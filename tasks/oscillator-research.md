# Web Audio API Oscillator Research

> Focused on click-free tone generation for a React Native game using `react-native-audio-api`.
> Four fixed frequencies: 220Hz, 277Hz, 330Hz, 415Hz. Tones last 300-600ms (sequence) or held indefinitely (player input).

---

## 1. Click-Free Oscillator Start/Stop

### Why clicks happen

A click is a broadband impulse caused by a discontinuity in the audio waveform. The three common sources:

1. **Start discontinuity** -- `oscillator.start()` begins output at a non-zero sample while the gain is already non-zero. The destination bus jumps from 0 to the oscillator's instantaneous amplitude in one sample.
2. **Stop discontinuity** -- `oscillator.stop()` or `gain.disconnect()` is called while the waveform is at a non-zero value. The signal drops to zero in one sample.
3. **Parameter jump** -- `gain.value = 0` or `setValueAtTime(0, now)` is applied immediately, creating a step function in the gain curve within a single render quantum.

### Best practice: gain-gated start

```ts
const now = ctx.currentTime
const osc = ctx.createOscillator()
const env = ctx.createGain()

// Start gain at zero -- oscillator output is silenced
env.gain.setValueAtTime(0, now)

// Ramp to target over attack period
env.gain.linearRampToValueAtTime(TARGET_GAIN, now + ATTACK_S)

osc.connect(env)
env.connect(destination)
osc.start(now)
```

Key points:
- The gain node is at zero **before** the oscillator starts, so the first non-zero oscillator sample is multiplied by ~0.
- `linearRampToValueAtTime` is preferred over `exponentialRampToValueAtTime` for the attack. Exponential ramps cannot start from exactly zero (they use `startValue * pow(endValue/startValue, t)`, which is undefined at zero). Using EPSILON (e.g., 0.001) as the start value creates a ratio that may produce audible gain jumps in the first few samples, especially at short attack times.

### Best practice: gain-gated stop

```ts
const now = ctx.currentTime
const RELEASE_S = 0.06 // 60ms release

// Ramp gain to zero
env.gain.linearRampToValueAtTime(0, now + RELEASE_S)

// Schedule stop AFTER gain reaches zero (with small margin)
osc.stop(now + RELEASE_S + 0.02)

// Disconnect after the oscillator has actually stopped
setTimeout(() => {
  try { osc.disconnect() } catch {}
  try { env.disconnect() } catch {}
}, (RELEASE_S + 0.05) * 1000)
```

Key points:
- The `osc.stop()` time must be **after** the gain ramp completes. If the oscillator stops while gain is still above zero, the output drops to zero instantaneously = click.
- The 20ms margin (`+ 0.02`) accounts for render quantum boundary alignment. The stop is processed at the start of the quantum containing the stop time, so a quantum's worth of extra silence prevents edge cases.
- Disconnect must happen **after** stop. Disconnecting a running oscillator from the graph causes the audio engine to drop its output from the mix immediately, even if the gain is in mid-ramp. The `setTimeout` with a margin ensures the node has fully stopped before disconnection.
- Never call `disconnect()` synchronously after scheduling a stop -- the stop hasn't executed yet.

### Why disconnecting too early causes clicks

In the Web Audio API (and `react-native-audio-api`), `disconnect()` is processed in the node manager's pre-process pass at the start of the next render quantum. If you disconnect a node that still has non-zero output:

1. The current quantum finishes rendering with the node's output in the mix.
2. The next quantum begins with the node removed from the graph.
3. The destination bus goes from "oscillator signal present" to "no signal" in one quantum boundary = a step discontinuity.

This is especially problematic in `react-native-audio-api` because `AudioNode::onInputDisconnected` immediately marks the node as having one fewer enabled input, which can cascade to `disable()` calls that zero the bus.

### Optimal attack/release times for game SFX

For short game tones (not music), the envelope should be as short as possible while remaining click-free:

