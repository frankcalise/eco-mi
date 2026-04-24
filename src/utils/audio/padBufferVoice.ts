/**
 * Pad-buffer + Hann envelope building blocks (react-native-audio-api).
 * For `useAudioTones` when pads move to `AudioBuffer` + `AudioBufferSourceNode`.
 */
import { Platform } from "react-native"
import type { AudioBuffer, AudioContext, GainNode } from "react-native-audio-api"
import type { OscillatorType } from "react-native-audio-api"

// --- Envelope (match spike defaults; `useAudioTones` can pass overrides later) ---

export const DEFAULT_PAD_TARGET_GAIN = 0.25
/** Hann attack (iOS + Android “warm”); longer Hann on Android “cold”. */
export const PAD_ATTACK_S = 0.02
export const PAD_ATTACK_S_ANDROID_COLD = 0.03
export const PAD_RELEASE_S = 0.2
export const PAD_ENVELOPE_CURVE_POINTS = 256
export const PAD_POST_RELEASE_DISCONNECT_MS = 120
export const PAD_ORPHAN_SOURCE_STOP_MS = 400
export const PAD_RETRIGGER_RELEASE_S = 0.01
export const PAD_RETRIGGER_DISCONNECT_MS = Math.ceil(PAD_RETRIGGER_RELEASE_S * 1000) + 80
export const PAD_RETRIGGER_DISCONNECT_MS_ANDROID = 48
/**
 * Pads: buffer+Hann (Android) vs oscillator+linear (iOS) — `useAudioTones` uses separate timings.
 * Kept for any buffer-only path; iOS sustains do not use this for attack lookahead.
 */
export const PAD_ATTACK_LOOKAHEAD_IOS_S = 0.02

/** Sustained pad: match settings `playPreview` (linear attack, no Hann curve on iOS). */
export const PAD_IOS_SUSTAIN_LOOKAHEAD_S = 0.002
export const PAD_IOS_SUSTAIN_ATTACK_S = 0.015
export const PAD_ATTACK_LOOKAHEAD_ANDROID_COLD_S = 0.1
export const PAD_ATTACK_LOOKAHEAD_ANDROID_WARM_S = 0.012
export const PAD_ANDROID_WARM_ENTRY_WINDOW_MS = 280

// --- Buffers: seamless single-channel sine for looping BufferSource ---

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

/**
 * One period `phase` (rad), integer periods in the buffer, phase = 2π * numCycles * i/length.
 */
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
      // True band-limited saw: alternating-harmonic Fourier series (2/π) Σ (-1)^{k+1} sin(kx)/k.
      // The incorrect non-alternating sum of sin(kx)/k is not a saw; when looped it reads brassy/horn-like.
      let sum = 0
      const nTerms = 10
      for (let k = 1; k <= nTerms; k++) {
        // (-1)^{k+1} sin(k*phase) / k
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

/** Seamless loop for game pad frequencies; timbre matches `OscillatorType`. */
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

export function getPadBufferAttackParams(options: {
  lastPressInWallMs: number
  nowWallMs: number
}): { isAndroidWarm: boolean; attackLookaheadS: number; attackDurationS: number } {
  const isAndroid = Platform.OS === "android"
  const isAndroidWarm =
    isAndroid &&
    options.lastPressInWallMs > 0 &&
    options.nowWallMs - options.lastPressInWallMs < PAD_ANDROID_WARM_ENTRY_WINDOW_MS
  return {
    isAndroidWarm,
    attackLookaheadS: isAndroid
      ? isAndroidWarm
        ? PAD_ATTACK_LOOKAHEAD_ANDROID_WARM_S
        : PAD_ATTACK_LOOKAHEAD_ANDROID_COLD_S
      : PAD_ATTACK_LOOKAHEAD_IOS_S,
    attackDurationS: isAndroid && !isAndroidWarm ? PAD_ATTACK_S_ANDROID_COLD : PAD_ATTACK_S,
  }
}

/**
 * Hann fade from current value to 0. Uses `cancelAndHoldAtTime` (not
 * `setValue` after `cancelScheduledValues(0)`) to avoid `NotSupportedError`
 * against in-flight `setValueCurve` on react-native-audio-api.
 */
export function scheduleHannPadRelease(g: GainNode, atTime: number, durationS: number) {
  g.gain.cancelAndHoldAtTime(atTime)
  const v0 = g.gain.value
  if (v0 < 0.0001) {
    return
  }
  const n = PAD_ENVELOPE_CURVE_POINTS
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1)
    const w = 0.5 * (1 + Math.cos(Math.PI * t))
    curve[i] = v0 * w
  }
  g.gain.setValueCurveAtTime(curve, atTime, durationS)
}

/** Linear fade-out (iOS sustained oscillators) — matches settings, avoids 256-pt setValueCurve “buzz” on iOS. */
export function scheduleLinearPadRelease(g: GainNode, atTime: number, durationS: number) {
  g.gain.cancelAndHoldAtTime(atTime)
  const v0 = g.gain.value
  if (v0 < 0.0001) {
    return
  }
  g.gain.setValueAtTime(v0, atTime)
  g.gain.linearRampToValueAtTime(0, atTime + durationS)
}

/**
 * Rising half Hann: 0 → `peak` with zero derivative at t=0 and t=duration.
 */
export function scheduleHannPadAttack(
  g: GainNode,
  atTime: number,
  peak: number,
  durationS: number,
) {
  const n = PAD_ENVELOPE_CURVE_POINTS
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1)
    const w = 0.5 * (1 - Math.cos(Math.PI * t))
    curve[i] = peak * w
  }
  g.gain.setValueCurveAtTime(curve, atTime, durationS)
}
