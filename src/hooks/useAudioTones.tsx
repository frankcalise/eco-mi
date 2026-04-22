import { useRef, useEffect } from "react"
import { AppState, Platform } from "react-native"
import { AudioContext, GainNode, OscillatorNode } from "react-native-audio-api"
import type { OscillatorType } from "react-native-audio-api"

import { SETTINGS_SOUND_VOLUME } from "@/config/storageKeys"
import { loadString } from "@/utils/storage"

// --- Debug logging (set EXPO_PUBLIC_DEBUG_AUDIO=1 to enable in release builds) ---
const DEBUG_AUDIO = __DEV__ || process.env.EXPO_PUBLIC_DEBUG_AUDIO === "1"
const alog = (...args: unknown[]) => {
  if (DEBUG_AUDIO) console.log("[audio]", ...args)
}

// --- Envelope constants (linearRamp, no EPSILON needed) ---
const ATTACK_S = 0.015 // 15ms — snappy, click-free with linearRamp
const RELEASE_S = 0.15 // 150ms — smooth release tail (matches old fade feel)
const SEQ_RELEASE_S = 0.03 // 30ms — shorter for sequence clarity
const TARGET_GAIN = 0.25 // keeps 4-osc sum ≤ 1.0 (per-quantum normalization threshold)
const LOOKAHEAD_S = 0.05 // cushion for audio render thread after cold-start resume

export type Color = "red" | "blue" | "green" | "yellow"

export interface ColorMap {
  [key: string]: {
    color: string
    activeColor: string
    sound: number
    position: "topLeft" | "topRight" | "bottomLeft" | "bottomRight"
  }
}

// --- Jingle / preview note definitions ---

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

// --- Pool types ---

interface TonePool {
  oscillators: Map<number, OscillatorNode>
  gains: Map<number, GainNode>
}

// --- Hook interface ---

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
  syncVolume: () => void
}

