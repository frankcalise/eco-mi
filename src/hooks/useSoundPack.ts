import { useState } from "react"

import { DEFAULT_SOUND_PACK_ID, getSoundPackById } from "@/config/soundPacks"
import { SETTINGS_SELECTED_SOUND_PACK } from "@/config/storageKeys"
import { loadString, saveString } from "@/utils/storage"

export function useSoundPack() {
  const [packId, setPackId] = useState<string>(() => {
    return loadString(SETTINGS_SELECTED_SOUND_PACK) ?? DEFAULT_SOUND_PACK_ID
  })
  const [previewPackId, setPreviewPackId] = useState<string | null>(null)

  const soundPack = getSoundPackById(packId)
  const previewSoundPack = previewPackId ? getSoundPackById(previewPackId) : null
  const activeSoundPack = previewSoundPack ?? soundPack

  function setSoundPack(id: string) {
    const pack = getSoundPackById(id)
    setPackId(pack.id)
    saveString(SETTINGS_SELECTED_SOUND_PACK, pack.id)
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
