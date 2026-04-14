import { useState } from "react"

import { SETTINGS_SELECTED_THEME } from "@/config/storageKeys"
import { getThemeById, type GameTheme } from "@/config/themes"
import { loadString, saveString } from "@/utils/storage"

export function useTheme() {
  const [themeId, setThemeId] = useState(() => loadString(SETTINGS_SELECTED_THEME) ?? "classic")
  const [previewThemeId, setPreviewThemeId] = useState<string | null>(null)

  const theme = getThemeById(themeId)
  const previewTheme = previewThemeId ? getThemeById(previewThemeId) : null
  const activeTheme = previewTheme ?? theme

  function setTheme(id: string) {
    setThemeId(id)
    saveString(SETTINGS_SELECTED_THEME, id)
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
