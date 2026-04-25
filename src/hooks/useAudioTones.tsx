import { useRef, useEffect } from "react"
import { AppState, Platform } from "react-native"
import { AudioContext, BiquadFilterNode, GainNode, OscillatorNode } from "react-native-audio-api"
import type { OscillatorType } from "react-native-audio-api"
import type { AudioBuffer, AudioBufferSourceNode } from "react-native-audio-api"

import { usePreferencesStore } from "@/stores/preferencesStore"
import {
  createLoopingPadBuffer,
  DEFAULT_PAD_TARGET_GAIN,
  getPadBufferAttackParams,
  padBufferCacheKey,
  PAD_ORPHAN_SOURCE_STOP_MS,
  PAD_POST_RELEASE_DISCONNECT_MS,
  PAD_RETRIGGER_DISCONNECT_MS,
  PAD_RETRIGGER_DISCONNECT_MS_ANDROID,
  PAD_RETRIGGER_RELEASE_S,
  PAD_RELEASE_S,
  scheduleLinearPadRelease,
} from "@/utils/audio/padBufferVoice"

// --- Debug logging (set EXPO_PUBLIC_DEBUG_AUDIO=1 to enable in release builds) ---
const DEBUG_AUDIO = __DEV__ || process.env.EXPO_PUBLIC_DEBUG_AUDIO === "1"
const alog = (...args: unknown[]) => {
  if (DEBUG_AUDIO) console.log("[audio]", ...args)
}

/**
 * Slightly long attacks / releases: native k-rate automation can sound "rattly" with very fast
 * linearRamps; gentle rolloff tames fizz. One-shots (jingle/preview) share these.
 */
const ONE_SHOT_ATTACK_S = 0.03
const SEQ_RELEASE_S = 0.055
const SEQUENCE_LOOKAHEAD_S = 0.05
const SEQUENCE_ATTACK_S = ONE_SHOT_ATTACK_S
/**
 * Soft lowpass after master — Android only. On iOS the filter sat in front of
 * cold-starting per-note `OscillatorNode`s and magnified envelope-zipper
 * artifacts (the very fizz it was added to tame), so iOS bypasses it entirely
 * and routes master → destination directly. Android still benefits from it
 * smoothing buffer-loop boundary transitions for sine/square/triangle pads.
 */
const MASTER_TONE_LP_HZ = 6800
const TARGET_GAIN = DEFAULT_PAD_TARGET_GAIN
/** Same peak as `playPreview` so pads/sequence match settings (incl. purchase flow) — `TARGET_GAIN * 0.8`. */
const SUSTAIN_PAD_PEAK = TARGET_GAIN * 0.8
const POOL_FREQS = [220, 277, 330, 415] as const

export type Color = "red" | "blue" | "green" | "yellow"

export interface ColorMap {
  [key: string]: {
    color: string
    activeColor: string
    sound: number
    position: "topLeft" | "topRight" | "bottomLeft" | "bottomRight"
  }
}

const PREVIEW_NOTES = [
  { freq: 220, delay: 0 },
  { freq: 277, delay: 0.15 },
  { freq: 330, delay: 0.3 },
  { freq: 415, delay: 0.45 },
  { freq: 330, delay: 0.6 },
  { freq: 415, delay: 0.7 },
]
const PREVIEW_NOTE_DURATION = 0.12

const JINGLE_NOTES = [
  { freq: 523, delay: 0 },
  { freq: 659, delay: 0.2 },
  { freq: 784, delay: 0.4 },
  { freq: 1047, delay: 0.6 },
  { freq: 784, delay: 0.85 },
  { freq: 1047, delay: 1.05 },
]
const JINGLE_NOTE_DURATION = 0.15

const GAMEOVER_NOTES = [
  { freq: 659, delay: 0 },
  { freq: 587, delay: 0.2 },
  { freq: 523, delay: 0.4 },
  { freq: 440, delay: 0.6 },
]
const GAMEOVER_NOTE_DURATION = 0.2

