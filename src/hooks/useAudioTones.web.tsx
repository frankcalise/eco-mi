import { useRef, useCallback } from "react"

import type { Color, ColorMap, AudioTonesHook } from "./useAudioTones"

/**
 * Web-specific implementation of audio tones using Web Audio API
 * @param colorMap Color mapping with frequency information
 * @param soundEnabled Whether sound is enabled
 */
export function useAudioTones(colorMap: ColorMap, soundEnabled: boolean): AudioTonesHook {
  const audioContextRef = useRef<AudioContext | null>(null)
  const oscillatorRef = useRef<OscillatorNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)

  const initialize = useCallback(async () => {
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch (error) {
      console.log("Web Audio API not supported:", error)
    }
  }, [])

  const cleanup = useCallback(async () => {
    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close()
      } catch (error) {
        console.log("Error closing AudioContext:", error)
      }
      audioContextRef.current = null
    }
  }, [])

  const playSound = useCallback(
    async (color: Color, duration: number = 600) => {
      if (!soundEnabled || !audioContextRef.current) return

      try {
        const frequency = colorMap[color].sound

        const oscillator = audioContextRef.current.createOscillator()
        const gainNode = audioContextRef.current.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContextRef.current.destination)

        oscillator.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime)
        oscillator.type = "sine"

        gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(
          0.01,
          audioContextRef.current.currentTime + duration / 1000,
        )

        oscillator.start(audioContextRef.current.currentTime)
        oscillator.stop(audioContextRef.current.currentTime + duration / 1000)
      } catch (error) {
        console.log("Error playing web sound:", error)
      }
    },
    [colorMap, soundEnabled],
  )

  const stopContinuousSound = useCallback(async (_color: Color) => {
    if (oscillatorRef.current && gainNodeRef.current && audioContextRef.current) {
      try {
        gainNodeRef.current.gain.exponentialRampToValueAtTime(
          0.01,
          audioContextRef.current.currentTime + 0.1,
        )
        oscillatorRef.current.stop(audioContextRef.current.currentTime + 0.1)
      } catch (_error) {
        // Oscillator might already be stopped
      }
      oscillatorRef.current = null
      gainNodeRef.current = null
    }
  }, [])

  const stopContinuousSoundWithFade = useCallback(async (_color: Color, fadeDuration: number = 200) => {
    if (oscillatorRef.current && gainNodeRef.current && audioContextRef.current) {
      try {
        const currentTime = audioContextRef.current.currentTime
        const fadeTime = fadeDuration / 1000 // Convert to seconds
        
        gainNodeRef.current.gain.exponentialRampToValueAtTime(
          0.01,
          currentTime + fadeTime,
        )
        oscillatorRef.current.stop(currentTime + fadeTime)
      } catch (_error) {
        // Oscillator might already be stopped
      }
      oscillatorRef.current = null
      gainNodeRef.current = null
    }
  }, [])

  const startContinuousSound = useCallback(
    async (color: Color) => {
      if (!soundEnabled || !audioContextRef.current) return

      // Stop any existing sound
      if (oscillatorRef.current) {
        await stopContinuousSound(color)
      }

      try {
        const frequency = colorMap[color].sound

        const oscillator = audioContextRef.current.createOscillator()
        const gainNode = audioContextRef.current.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContextRef.current.destination)

        oscillator.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime)
        oscillator.type = "sine"

        gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime)

        oscillator.start(audioContextRef.current.currentTime)

        oscillatorRef.current = oscillator
        gainNodeRef.current = gainNode
      } catch (error) {
        console.log("Error starting continuous web sound:", error)
      }
    },
    [colorMap, soundEnabled, stopContinuousSound],
  )

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
