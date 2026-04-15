import { View, Text, ScrollView, StyleSheet } from "react-native"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { PressableScale } from "@/components/PressableScale"
import { ACHIEVEMENTS } from "@/config/achievements"
import { useAchievements } from "@/hooks/useAchievements"
import { useTheme } from "@/hooks/useTheme"
import { UI_COLORS } from "@/theme/uiColors"

export default function AchievementsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { isUnlocked } = useAchievements()
  const insets = useSafeAreaInsets()
  const { activeTheme } = useTheme()

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
          {t("achievements:title")}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.grid}>
        {ACHIEVEMENTS.map((achievement) => {
          const unlocked = isUnlocked(achievement.id)
          return (
            <View
              key={achievement.id}
              style={[
                styles.badge,
                { backgroundColor: activeTheme.surfaceColor, borderColor: activeTheme.borderColor },
                unlocked && styles.badgeUnlocked,
              ]}
            >
              <Ionicons
                name={achievement.icon as keyof typeof Ionicons.glyphMap}
                size={28}
                color={unlocked ? "#fbbf24" : "#4a4a5a"}
              />
              <Text
                style={[
                  styles.badgeTitle,
                  { color: activeTheme.secondaryTextColor },
                  unlocked && { color: activeTheme.textColor },
                ]}
              >
                {t(`achievements:${achievement.id}`)}
              </Text>
              <Text style={[styles.badgeDescription, { color: activeTheme.secondaryTextColor }]}>
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
    borderRadius: 12,
    borderWidth: 1,
    minWidth: "45%",
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  badgeDescription: {
    fontFamily: "Oxanium-Regular",
    fontSize: 11,
    marginTop: 4,
    textAlign: "center",
  },
  badgeTitle: {
    fontFamily: "Oxanium-SemiBold",
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
  },
  badgeUnlocked: {
    borderColor: UI_COLORS.amberTint30,
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
    paddingBottom: 40,
    paddingTop: 24,
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
