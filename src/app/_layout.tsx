import { useEffect, useState } from "react"
import { Slot } from "expo-router"
import { PostHogProvider } from "posthog-react-native"
import { KeyboardProvider } from "react-native-keyboard-controller"
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context"

import { useWebFonts } from "@/hooks/useWebFonts"
import { initI18n } from "@/i18n"
import { ThemeProvider } from "@/theme/context"
import { loadDateFnsLocale } from "@/utils/formatDate"

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? ""

export default function Root() {
  const [isI18nInitialized, setIsI18nInitialized] = useState(false)
  const { loaded: isFontsLoaded } = useWebFonts()

  useEffect(() => {
    initI18n()
      .then(() => loadDateFnsLocale())
      .catch((err) => console.error("i18n init failed:", err))
      .finally(() => setIsI18nInitialized(true))
  }, [])

  const loaded = isI18nInitialized
  if (!loaded || !isFontsLoaded) {
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
      <ThemeProvider>
        <KeyboardProvider>{inner}</KeyboardProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
