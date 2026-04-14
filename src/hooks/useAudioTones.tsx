import { useRef, useEffect } from "react"
import { AppState } from "react-native"
import { AudioContext, GainNode, OscillatorNode } from "react-native-audio-api"
import type { OscillatorType } from "react-native-audio-api"

// Envelope constants — tuned to avoid clicks on react-native-audio-api
// which has per-quantum normalization that amplifies discontinuities
const ATTACK_S = 0.03 // 30ms fade-in
const RELEASE_S = 0.05 // 50ms fade-out
const TARGET_GAIN = 0.25 // Lower peak to avoid per-quantum normalization spikes
const EPSILON = 0.001 // Higher floor to reduce exponential ramp steepness (300x ratio vs 3000x)

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

const NODE_LIMIT = 60

interface AudioTonesHook {
  initialize: () => Promise<void>
  cleanup: () => Promise<void>
  playSound: (color: Color, duration?: number) => void
  playSequenceTones: (colors: Color[], intervalMs: number, flashDurationMs: number) => (() => void) | null
  playPreview: (overrideType?: OscillatorType) => void
  playJingle: () => void
  playGameOverJingle: () => void
  playHighScoreJingle: () => void
  startContinuousSound: (color: Color) => void
  stopContinuousSound: (color: Color) => void
  stopContinuousSoundWithFade: (color: Color, fadeDuration?: number) => void
}

interface ActiveSound {
  oscillator: OscillatorNode
  gain: GainNode
}

