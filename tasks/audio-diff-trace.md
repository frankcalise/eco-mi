# Audio Diff Trace: v1.0.1 → develop

Scope: `src/hooks/useAudioTones.tsx` and `src/hooks/useGameEngine.ts`
Goal: Identify every timing and lifecycle change that could cause audio pops/static on tone onset, where the pop is color-specific and persistent once a channel starts popping.

---

## Summary of Findings (Most Likely First)

| # | Category | Location | Confidence | Mechanism |
|---|----------|----------|------------|-----------|
| 1 | TIMING | `useGameEngine.ts` — `handleButtonRelease` → advance path | **HIGH** | Inner delay cut from 600ms to 200ms; new `showSequence` call fires while previous `playSound` oscillator is still ramping down |
| 2 | TIMING | `useGameEngine.ts` — `showSequence` lost `setGameState("showing")` guard; audio scheduling now races an async React/XState render | **HIGH** | `send(SEQUENCE_DONE)` is async-React; old code set state synchronously before scheduling next audio path |
| 3 | STRUCTURAL/TIMING | `useAudioTones.tsx` — `playSequenceTones` added but **never called** by `showSequence` | **HIGH** | The explicit fix for pop-on-JS-callback is dead code; `showSequence` still drives each note via `playSound` inside a JS `setTimeout`, subject to jitter and overlapping envelopes |
| 4 | TIMING | `useGameEngine.ts` — `scoreRef` synced via `ctx.score` (XState, one render lag) instead of direct `useState` | **MEDIUM** | Async XState context propagation means `scoreRef.current` can be stale in timer callbacks that also trigger audio side-effects |
| 5 | TIMING | `useGameEngine.ts` — `continueGame` reads `ctx.sequence` and `ctx.level` **before** XState `setupContinue` action propagates | **MEDIUM** | Stale closure: `send(CONTINUE)` queues the context mutation; the `addTimeout` callback captures the pre-mutation context snapshot |
| 6 | TIMING | `useGameEngine.ts` — `handleButtonTouch` removed the no-op minimum-duration `addTimeout` | **LOW** | Guard was vestigial (no-op body) but its removal is harmless; not a pop source |
| 7 | LIFECYCLE | `useAudioTones.tsx` — `createFreshContext` now reads `readVolume()` on init (new) | **LOW** | Structurally correct; introduces an MMKV read on context creation but does not change oscillator lifecycle |
| 8 | STRUCTURAL | `useGameEngine.ts` — `soundEnabled` init changed from `useState(true)` to lazy `loadString` check | **LOW** | On first render the value correctly reflects persisted state; no race with audio init path |

---

## Detailed Analysis

---

### #1 — Advance inner delay cut from 600ms to 200ms (TIMING, HIGH)

**Before (v1.0.1):**
```
// handleButtonRelease — sequence-complete path
addTimeout(() => {
  // outer: 400ms after last correct input
  addTimeout(() => {
    showSequence(newSequence, newLevel)
  }, 600) // ← inner: 600ms before next showSequence
}, 400)
// Total: 1000ms from last correct input to first new flashButton/playSound call
```

**After (develop):**
```
addTimeout(() => {
  addTimeout(() => {
    send({ type: "ADVANCE_COMPLETE", newSequence: newSeq })
    showSequence(newSeq, ctx.level + 1)
  }, 200) // ← inner: 200ms
}, 400)
// Total: 600ms from last correct input to first new flashButton/playSound call
```

**Pop mechanism:**  
`playSound` calls `scheduleNote`, which calls `createSound` → `createOscillator` → `gain.exponentialRampToValueAtTime(TARGET_GAIN, now + ATTACK_S)`. At 600ms after the last correct input, the user's `stopContinuousSoundWithFade` has been running for at least 600ms (fadeDuration is 100–200ms), so the gain has long since reached near-zero and the oscillator has stopped. At 200ms, this is much tighter. If the user releases quickly and the sequence advance fires at 200ms, the previous tone's oscillator may not yet be fully cleaned up — its `setTimeout` for `disconnect()` fires `Math.ceil((fadeS + 0.05) * 1000)` ms after the fade call (≈150ms for a 100ms fade). The new oscillator is created and starts within that window on the **same frequency channel**. When two oscillators on the same frequency overlap even briefly, the audio engine sums their gain nodes through master, causing a transient level spike (pop).

