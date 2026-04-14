import { View, Text, StyleSheet } from "react-native"
import { useTranslation } from "react-i18next"

import { DAILY_CURRENT_STREAK, DAILY_LAST_PLAYED } from "@/config/storageKeys"
import type { GameTheme } from "@/config/themes"
import { loadString } from "@/utils/storage"

type StreakBannerProps = {
  theme: GameTheme
}

function getTodayKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

export function StreakBanner({ theme }: StreakBannerProps) {
  const { t } = useTranslation()

  const streak = parseInt(loadString(DAILY_CURRENT_STREAK) ?? "0", 10)
  const lastPlayed = loadString(DAILY_LAST_PLAYED) ?? ""
  const today = getTodayKey()

  if (streak <= 0 || lastPlayed === today) return null

  return (
    <View style={[styles.banner, { backgroundColor: `${theme.warningColor}20` }]}>
      <Text style={[styles.bannerText, { color: theme.warningColor }]}>
        {t("game:streakAtRisk", { count: streak })}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    alignItems: "center",
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: "80%",
  },
  bannerText: {
    fontFamily: "Oxanium-SemiBold",
    fontSize: 14,
    textAlign: "center",
  },
})
