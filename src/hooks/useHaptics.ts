import { Platform } from "react-native"
import * as Device from "expo-device"
import { Presets, usePatternComposer } from "react-native-pulsar"

import { SPIRAL_PATTERN, VICTORY_PATTERN } from "@/config/hapticPatterns"
import { usePreferencesStore } from "@/stores/preferencesStore"

export type HapticEvent =
  | "buttonPress"
  | "menuTap"
  | "sequenceFlash"
  | "countdownTick"
  | "wrongButton"
  | "newHighScore"
  | "gameOver"

export type CountdownUrgency = "low" | "medium" | "high"

type PlayOptions = {
  urgency?: CountdownUrgency
}

function firePresetEvent(event: HapticEvent, opts?: PlayOptions): void {
  switch (event) {
    case "buttonPress":
      Presets.System.impactMedium()
      return
    case "menuTap":
    case "sequenceFlash":
      Presets.System.impactLight()
      return
    case "countdownTick": {
      const urgency = opts?.urgency ?? "low"
      if (urgency === "high") Presets.System.impactHeavy()
      else if (urgency === "medium") Presets.System.impactMedium()
      else Presets.System.impactLight()
      return
    }
    case "wrongButton":
      // Pulsar's notificationError is a native multi-tap pattern.
      Presets.System.notificationError()
      return
    case "newHighScore":
    case "gameOver":
      // Handled by the pattern composers in useHaptics — never reached here.
      return
  }
}

/**
 * Event-based haptics hook. Callers describe *what happened* (e.g.
 * `play('newHighScore')`) rather than picking an impact style — the hook
 * owns the mapping to the current haptics engine (react-native-pulsar).
 *
 * `newHighScore` and `gameOver` play authored Pattern objects synced to
 * the audio jingles (see src/config/hapticPatterns.ts). Everything else
 * delegates to Pulsar's Presets.System.* primitives.
 *
 * Respects the user's haptics preference via preferencesStore (reactive).
 * No-ops on web. On simulators in dev, logs `[haptics] <event>` instead of
 * firing since simulator haptics don't actuate.
 */
export function useHaptics() {
  const enabled = usePreferencesStore((s) => s.hapticsEnabled)
  const victoryComposer = usePatternComposer(VICTORY_PATTERN)
  const spiralComposer = usePatternComposer(SPIRAL_PATTERN)

  function play(event: HapticEvent, opts?: PlayOptions) {
    if (!enabled) return
    if (Platform.OS === "web") return
    if (__DEV__ && !Device.isDevice) {
      console.log(`[haptics] ${event}${opts?.urgency ? ` (${opts.urgency})` : ""}`)
      return
    }
    if (event === "newHighScore") {
      victoryComposer.play()
      return
    }
    if (event === "gameOver") {
      spiralComposer.play()
      return
    }
    firePresetEvent(event, opts)
  }

  return { play }
}
