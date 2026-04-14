import { useEffect, useRef } from "react"
import * as Notifications from "expo-notifications"
import { useTranslation } from "react-i18next"

import {
  DAILY_CURRENT_STREAK,
  DAILY_LAST_PLAYED,
  NOTIFICATIONS_PERMISSION_ASKED,
  STATS_GAMES_PLAYED,
} from "@/config/storageKeys"
import { loadString, saveString } from "@/utils/storage"

const MIN_GAMES_BEFORE_ASK = 3

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

function getTodayKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

export function useNotifications() {
  const { t } = useTranslation()
  const scheduled = useRef(false)

  async function requestPermissionIfNeeded(): Promise<boolean> {
    const asked = loadString(NOTIFICATIONS_PERMISSION_ASKED)
    if (asked === "true") {
      const { status } = await Notifications.getPermissionsAsync()
      return status === "granted"
    }

    const gamesPlayed = parseInt(loadString(STATS_GAMES_PLAYED) ?? "0", 10)
    if (gamesPlayed < MIN_GAMES_BEFORE_ASK) return false

    saveString(NOTIFICATIONS_PERMISSION_ASKED, "true")
    const { status } = await Notifications.requestPermissionsAsync()
    return status === "granted"
  }

  async function scheduleNotifications() {
    const granted = await requestPermissionIfNeeded()
    if (!granted) return

    await Notifications.cancelAllScheduledNotificationsAsync()

    const today = getTodayKey()
    const lastPlayed = loadString(DAILY_LAST_PLAYED) ?? ""

    // Daily reminder at 19:00 if not played today
    if (lastPlayed !== today) {
      const trigger = new Date()
      trigger.setHours(19, 0, 0, 0)
      if (trigger.getTime() > Date.now()) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Eco Mi",
            body: t("notifications:dailyReminder"),
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
        })
      }
    }

    // Streak save — tomorrow 10:00 if streak is active
    const streak = parseInt(loadString(DAILY_CURRENT_STREAK) ?? "0", 10)
    if (streak > 0 && lastPlayed === today) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(10, 0, 0, 0)
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Eco Mi",
          body: t("notifications:streakAtRisk", { count: streak }),
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: tomorrow },
      })
    }

    // Win-back — 3 days from now
    const threeDays = new Date()
    threeDays.setDate(threeDays.getDate() + 3)
    threeDays.setHours(12, 0, 0, 0)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Eco Mi",
        body: t("notifications:winBack"),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: threeDays },
    })
  }

  function rescheduleAfterGameOver() {
    scheduleNotifications()
  }

  useEffect(() => {
    if (!scheduled.current) {
      scheduled.current = true
      scheduleNotifications()
    }
  }, [])

  return { rescheduleAfterGameOver }
}
