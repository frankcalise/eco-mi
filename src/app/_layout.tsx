import { useEffect, useState } from "react"
import { Slot } from "expo-router"
import { KeyboardProvider } from "react-native-keyboard-controller"
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context"

import { initI18n } from "@/i18n"
import { ThemeProvider } from "@/theme/context"
import { loadDateFnsLocale } from "@/utils/formatDate"
import { useWebFonts } from "@/hooks/useWebFonts"

export default function Root() {
  const [isI18nInitialized, setIsI18nInitialized] = useState(false)
  const { loaded: isFontsLoaded } = useWebFonts()

  useEffect(() => {
    initI18n()
      .then(() => setIsI18nInitialized(true))
      .then(() => loadDateFnsLocale())
  }, [])

  const loaded = isI18nInitialized
  if (!loaded || !isFontsLoaded) {
    return null
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeProvider>
        <KeyboardProvider>
          <Slot />
        </KeyboardProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
