import type { NativeStackNavigationOptions } from "@react-navigation/native-stack"

import { gameThemes, type GameTheme } from "@/config/themes"

const classic = gameThemes.classic

/** Shared defaults for stats, leaderboard, achievements, settings (classic baseline + Oxanium). */
export const secondaryStackScreenOptions: NativeStackNavigationOptions = {
  headerShown: true,
  /** iOS: chevron only; v7 removed `headerBackTitleVisible`. */
  headerBackButtonDisplayMode: "minimal",
  headerShadowVisible: false,
  headerTitleStyle: {
    fontFamily: "Oxanium-Bold",
    fontSize: 17,
    color: classic.textColor,
  },
  headerStyle: {
    backgroundColor: classic.backgroundColor,
  },
  headerTintColor: classic.textColor,
}

export function stackHeaderOptionsFromTheme(
  theme: GameTheme,
): Pick<NativeStackNavigationOptions, "headerStyle" | "headerTintColor" | "headerTitleStyle"> {
  return {
    headerStyle: { backgroundColor: theme.backgroundColor },
    headerTintColor: theme.textColor,
    headerTitleStyle: {
      fontFamily: "Oxanium-Bold",
      fontSize: 17,
      color: theme.textColor,
    },
  }
}
