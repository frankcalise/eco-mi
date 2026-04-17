# Audio Pops/Static Bug — Remediation Plan

> Produced by research subagent 2026-04-15. Audio is clean in `v1.0.1` tag — regression introduced by XState migration.

## Root Cause

After the XState migration, a 10-50ms async gap exists between machine state transition and `playSound`/`startContinuousSound` calls. This leaves previous oscillators in the audio graph where they interfere with new ones on the same frequency.

Three contributing factors:
1. **Oscillator overlap** — `fadeOutAndStop()` in `startContinuousSound` schedules a ~67ms fade. If called again while fading, two oscillators at the same frequency coexist and create phase interference (pop).
2. **Gain discontinuity** — 30ms `ATTACK_S` ramp is compressed to ~10 audio quanta at 48kHz. Per-quantum normalization amplifies the discontinuity.
3. **No per-frequency cleanup** — `scheduleNote` (sequence playback) creates oscillators without checking if one already exists at that frequency.

## Why previous fix failed

Commit 8d3b600 tried pre-scheduling all sequence notes at precise audio-clock offsets (`playSequenceTones`). Reverted in 27e4a4a because `react-native-audio-api` doesn't reliably handle gain automation scheduled far in the future — resulted in silence/glitches worse than the original pops.

## Phase 1 (Quick wins, low risk)

### Fix 1: silentDiscard in startContinuousSound
**File:** `src/hooks/useAudioTones.tsx`
Change `fadeOutAndStop(activeSoundRef.current, 0.02)` → `silentDiscard(activeSoundRef.current)`. Immediately hard-disconnects previous oscillator instead of scheduling a fade that overlaps with the new one.

### Fix 2: Increase ramp times
**File:** `src/hooks/useAudioTones.tsx`
- `ATTACK_S`: 0.03 → 0.05 (50ms, ~17 quanta instead of ~10)
- `RELEASE_S`: 0.05 → 0.1 (100ms)
Spreads gain changes across more quanta, reducing normalization artifacts.

### Fix 3: Context state validation
**File:** `src/hooks/useAudioTones.tsx`
After `ensureResumed()`, double-check `ctx.state === "running"`. If not, call `recreateContext()`. Defensive check for Android-specific resume timing.

## Phase 2 (If Phase 1 insufficient)

### Fix 4: Defer audio to React state settlement
**File:** `src/hooks/useGameEngine.ts`
Queue audio in a ref, play it in a `useEffect` keyed on `gameState`. Ensures React has fully committed the state update before any oscillator is created.

### Fix 5: Per-frequency oscillator cleanup pool
**File:** `src/hooks/useAudioTones.tsx`
Track active oscillators by frequency in a `Map<number, OscillatorNode[]>`. Before creating a new oscillator at a frequency, disconnect any existing ones. Prevents same-frequency phase interference.

## Testing

Test on Pixel 9 Pro (the device where pops were observed):
- Sequence playback at levels 5-15+ (all modes)
- Rapid color switching during waiting phase
- Consecutive same-color notes (seeded RNG)
- High-speed sequences at level 15+

## Diagnostic shortcut

```bash
git diff v1.0.1..develop -- src/hooks/useGameEngine.ts src/hooks/useAudioTones.tsx
```
This shows exactly what changed between the clean audio (v1.0.1) and the current state.
