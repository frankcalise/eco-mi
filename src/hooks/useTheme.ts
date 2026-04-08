import { useState } from "react"

import { getThemeById, type GameTheme } from "@/config/themes"
import { loadString, saveString } from "@/utils/storage"

const THEME_KEY = "ecomi:settings:selectedTheme"

export function useTheme() {
  const [themeId, setThemeId] = useState(() => loadString(THEME_KEY) ?? "classic")
  const [previewThemeId, setPreviewThemeId] = useState<string | null>(null)

  const theme = getThemeById(themeId)
  const previewTheme = previewThemeId ? getThemeById(previewThemeId) : null
  const activeTheme = previewTheme ?? theme

  function setTheme(id: string) {
    setThemeId(id)
    saveString(THEME_KEY, id)
    setPreviewThemeId(null)
  }

  function setPreviewTheme(id: string) {
    setPreviewThemeId(id)
  }

  function clearPreview() {
    setPreviewThemeId(null)
  }

  return {
    theme,
    activeTheme,
    previewTheme,
    setTheme,
    setPreviewTheme,
    clearPreview,
  }
}