| Parameter | Minimum safe | Recommended | Maximum useful |
|-----------|-------------|-------------|----------------|
| Attack    | 5ms (at 48kHz = ~7 quanta) | 10-20ms | 50ms (sounds "soft") |
| Release   | 10ms | 20-60ms | 100ms (sounds "lingering") |

The minimum safe values assume `linearRampToValueAtTime`. With `exponentialRampToValueAtTime`, double the minimums because the exponential curve spends more time near the start value before accelerating.

For this game specifically:
- **Sequence playback** (300-600ms tones): 15ms attack, 30ms release. Short enough to sound snappy, long enough for clean transitions.
- **Player input** (held tones): 10ms attack (responsive feel), 50ms release (smooth finger-lift).

---

## 2. Oscillator Pooling vs. Create-Per-Note

### Approach A: Create new oscillator per note

```
[press] -> createOscillator() + createGain() -> ramp up -> play -> ramp down -> stop() -> disconnect()
[press] -> createOscillator() + createGain() -> ramp up -> play -> ...
```

**Pros:**
- Simple lifecycle: each note is self-contained
- No frequency switching artifacts
- No risk of stale automation state on gain params
- Automatic cleanup: stopped oscillators are eventually GC'd

**Cons:**
- Node creation has overhead (C++ object allocation, JSI bridge crossing)
- On `react-native-audio-api`, each `createOscillator()` + `createGain()` call crosses the JSI bridge and allocates C++ objects including `AudioBus` with `RENDER_QUANTUM_SIZE` buffers
- Risk of node accumulation if disconnect/cleanup is sloppy
- The current implementation tracks `nodeCountRef` but relies on the engine's GC -- no explicit pool management

### Approach B: Always-running oscillators with gain gating

```
[init] -> create 4 oscillators (220, 277, 330, 415) at gain=0 -> start all
[press red]   -> ramp oscillator[220].gain up
[release red] -> ramp oscillator[220].gain down to 0
[press blue]  -> ramp oscillator[277].gain up
...
```

**Pros:**
- Zero node creation latency at play time -- instant response
- No JSI bridge crossing during gameplay
- Exactly 4 oscillators + 4 gain nodes + 1 master gain = 9 nodes total, forever
- No node accumulation / GC pressure
- Phase is continuous -- no phase discontinuity between plays of the same frequency
- Trivially enforces "one note per frequency" (section 4)

**Cons:**
- Always-running oscillators consume CPU even when silent (gain=0). However, the GainNode in `react-native-audio-api` multiplies sample-by-sample (`dsp::multiply`), so a zero gain still processes the oscillator output. The CPU cost is ~4 oscillator renders per quantum regardless.
- Must handle oscillator type changes (sound pack switching) by rebuilding the pool
- If an oscillator dies (AudioContext recreation), all 4 must be rebuilt together

### Recommendation for this game

**Use Approach B (always-running oscillators with gain gating).** The case is strong:

1. Only 4 fixed frequencies -- the pool is tiny and static.
2. Response latency matters -- player input must feel instant. Creating oscillators on `startContinuousSound` crosses JSI and allocates memory, adding variable latency.
3. Node accumulation is eliminated -- no need to track node counts or worry about GC.
4. Same-frequency overlap is impossible -- each frequency has exactly one oscillator, one gain node.
5. CPU cost of 4 idle oscillators at gain=0 is negligible compared to the cost of creating/destroying nodes per note.

Implementation sketch:

```ts
interface TonePool {
  oscillators: Map<number, OscillatorNode>  // freq -> osc
  gains: Map<number, GainNode>              // freq -> gain envelope
}

function initPool(ctx: AudioContext, master: GainNode, type: OscillatorType): TonePool {
  const pool: TonePool = { oscillators: new Map(), gains: new Map() }
  for (const freq of [220, 277, 330, 415]) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    gain.gain.setValueAtTime(0, ctx.currentTime) // start silent
    osc.connect(gain)
    gain.connect(master)
    osc.start(ctx.currentTime)
    pool.oscillators.set(freq, osc)
    pool.gains.set(freq, gain)
  }
  return pool
}

function noteOn(pool: TonePool, freq: number, ctx: AudioContext) {
  const gain = pool.gains.get(freq)
  if (!gain) return
  const now = ctx.currentTime
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(gain.gain.value, now) // anchor current value
  gain.gain.linearRampToValueAtTime(TARGET_GAIN, now + ATTACK_S)
}

function noteOff(pool: TonePool, freq: number, ctx: AudioContext) {
  const gain = pool.gains.get(freq)
  if (!gain) return
  const now = ctx.currentTime
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(gain.gain.value, now) // anchor current value
  gain.gain.linearRampToValueAtTime(0, now + RELEASE_S)
}
```

