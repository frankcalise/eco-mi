import { useEffect, useRef, useState } from "react"
import { View, Text, StyleSheet } from "react-native"
import * as Haptics from "expo-haptics"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { EaseView } from "react-native-ease"

import { PressableScale } from "@/components/PressableScale"
import type { GameTheme } from "@/config/themes"
import type { GameMode } from "@/hooks/useGameEngine"

const GAME_MODES: { id: GameMode; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "classic", icon: "game-controller" },
  { id: "daily", icon: "calendar" },
  { id: "timed", icon: "timer" },
  { id: "reverse", icon: "swap-horizontal" },
  { id: "chaos", icon: "shuffle" },
]

const NEON_COLOR_ORDER = ["red", "blue", "green"] as const

type GameHeaderProps = {
  mode: GameMode
  isIdle: boolean
  theme: GameTheme
  onModePress: () => void
  onSettingsPress: () => void
}

export function GameHeader({
  mode,
  isIdle,
  theme,
  onModePress,
  onSettingsPress,
}: GameHeaderProps) {
  const { t } = useTranslation()

  const [neonColorIndex, setNeonColorIndex] = useState(0)
  const neonIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isIdle) {
      setNeonColorIndex(0)
      neonIntervalRef.current = setInterval(() => {
        setNeonColorIndex((prev) => (prev + 1) % NEON_COLOR_ORDER.length)
      }, 2000)
    } else {
      if (neonIntervalRef.current) {
        clearInterval(neonIntervalRef.current)
        neonIntervalRef.current = null
      }
    }
    return () => {
      if (neonIntervalRef.current) {
        clearInterval(neonIntervalRef.current)
        neonIntervalRef.current = null
      }
    }
  }, [isIdle])

  const neonColors = NEON_COLOR_ORDER.map((c) => theme.buttonColors[c].color)
  const currentMode = GAME_MODES.find((m) => m.id === mode)

  return (
    <View style={styles.header}>
      <PressableScale
        testID="btn-mode-selector"
        accessibilityLabel={t("a11y:modeSelector")}
        accessibilityRole="button"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          onModePress()
        }}
        disabled={!isIdle}
        style={styles.headerAction}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name="game-controller-outline"
          size={26}
          color={isIdle ? theme.textColor : theme.secondaryTextColor}
          style={{ opacity: isIdle ? 1 : 0.4 }}
        />
      </PressableScale>
      <EaseView
        animate={{ scale: isIdle ? 1.03 : 1 }}
        transition={{
          default: { type: "timing", duration: 1500, easing: "easeInOut", loop: "reverse" },
        }}
        style={styles.headerCenter}
      >
        <View style={styles.titleStack}>
          {isIdle ? (
            neonColors.map((color, i) => (
              <EaseView
                key={i}
                animate={{ opacity: neonColorIndex === i ? 1 : 0 }}
                transition={{ default: { type: "timing", duration: 600, easing: "easeInOut" } }}
                style={i > 0 ? styles.titleLayerAbsolute : undefined}
              >
                <Text
                  style={[
                    styles.title,
                    {
                      color,
                      textShadowColor: color,
                      textShadowOffset: { width: 0, height: 0 },
                      textShadowRadius: 12,
                    },
                  ]}
                >
                  {t("game:title")}
                </Text>
              </EaseView>
            ))
          ) : (
            <Text style={[styles.title, { color: theme.textColor }]}>{t("game:title")}</Text>
          )}
        </View>
        {currentMode && (
          <View style={styles.modeIndicator}>
            <Ionicons name={currentMode.icon} size={12} color={theme.secondaryTextColor} />
            <Text style={[styles.modeIndicatorText, { color: theme.secondaryTextColor }]}>
              {t(`game:modes.${mode}`)}
            </Text>
          </View>
        )}
      </EaseView>
      <PressableScale
        testID="btn-settings"
        accessibilityLabel={t("a11y:settings")}
        accessibilityRole="button"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          onSettingsPress()
        }}
        disabled={!isIdle}
        style={styles.headerAction}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name="settings-outline"
          size={26}
          color={isIdle ? theme.textColor : theme.secondaryTextColor}
          style={{ opacity: isIdle ? 1 : 0.4 }}
        />
      </PressableScale>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 20,
    width: "100%",
  },
  headerAction: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  headerCenter: {
    alignItems: "center",
  },
  modeIndicator: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginTop: 2,
  },
  modeIndicatorText: {
    fontFamily: "Oxanium-Medium",
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  title: {
    color: "white",
    fontFamily: "Oxanium-Bold",
    fontSize: 36,
    letterSpacing: 4,
  },
  titleLayerAbsolute: {
    position: "absolute",
  },
  titleStack: {
    alignItems: "center",
    justifyContent: "center",
  },
})
