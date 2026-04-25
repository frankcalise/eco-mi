import { useLayoutEffect } from "react"
import { View, StyleSheet } from "react-native"
import { useLocalSearchParams, useNavigation } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useTranslation } from "react-i18next"

import { AnchoredBanner } from "@/components/AnchoredBanner"
import { HighScoreTable } from "@/components/HighScoreTable"
import type { GameMode } from "@/hooks/useGameEngine"
import { useTheme } from "@/hooks/useTheme"
import { stackHeaderOptionsFromTheme } from "@/navigation/secondaryStackHeader"
import { useBreakpoints } from "@/utils/layoutBreakpoints"

export default function LeaderboardScreen() {
  const { t, i18n } = useTranslation()
  const navigation = useNavigation()
  const { activeTheme } = useTheme()
  const { isTablet } = useBreakpoints()
  const params = useLocalSearchParams<{
    mode?: string
    highlightIndex?: string
    highlightMode?: string
  }>()

  const mode = (params.mode as GameMode) ?? "classic"
  const highlightIndex = params.highlightIndex ? parseInt(params.highlightIndex, 10) : undefined
  const highlightMode = (params.highlightMode as GameMode) ?? mode

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("game:leaderboard"),
      headerBackAccessibilityLabel: t("common:back"),
      ...stackHeaderOptionsFromTheme(activeTheme),
    })
  }, [navigation, t, i18n.language, activeTheme])

  return (
    <View style={[styles.container, { backgroundColor: activeTheme.backgroundColor }]}>
      <StatusBar style={activeTheme.statusBarStyle} />
      <View style={[styles.content, isTablet && styles.contentTablet]}>
        <HighScoreTable
          initialMode={mode}
          highlightIndex={highlightIndex}
          highlightMode={highlightMode}
          isTablet={isTablet}
          theme={activeTheme}
        />
      </View>
      <View style={styles.bannerSlot}>
        <AnchoredBanner placement="leaderboard" />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bannerSlot: {
    // ≥16px from the score table satisfies the AdMob accidental-tap policy
    // (banner must not sit flush against tappable content).
    marginTop: 16,
  },
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  content: {
    width: "100%",
  },
  contentTablet: {
    alignSelf: "center",
    maxWidth: 700,
  },
})
