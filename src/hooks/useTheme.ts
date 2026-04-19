import { useState, useSyncExternalStore } from "react"

import { SETTINGS_SELECTED_THEME } from "@/config/storageKeys"
import { getThemeById } from "@/config/themes"
import { loadString, saveString } from "@/utils/storage"

let currentThemeId = loadString(SETTINGS_SELECTED_THEME) ?? "classic"
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return currentThemeId
}

function notifyThemeChanged() {
  for (const listener of listeners) {
    listener()
  }
}

export function useTheme() {
  const themeId = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const [previewThemeId, setPreviewThemeId] = useState<string | null>(null)

  const theme = getThemeById(themeId)
  const previewTheme = previewThemeId ? getThemeById(previewThemeId) : null
  const activeTheme = previewTheme ?? theme

  function setTheme(id: string) {
    currentThemeId = id
    saveString(SETTINGS_SELECTED_THEME, id)
    notifyThemeChanged()
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