export function useAudioTones(
  colorMap: ColorMap,
  soundEnabled: boolean,
  oscillatorType: OscillatorType = "sine",
  _onContextRecycle?: (nodeCount: number) => void,
): AudioTonesHook {
  const audioContextRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const poolRef = useRef<TonePool | null>(null)
  const contextReadyRef = useRef(false)
  const countersRef = useRef({ recreates: 0, resumeFalseNegatives: 0, droppedNotes: 0 })

  // --- AppState listener: suspend on background, resume on foreground ---

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

  // --- Context + pool lifecycle ---

  function readVolume(): number {
    const raw = loadString(SETTINGS_SOUND_VOLUME)
    if (raw == null) return 1.0
    const v = parseFloat(raw)
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1.0
  }

  function createFreshContext() {
    const ctx = new AudioContext()
    audioContextRef.current = ctx
    const master = ctx.createGain()
    master.gain.setValueAtTime(readVolume(), ctx.currentTime)
    master.connect(ctx.destination)
    masterGainRef.current = master
    contextReadyRef.current = true
    initPool(ctx, master, oscillatorType)
  }

  function initPool(ctx: AudioContext, master: GainNode, oscType: OscillatorType) {
    destroyPool()
    const pool: TonePool = { oscillators: new Map(), gains: new Map() }
    const freqs = [220, 277, 330, 415]
    for (const freq of freqs) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = oscType
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      gain.gain.setValueAtTime(0, ctx.currentTime)
      osc.connect(gain)
      gain.connect(master)
      osc.start(ctx.currentTime)
      pool.oscillators.set(freq, osc)
      pool.gains.set(freq, gain)
    }
    poolRef.current = pool
  }

  function destroyPool() {
    const pool = poolRef.current
    if (!pool) return
    for (const [, osc] of pool.oscillators) {
      try {
        osc.stop()
      } catch {}
      try {
        osc.disconnect()
      } catch {}
    }
    for (const [, gain] of pool.gains) {
      try {
        gain.disconnect()
      } catch {}
    }
    poolRef.current = null
  }

  // Returns true if the context is usable. Only suspends via AppState (background);
  // no idle-suspend timer — on Android/BT, suspending tears down the native audio
  // stream, and reopening on A2DP can take 200–500ms, dropping notes.
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
      // @ts-ignore — resume may not exist on all platforms
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
    destroyPool()
    const oldCtx = audioContextRef.current
    if (oldCtx) {
      try {
        oldCtx.close()
      } catch {}
      audioContextRef.current = null
      masterGainRef.current = null
    }
    createFreshContext()
  }

  function syncVolume() {
    const master = masterGainRef.current
    const ctx = audioContextRef.current
    if (master && ctx) {
      master.gain.setValueAtTime(readVolume(), ctx.currentTime)
    }
  }

  // Rebuild pooled oscillators when the selected sound pack changes.
  // noteOn/noteOff/scheduleSequence use the prebuilt pool frequencies (220/277/330/415),
  // so we need to recreate the pool to apply a new oscillator type.
  useEffect(() => {
    const ctx = audioContextRef.current
    const master = masterGainRef.current
    if (!contextReadyRef.current || !ctx || !master) return
    initPool(ctx, master, oscillatorType)
  }, [oscillatorType])

  // --- Pool-based note control (game frequencies only) ---

  function noteOn(color: Color) {
    if (!soundEnabled || !contextReadyRef.current) {
      alog("noteOn: skipped", {
        color,
        soundEnabled,
        contextReady: contextReadyRef.current,
      })
      return
    }
    if (!ensureResumed("noteOn")) {
      recreateContext("noteOn")
    }
    const ctx = audioContextRef.current
    const pool = poolRef.current
    if (!ctx || !pool) {
      countersRef.current.droppedNotes++
      alog("noteOn: dropped (no ctx/pool)", { color })
      return
    }

    const freq = colorMap[color].sound
    const gain = pool.gains.get(freq)
    if (!gain) {
      countersRef.current.droppedNotes++
      alog("noteOn: dropped (no gain for freq)", { color, freq })
      return
    }

    const now = ctx.currentTime
    // Cancel ALL scheduled events (not just from now) to ensure no
    // lingering sequence automation interferes with the sustained hold
    gain.gain.cancelScheduledValues(0)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(TARGET_GAIN, now + ATTACK_S)
  }

  function noteOff(color: Color) {
    if (!contextReadyRef.current) return
    const ctx = audioContextRef.current
    const pool = poolRef.current
    if (!ctx || !pool) return

    const freq = colorMap[color].sound
    const gain = pool.gains.get(freq)
    if (!gain) return

    const now = ctx.currentTime
    gain.gain.cancelScheduledValues(0)
    gain.gain.setValueAtTime(gain.gain.value, now)
    gain.gain.linearRampToValueAtTime(0, now + RELEASE_S)
  }

  function silenceAll() {
    const ctx = audioContextRef.current
    const master = masterGainRef.current
    if (!ctx || !master) return

    // Destroy and rebuild the pool — the only reliable way to kill
    // all scheduled gain automation. cancelScheduledValues is unreliable
    // in react-native-audio-api for events scheduled at future times.
    destroyPool()
    initPool(ctx, master, oscillatorType)
  }

  // --- Pre-scheduled sequence (audio-clock precise, zero JS jitter) ---

  function scheduleSequence(colors: Color[], intervalS: number, durationS: number) {
    if (!soundEnabled || !contextReadyRef.current) {
      alog("scheduleSequence: skipped", {
        soundEnabled,
        contextReady: contextReadyRef.current,
      })
      return
    }
    if (!ensureResumed("scheduleSequence")) {
      recreateContext("scheduleSequence")
    }
    const ctx = audioContextRef.current
    const pool = poolRef.current
    if (!ctx || !pool) {
      alog("scheduleSequence: dropped (no ctx/pool)")
      return
    }

    alog("scheduleSequence", {
      state: ctx.state,
      currentTime: ctx.currentTime.toFixed(3),
      notes: colors.length,
      intervalS,
      durationS,
      firstNoteAt: (ctx.currentTime + LOOKAHEAD_S + intervalS).toFixed(3),
    })

    const now = ctx.currentTime + LOOKAHEAD_S

    for (let i = 0; i < colors.length; i++) {
      const freq = colorMap[colors[i]].sound
      const gain = pool.gains.get(freq)
      if (!gain) continue

      const noteStart = now + (i + 1) * intervalS
      const noteEnd = noteStart + durationS

      // Attack: ramp from 0 to TARGET_GAIN
      gain.gain.setValueAtTime(0, noteStart)
      gain.gain.linearRampToValueAtTime(TARGET_GAIN, noteStart + ATTACK_S)
      // Release: ramp back to 0
      gain.gain.setValueAtTime(TARGET_GAIN, noteEnd - SEQ_RELEASE_S)
      gain.gain.linearRampToValueAtTime(0, noteEnd)
    }
  }

  // --- One-shot note scheduling (jingles use frequencies outside the pool) ---

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
    g.gain.linearRampToValueAtTime(peakGain, noteStart + ATTACK_S)
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

      const now = ctx.currentTime + LOOKAHEAD_S
      for (const note of notes) {
        scheduleOneShot(
          ctx,
          master,
          note.freq,
          oscillatorType,
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

  // --- Public jingle/preview functions ---

  function playPreview(overrideType?: OscillatorType) {
    if (!soundEnabled || !contextReadyRef.current) return
    if (!ensureResumed("preview")) {
      recreateContext("preview")
    }
    try {
      const ctx = audioContextRef.current
      const master = masterGainRef.current
      if (!ctx || !master) return

      const type = overrideType ?? oscillatorType
      const now = ctx.currentTime + LOOKAHEAD_S
      for (const note of PREVIEW_NOTES) {
        scheduleOneShot(
          ctx,
          master,
          note.freq,
          type,
          now + note.delay,
          PREVIEW_NOTE_DURATION,
          TARGET_GAIN * 0.8,
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

  // --- Init / cleanup ---

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
    destroyPool()
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
    syncVolume,
  }
}

export default useAudioTones
