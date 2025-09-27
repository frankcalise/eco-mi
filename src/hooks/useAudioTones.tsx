import { useRef, useCallback } from "react"
import { AudioContext, GainNode, OscillatorNode } from "react-native-audio-api"


// Fast, click-free envelope (tweak to taste)
const ATTACK_S = 0.01;         // 10 ms fade-in
const RELEASE_S = 0.02;        // 20 ms fade-out
const TARGET_GAIN = 0.3;       // peak volume (0..1)
const EPSILON = 0.0001;        // never ramp to exactly 0 with exponential ramps

export type Color = "red" | "blue" | "green" | "yellow"

export interface ColorMap {
  [key: string]: {
    color: string
    activeColor: string
    sound: number
    position: "topLeft" | "topRight" | "bottomLeft" | "bottomRight"
  }
}

interface AudioTonesHook {
  /**
   * Initialize audio system
   */
  initialize: () => Promise<void>

  /**
   * Cleanup audio resources
   */
  cleanup: () => Promise<void>

  /**
   * Play a sound for a specified duration
   * @param color The color associated with the sound
   * @param duration How long to play in milliseconds
   */
  playSound: (color: Color, duration?: number) => Promise<void>

  /**
   * Start playing a continuous sound
   * @param color The color associated with the sound
   */
  startContinuousSound: (color: Color) => Promise<void>

  /**
   * Stop a currently playing continuous sound
   * @param color The color associated with the sound
   */
  stopContinuousSound: (color: Color) => Promise<void>

  /**
   * Stop a continuous sound with fade-out effect
   * @param color The color associated with the sound
   * @param fadeDuration How long the fade-out should take in milliseconds
   */
  stopContinuousSoundWithFade: (color: Color, fadeDuration?: number) => Promise<void>
}

/**
 * Native implementation of audio tones using react-native-audio-api
 * @param colorMap Color mapping with frequency information
 * @param soundEnabled Whether sound is enabled
 */
