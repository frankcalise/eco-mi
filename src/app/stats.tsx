import { useLayoutEffect } from "react"
import { View, Text, StyleSheet } from "react-native"
import { useRouter, useNavigation } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"

import { PressableScale } from "@/components/PressableScale"
import { useStats } from "@/hooks/useStats"
import { useTheme } from "@/hooks/useTheme"
import { stackHeaderOptionsFromTheme } from "@/navigation/secondaryStackHeader"
import { useBreakpoints } from "@/utils/layoutBreakpoints"

export default function StatsScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const navigation = useNavigation()
  const stats = useStats()
  const { activeTheme } = useTheme()
  const { isTablet } = useBreakpoints()

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("stats:title"),
      headerBackAccessibilityLabel: t("common:back"),
      ...stackHeaderOptionsFromTheme(activeTheme),
    })
  }, [navigation, t, i18n.language, activeTheme])

  const dayUnit = (n: number) => (n !== 1 ? t("stats:daysUnit") : t("stats:dayUnit"))

  const statItems = [
    { label: t("stats:gamesPlayed"), value: stats.gamesPlayed },
    { label: t("stats:bestScore"), value: stats.bestScore },
    { label: t("stats:averageScore"), value: stats.averageScore },
    { label: t("stats:totalScore"), value: stats.totalScore },
    {
      label: t("stats:currentStreak"),
      value: `${stats.currentStreak} ${dayUnit(stats.currentStreak)}`,
    },
    {
      label: t("stats:longestStreak"),
      value: `${stats.longestStreak} ${dayUnit(stats.longestStreak)}`,
    },
  ]

  return (
    <View style={[styles.container, { backgroundColor: activeTheme.backgroundColor }]}>
      <StatusBar style={activeTheme.statusBarStyle} backgroundColor={activeTheme.backgroundColor} />
      <View style={[styles.content, isTablet && styles.contentTablet]}>
        {stats.gamesPlayed === 0 ? (
          <View
            style={[
              styles.emptyState,
              isTablet && styles.emptyStateTablet,
              {
                backgroundColor: activeTheme.surfaceColor,
                borderColor: activeTheme.borderColor,
              },
            ]}
          >
            <Ionicons
              name="game-controller-outline"
              size={48}
              color={activeTheme.secondaryTextColor}
            />
            <Text style={[styles.emptyTitle, { color: activeTheme.textColor }]}>
              {t("stats:emptyTitle")}
            </Text>
            <Text style={[styles.emptyBody, { color: activeTheme.secondaryTextColor }]}>
              {t("stats:emptyBody")}
            </Text>
            <PressableScale
              style={[
                styles.playNowButton,
                isTablet && styles.playNowButtonTablet,
                { backgroundColor: activeTheme.accentColor },
              ]}
              onPress={() => router.back()}
            >
              <Ionicons name="play" size={18} color={activeTheme.primaryForegroundColor} />
              <Text style={[styles.playNowText, { color: activeTheme.primaryForegroundColor }]}>
                {t("stats:playNow")}
              </Text>
            </PressableScale>
          </View>
        ) : (
          <View style={styles.grid}>
            {statItems.map((item) => (
              <View
                key={item.label}
                style={[
                  styles.statCard,
                  {
                    backgroundColor: activeTheme.surfaceColor,
                    borderColor: activeTheme.borderColor,
                  },
                ]}
              >
                <Text style={[styles.statValue, { color: activeTheme.textColor }]}>
                  {item.value}
                </Text>
                <Text style={[styles.statLabel, { color: activeTheme.secondaryTextColor }]}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    width: "100%",
  },
  contentTablet: {
    alignSelf: "center",
    maxWidth: 700,
    width: "100%",
  },
  emptyBody: {
    fontFamily: "Oxanium-Regular",
    fontSize: 14,
    marginTop: 8,
    maxWidth: 340,
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 20,
    flex: 1,
    gap: 8,
    justifyContent: "center",
    paddingBottom: 60,
    width: "100%",
  },
  emptyStateTablet: {
    alignSelf: "center",
    borderWidth: 1,
    maxWidth: 420,
    paddingHorizontal: 32,
    paddingTop: 32,
  },
  emptyTitle: {
    fontFamily: "Oxanium-Bold",
    fontSize: 20,
    marginTop: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
    marginTop: 24,
  },
  playNowButton: {
    alignItems: "center",
    borderRadius: 10,
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  playNowButtonTablet: {
    justifyContent: "center",
    minWidth: 220,
  },
  playNowText: {
    fontFamily: "Oxanium-SemiBold",
    fontSize: 16,
  },
  statCard: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    minWidth: "45%",
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  statLabel: {
    fontFamily: "Oxanium-Regular",
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },
  statValue: {
    fontFamily: "Oxanium-Bold",
    fontSize: 28,
  },
})
