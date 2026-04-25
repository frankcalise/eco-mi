/**
 * Pad-buffer and linear-gain utilities for `useAudioTones` (react-native-audio-api).
 * See docs/AUDIO-ARCHITECTURE.md.
 */
import type { AudioBuffer, AudioContext, GainNode } from "react-native-audio-api"
import type { OscillatorType } from "react-native-audio-api"

// --- Envelope + timing (shared with `useAudioTones` timing constants) ---

export const DEFAULT_PAD_TARGET_GAIN = 0.25
export const PAD_RELEASE_S = 0.2
export const PAD_POST_RELEASE_DISCONNECT_MS = 120
export const PAD_ORPHAN_SOURCE_STOP_MS = 400
export const PAD_RETRIGGER_RELEASE_S = 0.01
export const PAD_RETRIGGER_DISCONNECT_MS = Math.ceil(PAD_RETRIGGER_RELEASE_S * 1000) + 80
export const PAD_RETRIGGER_DISCONNECT_MS_ANDROID = 48
/**
 * Android buffer pads: `noteOn` starts the looping source at `ctx.currentTime + attackLookaheadS`
 * (cold vs warm, see getPadBufferAttackParams). iOS pads use the always-running
 * oscillator pool in `useAudioTones`, so no per-press lookahead is needed there.
 */
export const PAD_ATTACK_LOOKAHEAD_ANDROID_COLD_S = 0.1
export const PAD_ATTACK_LOOKAHEAD_ANDROID_WARM_S = 0.012
export const PAD_ANDROID_WARM_ENTRY_WINDOW_MS = 280

// --- Buffers: seamless single-channel audio for looping BufferSource ---

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
 * Android-only after the iOS pool migration. Returns warm vs cold lookahead
 * for buffer-loop pad attack scheduling. (`useAudioTones` short-circuits iOS
 * through the always-running oscillator pool before this fn is reached.)
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

export function scheduleLinearPadRelease(g: GainNode, atTime: number, durationS: number) {
  g.gain.cancelAndHoldAtTime(atTime)
  const v0 = g.gain.value
  if (v0 < 0.0001) {
    return
  }
  g.gain.setValueAtTime(v0, atTime)
  g.gain.linearRampToValueAtTime(0, atTime + durationS)
}
