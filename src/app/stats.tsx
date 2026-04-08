import { View, Text, Pressable, StyleSheet } from "react-native"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"

import { useStats } from "@/hooks/useStats"

export default function StatsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const stats = useStats()

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
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </Pressable>
        <Text style={styles.title}>{t("stats:title")}</Text>
      </View>

      <View style={styles.grid}>
        {statItems.map((item) => (
          <View key={item.label} style={styles.statCard}>
            <Text style={styles.statValue}>{item.value}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  container: {
    backgroundColor: "#1a1a2e",
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
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
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 12,
    minWidth: "45%",
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  statLabel: {
    color: "#a0a0a0",
    fontFamily: "Oxanium-Regular",
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },
  statValue: {
    color: "white",
    fontFamily: "Oxanium-Bold",
    fontSize: 28,
  },
  title: {
    color: "white",
    fontFamily: "Oxanium-Bold",
    fontSize: 28,
  },
})
