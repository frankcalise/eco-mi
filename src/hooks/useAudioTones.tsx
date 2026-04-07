import { useRef } from "react"
import { AudioContext, GainNode, OscillatorNode } from "react-native-audio-api"
import type { OscillatorType } from "react-native-audio-api"

const ATTACK_S = 0.025 // 25ms fade-in (longer = fewer pops on fast hardware)
const RELEASE_S = 0.04 // 40ms fade-out
const TARGET_GAIN = 0.3
const EPSILON = 0.0001

export type Color = "red" | "blue" | "green" | "yellow"

export interface ColorMap {
  [key: string]: {
    color: string
    activeColor: string
    sound: number
    position: "topLeft" | "topRight" | "bottomLeft" | "bottomRight"
  }
}

// Ascending arpeggio frequencies — the 4 game tones in a pleasing pattern
const PREVIEW_NOTES = [
  { freq: 220, delay: 0 }, // red
  { freq: 277, delay: 0.15 }, // blue
  { freq: 330, delay: 0.3 }, // green
  { freq: 415, delay: 0.45 }, // yellow
  { freq: 330, delay: 0.6 }, // green (resolve back down)
  { freq: 415, delay: 0.7 }, // yellow (end on high)
]
const PREVIEW_NOTE_DURATION = 0.12

// Retro chiptune jingle — short ascending C-major melody with resolution
const JINGLE_NOTES = [
  { freq: 523, delay: 0 }, // C5
  { freq: 659, delay: 0.2 }, // E5
  { freq: 784, delay: 0.4 }, // G5
  { freq: 1047, delay: 0.6 }, // C6
  { freq: 784, delay: 0.85 }, // G5
  { freq: 1047, delay: 1.05 }, // C6 (resolve)
]
const JINGLE_NOTE_DURATION = 0.15

interface AudioTonesHook {
  initialize: () => Promise<void>
  cleanup: () => Promise<void>
  playSound: (color: Color, duration?: number) => Promise<void>
  playPreview: (overrideType?: OscillatorType) => Promise<void>
  playJingle: () => Promise<void>
  startContinuousSound: (color: Color) => Promise<void>
  stopContinuousSound: (color: Color) => Promise<void>
  stopContinuousSoundWithFade: (color: Color, fadeDuration?: number) => Promise<void>
}

interface ActiveSound {
  oscillator: OscillatorNode
  gain: GainNode
}