const HIGHSCORE_NOTES = [
  { freq: 523, delay: 0 },
  { freq: 659, delay: 0.12 },
  { freq: 784, delay: 0.24 },
  { freq: 1047, delay: 0.36 },
  { freq: 1319, delay: 0.48 },
  { freq: 1568, delay: 0.6 },
]
const HIGHSCORE_NOTE_DURATION = 0.12

type PadSource = AudioBufferSourceNode | OscillatorNode

type PadVoice = {
  kind: "buffer" | "osc"
  source: PadSource
  gain: GainNode
  releaseTid?: ReturnType<typeof setTimeout>
}

/**
 * iOS pad pool: 4 always-running oscillators (one per `POOL_FREQS` entry)
 * gated by per-frequency gain nodes held at 0 between presses. Restores the
 * v1.1.0 design after per-`noteOn` osc creation was found to cause "rattle"
 * on iOS with `react-native-audio-api` ≥ 0.12.0 (cold-start transients +
 * sub-quantum lookahead snapping the 0→peak ramp onto k-rate boundaries).
 * `noteOn`/`noteOff` are pure gain ramps — no node creation/teardown on
 * the hot path. Android keeps its buffer-loop / native-saw paths.
 */
type IosPadPoolVoice = { osc: OscillatorNode; gain: GainNode }

/** Android: buffer+loop (sine/sq/tri) or osc (saw). iOS: oscillator pool — see `IosPadPoolVoice`. */
function sustainPadsWithOsc(wave: OscillatorType) {
  if (Platform.OS === "ios") {
    return true
  }
  if (Platform.OS === "android" && wave === "sawtooth") {
    return true
  }
  return false
}

interface AudioTonesHook {
  initialize: () => Promise<void>
  cleanup: () => Promise<void>
  noteOn: (color: Color) => void
  noteOff: (color: Color) => void
  silenceAll: () => void
  scheduleSequence: (colors: Color[], intervalS: number, durationS: number) => void
  playPreview: (overrideType?: OscillatorType) => void
  playJingle: () => void
  playGameOverJingle: () => void
  playHighScoreJingle: () => void
}

