/**
 * Cross-platform pad-audio primitives shared by `useAudioTones`, `padOscPool`,
 * and `androidPadBuffer`. Constants here are referenced by both the iOS
 * always-running oscillator pool and Android's per-press buffer/oscillator
 * voices, plus the one-shot scheduling for sequence / jingle / preview.
 *
 * See docs/AUDIO-ARCHITECTURE.md for the full signal-graph rationale.
 */
import type { GainNode } from "react-native-audio-api"

/**
 * Master-gain default used as the volume slider's initial value and as the
 * basis for `SUSTAIN_PAD_PEAK`. Anything louder routinely clipped on cheap
 * device speakers in early playtests.
 */
export const DEFAULT_PAD_TARGET_GAIN = 0.25

/**
 * Per-pad peak gain at the gate. `0.8 * target` keeps four simultaneous
 * pads ~headroom-safe at master and matches `playPreview` so the settings
 * preview feels identical to the gameplay tap (incl. purchase flow).
 */
export const SUSTAIN_PAD_PEAK = DEFAULT_PAD_TARGET_GAIN * 0.8

/**
 * Linear attack used by every "press → ramp to peak" path: iOS pool noteOn,
 * Android per-press noteOn, sequence steps, jingle/preview one-shots. Long
 * enough to dodge the k-rate "rattle" we saw with sub-quantum ramps; short
 * enough to feel instant under finger latency.
 */
export const ONE_SHOT_ATTACK_S = 0.03

/** Linear release on note-off for both iOS pool gates and Android per-press voices. */
export const PAD_RELEASE_S = 0.2

/** Sequence / jingle / preview scheduling lookahead — comfortable margin for AU graph init. */
export const SEQUENCE_LOOKAHEAD_S = 0.05

/** Sequence step attack — alias of `ONE_SHOT_ATTACK_S` for naming clarity at call sites. */
export const SEQUENCE_ATTACK_S = ONE_SHOT_ATTACK_S

/** Sequence/jingle release tail — slightly longer than pads so step boundaries don't click. */
export const SEQ_RELEASE_S = 0.055

/** Pad pitches (Hz) — same on both platforms; iOS pool size is `POOL_FREQS.length`. */
export const POOL_FREQS = [220, 277, 330, 415] as const

/**
 * Linear release: cancel any pending automation, hold the current value at
 * `atTime`, then ramp linearly to 0 over `durationS`. Skips work if the gate
 * is already silent. Used by both the iOS pool noteOff and Android per-press
 * teardown / orphan-retrigger paths.
 */
export function scheduleLinearPadRelease(g: GainNode, atTime: number, durationS: number) {
  g.gain.cancelAndHoldAtTime(atTime)
  const v0 = g.gain.value
  if (v0 < 0.0001) {
    return
  }
  g.gain.setValueAtTime(v0, atTime)
  g.gain.linearRampToValueAtTime(0, atTime + durationS)
}
