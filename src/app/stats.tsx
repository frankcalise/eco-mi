import { View, Text, StyleSheet } from "react-native"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { PressableScale } from "@/components/PressableScale"
import { useStats } from "@/hooks/useStats"
import { useTheme } from "@/hooks/useTheme"

export default function StatsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const stats = useStats()
  const insets = useSafeAreaInsets()
  const { activeTheme } = useTheme()

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
    <View
      style={[styles.container, { paddingTop: insets.top, backgroundColor: activeTheme.backgroundColor }]}
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
        <Text style={[styles.title, { color: activeTheme.textColor }]}>{t("stats:title")}</Text>
      </View>

      <View style={styles.grid}>
        {statItems.map((item) => (
          <View
            key={item.label}
            style={[styles.statCard, { backgroundColor: activeTheme.surfaceColor }]}
          >
            <Text style={[styles.statValue, { color: activeTheme.textColor }]}>{item.value}</Text>
            <Text style={[styles.statLabel, { color: activeTheme.secondaryTextColor }]}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
    marginTop: 24,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
  },
  statCard: {
    alignItems: "center",
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
  title: {
    fontFamily: "Oxanium-Bold",
    fontSize: 28,
  },
})
