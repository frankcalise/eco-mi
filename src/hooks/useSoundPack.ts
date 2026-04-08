import { useState } from "react"

import { DEFAULT_SOUND_PACK_ID, getSoundPackById } from "@/config/soundPacks"
import type { SoundPack } from "@/config/soundPacks"
import { loadString, saveString } from "@/utils/storage"

const STORAGE_KEY = "ecomi:settings:selectedSoundPack"

export function useSoundPack() {
  const [packId, setPackId] = useState<string>(() => {
    return loadString(STORAGE_KEY) ?? DEFAULT_SOUND_PACK_ID
  })
  const [previewPackId, setPreviewPackId] = useState<string | null>(null)

  const soundPack = getSoundPackById(packId)
  const previewSoundPack = previewPackId ? getSoundPackById(previewPackId) : null
  const activeSoundPack = previewSoundPack ?? soundPack

  function setSoundPack(id: string) {
    const pack = getSoundPackById(id)
    setPackId(pack.id)
    saveString(STORAGE_KEY, pack.id)
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
