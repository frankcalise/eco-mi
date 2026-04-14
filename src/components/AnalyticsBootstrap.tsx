import { useEffect } from "react"
import Constants from "expo-constants"
import i18n from "i18next"
import { nanoid } from "nanoid/non-secure"
import { usePostHog } from "posthog-react-native"

import {
  ANALYTICS_DISTINCT_ID,
  ANALYTICS_FIRST_SEEN,
  PURCHASES_REMOVE_ADS,
  SETTINGS_THEME_SCHEME,
} from "@/config/storageKeys"
import { loadString, saveString } from "@/utils/storage"

export function AnalyticsBootstrap() {
  const posthog = usePostHog()

  useEffect(() => {
    if (!posthog) return

    const environment = __DEV__ ? "development" : "production"
    const appVariant = Constants.expoConfig?.extra?.appVariant ?? "production"
    posthog.register({ environment, appVariant })

    let distinctId = loadString(ANALYTICS_DISTINCT_ID)
    if (!distinctId) {
      distinctId = nanoid(21)
      saveString(ANALYTICS_DISTINCT_ID, distinctId)
    }

    let firstSeenAt = loadString(ANALYTICS_FIRST_SEEN)
    if (!firstSeenAt) {
      firstSeenAt = new Date().toISOString()
      saveString(ANALYTICS_FIRST_SEEN, firstSeenAt)
    }

    const hasPurchasedPremium = loadString(PURCHASES_REMOVE_ADS) === "true"
    const themeMode = loadString(SETTINGS_THEME_SCHEME) ?? "system"
    const preferredLocale = i18n.language

    posthog.identify(distinctId, {
      firstSeenAt,
      preferredLocale,
      themeMode,
      hasPurchasedPremium,
    })
  }, [posthog])

  return null
}
