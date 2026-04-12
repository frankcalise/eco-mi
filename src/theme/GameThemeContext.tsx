import { createContext, useContext } from "react"

import type { GameTheme } from "@/config/themes"
import { gameThemes } from "@/config/themes"

const GameThemeContext = createContext<GameTheme>(gameThemes.classic)

export const GameThemeProvider = GameThemeContext.Provider

export function useGameTheme(): GameTheme {
  return useContext(GameThemeContext)
}
