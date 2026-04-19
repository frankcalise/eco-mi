import { useLayoutEffect } from "react"
import { View, StyleSheet } from "react-native"
import { useLocalSearchParams, useNavigation } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useTranslation } from "react-i18next"

import { HighScoreTable } from "@/components/HighScoreTable"
import type { GameMode } from "@/hooks/useGameEngine"
import { useTheme } from "@/hooks/useTheme"
import { stackHeaderOptionsFromTheme } from "@/navigation/secondaryStackHeader"

export default function LeaderboardScreen() {
  const { t, i18n } = useTranslation()
  const navigation = useNavigation()
  const { activeTheme } = useTheme()
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
      <StatusBar style={activeTheme.statusBarStyle} backgroundColor={activeTheme.backgroundColor} />
      <HighScoreTable
        initialMode={mode}
        highlightIndex={highlightIndex}
        highlightMode={highlightMode}
        theme={activeTheme}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
})
