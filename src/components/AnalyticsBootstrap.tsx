import { useEffect } from "react"
import Constants from "expo-constants"
import i18n from "i18next"
import { nanoid } from "nanoid/non-secure"
import { usePostHog } from "posthog-react-native"

import { loadString, saveString } from "@/utils/storage"

const DISTINCT_ID_KEY = "ecomi:analytics:distinctId"
const FIRST_SEEN_KEY = "ecomi:analytics:firstSeenAt"
const REMOVE_ADS_KEY = "ecomi:purchases:removeAds"
const THEME_KEY = "ignite.themeScheme"

export function AnalyticsBootstrap() {
  const posthog = usePostHog()

  useEffect(() => {
    if (!posthog) return

    const environment = __DEV__ ? "development" : "production"
    const appVariant = Constants.expoConfig?.extra?.appVariant ?? "production"
    posthog.register({ environment, appVariant })

    let distinctId = loadString(DISTINCT_ID_KEY)
    if (!distinctId) {
      distinctId = nanoid(21)
      saveString(DISTINCT_ID_KEY, distinctId)
    }

    let firstSeenAt = loadString(FIRST_SEEN_KEY)
    if (!firstSeenAt) {
      firstSeenAt = new Date().toISOString()
      saveString(FIRST_SEEN_KEY, firstSeenAt)
    }

    const hasPurchasedPremium = loadString(REMOVE_ADS_KEY) === "true"
    const themeMode = loadString(THEME_KEY) ?? "system"
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