**Color-persistence explanation:** Once a frequency channel's oscillator is in a half-disconnected state (stop scheduled but disconnect not yet called), any new oscillator on that frequency created within the overlap window starts with a non-zero background contribution. This compounds on each rapid press.

---

### #2 — `showSequence` lost synchronous `setGameState("showing")` guard; state change is now async (TIMING, HIGH)

**Before (v1.0.1):**
```typescript
function showSequence(seq: Color[], currentLevel: number) {
  setGameState("showing") // ← synchronous React setState batched in same render
  ...
  seq.forEach((color, index) => {
    addTimeout(() => {
      flashButton(color, flashDuration) // playSound called from timeout
```

**After (develop):**
```typescript
function showSequence(seq: Color[], currentLevel: number) {
  // NO immediate state guard — machine is in "starting" or "advancing"
  ...
  seq.forEach((color, index) => {
    addTimeout(() => {
      flashButton(color, flashDuration) // playSound still called from timeout
      if (index === seq.length - 1) {
        addTimeout(() => {
          send({ type: "SEQUENCE_DONE" }) // ← async XState transition
```

**Pop mechanism:**  
In v1.0.1, `setGameState("showing")` ensured that on the same React render cycle that queued the `addTimeout` callbacks, the component state already reflected `"showing"`. Any concurrent input handler would bail out immediately (`gameState !== "waiting"`). In develop, the machine is in `"starting"` or `"advancing"` state during `showSequence`, but `handleButtonTouch` now checks `state.value !== "waiting"` (correct), not `gameState`. This part is fine for input blocking.

