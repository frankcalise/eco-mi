# Audio Tone Generation: Approach Comparison

## Current State

Eco Mi uses `react-native-audio-api` v0.8.2 (latest is v0.11.7 as of March 2026) with live `OscillatorNode` + `GainNode` chains. The existing `useAudioTones.tsx` already applies 30ms attack / 50ms release envelopes with `exponentialRampToValueAtTime` to suppress clicks, plus a master gain node to avoid per-quantum normalization spikes. Despite this, intermittent pop/click artifacts persist on Android, likely due to oscillator start/stop timing at the native layer rather than missing JS-side envelopes.

The package is actively maintained by Software Mansion (releases through 0.11.7, March 2026). GitHub issues show Android-specific problems (#809 recorder tone artifacts, #833 grey screen/freeze, #717 crash in clearOnEndedCallback, #671 crackling audio) but no dedicated "oscillator click/pop" issue -- suggesting the artifact may be a lower-level Android audio subsystem timing issue rather than a library bug.

---

## Approaches Evaluated

### 1. Current: Live Oscillators (react-native-audio-api)

**How it works:** Create `OscillatorNode` + `GainNode` per note, apply attack/release envelope, `start()`/`stop()` on the audio clock.

| Criterion | Rating |
|---|---|
| Latency | Excellent (<5ms, nodes created synchronously) |
| Android reliability | Fair -- clicks persist despite envelopes |
| Complexity | Already implemented (650 LOC) |
| Oscillator types | Native support (sine/square/sawtooth/triangle) |
| Continuous sounds | Excellent (start oscillator, stop on release) |
| Memory | Minimal (no buffers stored) |

**Root cause of clicks:** Even with JS-level envelopes, the native oscillator `start()`/`stop()` implementation on Android can introduce micro-discontinuities at the audio render quantum boundary. The Web Audio spec says start/stop should be sample-accurate, but react-native-audio-api's C++ implementation may have slight timing misalignment on some Android devices.

---

### 2. Pre-rendered AudioBuffer (recommended for fixed-duration sounds)

**How it works:** At startup, programmatically generate a `Float32Array` with the waveform samples for each tone (frequency x oscillator type x duration), wrap in an `AudioBuffer` via `ctx.createBuffer()`, then play via `AudioBufferSourceNode`.

**Confirmed available in react-native-audio-api:**
- `ctx.createBuffer(channels, length, sampleRate)` -- creates empty buffer
- `buffer.getChannelData(channel)` -- returns `Float32Array` to fill
- `buffer.copyToChannel(source, channel, offset)` -- alternative fill method
- `AudioBufferSourceNode` with `.buffer`, `.start(when, offset, duration)`
- Buffers are reusable -- only the source node is single-use (cheap to create)

**Waveform generation (pseudocode):**
```typescript
function generateToneBuffer(
  ctx: AudioContext,
  freq: number,
  duration: number,
  type: 'sine' | 'square' | 'sawtooth' | 'triangle',
  attackS = 0.03,
  releaseS = 0.05,
): AudioBuffer {
  const sr = ctx.sampleRate
  const len = Math.ceil(duration * sr)
  const buf = ctx.createBuffer(1, len, sr)
  const data = buf.getChannelData(0)

  for (let i = 0; i < len; i++) {
    const t = i / sr
    const phase = (2 * Math.PI * freq * t) % (2 * Math.PI)

    // Waveform
    let sample: number
    switch (type) {
      case 'sine':      sample = Math.sin(phase); break
      case 'square':    sample = Math.sin(phase) >= 0 ? 1 : -1; break
      case 'sawtooth':  sample = 2 * ((freq * t) % 1) - 1; break
      case 'triangle':  sample = 2 * Math.abs(2 * ((freq * t) % 1) - 1) - 1; break
    }

    // Envelope (baked into the buffer)
    let env = 1.0
    if (t < attackS) env = t / attackS
    if (t > duration - releaseS) env = (duration - t) / releaseS
    data[i] = sample * env * 0.25 // TARGET_GAIN
  }
  return buf
}
```

| Criterion | Rating |
|---|---|
| Latency | Excellent (<5ms, buffer already in memory) |
| Android reliability | Excellent -- no oscillator lifecycle, envelope baked in, zero discontinuity |
| Complexity | Moderate -- new buffer generation code, but replaces oscillator creation |
| Oscillator types | Full support (waveform math is straightforward) |
| Continuous sounds | Poor -- buffers have fixed duration, can't extend dynamically |
| Memory | Low (~35KB per tone at 44.1kHz mono, 0.2s duration; ~560KB for 4 freqs x 4 types) |

**Key advantage:** Completely eliminates oscillator start/stop timing as an artifact source. The waveform is a single contiguous buffer with envelope already applied -- playback is just reading samples sequentially.

---

### 3. OfflineAudioContext Pre-rendering

**How it works:** Use `OfflineAudioContext` (confirmed available in react-native-audio-api) to render oscillator output to an `AudioBuffer` offline, then play the buffer.

**Difference from approach 2:** Uses the library's own oscillator + gain math instead of manual `Float32Array` generation. More accurate to the actual oscillator sound, but requires async rendering at startup.

| Criterion | Rating |
|---|---|
| Latency | Excellent after initial render; startup cost ~50-200ms per tone |
| Android reliability | Same as approach 2 (plays as buffer) |
| Complexity | Moderate -- simpler waveform code (library does the math) |
| Oscillator types | Perfect fidelity (uses the library's native oscillator implementation) |
| Continuous sounds | Same limitation as approach 2 |
| Memory | Same as approach 2 |

**Trade-off vs approach 2:** Slightly slower startup (async rendering) but guaranteed identical sound to the current oscillators. If you switch to manual `Float32Array` generation, you need to verify the waveforms sound identical (especially sawtooth/triangle which have aliasing considerations).

---

### 4. expo-audio / expo-av with Pre-recorded WAV Files

**How it works:** Generate .wav files for each tone offline (build step or bundled assets), load via `expo-audio` `useAudioPlayer`, play on demand.

| Criterion | Rating |
|---|---|
| Latency | Poor to fair (~50-200ms even with preloading; expo-audio preload still has known issues, GitHub #42900) |
| Android reliability | Good (standard media player path, well-tested) |
| Complexity | High -- need to generate/bundle WAV files for every freq x type x duration combination |
| Oscillator types | Limited to pre-generated files (no runtime flexibility) |
| Continuous sounds | Very poor (no way to extend a file playback dynamically) |
| Memory | Moderate (WAV files larger than computed buffers due to headers, multiple durations needed) |

**Verdict:** Not suitable. Latency is too high for a game requiring <50ms response. Sound preloading in expo-audio is documented as not fully implemented. Also eliminates the runtime flexibility that makes sound packs work.

---

### 5. react-native-sound with Pre-recorded WAV Files

**How it works:** Similar to approach 4, but uses `react-native-sound` which has explicit preload support.

| Criterion | Rating |
|---|---|
| Latency | Fair (~20-80ms with preloading; better than expo-audio but still file I/O dependent) |
| Android reliability | Good (uses Android SoundPool under the hood, designed for short clips) |
| Complexity | High -- same asset generation/bundling burden |
| Oscillator types | Same limitation as approach 4 |
| Continuous sounds | Very poor |
| Memory | Same as approach 4 |

**Verdict:** Better latency than expo-audio due to SoundPool, but still worse than in-memory AudioBuffer. Adds a second native audio dependency alongside react-native-audio-api. Not recommended when the AudioBuffer approach stays within the same library.

---

### 6. Hybrid: AudioBuffer for Sequences + Live Oscillators for Input

**How it works:**
- **Sequence playback (computer plays pattern):** Use pre-rendered `AudioBuffer` for each tone. Duration is known in advance. All notes can be pre-scheduled on the audio clock. Zero oscillator lifecycle artifacts.
- **Player input (touch/hold):** Keep live `OscillatorNode` for continuous sounds where duration is unknown (player holds a button for variable time). The existing envelope code handles these well since the player controls when to release.

| Criterion | Rating |
|---|---|
| Latency | Excellent for both paths |
| Android reliability | Excellent for sequences (buffer), Fair for input (oscillator -- but shorter duration = fewer artifacts) |
| Complexity | Moderate -- two code paths, but each is simpler than the current unified approach |
| Oscillator types | Full support in both paths |
| Continuous sounds | Excellent (oscillator path handles this) |
| Memory | Same low footprint as approach 2 |

**Key insight:** The clicks are most noticeable during rapid sequence playback (multiple oscillators starting/stopping in quick succession). Player input sounds are single tones with natural human timing, making artifacts much less perceptible. This hybrid targets the fix where it matters most.

---

### 7. Tone.js or Higher-Level Libraries

**How it works:** Use Tone.js (or similar) as a wrapper over the audio API for better oscillator lifecycle management.

| Criterion | Rating |
|---|---|
| Latency | Unknown -- Tone.js does not officially support React Native |
| Android reliability | Unknown -- untested in production on RN |
| Complexity | Very high -- Tone.js assumes browser Web Audio API; react-native-audio-api has compatibility gaps |
| Oscillator types | Full support (Tone.js has excellent synth capabilities) |
| Continuous sounds | Excellent (Tone.js handles this well in browser) |
| Memory | Higher (Tone.js is a large library, ~150KB minified) |

**Verdict:** Not viable. Tone.js GitHub issues #293 and #294 confirm it does not work reliably with React Native. The compatibility layer in react-native-audio-api is close but not 100% -- missing APIs would cause runtime crashes. Risk is too high for a production app.

---

## Comparison Table

| Approach | Latency | Android Clicks | Complexity | Osc Types | Continuous | Memory |
|---|---|---|---|---|---|---|
| 1. Live oscillators (current) | <5ms | Intermittent clicks | Done | All 4 | Excellent | Minimal |
| 2. Pre-rendered AudioBuffer | <5ms | None | Moderate | All 4 | Poor | ~560KB |
| 3. OfflineAudioContext render | <5ms | None | Moderate | All 4 (native) | Poor | ~560KB |
| 4. expo-audio + WAVs | 50-200ms | None | High | Fixed set | Very poor | Higher |
| 5. react-native-sound + WAVs | 20-80ms | None | High | Fixed set | Very poor | Higher |
| **6. Hybrid (buffer + oscillator)** | **<5ms** | **None for sequences** | **Moderate** | **All 4** | **Excellent** | **~560KB** |
| 7. Tone.js | N/A | N/A | Very high | All 4 | N/A | ~150KB+ |

---

## Recommendation

**Implement approach 6 (Hybrid)** using approach 3 (OfflineAudioContext) for the buffer generation.

### Why

1. **Targets the actual problem.** Clicks happen during rapid sequence playback, not during player input. The hybrid fixes the high-impact path without sacrificing the low-latency continuous sound path.

2. **Stays within react-native-audio-api.** No new dependencies. Uses `AudioBuffer`, `AudioBufferSourceNode`, and `OfflineAudioContext` which are all already exported from the library.

3. **Preserves sound pack flexibility.** Different oscillator types are rendered at startup via `OfflineAudioContext`, which uses the library's native oscillator implementation -- guaranteeing identical sound to the current approach.

4. **Minimal memory cost.** ~560KB for 4 frequencies x 4 oscillator types at 0.5s duration. Negligible on mobile.

5. **Progressive implementation.** Can be done in phases:
   - Phase 1: Pre-render sequence tones as buffers, use in `playSound()` and `playSequenceTones()`. Keep live oscillators for `startContinuousSound()`.
   - Phase 2: Pre-render jingle/game-over/high-score note sequences as buffers too.
   - Phase 3: If oscillator clicks are still noticeable on player input, consider pre-rendering a longer buffer and stopping it early with a gain fade.

### Why OfflineAudioContext over manual Float32Array

- The library's oscillator implementation handles anti-aliasing (band-limiting) for square/sawtooth/triangle waves. Manual `Math.sin(phase) >= 0 ? 1 : -1` produces aliased square waves that sound different and harsher, especially at higher frequencies (415Hz+).
- OfflineAudioContext guarantees the pre-rendered buffer sounds identical to the current live oscillators.
- If OfflineAudioContext has issues on Android, fall back to manual Float32Array generation (approach 2) as a backup -- sine waves are identical either way, and the aliasing difference for other types is subtle at game frequencies.

### Also recommended: Upgrade react-native-audio-api

The project is on v0.8.2 but v0.11.7 is current. The 0.9-0.11 releases include breaking changes (context refactor, API renames) but also bug fixes that may address Android audio issues directly. Evaluate upgrading as a separate task.
