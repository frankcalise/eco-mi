import { useFonts } from "expo-font"

export function useWebFonts() {
  const [loaded, error] = useFonts({
    "Oxanium-Regular": require("@assets/fonts/Oxanium-Regular.ttf"),
    "Oxanium-Bold": require("@assets/fonts/Oxanium-Bold.ttf"),
    "Oxanium-Medium": require("@assets/fonts/Oxanium-Medium.ttf"),
    "Oxanium-SemiBold": require("@assets/fonts/Oxanium-SemiBold.ttf"),
  })

  return { loaded, error }
}