For **sequence playback**, the same pool works. Pre-schedule gain ramps at audio-clock-precise times:

```ts
function scheduleSequence(pool: TonePool, colors: Color[], ctx: AudioContext, intervalS: number, durationS: number) {
  const now = ctx.currentTime
  colors.forEach((color, i) => {
    const freq = colorMap[color].sound
    const gain = pool.gains.get(freq)!
    const noteStart = now + (i + 1) * intervalS
    const noteEnd = noteStart + durationS

    // Attack
    gain.gain.setValueAtTime(0, noteStart)
    gain.gain.linearRampToValueAtTime(TARGET_GAIN, noteStart + ATTACK_S)
    // Sustain is implicit (gain stays at TARGET_GAIN)
    // Release
    gain.gain.linearRampToValueAtTime(0, noteEnd)
  })
}
```

**Caveat:** When two notes of the same frequency are adjacent in a sequence, the gain automation events must not overlap. If note N ends at time T and note N+1 starts at time T+0.001, the release ramp of N and the attack ramp of N+1 would conflict. Solution: check for same-frequency adjacency and either skip the release/attack pair (sustain through) or ensure the gap is at least `RELEASE_S + ATTACK_S`.

---

## 3. Per-Quantum Normalization

### What it is

`react-native-audio-api` applies per-quantum normalization in `AudioDestinationNode::renderAudio()`:

```cpp
void AudioDestinationNode::renderAudio(const std::shared_ptr<AudioBus> &destinationBus, int numFrames) {
  // ... process graph ...
  destinationBus->normalize();  // <-- THIS
  currentSampleFrame_ += numFrames;
}
```

The `normalize()` function:
```cpp
void AudioBus::normalize() {
  float maxAbsValue = this->maxAbsValue();
  if (maxAbsValue == 0.0f || maxAbsValue == 1.0f) return;
  float scale = 1.0f / maxAbsValue;
  this->scale(scale);
}
```

And critically, `maxAbsValue()` returns at minimum 1.0:
```cpp
float AudioBus::maxAbsValue() const {
  float maxAbsValue = 1.0f;  // <-- floor of 1.0
  for (const auto &channel : channels_) {
    float channelMaxAbsValue = channel->getMaxAbsValue();
    maxAbsValue = std::max(maxAbsValue, channelMaxAbsValue);
  }
  return maxAbsValue;
}
```

**This is NOT standard Web Audio API behavior.** The W3C spec does not normalize the destination bus. This is a `react-native-audio-api`-specific behavior, likely added as a limiter to prevent clipping.

### How it affects gain ramps

The normalization only activates when `maxAbsValue > 1.0`. For signals below 1.0, the function returns early (because the floor is 1.0). This means:

- **If your peak gain * oscillator peak <= 1.0:** No normalization occurs. The signal passes through untouched. A sine wave at gain 0.25 has peak amplitude 0.25 -- no normalization.
- **If your peak gain * oscillator peak > 1.0:** The entire 128-sample quantum is scaled by `1.0 / maxAbsValue`. This affects ALL samples in the quantum, including those that were below 1.0.

The artifact: when a gain ramp crosses 1.0 during a quantum, the normalizer activates for that quantum but not the next (where gain is back below 1.0). This creates a discontinuity at the quantum boundary.