The deeper issue: `send({ type: "SEQUENCE_DONE" })` at the end of sequence playback triggers `XState → React render → state.value = "waiting"` asynchronously. Between `SEQUENCE_DONE` being sent and the React re-render completing, `toPublicState` returns `"showing"` (since the internal state hasn't yet updated in the component). If `continueGame` or `startGame` is invoked in that window (e.g., from a rapid UI interaction), it calls `showSequence` again, scheduling a second wave of `addTimeout`/`playSound` calls while the first wave's oscillators are mid-lifecycle. Two oscillators on the same frequency, both running `exponentialRampToValueAtTime`, sum at the destination — the discontinuity in the combined envelope produces a pop.

---

### #3 — `playSequenceTones` is added to `useAudioTones` but never called in `useGameEngine.ts` (STRUCTURAL/TIMING, HIGH)

**Before (v1.0.1):**  
`playSequenceTones` did not exist. Sequence notes were scheduled one-by-one via `playSound` inside `addTimeout` callbacks (JS clock).

**After (develop):**  
`playSequenceTones` was added to `useAudioTones` with the explicit goal of pre-scheduling all sequence tones against the audio clock in a single synchronous pass — eliminating JS-timer jitter. The function is exported and mocked in tests. However, it is **never imported or called** in `useGameEngine.ts`. `showSequence` still calls `flashButton(color, flashDuration)` which calls `playSound` from inside a `setTimeout`. Each `playSound` call does:

```typescript
scheduleNote(ctx, master, frequency, oscillatorType, ctx.currentTime, durationS, TARGET_GAIN)
```

At the moment the JS timer fires, `ctx.currentTime` is the Web Audio API's current clock position. Any JS event-loop jitter (GC pause, RN bridge congestion, Hermes microtask scheduling) shifts `ctx.currentTime` forward at callback time. The `gain.exponentialRampToValueAtTime` ramp is then scheduled to start from a later `now`, meaning the oscillator may have already been running at `EPSILON` gain for several milliseconds before the ramp begins — when the ramp starts it jumps from `EPSILON` to the beginning of the exponential curve, which is audible as a click.

**Why color-specific:** The JS-jitter pattern is non-uniform — some timer callbacks fire with more delay than others. Once a particular color's callback fires with enough jitter that the oscillator's start-time is significantly ahead of the scheduled ramp start, that frequency channel consistently pops. The bias is per-color because button colors fire at predictable positions in the sequence (index 1, 2, 3...) and later-index timeouts accumulate more scheduling drift.

**The fix is present in the codebase but disconnected.** `showSequence` needs to be rewritten to call `playSequenceTones` once with the full color array, and the visual flash timing should be decoupled from the audio scheduling.

---

### #4 — `scoreRef` synced via XState `ctx.score` (one render lag) instead of direct `useState` (TIMING, MEDIUM)

**Before (v1.0.1):**
```typescript
const [score, setScore] = useState(0)
useEffect(() => { scoreRef.current = score }, [score])
// score updated via setScore() — same render cycle
```

**After (develop):**
```typescript
useEffect(() => { scoreRef.current = ctx.score }, [ctx.score])
// ctx.score updated via XState assign action — propagates on next render
```

**Pop mechanism:**  
`scoreRef` is read inside `handleGameOverSideEffects()`, which is called from the timer interval callback (a `setInterval` closure over `scoreRef`). If `handleGameOverSideEffects` runs immediately after `send({ type: "TIMER_EXPIRED" })`, and the XState `markGameOver` action hasn't yet propagated its context update to `ctx.score`, `scoreRef.current` holds the previous value. This path doesn't directly cause audio pops, but `handleGameOverSideEffects` calls are interleaved with the `stopTimer` → `clearAllTimeouts` path. If `clearAllTimeouts` fires while a `playSound` oscillator is mid-ramp, its `setTimeout` disconnect callback may be in the cleared set — the oscillator is left connected forever (gain ramps to near-zero but the node is never disconnected/stopped), contributing a DC offset or residual noise on that frequency channel. This compounds over multiple game-overs.

---

### #5 — `continueGame` reads stale `ctx.sequence` / `ctx.level` before XState `setupContinue` action propagates (TIMING, MEDIUM)

**Before (v1.0.1):**
```typescript
function continueGame() {
  ...
  addTimeout(() => {
    showSequence(sequence, level) // local React state — already updated synchronously
  }, 500)
}
```

**After (develop):**
```typescript
function continueGame() {
  ...
  send({ type: "CONTINUE" }) // queues setupContinue action in XState
  addTimeout(() => {
    showSequence(ctx.sequence, ctx.level) // ← ctx captured at call time, before XState re-renders
    send({ type: "SET_INITIAL_SEQUENCE", sequence: ctx.sequence })
  }, 500)
}
```

**Pop mechanism:**  
`send({ type: "CONTINUE" })` triggers XState's `setupContinue` action which sets `continuedThisGame: true`, `isNewHighScore: false`, `playerSequence: []`. It does **not** change `sequence` or `level`, so `ctx.sequence` and `ctx.level` in the closure are correct in practice. However, the machine transitions from `gameover → starting`. The `addTimeout` closure at 500ms then calls `showSequence(ctx.sequence, ctx.level)` followed by `send({ type: "SET_INITIAL_SEQUENCE", sequence: ctx.sequence })`. The machine expects to be in `starting` to accept `SET_INITIAL_SEQUENCE`. If any concurrent event (e.g., rapid double-tap on "Continue") fires a second `send(CONTINUE)` in the 500ms window, the machine transitions again and the first `addTimeout`'s `showSequence` call fires while the machine is already in `showing` (from the second continue's `SET_INITIAL_SEQUENCE`). Two waves of `playSound` calls on overlapping audio clocks → pops.

---

### #6 — `handleButtonTouch` removed the minimum-duration no-op `addTimeout` (TIMING, LOW)

**Before (v1.0.1):**
```typescript
addTimeout(() => {
  // Ensures minimum duration — cleared on release if held longer
}, toneDuration)
```

**After (develop):**  
Removed entirely.

**Pop mechanism:**  
This was a no-op (empty callback body). Its presence kept the `timeoutsRef` set non-empty during the button press, which had the side-effect of preventing `clearAllTimeouts` from appearing to complete while a press was in flight. Its removal is benign from an audio perspective. **Not a pop source.**

---

### #7 — `createFreshContext` now calls `readVolume()` on init (LIFECYCLE, LOW)

**Before (v1.0.1):**
```typescript
master.gain.setValueAtTime(1.0, ctx.currentTime)
```

**After (develop):**
```typescript
master.gain.setValueAtTime(readVolume(), ctx.currentTime)
```

**Pop mechanism:**  
`readVolume()` reads from MMKV synchronously. If volume is 1.0 (default), behavior is identical. If volume is < 1.0, the master gain is now set correctly at init time rather than always starting at 1.0. This is a correctness fix, not a pop source. The `setValueAtTime` call is still at `ctx.currentTime` with the context newly created — no oscillators exist yet so no discontinuity is possible.

---

### #8 — `soundEnabled` initialization changed from `useState(true)` to lazy `loadString` check (STRUCTURAL, LOW)

**Before (v1.0.1):**
```typescript
const [soundEnabled, setSoundEnabled] = useState(true)
```

**After (develop):**
```typescript
const [soundEnabled, setSoundEnabled] = useState(
  () => loadString(SETTINGS_SOUND_ENABLED) !== "false",
)
```

**Pop mechanism:**  
On first mount, v1.0.1 always passed `soundEnabled = true` to `useAudioTones`. Develop reads persisted state. Both evaluate before the first render. No async race. Not a pop source.

---

## Root Cause Assessment

There are two independent root causes that interact:

**Root Cause A (Primary): `playSequenceTones` is wired up in `useAudioTones` but never called from `showSequence`.**  
The explicit architectural fix for JS-callback jitter pops exists in the codebase but is disconnected. `showSequence` continues to fire individual `playSound` calls from `setTimeout` callbacks, meaning every sequence tone onset is subject to JS event-loop jitter. The `scheduleNote` function uses `ctx.currentTime` at callback-fire time, so any delay in the JS timer (GC, bridge congestion) shifts the audio scheduling window forward. The oscillator runs at `EPSILON` gain for those extra milliseconds before the ramp fires — the ramp start is then a discontinuity. This is the mechanism that makes pops color-specific: later-index tones in the sequence accumulate more scheduling drift, and once a particular color fires at a jitter-heavy moment, the per-oscillator gain ramp becomes miscalibrated for that frequency.

**Root Cause B (Secondary): Advance delay cut from 600ms to 200ms reduces the oscillator cleanup window.**  
At 200ms, the `fadeOutAndStop` disconnect `setTimeout` (≈150ms after a 100ms fade) may not have fired before the next `createSound` on the same frequency. The two oscillators' gain nodes briefly overlap in the audio graph, producing a transient level spike at the destination.

**Why it's color-specific and persistent:** A frequency channel that has experienced root cause B (overlapping oscillators) will have a partially-disconnected node with a gain that settled to near-zero but whose `disconnect()` hasn't been called yet. When root cause A fires a new oscillator on the same frequency, the summed output of both nodes exceeds `TARGET_GAIN`, causing a pop. This leaves the channel in a state where it consistently pops on subsequent notes because the misaligned scheduling (root cause A jitter) keeps re-triggering the overlap window.

---

## Recommended Fix Order

1. **Wire `playSequenceTones` into `showSequence`** — rewrite `showSequence` to call `playSequenceTones(seq, interval, flashDuration)` once, and decouple the visual `setActiveButton` flashing from the audio scheduling. This removes JS-jitter from tone onset entirely.

2. **Restore the 600ms advance inner delay OR increase the fade duration** — either restore 600ms (matches v1.0.1) or increase `stopContinuousSoundWithFade` fade to 300ms to ensure disconnect fires well before the next note on the same frequency.

3. **Audit `continueGame` for double-invoke guard** — add a ref-based lock to prevent `showSequence` being called twice during the 500ms window.
