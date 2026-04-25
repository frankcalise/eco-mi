/**
 * Cross-platform gameplay pad strategy: a fixed pool of always-running
 * `OscillatorNode`s (one per `POOL_FREQS` entry) gated by per-frequency
 * `GainNode`s held at 0 between presses. `noteOn` / `noteOff` are pure
 * linear gain ramps — no node creation/teardown on the tap hot path.
 *
 * This restores the v1.1.0 pooling behavior for both iOS and Android so
 * device testing can isolate whether the post-spike per-press Android path
 * caused rapid-tap crackle.
 */
import type { AudioContext, GainNode, OscillatorNode } from "react-native-audio-api"
import type { OscillatorType } from "react-native-audio-api"

import { POOL_FREQS, scheduleLinearPadRelease } from "./padShared"

export type PadPoolVoice = { osc: OscillatorNode; gain: GainNode }
export type PadOscPool = Map<number, PadPoolVoice>

export function buildPadOscPool(
  ctx: AudioContext,
  master: GainNode,
  wave: OscillatorType,
): PadOscPool {
  const pool: PadOscPool = new Map()
  const t0 = ctx.currentTime
  for (const freq of POOL_FREQS) {
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, t0)
    const osc = ctx.createOscillator()
    osc.type = wave
    osc.frequency.setValueAtTime(freq, t0)
    osc.connect(gain)
    gain.connect(master)
    osc.start()
    pool.set(freq, { osc, gain })
  }
  return pool
}

export function teardownPadOscPool(pool: PadOscPool | null): void {
  if (!pool) return
  for (const v of pool.values()) {
    try {
      v.osc.stop()
    } catch {}
    try {
      v.osc.disconnect()
    } catch {}
    try {
      v.gain.disconnect()
    } catch {}
  }
}

export function setPadOscPoolWave(pool: PadOscPool | null, wave: OscillatorType): void {
  if (!pool) return
  for (const v of pool.values()) {
    v.osc.type = wave
  }
}

export function silencePadOscPool(pool: PadOscPool | null, ctx: AudioContext): void {
  if (!pool) return
  const now = ctx.currentTime
  for (const v of pool.values()) {
    v.gain.gain.cancelScheduledValues(now)
    v.gain.gain.setValueAtTime(0, now)
  }
}

export function padOscPoolNoteOn(
  pool: PadOscPool,
  freq: number,
  ctx: AudioContext,
  peak: number,
  attackS: number,
): boolean {
  const voice = pool.get(freq)
  if (!voice) return false
  const now = ctx.currentTime
  const g = voice.gain.gain
  const v0 = g.value
  g.cancelScheduledValues(now)
  g.setValueAtTime(v0, now)
  g.linearRampToValueAtTime(peak, now + attackS)
  return true
}

export function padOscPoolNoteOff(
  pool: PadOscPool,
  freq: number,
  ctx: AudioContext,
  releaseS: number,
): boolean {
  const voice = pool.get(freq)
  if (!voice) return false
  scheduleLinearPadRelease(voice.gain, ctx.currentTime, releaseS)
  return true
}