**For this game at `TARGET_GAIN = 0.25`:** Normalization should never activate for a single oscillator (sine peak = 0.25). However, with 4 concurrent oscillators at 0.25 each, the summed signal can theoretically reach 1.0 (or slightly above due to constructive interference). In practice, the four frequencies are inharmonic, so sustained peaks above 1.0 are rare but possible.

### Recommended minimum ramp durations

The render quantum is 128 samples. At common sample rates:

| Sample Rate | Quantum Duration | Quanta per 10ms | Quanta per 30ms | Quanta per 50ms |
|------------|-----------------|-----------------|-----------------|-----------------|
| 44,100 Hz  | 2.90ms          | ~3.4            | ~10.3           | ~17.2           |
| 48,000 Hz  | 2.67ms          | ~3.75           | ~11.25          | ~18.75          |

For smooth gain ramps:
- **Minimum 3 quanta** (~8ms at 48kHz) to avoid the ramp being compressed into fewer than 3 steps. Below this, the ramp is essentially a step function and the normalizer may amplify the discontinuity.
- **Recommended 5+ quanta** (~13ms at 48kHz) for ramps that cross significant gain ranges (e.g., 0 to 0.25).
- **For release ramps** (where the signal envelope is shrinking), the normalizer is less of a concern because `maxAbsValue` is decreasing. But the perceptual smoothness still benefits from 5+ quanta.

### Practical mitigation

1. Keep `TARGET_GAIN` at or below 0.25. With 4 oscillators, worst-case sum is 1.0, right at the normalization threshold.
2. Use `linearRampToValueAtTime` instead of `exponentialRampToValueAtTime`. Linear ramps distribute the gain change evenly across samples, so each quantum sees a roughly equal gain delta. Exponential ramps concentrate most of the change in the final quanta, creating a larger per-quantum delta near the target.
3. If you must use exponential ramps, use a larger EPSILON (0.01 instead of 0.001) to reduce the ratio, which flattens the exponential curve.

---

## 4. Concurrent Oscillator Management

### Same-frequency overlap problems

When two oscillators run at the same frequency simultaneously:

1. **Constructive interference:** If they're in phase, the amplitudes add. Two sine waves at 220Hz and gain 0.25, in phase = effective amplitude 0.50. Potentially triggers normalization.
2. **Destructive interference:** If they're 180 degrees out of phase, they cancel. The output drops to near-zero, then snaps back when one stops = loud click.
3. **Phase beating:** If they're at slightly different phases (which is almost always the case since phase depends on start time), you get amplitude modulation at the beat frequency. For two oscillators at exactly 220Hz, the beat frequency is 0Hz, so the interference pattern is static -- but the amplitude depends on the phase offset at start time, which is unpredictable.

### Why this matters for this game

The current `startContinuousSound` implementation does this:
```ts
if (activeSoundRef.current) {
  fadeOutAndStop(activeSoundRef.current, 0.02)  // 20ms fade
  activeSoundRef.current = null
}
const sound = createSound(frequency)  // new oscillator starts immediately
```

During the 20ms fade-out of the old oscillator, both the old and new oscillators at the same frequency are in the audio graph. The phase difference between them is random, so the interference is unpredictable. This is the primary source of pops on rapid re-presses of the same color.

### Best practice: one note per frequency

**With the pool approach (section 2), this problem is eliminated.** Each frequency has exactly one oscillator. Re-pressing the same color just modifies the gain envelope of the existing oscillator -- no new oscillator is created, no overlap.

If using create-per-note (approach A), enforce one-per-frequency with a Map:

```ts
const activeByFreq = new Map<number, ActiveSound>()

function startNote(freq: number) {
  const existing = activeByFreq.get(freq)
  if (existing) {
    // Hard-kill the previous one (silentDiscard, not fade)
    // to avoid overlap. The click from hard-kill is less audible
    // than the beating from overlap.
    silentDiscard(existing)
  }
  const sound = createSound(freq)
  activeByFreq.set(freq, sound)
}
```

Even with hard-kill, there may be a 1-sample discontinuity. The pool approach avoids this entirely.

### Sequence playback: same-frequency adjacent notes

