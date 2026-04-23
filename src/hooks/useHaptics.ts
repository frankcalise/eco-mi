import { Platform } from "react-native"
import * as Device from "expo-device"
import * as Haptics from "expo-haptics"

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

const ERROR_DOUBLE_PULSE_MS = 150

function fireEvent(event: HapticEvent, opts?: PlayOptions): void {
  switch (event) {
    case "buttonPress":
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      return
    case "menuTap":
    case "sequenceFlash":
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      return
    case "countdownTick": {
      const urgency = opts?.urgency ?? "low"
      const style =
        urgency === "high"
          ? Haptics.ImpactFeedbackStyle.Heavy
          : urgency === "medium"
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light
      Haptics.impactAsync(style)
      return
    }
    case "wrongButton":
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setTimeout(
        () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
        ERROR_DOUBLE_PULSE_MS,
      )
      return
    case "newHighScore":
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      return
    case "gameOver":
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
  }
}

/**
 * Event-based haptics hook. Callers describe *what happened* (e.g.
 * `play('newHighScore')`) rather than picking an impact style — the hook
 * owns the mapping so future engine swaps (e.g. Pulsar) are one-file changes.
 *
 * Respects the user's haptics preference via preferencesStore (reactive).
 * No-ops on web. On simulators in dev, logs `[haptics] <event>` instead of
 * firing since simulator haptics don't actuate.
 */
export function useHaptics() {
  const enabled = usePreferencesStore((s) => s.hapticsEnabled)

  function play(event: HapticEvent, opts?: PlayOptions) {
    if (!enabled) return
    if (Platform.OS === "web") return
    if (__DEV__ && !Device.isDevice) {
      console.log(`[haptics] ${event}${opts?.urgency ? ` (${opts.urgency})` : ""}`)
      return
    }
    fireEvent(event, opts)
  }

  return { play }
}