export function useAudioTones(colorMap: ColorMap, soundEnabled: boolean): AudioTonesHook {
  const audioContextRef = useRef<AudioContext | null>(null)
  const oscillatorRef = useRef<OscillatorNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)

  const initialize = useCallback(async () => {
    try {
      audioContextRef.current = new AudioContext()
      // Some platforms may require a user gesture first; resume just in case
      // @ts-ignore
      await audioContextRef.current?.resume?.()
    } catch (error) {
      console.log("Audio initialization failed:", error)
    }
  }, [])

  const cleanup = useCallback(async () => {
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop()
        oscillatorRef.current.disconnect()
      } catch (error) {
        // ignore
      }
      oscillatorRef.current = null
    }
    if (gainNodeRef.current) {
      try {
        gainNodeRef.current.disconnect()
      } catch (error) {
        // ignore
      }
      gainNodeRef.current = null
    }
    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close()
      } catch (error) {
        // ignore
      }
      audioContextRef.current = null
    }
  }, [])

  const playSound = useCallback(
    async (color: Color, duration: number = 600) => {
      if (!soundEnabled || !audioContextRef.current) return

      try {
        const ctx = audioContextRef.current
        // @ts-ignore
        await ctx?.resume?.()

        const frequency = colorMap[color].sound
        const now = ctx.currentTime
        const durationSeconds = duration / 1000

        const oscillator = ctx.createOscillator()
        const gain = ctx.createGain()

        oscillator.connect(gain)
        gain.connect(ctx.destination)

        oscillator.frequency.setValueAtTime(frequency, now)
        oscillator.type = "sine"

        // Click-free one-shot envelope
        gain.gain.setValueAtTime(EPSILON, now)
        gain.gain.exponentialRampToValueAtTime(TARGET_GAIN, now + ATTACK_S)
        gain.gain.exponentialRampToValueAtTime(EPSILON, now + durationSeconds - RELEASE_S)

        oscillator.start(now)
        oscillator.stop(now + durationSeconds)

        setTimeout(() => {
          try { oscillator.disconnect() } catch { }
          try { gain.disconnect() } catch { }
        }, duration + 10)
      } catch (error) {
        console.log("Error playing sound:", error)
      }
    },
    [colorMap, soundEnabled],
  )

  const startContinuousSound = useCallback(
    async (color: Color) => {
      if (!soundEnabled || !audioContextRef.current) return

      try {
        const ctx = audioContextRef.current
        // @ts-ignore
        await ctx?.resume?.()

        const frequency = colorMap[color].sound
        const now = ctx.currentTime

        // If we’re already sounding, just retune and ramp to target
        if (oscillatorRef.current && gainNodeRef.current) {
          const osc = oscillatorRef.current
          const gain = gainNodeRef.current

          // Retune smoothly
          osc.frequency.cancelScheduledValues(now)
          osc.frequency.setValueAtTime(osc.frequency.value, now)
          osc.frequency.linearRampToValueAtTime(frequency, now + 0.01)

          // Smooth attack to target (re-press behavior)
          gain.gain.cancelScheduledValues(now)
          gain.gain.setValueAtTime(Math.max(gain.gain.value, EPSILON), now)
          gain.gain.linearRampToValueAtTime(TARGET_GAIN, now + ATTACK_S)
          return
        }

        // Create fresh nodes
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = "sine"
        osc.frequency.setValueAtTime(frequency, now)

        // Start silent, then attack
        gain.gain.setValueAtTime(EPSILON, now)
        gain.gain.exponentialRampToValueAtTime(TARGET_GAIN, now + ATTACK_S)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)

        oscillatorRef.current = osc
        gainNodeRef.current = gain
      } catch (error) {
        console.log("Error starting continuous sound:", error)
      }
    },
    [colorMap, soundEnabled],
  )

  const stopContinuousSound = useCallback(async (_color: Color) => {
    const ctx = audioContextRef.current
    const osc = oscillatorRef.current
    const gain = gainNodeRef.current
    if (!ctx || !osc || !gain) return

    try {
      const now = ctx.currentTime

      // Cancel any pending ramps, then release to near-zero
      gain.gain.cancelScheduledValues(now)
      gain.gain.setValueAtTime(Math.max(gain.gain.value, EPSILON), now)
      // Fast, click-free release
      gain.gain.exponentialRampToValueAtTime(EPSILON, now + RELEASE_S)

      // Stop just after the release
      osc.stop(now + RELEASE_S + 0.005)

      // Cleanup after fade completes
      setTimeout(() => {
        try { osc.disconnect() } catch { }
        try { gain.disconnect() } catch { }
        oscillatorRef.current = null
        gainNodeRef.current = null
      }, Math.ceil((RELEASE_S + 0.02) * 1000))
    } catch {
      oscillatorRef.current = null
      gainNodeRef.current = null
    }
  }, [])

  const stopContinuousSoundWithFade = useCallback(async (_color: Color, fadeDuration: number = 200) => {
    const ctx = audioContextRef.current
    const osc = oscillatorRef.current
    const gain = gainNodeRef.current
    if (!ctx || !osc || !gain) return

    try {
      const now = ctx.currentTime
      const fadeS = Math.max(fadeDuration / 1000, 0.005)

      gain.gain.cancelScheduledValues(now)
      gain.gain.setValueAtTime(Math.max(gain.gain.value, EPSILON), now)
      gain.gain.exponentialRampToValueAtTime(EPSILON, now + fadeS)

      osc.stop(now + fadeS + 0.005)

      setTimeout(() => {
        try { osc.disconnect() } catch { }
        try { gain.disconnect() } catch { }
        oscillatorRef.current = null
        gainNodeRef.current = null
      }, Math.ceil((fadeS + 0.02) * 1000))
    } catch {
      oscillatorRef.current = null
      gainNodeRef.current = null
    }
  }, [])

  return {
    initialize,
    cleanup,
    playSound,
    startContinuousSound,
    stopContinuousSound,
    stopContinuousSoundWithFade,
  }
}

export default useAudioTones
