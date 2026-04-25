import { useEffect, useRef, useState } from "react"
import { View, Text, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { EaseView } from "react-native-ease"

import { PressableScale } from "@/components/PressableScale"
import { isLightTheme, type GameTheme } from "@/config/themes"
import { useHaptics } from "@/hooks/useHaptics"
import { useReducedMotion } from "@/hooks/useReducedMotion"

type GameHeaderProps = {
  isIdle: boolean
  theme: GameTheme
  onModePress: () => void
  onSettingsPress: () => void
}

export function GameHeader({ isIdle, theme, onModePress, onSettingsPress }: GameHeaderProps) {
  const { t } = useTranslation()
  const haptics = useHaptics()
  const reducedMotion = useReducedMotion()
  const neonColors = theme.titleCycleColors

  const [neonColorIndex, setNeonColorIndex] = useState(0)
  const neonIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isIdle && !reducedMotion) {
      setNeonColorIndex(0)
      neonIntervalRef.current = setInterval(() => {
        setNeonColorIndex((prev) => (prev + 1) % neonColors.length)
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
  }, [isIdle, neonColors.length, reducedMotion])
  const isLight = isLightTheme(theme)
  const titleBaseColor = isLight ? `${theme.textColor}B8` : `${theme.textColor}66`
  const titleGhostColor = isLight ? `${theme.backgroundColor}55` : `${theme.backgroundColor}33`
  // Ghost layer stays rendered so it sizes the absolute-positioned neon siblings,
  // but is hidden on light themes where a 1px offset reads too loud.
  const showTitleGhost = !isLight

  return (
    <View style={styles.header}>
      <PressableScale
        testID="btn-mode-selector"
        accessibilityLabel={t("a11y:modeSelector")}
        accessibilityRole="button"
        onPress={() => {
          haptics.play("menuTap")
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
          style={!isIdle && styles.iconDim}
        />
      </PressableScale>
      <EaseView
        animate={{ scale: isIdle && !reducedMotion ? 1.03 : 1 }}
        transition={{
          default: reducedMotion
            ? { type: "timing", duration: 0 }
            : { type: "timing", duration: 1500, easing: "easeInOut", loop: "reverse" },
        }}
        style={styles.headerCenter}
      >
        <View style={styles.titleStack}>
          {isIdle ? (
            <>
              <Text
                style={[
                  styles.title,
                  styles.titleGhost,
                  !showTitleGhost && styles.titleGhostHidden,
                  {
                    color: titleGhostColor,
                    textShadowColor: titleGhostColor,
                  },
                ]}
              >
                {t("game:title")}
              </Text>
              <Text style={[styles.title, styles.titleLayerAbsolute, { color: titleBaseColor }]}>
                {t("game:title")}
              </Text>
              {neonColors.map((color, i) => (
                <EaseView
                  key={i}
                  animate={{ opacity: neonColorIndex === i ? 1 : 0 }}
                  transition={{ default: { type: "timing", duration: 600, easing: "easeInOut" } }}
                  style={styles.titleLayerAbsolute}
                >
                  <Text style={[styles.title, styles.titleNeon, { color, textShadowColor: color }]}>
                    {t("game:title")}
                  </Text>
                </EaseView>
              ))}
            </>
          ) : (
            <Text style={[styles.title, { color: theme.textColor }]}>{t("game:title")}</Text>
          )}
        </View>
      </EaseView>
      <PressableScale
        testID="btn-settings"
        accessibilityLabel={t("a11y:settings")}
        accessibilityRole="button"
        onPress={() => {
          haptics.play("menuTap")
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
          style={!isIdle && styles.iconDim}
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
  iconDim: {
    opacity: 0.4,
  },
  title: {
    fontFamily: "Oxanium-Bold",
    fontSize: 36,
    letterSpacing: 4,
  },
  titleGhost: {
    opacity: 0.4,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
  titleGhostHidden: {
    opacity: 0,
  },
  titleLayerAbsolute: {
    position: "absolute",
  },
  titleNeon: {
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  titleStack: {
    alignItems: "center",
    justifyContent: "center",
  },
})