export function useAudioTones(
  colorMap: ColorMap,
  soundEnabled: boolean,
  oscillatorType: OscillatorType = "sine",
): AudioTonesHook {
  const audioContextRef = useRef<AudioContext | null>(null)
  const activeSoundRef = useRef<ActiveSound | null>(null)
  const nodeCountRef = useRef(0)
  const NODE_LIMIT = 50

  function getContext(): AudioContext | null {
    return audioContextRef.current
  }

  async function refreshContextIfNeeded() {
    if (nodeCountRef.current < NODE_LIMIT) return
    const oldCtx = audioContextRef.current
    if (oldCtx) {
      try {
        await oldCtx.close()
      } catch {}
    }
    audioContextRef.current = new AudioContext()
    // @ts-ignore
    await audioContextRef.current?.resume?.()
    nodeCountRef.current = 0
  }

  function fadeOutAndDiscard(sound: ActiveSound, fadeS: number) {
    const ctx = getContext()
    if (!ctx) return

    try {
      const now = ctx.currentTime
      sound.gain.gain.cancelScheduledValues(now)
      sound.gain.gain.setValueAtTime(Math.max(sound.gain.gain.value, EPSILON), now)
      sound.gain.gain.exponentialRampToValueAtTime(EPSILON, now + fadeS)
      sound.oscillator.stop(now + fadeS + 0.01)

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
      try {
        sound.oscillator.disconnect()
      } catch {}
      try {
        sound.gain.disconnect()
      } catch {}
    }
  }

  function createSound(frequency: number): ActiveSound | null {
    const ctx = getContext()
    if (!ctx) return null

    const now = ctx.currentTime
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.type = oscillatorType
    oscillator.frequency.setValueAtTime(frequency, now)

    gain.gain.setValueAtTime(EPSILON, now)
    gain.gain.exponentialRampToValueAtTime(TARGET_GAIN, now + ATTACK_S)

    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(now)
    nodeCountRef.current += 1

    return { oscillator, gain }
  }

  async function initialize() {
    try {
      audioContextRef.current = new AudioContext()
      // @ts-ignore — resume may not exist on all platforms
      await audioContextRef.current?.resume?.()
    } catch (error) {
      console.log("Audio initialization failed:", error)
    }
  }

  async function cleanup() {
    if (activeSoundRef.current) {
      fadeOutAndDiscard(activeSoundRef.current, 0.01)
      activeSoundRef.current = null
    }
    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close()
      } catch {}
      audioContextRef.current = null
    }
  }

  async function playSound(color: Color, duration: number = 600) {
    if (!soundEnabled || !getContext()) return

    await refreshContextIfNeeded()
    const ctx = getContext()!
    // @ts-ignore
    await ctx?.resume?.()

    const frequency = colorMap[color].sound
    const sound = createSound(frequency)
    if (!sound) return

    const durationS = duration / 1000
    const now = ctx.currentTime

    // Schedule the release envelope and stop
    sound.gain.gain.exponentialRampToValueAtTime(EPSILON, now + durationS - RELEASE_S)
    sound.oscillator.stop(now + durationS)

    setTimeout(() => {
      try {
        sound.oscillator.disconnect()
      } catch {}
      try {
        sound.gain.disconnect()
      } catch {}
    }, duration + 50)
  }

  async function playPreview(overrideType?: OscillatorType) {
    if (!getContext()) return
    await refreshContextIfNeeded()
    const ctx = getContext()!
    // @ts-ignore
    await ctx?.resume?.()

    const type = overrideType ?? oscillatorType
    const now = ctx.currentTime

    for (const note of PREVIEW_NOTES) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = type
      osc.frequency.setValueAtTime(note.freq, now + note.delay)

      const noteStart = now + note.delay
      gain.gain.setValueAtTime(EPSILON, noteStart)
      gain.gain.exponentialRampToValueAtTime(TARGET_GAIN * 0.8, noteStart + ATTACK_S)
      gain.gain.exponentialRampToValueAtTime(EPSILON, noteStart + PREVIEW_NOTE_DURATION)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(noteStart)
      osc.stop(noteStart + PREVIEW_NOTE_DURATION + 0.01)
      nodeCountRef.current += 1

      setTimeout(
        () => {
          try {
            osc.disconnect()
          } catch {}
          try {
            gain.disconnect()
          } catch {}
        },
        (note.delay + PREVIEW_NOTE_DURATION + 0.05) * 1000,
      )
    }
  }

  async function playJingle() {
    if (!soundEnabled) return
    if (!getContext()) return

    await refreshContextIfNeeded()
    const ctx = getContext()!
    // @ts-ignore
    await ctx?.resume?.()

    const now = ctx.currentTime

    for (const note of JINGLE_NOTES) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = oscillatorType
      osc.frequency.setValueAtTime(note.freq, now + note.delay)

      const noteStart = now + note.delay
      gain.gain.setValueAtTime(EPSILON, noteStart)
      gain.gain.exponentialRampToValueAtTime(TARGET_GAIN * 0.6, noteStart + ATTACK_S)
      gain.gain.exponentialRampToValueAtTime(EPSILON, noteStart + JINGLE_NOTE_DURATION)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(noteStart)
      osc.stop(noteStart + JINGLE_NOTE_DURATION + 0.01)
      nodeCountRef.current += 1

      setTimeout(
        () => {
          try {
            osc.disconnect()
          } catch {}
          try {
            gain.disconnect()
          } catch {}
        },
        (note.delay + JINGLE_NOTE_DURATION + 0.05) * 1000,
      )
    }
  }

  async function startContinuousSound(color: Color) {
    if (!soundEnabled || !getContext()) return

    await refreshContextIfNeeded()
    const ctx = getContext()!
    // @ts-ignore
    await ctx?.resume?.()

    // Fade out any existing sound first — never reuse a dying oscillator
    if (activeSoundRef.current) {
      fadeOutAndDiscard(activeSoundRef.current, RELEASE_S)
      activeSoundRef.current = null
    }

    const frequency = colorMap[color].sound
    const sound = createSound(frequency)
    if (!sound) return

    activeSoundRef.current = sound
  }

  async function stopContinuousSound(_color: Color) {
    if (!activeSoundRef.current) return

    fadeOutAndDiscard(activeSoundRef.current, RELEASE_S)
    activeSoundRef.current = null
  }

  async function stopContinuousSoundWithFade(_color: Color, fadeDuration: number = 200) {
    if (!activeSoundRef.current) return

    const fadeS = Math.max(fadeDuration / 1000, 0.01)
    fadeOutAndDiscard(activeSoundRef.current, fadeS)
    activeSoundRef.current = null
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
