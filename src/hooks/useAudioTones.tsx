import { useRef } from "react"
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

const NODE_LIMIT = 60

interface AudioTonesHook {
  initialize: () => Promise<void>
  cleanup: () => Promise<void>
  playSound: (color: Color, duration?: number) => void
  playPreview: (overrideType?: OscillatorType) => void
  playJingle: () => void
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

  function getContext(): AudioContext | null {
    return audioContextRef.current
  }

  function getMasterGain(): GainNode | null {
    return masterGainRef.current
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

  // Recycle the context if too many nodes have accumulated.
  // Fades out any active sound first to avoid hard-cut pops.
  function recycleContextIfNeeded() {
    if (nodeCountRef.current < NODE_LIMIT) return
    const recycledCount = nodeCountRef.current
    if (activeSoundRef.current) {
      silentDiscard(activeSoundRef.current)
      activeSoundRef.current = null
    }
    const oldCtx = audioContextRef.current
    if (oldCtx) {
      try { oldCtx.close() } catch {}
    }
    createFreshContext()
    onContextRecycle?.(recycledCount)
  }

  // Immediately silence and disconnect a sound without scheduling
  // (safe to call even on a closing context)
  function silentDiscard(sound: ActiveSound) {
    try {
      sound.gain.gain.setValueAtTime(EPSILON, 0)
      sound.oscillator.stop(0)
    } catch {}
    try { sound.oscillator.disconnect() } catch {}
    try { sound.gain.disconnect() } catch {}
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

      setTimeout(() => {
        try { sound.oscillator.disconnect() } catch {}
        try { sound.gain.disconnect() } catch {}
      }, Math.ceil((fadeS + 0.05) * 1000))
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

    setTimeout(() => {
      try { osc.disconnect() } catch {}
      try { g.disconnect() } catch {}
    }, (noteStart - ctx.currentTime + duration + 0.05) * 1000)
  }

  async function initialize() {
    try {
      createFreshContext()
      // @ts-ignore — resume may not exist on all platforms
      await audioContextRef.current?.resume?.()
    } catch (error) {
      console.log("Audio initialization failed:", error)
    }
  }

  async function cleanup() {
    contextReadyRef.current = false
    if (activeSoundRef.current) {
      silentDiscard(activeSoundRef.current)
      activeSoundRef.current = null
    }
    if (audioContextRef.current) {
      try { await audioContextRef.current.close() } catch {}
      audioContextRef.current = null
      masterGainRef.current = null
    }
  }

  // Used by the computer during sequence playback — pre-scheduled envelope
  function playSound(color: Color, duration: number = 600) {
    if (!soundEnabled || !contextReadyRef.current) return

    recycleContextIfNeeded()
    const ctx = getContext()
    const master = getMasterGain()
    if (!ctx || !master) return

    const frequency = colorMap[color].sound
    const durationS = duration / 1000
    scheduleNote(ctx, master, frequency, oscillatorType, ctx.currentTime, durationS, TARGET_GAIN)
  }

  // Used by the player on touch — SYNCHRONOUS node creation, no async race
  function startContinuousSound(color: Color) {
    if (!soundEnabled || !contextReadyRef.current) return

    recycleContextIfNeeded()

    // Fade out any existing sound first
    if (activeSoundRef.current) {
      fadeOutAndStop(activeSoundRef.current, 0.02)
      activeSoundRef.current = null
    }

    const frequency = colorMap[color].sound
    const sound = createSound(frequency)
    if (!sound) return

    activeSoundRef.current = sound
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
    if (!contextReadyRef.current) return
    recycleContextIfNeeded()
    const ctx = getContext()
    const master = getMasterGain()
    if (!ctx || !master) return

    const type = overrideType ?? oscillatorType
    const now = ctx.currentTime

    for (const note of PREVIEW_NOTES) {
      scheduleNote(ctx, master, note.freq, type, now + note.delay, PREVIEW_NOTE_DURATION, TARGET_GAIN * 0.8)
    }
  }

  function playJingle() {
    if (!soundEnabled || !contextReadyRef.current) return
    recycleContextIfNeeded()
    const ctx = getContext()
    const master = getMasterGain()
    if (!ctx || !master) return

    const now = ctx.currentTime

    for (const note of JINGLE_NOTES) {
      scheduleNote(ctx, master, note.freq, oscillatorType, now + note.delay, JINGLE_NOTE_DURATION, TARGET_GAIN * 0.6)
    }
  }

  return {
    initialize,
    cleanup,
    playSound,
    playPreview,
    playJingle,
    startContinuousSound,
    stopContinuousSound,
    stopContinuousSoundWithFade,
  }
}

export default useAudioTones
