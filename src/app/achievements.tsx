import { useLayoutEffect } from "react"
import { View, Text, ScrollView, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useNavigation } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useTranslation } from "react-i18next"

import { ACHIEVEMENTS } from "@/config/achievements"
import { useAchievements } from "@/hooks/useAchievements"
import { useTheme } from "@/hooks/useTheme"
import { stackHeaderOptionsFromTheme } from "@/navigation/secondaryStackHeader"
import { UI_COLORS } from "@/theme/uiColors"

export default function AchievementsScreen() {
  const { t, i18n } = useTranslation()
  const navigation = useNavigation()
  const { isUnlocked } = useAchievements()
  const { activeTheme } = useTheme()

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("achievements:title"),
      headerBackAccessibilityLabel: t("common:back"),
      ...stackHeaderOptionsFromTheme(activeTheme),
    })
  }, [navigation, t, i18n.language, activeTheme])

  return (
    <View style={[styles.container, { backgroundColor: activeTheme.backgroundColor }]}>
      <StatusBar style={activeTheme.statusBarStyle} backgroundColor={activeTheme.backgroundColor} />
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
})
