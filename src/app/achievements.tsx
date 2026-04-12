import { View, Text, ScrollView, StyleSheet } from "react-native"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { PressableScale } from "@/components/PressableScale"
import { ACHIEVEMENTS } from "@/config/achievements"
import { useAchievements } from "@/hooks/useAchievements"

export default function AchievementsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { isUnlocked } = useAchievements()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PressableScale
          accessibilityLabel={t("common:back")}
          accessibilityRole="button"
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </PressableScale>
        <Text style={styles.title}>{t("achievements:title")}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        {ACHIEVEMENTS.map((achievement) => {
          const unlocked = isUnlocked(achievement.id)
          return (
            <View key={achievement.id} style={[styles.badge, unlocked && styles.badgeUnlocked]}>
              <Ionicons
                name={achievement.icon as keyof typeof Ionicons.glyphMap}
                size={28}
                color={unlocked ? "#fbbf24" : "#4a4a5a"}
              />
              <Text style={[styles.badgeTitle, unlocked && styles.badgeTitleUnlocked]}>
                {t(`achievements:${achievement.id}`)}
              </Text>
              <Text style={styles.badgeDescription}>
                {t(`achievements:${achievement.id}_desc`)}
              </Text>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  backButton: {
    marginRight: 16,
    padding: 10,
  },
  badge: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    borderWidth: 1,
    minWidth: "45%",
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  badgeDescription: {
    color: "#7e7e8e",
    fontFamily: "Oxanium-Regular",
    fontSize: 11,
    marginTop: 4,
    textAlign: "center",
  },
  badgeTitle: {
    color: "#8e8e9e",
    fontFamily: "Oxanium-SemiBold",
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
  },
  badgeTitleUnlocked: {
    color: "white",
  },
  badgeUnlocked: {
    borderColor: "rgba(251, 191, 36, 0.3)",
  },
  container: {
    backgroundColor: "#1a1a2e",
    flex: 1,
    paddingHorizontal: 20,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
    paddingBottom: 40,
    paddingTop: 24,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
  },
  title: {
    color: "white",
    fontFamily: "Oxanium-Bold",
    fontSize: 28,
  },
})
