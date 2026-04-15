import { useEffect, useState } from "react"
import AppMetrics from "expo-eas-observe"
import { Stack } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import * as Sentry from "@sentry/react-native"
import { PostHogProvider } from "posthog-react-native"
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context"

import { AnalyticsBootstrap } from "@/components/AnalyticsBootstrap"
import { RouteTracker } from "@/components/RouteTracker"
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

SplashScreen.preventAutoHideAsync()

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
      SplashScreen.hideAsync()
      AppMetrics.markFirstRender()
      AppMetrics.markInteractive()
    }
  }, [loaded])

  if (!loaded) {
    return null
  }

  const navigation = (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "ios_from_right",
        contentStyle: { backgroundColor: "#1a1a2e" },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="tracking" options={{ animation: "fade" }} />
      <Stack.Screen name="achievements" />
      <Stack.Screen name="stats" />
      <Stack.Screen name="leaderboard" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="game-over" options={{ animation: "fade", gestureEnabled: false }} />
    </Stack>
  )

  const inner = POSTHOG_KEY ? (
    <PostHogProvider
      apiKey={POSTHOG_KEY}
      options={{ host: "https://us.i.posthog.com" }}
      autocapture={{ captureScreens: false }}
    >
      <AnalyticsBootstrap />
      <RouteTracker />
      {navigation}
    </PostHogProvider>
  ) : (
    navigation
  )

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeProvider>{inner}</ThemeProvider>
    </SafeAreaProvider>
  )
}

export default SENTRY_DSN ? Sentry.wrap(Root) : Root
