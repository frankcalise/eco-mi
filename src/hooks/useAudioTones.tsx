import { useRef, useEffect } from "react"
import { AppState, Platform } from "react-native"
import { AudioContext, GainNode, OscillatorNode } from "react-native-audio-api"
import type { OscillatorType } from "react-native-audio-api"
import type { AudioBuffer, AudioBufferSourceNode } from "react-native-audio-api"

import { usePreferencesStore } from "@/stores/preferencesStore"
import { createLoopingPadBuffer, padBufferCacheKey } from "@/utils/audio/androidPadBuffer"
import {
  buildPadOscPool,
  padOscPoolNoteOff,
  padOscPoolNoteOn,
  setPadOscPoolWave,
  silencePadOscPool,
  teardownPadOscPool,
  type PadOscPool,
} from "@/utils/audio/padOscPool"
import {
  DEFAULT_PAD_TARGET_GAIN,
  ONE_SHOT_ATTACK_S,
  PAD_RELEASE_S,
  POOL_FREQS,
  scheduleLinearPadRelease,
  SEQ_RELEASE_S,
  SEQUENCE_ATTACK_S,
  SEQUENCE_LOOKAHEAD_S,
  SUSTAIN_PAD_PEAK,
} from "@/utils/audio/padShared"

// --- Debug logging (set EXPO_PUBLIC_DEBUG_AUDIO=1 to enable in release builds) ---
const DEBUG_AUDIO = __DEV__ || process.env.EXPO_PUBLIC_DEBUG_AUDIO === "1"
const alog = (...args: unknown[]) => {
  if (DEBUG_AUDIO) console.log("[audio]", ...args)
}

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

/** Sequence playback uses Android buffers for non-saw waves; gameplay pads use `padOscPool.ts`. */
function sequenceUsesOsc(wave: OscillatorType) {
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
  const bufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map())
  /** Cross-platform gameplay pad pool. Null before init / after teardown. */
  const padOscPoolRef = useRef<PadOscPool | null>(null)
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
    master.connect(ctx.destination)
    masterGainRef.current = master
    padOscPoolRef.current = buildPadOscPool(ctx, master, oscillatorTypeRef.current)
    contextReadyRef.current = true
    rebuildBufferCache(ctx, oscillatorTypeRef.current)
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
    teardownPadOscPool(padOscPoolRef.current)
    padOscPoolRef.current = null
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
    setPadOscPoolWave(padOscPoolRef.current, oscillatorType)
    rebuildBufferCache(ctx, oscillatorType)
  }, [oscillatorType])

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

    /* Defensive rebuild: pool can be null if a teardown beat the next press. */
    if (!padOscPoolRef.current && contextReadyRef.current && audioContextRef.current === ctx) {
      padOscPoolRef.current = buildPadOscPool(ctx, master, wave)
    }
    const pool = padOscPoolRef.current
    if (!pool || !padOscPoolNoteOn(pool, freq, ctx, SUSTAIN_PAD_PEAK, ONE_SHOT_ATTACK_S)) {
      countersRef.current.droppedNotes++
      alog("noteOn: dropped (no pad pool voice)", { color, freq })
      return
    }
  }

  function noteOff(color: Color) {
    if (!contextReadyRef.current) return
    const ctx = audioContextRef.current
    if (!ctx) return

    const freq = colorMap[color].sound

    const pool = padOscPoolRef.current
    if (!pool) return
    padOscPoolNoteOff(pool, freq, ctx, PAD_RELEASE_S)
  }

  function silenceAll() {
    const ctx = audioContextRef.current
    if (!ctx) return
    clearAllSequenceTimeouts()
    sequenceRunIdRef.current++
    teardownAllSequenceStepVoices()
    silencePadOscPool(padOscPoolRef.current, ctx)
    if (!masterGainRef.current) return
    /* Sequence buffer cache (Android, non-saw); gameplay pad pool unaffected. */
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
    const seqOsc = sequenceUsesOsc(seqWave)

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
          DEFAULT_PAD_TARGET_GAIN * gainMultiplier,
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
    teardownPadOscPool(padOscPoolRef.current)
    padOscPoolRef.current = null
    destroyBufferCache()
    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close()
      } catch {}
      audioContextRef.current = null
      masterGainRef.current = null
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