export function useAudioTones(
  colorMap: ColorMap,
  soundEnabled: boolean,
  oscillatorType: OscillatorType = "sine",
  onContextRecycle?: (nodeCount: number) => void,
): AudioTonesHook {
  const audioContextRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const activeSoundRef = useRef<ActiveSound | null>(null)
  const nodeCountRef = useRef(0)
  const contextReadyRef = useRef(false)
  const suspendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const SUSPEND_DELAY = 3000 // Suspend context after 3s of no audio activity

  // Suspend context when app goes to background, resume when foregrounded
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

  function getContext(): AudioContext | null {
    return audioContextRef.current
  }

  function getMasterGain(): GainNode | null {
    return masterGainRef.current
  }

  // Resume the context and reset the auto-suspend timer.
  // Called before every sound to ensure the context is running.
  // Returns true if the context is healthy, false if it needs recreation.
  function ensureResumed(): boolean {
    const ctx = getContext()
    if (!ctx) return false

    // If the context has been closed, it cannot be resumed
    if (ctx.state === "closed") return false

    try {
      // @ts-ignore — resume may not exist on all platforms
      ctx.resume?.()
    } catch {
      return false
    }

    // After resume attempt, check if the context is still suspended.
    // On iOS after prolonged backgrounding, resume() can succeed without
    // actually transitioning the state — treat this as unrecoverable.
    if (ctx.state === "suspended") return false

    // Reset the auto-suspend timer
    if (suspendTimerRef.current) clearTimeout(suspendTimerRef.current)
    suspendTimerRef.current = setTimeout(() => {
      const c = getContext()
      if (c && !activeSoundRef.current) {
        try {
          c.suspend()
        } catch {}
      }
    }, SUSPEND_DELAY)
    return true
  }

  // Tear down the current audio context and build a fresh one.
  // Used when the context enters an unrecoverable state (closed, or
  // permanently stuck suspended after prolonged backgrounding on iOS).
  function recreateContext() {
    // Clean up the old context
    if (activeSoundRef.current) {
      silentDiscard(activeSoundRef.current)
      activeSoundRef.current = null
    }
    const oldCtx = audioContextRef.current
    if (oldCtx) {
      try {
        oldCtx.close()
      } catch {}
      audioContextRef.current = null
      masterGainRef.current = null
    }

    // Build a new context + master gain
    createFreshContext()

    // Reset the auto-suspend timer for the new context
    if (suspendTimerRef.current) clearTimeout(suspendTimerRef.current)
    suspendTimerRef.current = setTimeout(() => {
      const c = getContext()
      if (c && !activeSoundRef.current) {
        try {
          c.suspend()
        } catch {}
      }
    }, SUSPEND_DELAY)
  }

  // Create a fresh context + master gain node. All oscillators route through
  // the master gain to avoid per-quantum normalization artifacts from
  // varying peak levels hitting the destination directly.
  function createFreshContext() {
    const ctx = new AudioContext()
    audioContextRef.current = ctx
    const master = ctx.createGain()
    master.gain.setValueAtTime(1.0, ctx.currentTime)
    master.connect(ctx.destination)
    masterGainRef.current = master
    nodeCountRef.current = 0
    contextReadyRef.current = true
  }

  // Monitor node count — log but don't recycle. The audio engine's
  // internal GC handles stopped+disconnected nodes. Recycling was
  // causing more problems (sound death) than it solved.
  function trackNodeCount() {
    if (nodeCountRef.current > 0 && nodeCountRef.current % NODE_LIMIT === 0) {
      onContextRecycle?.(nodeCountRef.current)
    }
  }

  // Immediately silence and disconnect a sound without scheduling
  // (safe to call even on a closing context)
  function silentDiscard(sound: ActiveSound) {
    try {
      sound.gain.gain.setValueAtTime(EPSILON, 0)
      sound.oscillator.stop(0)
    } catch {}
    try {
      sound.oscillator.disconnect()
    } catch {}
    try {
      sound.gain.disconnect()
    } catch {}
  }

  // Schedule a clean fade-out using setTargetAtTime. Does NOT cancel
  // in-flight ramps — setTargetAtTime takes over smoothly from whatever
  // the current interpolated value is, avoiding the discontinuity that
  // cancelScheduledValues + setValueAtTime would cause mid-ramp.
  function fadeOutAndStop(sound: ActiveSound, fadeS: number) {
    const ctx = getContext()
    if (!ctx) {
      silentDiscard(sound)
      return
    }

    try {
      const now = ctx.currentTime
      // timeConstant = fadeS/3 means ~95% decay in fadeS seconds.
      // setTargetAtTime starts from the current computed value —
      // no need to anchor with setValueAtTime first.
      sound.gain.gain.setTargetAtTime(0, now, fadeS / 3)
      sound.oscillator.stop(now + fadeS + 0.02)

      setTimeout(
        () => {
          try {
            sound.oscillator.disconnect()
          } catch {}
          try {
            sound.gain.disconnect()
          } catch {}
        },
        Math.ceil((fadeS + 0.05) * 1000),
      )
    } catch {
      silentDiscard(sound)
    }
  }

  // Create a new oscillator + gain, routed through master gain.
  // This is SYNCHRONOUS — no awaits, no race conditions.
  function createSound(frequency: number): ActiveSound | null {
    const ctx = getContext()
    const master = getMasterGain()
    if (!ctx || !master) return null

    const now = ctx.currentTime
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.type = oscillatorType
    oscillator.frequency.setValueAtTime(frequency, now)

    // Start at silence, ramp up
    gain.gain.setValueAtTime(EPSILON, now)
    gain.gain.exponentialRampToValueAtTime(TARGET_GAIN, now + ATTACK_S)

    oscillator.connect(gain)
    gain.connect(master) // Route through master, not directly to destination
    oscillator.start(now)
    nodeCountRef.current += 1

    return { oscillator, gain }
  }

  // Schedule a self-contained note with attack + release envelope
  function scheduleNote(
    ctx: AudioContext,
    master: GainNode,
    freq: number,
    type: OscillatorType,
    noteStart: number,
    duration: number,
    gain: number,
  ) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(freq, noteStart)

    g.gain.setValueAtTime(EPSILON, noteStart)
    g.gain.exponentialRampToValueAtTime(gain, noteStart + ATTACK_S)
    g.gain.exponentialRampToValueAtTime(EPSILON, noteStart + duration)

    osc.connect(g)
    g.connect(master)
    osc.start(noteStart)
    osc.stop(noteStart + duration + 0.02)
    nodeCountRef.current += 1

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
    if (activeSoundRef.current) {
      silentDiscard(activeSoundRef.current)
      activeSoundRef.current = null
    }
    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close()
      } catch {}
      audioContextRef.current = null
      masterGainRef.current = null
    }
  }

  // Used by the computer during sequence playback — pre-scheduled envelope
  function playSound(color: Color, duration: number = 600) {
    if (!soundEnabled || !contextReadyRef.current) return

    trackNodeCount()
    if (!ensureResumed()) {
      recreateContext()
    }
    try {
      const ctx = getContext()
      const master = getMasterGain()
      if (!ctx || !master) return

      const frequency = colorMap[color].sound
      const durationS = duration / 1000
      scheduleNote(ctx, master, frequency, oscillatorType, ctx.currentTime, durationS, TARGET_GAIN)
    } catch {
      recreateContext()
    }
  }

  // Pre-schedule all tones for a sequence in one pass using the audio clock.
  // Avoids the pops caused by scheduling each note at JS-callback time.
  // Returns a cancel function to silence remaining notes on early exit.
  function playSequenceTones(
    colors: Color[],
    intervalMs: number,
    flashDurationMs: number,
  ): (() => void) | null {
    if (!soundEnabled || !contextReadyRef.current) return null

    trackNodeCount()
    if (!ensureResumed()) {
      recreateContext()
    }
    try {
      const ctx = getContext()
      const master = getMasterGain()
      if (!ctx || !master) return null

      const seqGain = ctx.createGain()
      seqGain.gain.setValueAtTime(1.0, ctx.currentTime)
      seqGain.connect(master)

      const now = ctx.currentTime
      const intervalS = intervalMs / 1000
      const durationS = flashDurationMs / 1000
      const oscillators: OscillatorNode[] = []

      colors.forEach((color, index) => {
        const noteStart = now + (index + 1) * intervalS
        const frequency = colorMap[color].sound

        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = oscillatorType
        osc.frequency.setValueAtTime(frequency, noteStart)
        g.gain.setValueAtTime(EPSILON, noteStart)
        g.gain.exponentialRampToValueAtTime(TARGET_GAIN, noteStart + ATTACK_S)
        g.gain.exponentialRampToValueAtTime(EPSILON, noteStart + durationS)
        osc.connect(g)
        g.connect(seqGain)
        osc.start(noteStart)
        osc.stop(noteStart + durationS + 0.02)
        nodeCountRef.current += 1
        oscillators.push(osc)
      })

      const totalS = (colors.length + 1) * intervalS + durationS + 0.05
      const cleanupTimer = setTimeout(() => {
        try { seqGain.disconnect() } catch {}
      }, totalS * 1000)

      return () => {
        try {
          const t = ctx.currentTime
          seqGain.gain.setTargetAtTime(0, t, 0.01)
          for (const osc of oscillators) {
            try { osc.stop(t + 0.05) } catch {}
          }
          clearTimeout(cleanupTimer)
          setTimeout(() => { try { seqGain.disconnect() } catch {} }, 100)
        } catch {}
      }
    } catch {
      recreateContext()
      return null
    }
  }

  // Used by the player on touch — SYNCHRONOUS node creation, no async race
  function startContinuousSound(color: Color) {
    if (!soundEnabled || !contextReadyRef.current) return

    trackNodeCount()
    if (!ensureResumed()) {
      recreateContext()
    }

    try {
      // Fade out any existing sound first
      if (activeSoundRef.current) {
        fadeOutAndStop(activeSoundRef.current, 0.02)
        activeSoundRef.current = null
      }

      const frequency = colorMap[color].sound
      const sound = createSound(frequency)
      if (!sound) return

      activeSoundRef.current = sound
    } catch {
      recreateContext()
    }
  }

  // Used by the player on release — setTargetAtTime for clean fade to zero
  function stopContinuousSound(_color: Color) {
    if (!activeSoundRef.current) return
    fadeOutAndStop(activeSoundRef.current, RELEASE_S)
    activeSoundRef.current = null
  }

  function stopContinuousSoundWithFade(_color: Color, fadeDuration: number = 200) {
    if (!activeSoundRef.current) return
    const fadeS = Math.max(fadeDuration / 1000, 0.02)
    fadeOutAndStop(activeSoundRef.current, fadeS)
    activeSoundRef.current = null
  }

  function playPreview(overrideType?: OscillatorType) {
    if (!soundEnabled) return
    if (!contextReadyRef.current) return
    trackNodeCount()
    if (!ensureResumed()) {
      recreateContext()
    }
    try {
      const ctx = getContext()
      const master = getMasterGain()
      if (!ctx || !master) return

      const type = overrideType ?? oscillatorType
      const now = ctx.currentTime

      for (const note of PREVIEW_NOTES) {
        scheduleNote(
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
    if (!soundEnabled || !contextReadyRef.current) return
    trackNodeCount()
    if (!ensureResumed()) {
      recreateContext()
    }
    try {
      const ctx = getContext()
      const master = getMasterGain()
      if (!ctx || !master) return

      const now = ctx.currentTime

      for (const note of JINGLE_NOTES) {
        scheduleNote(
          ctx,
          master,
          note.freq,
          oscillatorType,
          now + note.delay,
          JINGLE_NOTE_DURATION,
          TARGET_GAIN * 0.6,
        )
      }
    } catch {
      recreateContext()
    }
  }

  function playGameOverJingle() {
    if (!soundEnabled || !contextReadyRef.current) return
    trackNodeCount()
    if (!ensureResumed()) {
      recreateContext()
    }
    try {
      const ctx = getContext()
      const master = getMasterGain()
      if (!ctx || !master) return

      const now = ctx.currentTime

      for (const note of GAMEOVER_NOTES) {
        scheduleNote(
          ctx,
          master,
          note.freq,
          oscillatorType,
          now + note.delay,
          GAMEOVER_NOTE_DURATION,
          TARGET_GAIN * 0.4,
        )
      }
    } catch {
      recreateContext()
    }
  }

  function playHighScoreJingle() {
    if (!soundEnabled || !contextReadyRef.current) return
    trackNodeCount()
    if (!ensureResumed()) {
      recreateContext()
    }
    try {
      const ctx = getContext()
      const master = getMasterGain()
      if (!ctx || !master) return

      const now = ctx.currentTime

      for (const note of HIGHSCORE_NOTES) {
        scheduleNote(
          ctx,
          master,
          note.freq,
          oscillatorType,
          now + note.delay,
          HIGHSCORE_NOTE_DURATION,
          TARGET_GAIN * 0.7,
        )
      }
    } catch {
      recreateContext()
    }
  }

  return {
    initialize,
    cleanup,
    playSound,
    playSequenceTones,
    playPreview,
    playJingle,
    playGameOverJingle,
    playHighScoreJingle,
    startContinuousSound,
    stopContinuousSound,
    stopContinuousSoundWithFade,
  }
}

export default useAudioTones
