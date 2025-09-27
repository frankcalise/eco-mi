import { useRef, useCallback } from "react"
import { AudioContext, GainNode, OscillatorNode } from "react-native-audio-api"

import type { Color, ColorMap, AudioTonesHook } from "./useAudioTones"

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
        console.log("Error stopping oscillator:", error)
      }
      oscillatorRef.current = null
    }
    if (gainNodeRef.current) {
      try {
        gainNodeRef.current.disconnect()
      } catch (error) {
        console.log("Error disconnecting gain node:", error)
      }
      gainNodeRef.current = null
    }
    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close()
      } catch (error) {
        console.log("Error closing audio context:", error)
      }
      audioContextRef.current = null
    }
  }, [])

  const playSound = useCallback(
    async (color: Color, duration: number = 600) => {
      if (!soundEnabled || !audioContextRef.current) return

      try {
        const frequency = colorMap[color].sound
        const currentTime = audioContextRef.current.currentTime
        const durationSeconds = duration / 1000

        const oscillator = audioContextRef.current.createOscillator()
        const gainNode = audioContextRef.current.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContextRef.current.destination)

        oscillator.frequency.setValueAtTime(frequency, currentTime)
        oscillator.type = "sine"

        // Smooth fade-in and fade-out to prevent pops
        gainNode.gain.setValueAtTime(0.001, currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.3, currentTime + 0.01)
        gainNode.gain.exponentialRampToValueAtTime(
          0.001,
          currentTime + durationSeconds - 0.01,
        )

        oscillator.start(currentTime)
        oscillator.stop(currentTime + durationSeconds)
        
        // Clean up after sound completes
        setTimeout(() => {
          try {
            oscillator.disconnect()
            gainNode.disconnect()
          } catch (_e) {
            // Already disconnected
          }
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

      // Stop any existing sound with proper cleanup
      if (oscillatorRef.current) {
        await stopContinuousSound(color)
        // Wait a bit for cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      try {
        const frequency = colorMap[color].sound
        const currentTime = audioContextRef.current.currentTime

        const oscillator = audioContextRef.current.createOscillator()
        const gainNode = audioContextRef.current.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContextRef.current.destination)

        oscillator.frequency.setValueAtTime(frequency, currentTime)
        oscillator.type = "sine"

        // Start with very low volume and fade in to prevent pops
        gainNode.gain.setValueAtTime(0.001, currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.3, currentTime + 0.01)

        oscillator.start(currentTime)

        oscillatorRef.current = oscillator
        gainNodeRef.current = gainNode
      } catch (error) {
        console.log("Error starting continuous sound:", error)
      }
    },
    [colorMap, soundEnabled],
  )

  const stopContinuousSound = useCallback(async (_color: Color) => {
    if (oscillatorRef.current && gainNodeRef.current && audioContextRef.current) {
      try {
        const currentTime = audioContextRef.current.currentTime
        // Smooth fade-out to prevent pops
        gainNodeRef.current.gain.exponentialRampToValueAtTime(
          0.001, // Very low value instead of 0.01
          currentTime + 0.05, // Shorter fade time
        )
        oscillatorRef.current.stop(currentTime + 0.05)
        
        // Clean up after fade completes
        setTimeout(() => {
          if (oscillatorRef.current) {
            try {
              oscillatorRef.current.disconnect()
            } catch (_e) {
              // Already disconnected
            }
          }
          if (gainNodeRef.current) {
            try {
              gainNodeRef.current.disconnect()
            } catch (_e) {
              // Already disconnected
            }
          }
          oscillatorRef.current = null
          gainNodeRef.current = null
        }, 60) // Slightly longer than fade time
      } catch (_error) {
        // Oscillator might already be stopped
        oscillatorRef.current = null
        gainNodeRef.current = null
      }
    }
  }, [])

  const stopContinuousSoundWithFade = useCallback(async (_color: Color, fadeDuration: number = 200) => {
    if (oscillatorRef.current && gainNodeRef.current && audioContextRef.current) {
      try {
        const currentTime = audioContextRef.current.currentTime
        const fadeTime = fadeDuration / 1000 // Convert to seconds
        
        // Smooth fade-out to prevent pops
        gainNodeRef.current.gain.exponentialRampToValueAtTime(
          0.001, // Very low value instead of 0.01
          currentTime + fadeTime,
        )
        oscillatorRef.current.stop(currentTime + fadeTime)
        
        // Clean up after fade completes
        setTimeout(() => {
          if (oscillatorRef.current) {
            try {
              oscillatorRef.current.disconnect()
            } catch (_e) {
              // Already disconnected
            }
          }
          if (gainNodeRef.current) {
            try {
              gainNodeRef.current.disconnect()
            } catch (_e) {
              // Already disconnected
            }
          }
          oscillatorRef.current = null
          gainNodeRef.current = null
        }, fadeDuration + 10) // Slightly longer than fade time
      } catch (_error) {
        // Oscillator might already be stopped
        oscillatorRef.current = null
        gainNodeRef.current = null
      }
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
