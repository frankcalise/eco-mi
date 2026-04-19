import { useState, useSyncExternalStore } from "react"

import { DEFAULT_SOUND_PACK_ID, getSoundPackById } from "@/config/soundPacks"
import { SETTINGS_SELECTED_SOUND_PACK } from "@/config/storageKeys"
import { loadString, saveString } from "@/utils/storage"

let currentPackId = loadString(SETTINGS_SELECTED_SOUND_PACK) ?? DEFAULT_SOUND_PACK_ID
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return currentPackId
}

function notifySoundPackChanged() {
  for (const listener of listeners) {
    listener()
  }
}

export function useSoundPack() {
  const packId = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const [previewPackId, setPreviewPackId] = useState<string | null>(null)

  const soundPack = getSoundPackById(packId)
  const previewSoundPack = previewPackId ? getSoundPackById(previewPackId) : null
  const activeSoundPack = previewSoundPack ?? soundPack

  function setSoundPack(id: string) {
    const pack = getSoundPackById(id)
    currentPackId = pack.id
    saveString(SETTINGS_SELECTED_SOUND_PACK, pack.id)
    notifySoundPackChanged()
    setPreviewPackId(null)
  }

  function setPreviewSoundPack(id: string) {
    setPreviewPackId(id)
  }

  function clearSoundPreview() {
    setPreviewPackId(null)
  }

  return {
    soundPack,
    activeSoundPack,
    previewSoundPack,
    setSoundPack,
    setPreviewSoundPack,
    clearSoundPreview,
  }
}
