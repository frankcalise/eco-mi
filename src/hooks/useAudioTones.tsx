import { useRef, useEffect } from "react"
import { AppState } from "react-native"
import { AudioContext, GainNode, OscillatorNode } from "react-native-audio-api"
import type { OscillatorType } from "react-native-audio-api"

import { SETTINGS_SOUND_VOLUME } from "@/config/storageKeys"
import { loadString } from "@/utils/storage"

// --- Envelope constants (linearRamp, no EPSILON needed) ---
const ATTACK_S = 0.015 // 15ms — snappy, click-free with linearRamp
const RELEASE_S = 0.15 // 150ms — smooth release tail (matches old fade feel)
const SEQ_RELEASE_S = 0.03 // 30ms — shorter for sequence clarity
const TARGET_GAIN = 0.25 // keeps 4-osc sum ≤ 1.0 (per-quantum normalization threshold)

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

const SUSPEND_DELAY = 5000

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
  const suspendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // --- AppState listener: suspend on background, resume on foreground ---

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      const ctx = audioContextRef.current
      if (!ctx) return
      if (state === "background") {
        try {
          ctx.suspend()
        } catch {}
      } else if (state === "active" && contextReadyRef.current) {
        if (!ensureResumed()) {
          recreateContext()
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

  function ensureResumed(): boolean {
    const ctx = audioContextRef.current
    if (!ctx) return false
    if (ctx.state === "closed") return false

    try {
      // @ts-ignore — resume may not exist on all platforms
      ctx.resume?.()
    } catch {
      return false
    }

    if (ctx.state === "suspended") return false

    if (suspendTimerRef.current) clearTimeout(suspendTimerRef.current)
    suspendTimerRef.current = setTimeout(() => {
      const c = audioContextRef.current
      if (c) {
        try {
          c.suspend()
        } catch {}
      }
    }, SUSPEND_DELAY)
    return true
  }

  function recreateContext() {
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
    if (suspendTimerRef.current) clearTimeout(suspendTimerRef.current)
    suspendTimerRef.current = setTimeout(() => {
      const c = audioContextRef.current
      if (c) {
        try {
          c.suspend()
        } catch {}
      }
    }, SUSPEND_DELAY)
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
    if (!soundEnabled || !contextReadyRef.current) return
    if (!ensureResumed()) {
      recreateContext()
    }
    const ctx = audioContextRef.current
    const pool = poolRef.current
    if (!ctx || !pool) return

    const freq = colorMap[color].sound
    const gain = pool.gains.get(freq)
    if (!gain) return

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
    if (!soundEnabled || !contextReadyRef.current) return
    if (!ensureResumed()) {
      recreateContext()
    }
    const ctx = audioContextRef.current
    const pool = poolRef.current
    if (!ctx || !pool) return

    // Extend the suspend timer to cover the entire sequence duration + margin
    const totalSequenceS = (colors.length + 1) * intervalS + durationS + 1
    if (suspendTimerRef.current) clearTimeout(suspendTimerRef.current)
    suspendTimerRef.current = setTimeout(() => {
      const c = audioContextRef.current
      if (c) {
        try {
          c.suspend()
        } catch {}
      }
    }, totalSequenceS * 1000)

    const now = ctx.currentTime

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
    if (!ensureResumed()) {
      recreateContext()
    }
    try {
      const ctx = audioContextRef.current
      const master = masterGainRef.current
      if (!ctx || !master) return

      const now = ctx.currentTime
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
    } catch {
      recreateContext()
    }
  }

  // --- Public jingle/preview functions ---

  function playPreview(overrideType?: OscillatorType) {
    if (!soundEnabled || !contextReadyRef.current) return
    if (!ensureResumed()) {
      recreateContext()
    }
    try {
      const ctx = audioContextRef.current
      const master = masterGainRef.current
      if (!ctx || !master) return

      const type = overrideType ?? oscillatorType
      const now = ctx.currentTime
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
    } catch {
      recreateContext()
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
    try {
      createFreshContext()
      ensureResumed()
    } catch (error) {
      console.log("Audio initialization failed:", error)
    }
  }

  async function cleanup() {
    contextReadyRef.current = false
    if (suspendTimerRef.current) {
      clearTimeout(suspendTimerRef.current)
      suspendTimerRef.current = null
    }
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
