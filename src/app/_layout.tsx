import { useEffect, useState } from "react"
import AppMetrics from "expo-eas-observe"
import { Slot } from "expo-router"
import * as Sentry from "@sentry/react-native"
import { PostHogProvider } from "posthog-react-native"
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context"

import { useWebFonts } from "@/hooks/useWebFonts"
import { initI18n } from "@/i18n"
import { ThemeProvider } from "@/theme/context"

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? ""

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    debug: false,
    environment: __DEV__ ? "development" : "production",
    enableUserInteractionTracing: false,
  })
}

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? ""

function Root() {
  const [isI18nInitialized, setIsI18nInitialized] = useState(false)
  const { loaded: isFontsLoaded } = useWebFonts()

  useEffect(() => {
    initI18n()
      .catch((err) => console.error("i18n init failed:", err))
      .finally(() => setIsI18nInitialized(true))
  }, [])

  const loaded = isI18nInitialized && isFontsLoaded

  useEffect(() => {
    if (loaded) {
      AppMetrics.markFirstRender()
      AppMetrics.markInteractive()
    }
  }, [loaded])

  if (!loaded) {
    return null
  }

  const inner = POSTHOG_KEY ? (
    <PostHogProvider
      apiKey={POSTHOG_KEY}
      options={{ host: "https://us.i.posthog.com" }}
      autocapture={{ captureScreens: false }}
    >
      <Slot />
    </PostHogProvider>
  ) : (
    <Slot />
  )

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeProvider>{inner}</ThemeProvider>
    </SafeAreaProvider>
  )
}

export default SENTRY_DSN ? Sentry.wrap(Root) : Root