When the game sequence contains `[red, red, blue, red]`, the two red notes at 220Hz overlap if not handled:

```
Note 1: |--attack--|---sustain---|--release--|
Note 2:                    |--attack--|---sustain---|--release--|
                           ^ overlap zone: two oscillators at 220Hz
```

With the pool approach, this becomes a gain automation concern rather than an oscillator overlap concern. The gain for freq 220 would look like:

```
Time:  ---|ramp up|--hold--|ramp down|--gap--|ramp up|--hold--|ramp down|---
Gain:  0   0->0.25  0.25   0.25->0    0      0->0.25  0.25   0.25->0    0
```

If the gap between notes is shorter than `RELEASE_S + ATTACK_S`, the gain won't fully reach zero before ramping back up. Two solutions:

1. **Sustain through:** Detect same-frequency adjacency and skip the release/attack. Just hold the gain at `TARGET_GAIN`.
2. **Shorten the envelope:** Use a faster release (5ms) for same-frequency adjacent notes, with a micro-gap of silence (2-3ms) before the next attack. This preserves the "two separate notes" feel.

---

## 5. AudioContext Lifecycle

### Resume/suspend timing

`react-native-audio-api`'s `AudioContext.resume()` returns `Promise<boolean>`, but the underlying C++ implementation may not be truly async -- it may flip internal state synchronously while the audio thread catches up. Key issues:

1. **Resume is not instant on iOS.** After `ctx.suspend()`, calling `ctx.resume()` may take 1-2 render quanta (~5ms) before the audio thread actually starts processing again. Nodes created during this gap will have their first output dropped.
2. **State getter may be stale.** `ctx.state` is read from the JS-side cache and may not reflect the audio thread's actual state. The current code checks `ctx.state === "suspended"` after resume and treats it as failure -- this is correct defensive behavior.

### When is it safe to create nodes after resume?

Strictly speaking, nodes can be created at any time -- they're JS/C++ objects that get added to the graph. The issue is whether their **output** will be processed:

- **Safe immediately:** Creating nodes, connecting them, scheduling automation events. These are all queued operations processed by `AudioNodeManager::preProcessGraph()`.
- **Not safe immediately:** Expecting the first render quantum to contain the scheduled output. After resume, allow 1 quantum (~3ms) before scheduling time-critical events.

Practical approach:

```ts
function ensureRunningThenPlay(freq: number) {
  if (ctx.state !== 'running') {
    ctx.resume()
    // Add a small offset to the scheduled start time
    const safeStart = ctx.currentTime + 0.005 // 5ms safety margin
    gain.gain.setValueAtTime(0, safeStart)
    gain.gain.linearRampToValueAtTime(TARGET_GAIN, safeStart + ATTACK_S)
  } else {
    // Context is running, schedule immediately
    const now = ctx.currentTime
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(TARGET_GAIN, now + ATTACK_S)
  }
}
```

### Mobile-specific gotchas

**iOS:**
- When the app goes to background, iOS suspends the audio session. `ctx.suspend()` is the correct response. On return to foreground, `ctx.resume()` reactivates the session.
- After prolonged backgrounding (30+ seconds), the audio session may be reclaimed by the OS. `resume()` succeeds (returns true) but the context stays suspended internally. The current `recreateContext()` fallback handles this correctly.
- Audio interruptions (phone call, Siri) suspend the audio session without calling `AppState` change. Consider listening for `AVAudioSession` interruption notifications via a native module, or defensively checking `ctx.state` before every sound.

**Android:**
- Android's audio focus model is different. The audio thread continues running in the background unless explicitly suspended. However, some OEMs aggressively kill background audio.
- `resume()` after a long background period may fail silently on some Android devices (Pixel, Samsung). The context reports "running" but produces no output. The only reliable fix is `recreateContext()`.
- **Sample rate mismatch:** Some Android devices report a preferred sample rate of 48000Hz but actually run the HAL at 44100Hz. This can cause subtle timing issues with scheduled automation. Using `AudioManager.getDevicePreferredSampleRate()` (as the current code does) is correct.

