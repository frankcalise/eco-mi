import { useEffect, useState } from "react"
import { StyleSheet, View } from "react-native"
import { registerDevMenuItems } from "expo-dev-menu"
import AppMetrics from "expo-eas-observe"
import { router, Stack } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import * as Sentry from "@sentry/react-native"
import i18n from "i18next"
import { PostHogProvider } from "posthog-react-native"
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context"

import { AnalyticsBootstrap } from "@/components/AnalyticsBootstrap"
import { OrientationLockProvider } from "@/components/OrientationLockProvider"
import { RouteTracker } from "@/components/RouteTracker"
import { SETTINGS_SELECTED_THEME } from "@/config/storageKeys"
import { getThemeById } from "@/config/themes"
import { useWebFonts } from "@/hooks/useWebFonts"
import { initI18n } from "@/i18n"
import { secondaryStackScreenOptions } from "@/navigation/secondaryStackHeader"
import { ThemeProvider } from "@/theme/context"
import { UI_COLORS } from "@/theme/uiColors"
import { seedScreenshotData } from "@/utils/screenshotSeed"
import { loadString } from "@/utils/storage"

if (__DEV__) {
  registerDevMenuItems([
    {
      name: "Seed Screenshot Data",
      callback: () => seedScreenshotData(),
      shouldCollapse: true,
    },
    {
      name: "Haptics Lab",
      callback: () => router.push("/haptics-lab"),
      shouldCollapse: true,
    },
  ])
}

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

/** Keeps index under modal routes for correct deep-link / back stack behavior. */
export const unstable_settings = {
  anchor: "index",
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

  const [themeBg, setThemeBg] = useState(() => {
    const id = loadString(SETTINGS_SELECTED_THEME) ?? "classic"
    return getThemeById(id).backgroundColor
  })

  function syncThemeBg() {
    const id = loadString(SETTINGS_SELECTED_THEME) ?? "classic"
    const bg = getThemeById(id).backgroundColor
    setThemeBg((prev) => (prev === bg ? prev : bg))
  }

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync()
      AppMetrics.markFirstRender()
      AppMetrics.markInteractive()
    }
  }, [loaded])

  if (!loaded) {
    return (
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <View style={styles.splashBg} />
      </SafeAreaProvider>
    )
  }

  const navigation = (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "ios_from_right",
        contentStyle: { backgroundColor: themeBg },
      }}
      screenListeners={{ state: syncThemeBg }}
    >
      <Stack.Screen
        name="index"
        options={{
          /** Used as previous-screen label (e.g. iOS back long-press); header stays hidden via screenOptions. */
          title: i18n.t("game:mainMenu"),
        }}
      />
      <Stack.Screen name="tracking" options={{ animation: "fade" }} />
      <Stack.Screen name="achievements" options={secondaryStackScreenOptions as any} />
      <Stack.Screen name="stats" options={secondaryStackScreenOptions as any} />
      <Stack.Screen name="leaderboard" options={secondaryStackScreenOptions as any} />
      <Stack.Screen name="settings" options={secondaryStackScreenOptions as any} />
      <Stack.Screen name="game-over" options={{ animation: "fade", gestureEnabled: false }} />
      <Stack.Screen
        name="mode-select"
        options={{
          presentation: "transparentModal",
          headerShown: false,
          animation: "fade",
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
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
      <View style={[styles.splashBg, { backgroundColor: themeBg }]}>
        <ThemeProvider>
          <OrientationLockProvider>{inner}</OrientationLockProvider>
        </ThemeProvider>
      </View>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  splashBg: {
    backgroundColor: UI_COLORS.classicBackground,
    flex: 1,
  },
})

export default SENTRY_DSN ? Sentry.wrap(Root) : Root