export function useAudioTones(
  colorMap: ColorMap,
  oscillatorType: OscillatorType = "sine",
  onContextRecycle?: (nodeCount: number) => void,
): AudioTonesHook {
  const audioContextRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const masterToneRef = useRef<BiquadFilterNode | null>(null)
  const bufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map())
  const padByFreqRef = useRef<Map<number, PadVoice>>(new Map())
  /** iOS only — see `IosPadPoolVoice` doc. Null on Android / before init. */
  const iosPadPoolRef = useRef<Map<number, IosPadPoolVoice> | null>(null)
  const lastPressInWallMsRef = useRef(0)
  const contextReadyRef = useRef(false)
  const countersRef = useRef({ recreates: 0, resumeFalseNegatives: 0, droppedNotes: 0 })
  const sequenceRunIdRef = useRef(0)
  const sequenceTimeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const sequenceStepVoicesRef = useRef<{ source: PadSource; gain: GainNode }[]>([])
  const soundEnabled = usePreferencesStore((s) => s.soundEnabled)
  const volume = usePreferencesStore((s) => s.volume)
  const oscillatorTypeRef = useRef(oscillatorType)
  oscillatorTypeRef.current = oscillatorType

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      const ctx = audioContextRef.current
      if (!ctx) return
      if (state === "background") {
        alog("appState: background → suspend")
        try {
          ctx.suspend()
        } catch (e) {
          alog("appState: suspend threw", String(e))
        }
      } else if (state === "active" && contextReadyRef.current) {
        alog("appState: active")
        if (!ensureResumed("appState")) {
          recreateContext("appState")
        }
      }
    })
    return () => sub.remove()
  }, [])

  function rebuildBufferCache(ctx: AudioContext, wave: OscillatorType) {
    bufferCacheRef.current = new Map()
    if (Platform.OS === "ios") {
      return
    }
    if (wave === "sawtooth") {
      return
    }
    for (const f of POOL_FREQS) {
      bufferCacheRef.current.set(padBufferCacheKey(f, wave), createLoopingPadBuffer(ctx, f, wave))
    }
  }

  function getPadBufferForFreq(ctx: AudioContext, freq: number) {
    const w = oscillatorTypeRef.current
    return bufferCacheRef.current.get(padBufferCacheKey(freq, w)) ?? null
  }

  function clearAllSequenceTimeouts() {
    for (const id of sequenceTimeoutIdsRef.current) {
      clearTimeout(id)
    }
    sequenceTimeoutIdsRef.current = []
  }

  function teardownAllSequenceStepVoices() {
    for (const v of sequenceStepVoicesRef.current) {
      try {
        v.source.stop()
      } catch {}
      try {
        v.source.disconnect()
      } catch {}
      try {
        v.gain.disconnect()
      } catch {}
    }
    sequenceStepVoicesRef.current = []
  }

  function createFreshContext() {
    const ctx = new AudioContext()
    audioContextRef.current = ctx
    const t0 = ctx.currentTime
    const master = ctx.createGain()
    master.gain.setValueAtTime(usePreferencesStore.getState().volume, t0)
    if (Platform.OS === "ios") {
      master.connect(ctx.destination)
      masterToneRef.current = null
    } else {
      const tone = ctx.createBiquadFilter()
      tone.type = "lowpass"
      tone.frequency.setValueAtTime(MASTER_TONE_LP_HZ, t0)
      tone.Q.setValueAtTime(0.707, t0)
      master.connect(tone)
      tone.connect(ctx.destination)
      masterToneRef.current = tone
    }
    masterGainRef.current = master
    if (Platform.OS === "ios") {
      buildIosPadPool(ctx, master)
    }
    contextReadyRef.current = true
    rebuildBufferCache(ctx, oscillatorTypeRef.current)
  }

  function buildIosPadPool(ctx: AudioContext, master: GainNode) {
    const pool = new Map<number, IosPadPoolVoice>()
    const wave = oscillatorTypeRef.current
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
    iosPadPoolRef.current = pool
  }

  function teardownIosPadPool() {
    const pool = iosPadPoolRef.current
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
    iosPadPoolRef.current = null
  }

  function teardownAllPadVoices() {
    for (const [, v] of padByFreqRef.current) {
      if (v.releaseTid) {
        clearTimeout(v.releaseTid)
      }
      try {
        v.source.stop()
      } catch {}
      try {
        v.source.disconnect()
      } catch {}
      try {
        v.gain.disconnect()
      } catch {}
    }
    padByFreqRef.current.clear()
  }

  function destroyBufferCache() {
    bufferCacheRef.current.clear()
  }

  function ensureResumed(caller: string = "unknown"): boolean {
    const ctx = audioContextRef.current
    if (!ctx) {
      alog("ensureResumed: no ctx", { caller })
      return false
    }
    if (ctx.state === "closed") {
      alog("ensureResumed: state=closed", { caller })
      return false
    }
    if (ctx.state === "running") return true

    try {
      // @ts-ignore
      ctx.resume?.()
    } catch (e) {
      alog("ensureResumed: resume() threw", { caller, error: String(e) })
      return false
    }
    return true
  }

  function recreateContext(caller: string = "unknown") {
    countersRef.current.recreates++
    alog("recreateContext", { caller })
    teardownIosPadPool()
    teardownAllPadVoices()
    teardownAllSequenceStepVoices()
    clearAllSequenceTimeouts()
    teardownAllSequenceStepVoices()
    sequenceRunIdRef.current++
    destroyBufferCache()
    const oldCtx = audioContextRef.current
    if (oldCtx) {
      try {
        oldCtx.close()
      } catch {}
      audioContextRef.current = null
      masterGainRef.current = null
      masterToneRef.current = null
    }
    onContextRecycle?.(POOL_FREQS.length * 2 + 1)
    createFreshContext()
  }

  useEffect(() => {
    const master = masterGainRef.current
    const ctx = audioContextRef.current
    if (master && ctx) {
      master.gain.setValueAtTime(volume, ctx.currentTime)
    }
  }, [volume])

  useEffect(() => {
    const ctx = audioContextRef.current
    const master = masterGainRef.current
    if (!contextReadyRef.current || !ctx || !master) return
    if (Platform.OS === "ios") {
      const pool = iosPadPoolRef.current
      if (pool) {
        for (const v of pool.values()) {
          v.osc.type = oscillatorType
        }
      }
    }
    rebuildBufferCache(ctx, oscillatorType)
  }, [oscillatorType])

  /** Always linear (Hann/setValueCurve on iOS/Android was grainy / “rattly” on quick re-press). */
  function retriggerOrphanPad(tAudio: number, source: PadSource, gain: GainNode) {
    scheduleLinearPadRelease(gain, tAudio, PAD_RETRIGGER_RELEASE_S)
    const ms =
      Platform.OS === "android" ? PAD_RETRIGGER_DISCONNECT_MS_ANDROID : PAD_RETRIGGER_DISCONNECT_MS
    setTimeout(() => {
      try {
        gain.disconnect()
      } catch {}
      try {
        source.disconnect()
      } catch {}
      setTimeout(() => {
        try {
          source.stop()
        } catch {}
      }, PAD_ORPHAN_SOURCE_STOP_MS)
    }, ms)
  }

  function noteOn(color: Color) {
    if (!soundEnabled || !contextReadyRef.current) {
      alog("noteOn: skipped", { color, soundEnabled, contextReady: contextReadyRef.current })
      return
    }
    if (!ensureResumed("noteOn")) {
      recreateContext("noteOn")
    }
    const ctx = audioContextRef.current
    const master = masterGainRef.current
    if (!ctx || !master) {
      countersRef.current.droppedNotes++
      alog("noteOn: dropped (no ctx/master)", { color })
      return
    }

    const wave = oscillatorTypeRef.current
    const freq = colorMap[color].sound

    /* iOS pool: always-running oscillator gated by a per-freq gain. No node
     * creation on the hot path — `noteOn` is a pure linear ramp from the
     * gain's current value to peak. Retrigger during attack/release just
     * cancels and ramps again from `value` for click-free pickup. */
    if (Platform.OS === "ios") {
      const pool = iosPadPoolRef.current
      if (!pool && contextReadyRef.current && audioContextRef.current === ctx) {
        buildIosPadPool(ctx, master)
      }
      const voice = iosPadPoolRef.current?.get(freq)
      if (!voice) {
        countersRef.current.droppedNotes++
        alog("noteOn: dropped (no iOS pool voice)", { color, freq })
        return
      }
      const now = ctx.currentTime
      const g = voice.gain.gain
      const v0 = g.value
      g.cancelScheduledValues(now)
      g.setValueAtTime(v0, now)
      g.linearRampToValueAtTime(SUSTAIN_PAD_PEAK, now + ONE_SHOT_ATTACK_S)
      lastPressInWallMsRef.current = Date.now()
      return
    }

    /* Android path (buffer-loop sine/sq/tri, native osc for saw) — unchanged. */
    const sustainedOsc = sustainPadsWithOsc(wave)
    let padBuffer: AudioBuffer | null = null
    if (!sustainedOsc) {
      padBuffer = getPadBufferForFreq(ctx, freq)
      if (!padBuffer) {
        rebuildBufferCache(ctx, wave)
        padBuffer = getPadBufferForFreq(ctx, freq)
      }
      if (!padBuffer) {
        countersRef.current.droppedNotes++
        alog("noteOn: dropped (no buffer for freq)", { color, freq, wave })
        return
      }
    }

    const existing = padByFreqRef.current.get(freq)
    if (existing) {
      if (existing.releaseTid) {
        clearTimeout(existing.releaseTid)
        existing.releaseTid = undefined
      }
      retriggerOrphanPad(ctx.currentTime, existing.source, existing.gain)
      padByFreqRef.current.delete(freq)
    }

    const now = ctx.currentTime
    const wall = Date.now()
    const wallParams = {
      lastPressInWallMs: lastPressInWallMsRef.current,
      nowWallMs: wall,
    }
    const { attackLookaheadS } = getPadBufferAttackParams(wallParams)
    const tStart = now + attackLookaheadS
    lastPressInWallMsRef.current = wall

    if (sustainedOsc) {
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, ctx.currentTime)
      const osc = ctx.createOscillator()
      osc.type = wave
      osc.frequency.setValueAtTime(freq, tStart)
      osc.connect(gain)
      gain.connect(master)
      gain.gain.setValueAtTime(0, tStart)
      gain.gain.linearRampToValueAtTime(SUSTAIN_PAD_PEAK, tStart + ONE_SHOT_ATTACK_S)
      osc.start(tStart)
      padByFreqRef.current.set(freq, { kind: "osc", source: osc, gain })
      return
    }

    const buffer = padBuffer!
    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, ctx.currentTime)
    source.buffer = buffer
    source.loop = true
    source.connect(gain)
    gain.connect(master)
    gain.gain.setValueAtTime(0, tStart)
    gain.gain.linearRampToValueAtTime(SUSTAIN_PAD_PEAK, tStart + ONE_SHOT_ATTACK_S)
    source.start(tStart)
    padByFreqRef.current.set(freq, { kind: "buffer", source, gain })
  }

  function noteOff(color: Color) {
    if (!contextReadyRef.current) return
    const ctx = audioContextRef.current
    if (!ctx) return

    const freq = colorMap[color].sound

    /* iOS pool: pure gain ramp to 0. The oscillator keeps running silently —
     * no disconnect, no deferred `source.stop()`, no orphan teardown. */
    if (Platform.OS === "ios") {
      const voice = iosPadPoolRef.current?.get(freq)
      if (!voice) return
      scheduleLinearPadRelease(voice.gain, ctx.currentTime, PAD_RELEASE_S)
      return
    }

    /* Android: per-press voices need release → disconnect → deferred stop. */
    const voice = padByFreqRef.current.get(freq)
    if (!voice) return
    if (voice.releaseTid) {
      clearTimeout(voice.releaseTid)
      voice.releaseTid = undefined
    }

    const { source: src, gain: g } = voice
    const now = ctx.currentTime
    scheduleLinearPadRelease(g, now, PAD_RELEASE_S)
    const postMs = PAD_RELEASE_S * 1000 + PAD_POST_RELEASE_DISCONNECT_MS
    voice.releaseTid = setTimeout(() => {
      if (padByFreqRef.current.get(freq)?.source !== src) return
      try {
        g.disconnect()
      } catch {}
      try {
        src.disconnect()
      } catch {}
      padByFreqRef.current.delete(freq)
      voice.releaseTid = undefined
      setTimeout(() => {
        try {
          src.stop()
        } catch {}
      }, PAD_ORPHAN_SOURCE_STOP_MS)
    }, postMs)
  }

  function silenceAll() {
    const ctx = audioContextRef.current
    if (!ctx) return
    clearAllSequenceTimeouts()
    sequenceRunIdRef.current++
    teardownAllSequenceStepVoices()
    if (Platform.OS === "ios") {
      /* Zero every pool gain immediately — keeps the always-running oscillators
       * intact so the next `noteOn` is still a pure gain ramp. */
      const pool = iosPadPoolRef.current
      if (pool) {
        const now = ctx.currentTime
        for (const v of pool.values()) {
          v.gain.gain.cancelScheduledValues(now)
          v.gain.gain.setValueAtTime(0, now)
        }
      }
    } else {
      teardownAllPadVoices()
    }
    if (!masterGainRef.current) return
    /* Pads/sequence buffer cache (Android, non-saw); iOS pool unaffected. */
    rebuildBufferCache(ctx, oscillatorTypeRef.current)
  }

  function scheduleSequence(colors: Color[], intervalS: number, durationS: number) {
    if (!soundEnabled || !contextReadyRef.current) {
      alog("scheduleSequence: skipped", { soundEnabled, contextReady: contextReadyRef.current })
      return
    }
    if (!ensureResumed("scheduleSequence")) {
      recreateContext("scheduleSequence")
    }
    const ctx = audioContextRef.current
    const master = masterGainRef.current
    if (!ctx || !master) {
      alog("scheduleSequence: dropped (no ctx/master)")
      return
    }

    alog("scheduleSequence", {
      state: ctx.state,
      currentTime: ctx.currentTime.toFixed(3),
      notes: colors.length,
      intervalS,
      durationS,
      firstNoteAt: (ctx.currentTime + SEQUENCE_LOOKAHEAD_S + intervalS).toFixed(3),
    })

    clearAllSequenceTimeouts()
    teardownAllSequenceStepVoices()
    const tBase = ctx.currentTime + SEQUENCE_LOOKAHEAD_S
    const myRun = ++sequenceRunIdRef.current
    const seqWave = oscillatorTypeRef.current
    const seqOsc = sustainPadsWithOsc(seqWave)

    for (let i = 0; i < colors.length; i++) {
      const freq = colorMap[colors[i]].sound
      const buffer = seqOsc ? null : getPadBufferForFreq(ctx, freq)
      if (!seqOsc && !buffer) {
        alog("scheduleSequence: skip (no buffer)", { freq, seqWave })
        continue
      }

      const noteStart = tBase + (i + 1) * intervalS
      const noteEnd = noteStart + durationS
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, ctx.currentTime)
      let source: PadSource
      if (seqOsc) {
        const osc = ctx.createOscillator()
        osc.type = seqWave
        osc.frequency.setValueAtTime(freq, noteStart)
        osc.connect(g)
        source = osc
      } else {
        const bufSrc = ctx.createBufferSource()
        bufSrc.buffer = buffer!
        bufSrc.loop = true
        bufSrc.connect(g)
        source = bufSrc
      }
      g.connect(master)
      g.gain.setValueAtTime(0, noteStart)
      g.gain.linearRampToValueAtTime(SUSTAIN_PAD_PEAK, noteStart + SEQUENCE_ATTACK_S)
      g.gain.setValueAtTime(SUSTAIN_PAD_PEAK, noteEnd - SEQ_RELEASE_S)
      g.gain.linearRampToValueAtTime(0, noteEnd)
      source.start(noteStart)
      source.stop(noteEnd + 0.02)
      sequenceStepVoicesRef.current.push({ source, gain: g })

      const untilCleanup = Math.max(0, (noteEnd - ctx.currentTime + 0.05) * 1000)
      const tid = setTimeout(() => {
        if (sequenceRunIdRef.current !== myRun) return
        try {
          g.disconnect()
        } catch {}
        try {
          source.disconnect()
        } catch {}
        try {
          source.stop()
        } catch {}
      }, untilCleanup)
      sequenceTimeoutIdsRef.current.push(tid)
    }
  }

  function scheduleOneShot(
    ctx: AudioContext,
    master: GainNode,
    freq: number,
    type: OscillatorType,
    noteStart: number,
    duration: number,
    peakGain: number,
  ) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(freq, noteStart)

    g.gain.setValueAtTime(0, noteStart)
    g.gain.linearRampToValueAtTime(peakGain, noteStart + ONE_SHOT_ATTACK_S)
    g.gain.setValueAtTime(peakGain, noteStart + duration - SEQ_RELEASE_S)
    g.gain.linearRampToValueAtTime(0, noteStart + duration)

    osc.connect(g)
    g.connect(master)
    osc.start(noteStart)
    osc.stop(noteStart + duration + 0.02)

    setTimeout(
      () => {
        try {
          osc.disconnect()
        } catch {}
        try {
          g.disconnect()
        } catch {}
      },
      (noteStart - ctx.currentTime + duration + 0.05) * 1000,
    )
  }

  function playJingleNotes(
    notes: { freq: number; delay: number }[],
    noteDuration: number,
    gainMultiplier: number,
  ) {
    if (!soundEnabled || !contextReadyRef.current) return
    if (!ensureResumed("jingle")) {
      recreateContext("jingle")
    }
    try {
      const ctx = audioContextRef.current
      const master = masterGainRef.current
      if (!ctx || !master) return

      const now = ctx.currentTime + SEQUENCE_LOOKAHEAD_S
      for (const note of notes) {
        scheduleOneShot(
          ctx,
          master,
          note.freq,
          oscillatorTypeRef.current,
          now + note.delay,
          noteDuration,
          TARGET_GAIN * gainMultiplier,
        )
      }
    } catch (e) {
      alog("playJingleNotes: threw → recreate", String(e))
      recreateContext("jingle-catch")
    }
  }

  function playPreview(overrideType?: OscillatorType) {
    if (!soundEnabled || !contextReadyRef.current) return
    if (!ensureResumed("preview")) {
      recreateContext("preview")
    }
    try {
      const ctx = audioContextRef.current
      const master = masterGainRef.current
      if (!ctx || !master) return

      const type = overrideType ?? oscillatorTypeRef.current
      const now = ctx.currentTime + SEQUENCE_LOOKAHEAD_S
      for (const note of PREVIEW_NOTES) {
        scheduleOneShot(
          ctx,
          master,
          note.freq,
          type,
          now + note.delay,
          PREVIEW_NOTE_DURATION,
          SUSTAIN_PAD_PEAK,
        )
      }
    } catch (e) {
      alog("playPreview: threw → recreate", String(e))
      recreateContext("preview-catch")
    }
  }

  function playJingle() {
    playJingleNotes(JINGLE_NOTES, JINGLE_NOTE_DURATION, 0.6)
  }

  function playGameOverJingle() {
    playJingleNotes(GAMEOVER_NOTES, GAMEOVER_NOTE_DURATION, 0.4)
  }

  function playHighScoreJingle() {
    playJingleNotes(HIGHSCORE_NOTES, HIGHSCORE_NOTE_DURATION, 0.7)
  }

  async function initialize() {
    countersRef.current = { recreates: 0, resumeFalseNegatives: 0, droppedNotes: 0 }
    const t0 = Date.now()
    alog("initialize: begin", {
      platform: Platform.OS,
      version: Platform.Version,
    })
    try {
      createFreshContext()
      ensureResumed("initialize")
      const ctx = audioContextRef.current
      alog("initialize: ctx ready", {
        ms: Date.now() - t0,
        state: ctx?.state,
        currentTime: ctx?.currentTime?.toFixed?.(3),
      })
    } catch (error) {
      console.log("Audio initialization failed:", error)
      alog("initialize: failed", String(error))
    }
  }

  async function cleanup() {
    const c = countersRef.current
    alog("cleanup: session summary", {
      recreates: c.recreates,
      resumeFalseNegatives: c.resumeFalseNegatives,
      droppedNotes: c.droppedNotes,
    })
    contextReadyRef.current = false
    clearAllSequenceTimeouts()
    teardownAllSequenceStepVoices()
    teardownIosPadPool()
    teardownAllPadVoices()
    destroyBufferCache()
    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close()
      } catch {}
      audioContextRef.current = null
      masterGainRef.current = null
      masterToneRef.current = null
    }
  }

  return {
    initialize,
    cleanup,
    noteOn,
    noteOff,
    silenceAll,
    scheduleSequence,
    playPreview,
    playJingle,
    playGameOverJingle,
    playHighScoreJingle,
  }
}

export default useAudioTones