### Auto-suspend strategy

The current 3-second auto-suspend timer is a good pattern. Refinements:

1. **Don't suspend if the pool is running.** With always-running oscillators, the context must stay running. Instead of suspending, you could mute the master gain. But 4 oscillators at gain=0 drawing negligible CPU may not warrant the complexity.
2. **On resume, re-validate the pool.** After context recreation, the old oscillator pool is invalid. The pool must be rebuilt.
3. **Debounce resume.** If the user rapidly backgrounds/foregrounds the app, avoid resume/suspend thrashing by adding a 100ms debounce to the AppState listener.

---

## 6. Recommendations Summary

Specific to this game (4 fixed frequencies, `react-native-audio-api`, per-quantum normalization):

### Architecture

1. **Switch to always-running oscillator pool.** Create 4 oscillators + 4 gain nodes at init. Control notes by ramping gain up/down. Never create or stop oscillators during gameplay.

2. **Use `linearRampToValueAtTime` instead of `exponentialRampToValueAtTime`.** Linear ramps:
   - Can start from exactly 0 (no EPSILON needed)
   - Distribute gain change evenly across quanta (no normalization spikes)
   - Are simpler to reason about for scheduling

3. **Use `cancelScheduledValues` + `setValueAtTime` + `linearRampToValueAtTime` for re-triggers.** When a note is re-triggered before the release completes:
   ```ts
   gain.gain.cancelScheduledValues(now)
   gain.gain.setValueAtTime(gain.gain.value, now)  // anchor from current interpolated value
   gain.gain.linearRampToValueAtTime(TARGET_GAIN, now + ATTACK_S)
   ```
   This cleanly transitions from any in-progress automation to the new ramp.

### Envelope parameters

4. **Attack:** 15ms for sequence playback, 10ms for player input.
5. **Release:** 30ms for sequence playback, 50ms for player input.
6. **TARGET_GAIN:** Keep at 0.25 or lower. This keeps 4 concurrent oscillators at or below 1.0 sum, avoiding per-quantum normalization.

### Context lifecycle

7. **Keep the context running during gameplay.** With a pool of always-running oscillators, the context must be running. Suspend only when leaving the game screen entirely.
8. **Rebuild the pool on context recreation.** If `recreateContext()` is called, rebuild all 4 oscillators.
9. **Add a 5ms safety margin** after `resume()` before scheduling time-critical gain ramps.

### linearRamp vs exponentialRamp vs setTargetAtTime

| Method | Zero-safe | Predictable timing | Normalization-friendly | Interruptible |
|--------|-----------|--------------------|-----------------------|---------------|
| `linearRampToValueAtTime` | Yes (can start/end at 0) | Yes (exact end time) | Yes (uniform per-quantum delta) | Needs `cancelScheduledValues` first |
| `exponentialRampToValueAtTime` | No (needs EPSILON) | Yes (exact end time) | No (concentrated change at end) | Needs `cancelScheduledValues` first |
| `setTargetAtTime` | Yes (asymptotic to target) | No (never exactly reaches target) | Moderate (exponential decay) | Automatically takes over from current value |

For this game, `linearRampToValueAtTime` is the best choice for all envelopes. `setTargetAtTime` is acceptable for release-only scenarios where the exact end time doesn't matter (e.g., the current `fadeOutAndStop`), but with the pool approach there's no stop to coordinate, so linear ramps are cleaner.

### What NOT to do

- Do not use `gain.value = X` for envelope control. It's a step function processed at the start of the next quantum = click.
- Do not call `oscillator.stop()` without first ramping gain to zero. The oscillator's output is zeroed mid-quantum = click.
- Do not call `disconnect()` on a node that's still producing non-zero output. The graph removes it at the next quantum boundary = click.
- Do not schedule `exponentialRampToValueAtTime` with a start value of exactly 0. The C++ implementation computes `0 * pow(end/0, t)` = NaN/Infinity.
- Do not create a new oscillator at the same frequency while another is still fading out. Phase interference = unpredictable amplitude = potential normalization spike.
