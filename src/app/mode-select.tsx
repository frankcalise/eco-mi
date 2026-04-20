import { useEffect, useRef, useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import * as Haptics from "expo-haptics"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { GameModePickerContent } from "@/components/GameModePickerContent"
import { GAME_MODES } from "@/config/gameModes"
import {
  MODE_PICKER_DISMISS_DELAY_MS,
  MODE_PICKER_PULSE_COUNT,
  MODE_PICKER_PULSE_DURATION_MS,
} from "@/config/modePickerTiming"
import type { GameMode } from "@/hooks/useGameEngine"
import { useTheme } from "@/hooks/useTheme"
import { usePendingModeStore } from "@/stores/pendingModeStore"
import { UI_COLORS } from "@/theme/uiColors"

const ALLOWED_MODES = new Set(GAME_MODES.map((m) => m.id))

function parseCurrentMode(raw: string | undefined): GameMode {
  if (raw && ALLOWED_MODES.has(raw as GameMode)) return raw as GameMode
  return "classic"
}

export default function ModeSelectScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { activeTheme } = useTheme()
  const setPendingMode = usePendingModeStore((s) => s.setPendingMode)
  const params = useLocalSearchParams<{ currentMode?: string }>()
  const currentMode = parseCurrentMode(
    typeof params.currentMode === "string" ? params.currentMode : undefined,
  )

  const [pulsingMode, setPulsingMode] = useState<GameMode | null>(null)
  const [pulsePhase, setPulsePhase] = useState<"bright" | "dim">("bright")
  const pulseTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    if (!router.canGoBack()) router.replace("/")
  }, [router])

  useEffect(() => {
    return () => pulseTimers.current.forEach(clearTimeout)
  }, [])

  function handleModeSelect(id: GameMode) {
    if (id === currentMode && !pulsingMode) {
      router.back()
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    pulseTimers.current.forEach(clearTimeout)
    pulseTimers.current = []

    setPulsingMode(id)
    setPulsePhase("bright")

    let delay = 0
    for (let i = 0; i < MODE_PICKER_PULSE_COUNT; i++) {
      pulseTimers.current.push(
        setTimeout(() => setPulsePhase("dim"), delay + MODE_PICKER_PULSE_DURATION_MS),
      )
      if (i < MODE_PICKER_PULSE_COUNT - 1) {
        pulseTimers.current.push(
          setTimeout(() => setPulsePhase("bright"), delay + MODE_PICKER_PULSE_DURATION_MS * 2),
        )
      }
      delay += MODE_PICKER_PULSE_DURATION_MS * 2
    }

    pulseTimers.current.push(
      setTimeout(() => {
        setPendingMode(id)
        router.back()
        // Do not clear pulsingMode here — that would re-render with route currentMode
        // and flash the old selection for a frame; screen unmounts on back.
      }, delay + MODE_PICKER_DISMISS_DELAY_MS),
    )
  }

  return (
    <View style={styles.root}>
      <Pressable
        style={[styles.scrim, StyleSheet.absoluteFill]}
        onPress={() => {
          if (!pulsingMode) router.back()
        }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />
      <View
        style={[
          styles.card,
          {
            backgroundColor: activeTheme.backgroundColor,
            maxWidth: 480,
            paddingBottom: 16,
            width: "90%",
          },
        ]}
      >
        <GameModePickerContent
          selectedMode={pulsingMode ?? currentMode}
          pulsingMode={pulsingMode}
          pulsePhase={pulsePhase}
          theme={activeTheme}
          onSelectMode={handleModeSelect}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    elevation: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    shadowColor: UI_COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    zIndex: 1,
  },
  root: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  scrim: {
    backgroundColor: UI_COLORS.backdropModal,
  },
})
