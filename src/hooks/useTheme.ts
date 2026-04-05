import { useState } from "react"

import { getThemeById, type GameTheme } from "@/config/themes"
import { loadString, saveString } from "@/utils/storage"

const THEME_KEY = "ecomi:settings:selectedTheme"

export function useTheme(): { theme: GameTheme; setTheme: (id: string) => void } {
  const [themeId, setThemeId] = useState(() => loadString(THEME_KEY) ?? "classic")

  function setTheme(id: string) {
    setThemeId(id)
    saveString(THEME_KEY, id)
  }

  return {
    theme: getThemeById(themeId),
    setTheme,
  }
}
