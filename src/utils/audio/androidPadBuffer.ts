/**
 * Android buffer utilities retained for sequence playback and comparison
 * experiments. Gameplay pads now use the cross-platform always-running
 * oscillator pool in `padOscPool.ts`, so rapid taps do not create or tear
 * down nodes on the hot path.
 *
 * iOS does not use this module — it goes through `padOscPool` instead.
 * See docs/AUDIO-ARCHITECTURE.md.
 */
import type { AudioBuffer, AudioContext } from "react-native-audio-api"
import type { OscillatorType } from "react-native-audio-api"

// --- Legacy per-press voice timing (Android experiments) -------------------

/**
 * Wait this long after the gain ramp completes before tearing down the
 * source/gain nodes — guards against trimming the audible tail.
 */
export const PAD_POST_RELEASE_DISCONNECT_MS = 120

/**
 * After disconnecting an orphaned source, defer `source.stop()` by this
 * margin so the engine has settled before we touch the node again.
 */
export const PAD_ORPHAN_SOURCE_STOP_MS = 400

/**
 * Fast linear release used when the same pad is retriggered while still
 * sustaining — we ramp the orphaned voice down quickly to avoid a beat
 * with the new voice ramping up.
 */
export const PAD_RETRIGGER_RELEASE_S = 0.01

export const PAD_RETRIGGER_DISCONNECT_MS = Math.ceil(PAD_RETRIGGER_RELEASE_S * 1000) + 80

/**
 * Tighter window on Android: the engine reliably honours `disconnect()`
 * faster than iOS used to, so we don't need the +80ms cushion.
 */
export const PAD_RETRIGGER_DISCONNECT_MS_ANDROID = 48

// --- Attack lookahead (legacy Android buffer-pad experiments) --------------

/**
 * Cold-start press: schedule the loop a comfortable margin into the future
 * so the first quantum of automation lands cleanly.
 */
export const PAD_ATTACK_LOOKAHEAD_ANDROID_COLD_S = 0.1

/**
 * Warm press (within `PAD_ANDROID_WARM_ENTRY_WINDOW_MS` of the previous
 * press): the engine is already hot, so a much shorter lookahead keeps
 * rapid taps tight.
 */
export const PAD_ATTACK_LOOKAHEAD_ANDROID_WARM_S = 0.012

export const PAD_ANDROID_WARM_ENTRY_WINDOW_MS = 280

// --- Buffer creation -------------------------------------------------------

/**
 * Smallest length where (length * freq) / sampleRate is an integer number of
 * full sine cycles, so a looping buffer is phase-continuous.
 */
export function computeSeamlessSineLoopLength(sampleRate: number, freq: number): number {
  const maxCycles = 5000
  for (let cycles = 1; cycles < maxCycles; cycles++) {
    const length = (cycles * sampleRate) / freq
    if (Number.isInteger(length) && length > 1) {
      return length
    }
  }
  return Math.max(2, Math.round(sampleRate / freq))
}

export function padBufferCacheKey(freq: number, type: OscillatorType): string {
  return `${freq}:${type}`
}

function padSample(phase: number, type: OscillatorType): number {
  const s = Math.sin(phase)
  switch (type) {
    case "sine":
      return s
    case "square":
      return s >= 0 ? 1 : -1
    case "triangle":
      return (2 / Math.PI) * Math.asin(s)
    case "sawtooth": {
      let sum = 0
      const nTerms = 10
      for (let k = 1; k <= nTerms; k++) {
        const sign = (k & 1) === 1 ? 1 : -1
        sum += (sign * Math.sin(k * phase)) / k
      }
      const s = (2 / Math.PI) * sum
      return Math.max(-1, Math.min(1, s))
    }
    default:
      return s
  }
}

export function createLoopingPadBuffer(
  ctx: AudioContext,
  freq: number,
  wave: OscillatorType,
): AudioBuffer {
  const sr = ctx.sampleRate
  const length = computeSeamlessSineLoopLength(sr, freq)
  const numCycles = (length * freq) / sr
  const buffer = ctx.createBuffer(1, length, sr)
  const ch = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    const phase = (2 * Math.PI * numCycles * i) / length
    ch[i] = padSample(phase, wave)
  }
  return buffer
}

export function createLoopingSineBuffer(ctx: AudioContext, freq: number): AudioBuffer {
  return createLoopingPadBuffer(ctx, freq, "sine")
}

/**
 * Returns warm vs cold lookahead for buffer-loop pad attack scheduling.
 * Gameplay pads no longer call this; it is retained for sequence-path tuning
 * and quick A/B experiments against the old Android per-press strategy.
 */
export function getPadBufferAttackParams(options: {
  lastPressInWallMs: number
  nowWallMs: number
}): { attackLookaheadS: number } {
  const isAndroidWarm =
    options.lastPressInWallMs > 0 &&
    options.nowWallMs - options.lastPressInWallMs < PAD_ANDROID_WARM_ENTRY_WINDOW_MS
  return {
    attackLookaheadS: isAndroidWarm
      ? PAD_ATTACK_LOOKAHEAD_ANDROID_WARM_S
      : PAD_ATTACK_LOOKAHEAD_ANDROID_COLD_S,
  }
}
