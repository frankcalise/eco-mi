import { useRef, useCallback } from "react"
import { Audio } from "expo-av"

import type { Color, ColorMap, AudioTonesHook } from "./useAudioTones"

/**
 * Native implementation of audio tones using Expo Audio
 * @param colorMap Color mapping with frequency information
 * @param soundEnabled Whether sound is enabled
 */
export function useAudioTones(colorMap: ColorMap, soundEnabled: boolean): AudioTonesHook {
  const soundObjects = useRef<{ [key: string]: Audio.Sound }>({})
  const colors = Object.keys(colorMap) as Color[]

  const initialize = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      })

      // Create sound objects for each color
      for (const color of colors) {
        const { sound } = await Audio.Sound.createAsync(
          { uri: generateToneUri(colorMap[color].sound) },
          { shouldPlay: false, isLooping: true },
        )
        soundObjects.current[color] = sound
      }
    } catch (error) {
      console.log("Audio initialization failed:", error)
    }
  }, [colorMap, colors])

  const cleanup = useCallback(async () => {
    for (const sound of Object.values(soundObjects.current)) {
      try {
        await sound.unloadAsync()
      } catch (error) {
        console.log("Error unloading sound:", error)
      }
    }
    soundObjects.current = {}
  }, [])

  const generateToneUri = (frequency: number): string => {
    // In a real app, you would generate or reference pre-generated tone files
    // based on the frequency. For this example, we'll just use a placeholder.
    // You might want to include actual sound files in your assets.
    return `tone-${frequency}.mp3`
  }

  const playSound = useCallback(
    async (color: Color, duration: number = 600) => {
      if (!soundEnabled || !soundObjects.current[color]) return

      try {
        const sound = soundObjects.current[color]
        await sound.setPositionAsync(0)
        await sound.playAsync()

        setTimeout(async () => {
          try {
            await sound.pauseAsync()
          } catch (error) {
            console.log("Error stopping sound:", error)
          }
        }, duration)
      } catch (error) {
        console.log("Error playing sound:", error)
      }
    },
    [soundEnabled],
  )

  const startContinuousSound = useCallback(
    async (color: Color) => {
      if (!soundEnabled || !soundObjects.current[color]) return

      try {
        const sound = soundObjects.current[color]
        await sound.setPositionAsync(0)
        await sound.playAsync()
      } catch (error) {
        console.log("Error starting continuous sound:", error)
      }
    },
    [soundEnabled],
  )

  const stopContinuousSound = useCallback(async (color: Color) => {
    if (!soundObjects.current[color]) return

    try {
      const sound = soundObjects.current[color]
      await sound.pauseAsync()
    } catch (error) {
      console.log("Error stopping continuous sound:", error)
    }
  }, [])

  const stopContinuousSoundWithFade = useCallback(async (color: Color, fadeDuration: number = 200) => {
    if (!soundObjects.current[color]) return

    try {
      const sound = soundObjects.current[color]
      const fadeSteps = 10 // Number of volume steps for smooth fade
      const stepDuration = fadeDuration / fadeSteps
      const volumeStep = 1.0 / fadeSteps

      // Gradually reduce volume
      for (let i = fadeSteps; i > 0; i--) {
        const volume = i * volumeStep
        await sound.setVolumeAsync(volume)
        await new Promise(resolve => setTimeout(resolve, stepDuration))
      }

      // Stop the sound after fade is complete
      await sound.pauseAsync()
      // Reset volume for next time
      await sound.setVolumeAsync(1.0)
    } catch (error) {
      console.log("Error stopping continuous sound with fade:", error)
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
