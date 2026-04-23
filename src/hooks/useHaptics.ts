import { Platform } from "react-native"
import * as Device from "expo-device"
import { Presets } from "react-native-pulsar"

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

function fireEvent(event: HapticEvent, opts?: PlayOptions): void {
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
      // Pulsar's notificationError is a native multi-tap pattern — no manual
      // setTimeout double-pulse needed like we did with expo-haptics.
      Presets.System.notificationError()
      return
    case "newHighScore":
      // Phase 3 replaces this with a usePatternComposer(VICTORY_PATTERN).play()
      // to ride the 720ms ascending high-score jingle.
      Presets.System.notificationSuccess()
      return
    case "gameOver":
      // Phase 3 replaces this with a usePatternComposer(SPIRAL_PATTERN).play()
      // for the cartoon "spiral + thud + bounce" synced to the game-over jingle.
      Presets.System.notificationError()
      return
  }
}

/**
 * Event-based haptics hook. Callers describe *what happened* (e.g.
 * `play('newHighScore')`) rather than picking an impact style — the hook
 * owns the mapping to the current haptics engine (react-native-pulsar).
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
