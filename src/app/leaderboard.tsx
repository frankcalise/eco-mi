import { View, Text, StyleSheet } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { HighScoreTable } from "@/components/HighScoreTable"
import { PressableScale } from "@/components/PressableScale"
import type { GameMode } from "@/hooks/useGameEngine"
import { useTheme } from "@/hooks/useTheme"

export default function LeaderboardScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { activeTheme } = useTheme()
  const params = useLocalSearchParams<{
    mode?: string
    highlightIndex?: string
    highlightMode?: string
  }>()

  const mode = (params.mode as GameMode) ?? "classic"
  const highlightIndex = params.highlightIndex ? parseInt(params.highlightIndex, 10) : undefined
  const highlightMode = (params.highlightMode as GameMode) ?? mode

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, backgroundColor: activeTheme.backgroundColor },
      ]}
    >
      <View style={styles.header}>
        <PressableScale
          accessibilityLabel={t("common:back")}
          accessibilityRole="button"
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={activeTheme.textColor} />
        </PressableScale>
        <Text style={[styles.title, { color: activeTheme.textColor }]}>
          {t("game:leaderboard")}
        </Text>
      </View>

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
  backButton: {
    marginRight: 16,
    padding: 10,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
  },
  title: {
    fontFamily: "Oxanium-Bold",
    fontSize: 28,
  },
})
