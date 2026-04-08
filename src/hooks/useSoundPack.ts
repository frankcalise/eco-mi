import { useState } from "react"

import { DEFAULT_SOUND_PACK_ID, getSoundPackById } from "@/config/soundPacks"
import type { SoundPack } from "@/config/soundPacks"
import { loadString, saveString } from "@/utils/storage"

const STORAGE_KEY = "ecomi:settings:selectedSoundPack"

export function useSoundPack(): {
  soundPack: SoundPack
  setSoundPack: (id: string) => void
} {
  const [packId, setPackId] = useState<string>(() => {
    return loadString(STORAGE_KEY) ?? DEFAULT_SOUND_PACK_ID
  })

  function setSoundPack(id: string) {
    const pack = getSoundPackById(id)
    setPackId(pack.id)
    saveString(STORAGE_KEY, pack.id)
  }

  return {
    soundPack: getSoundPackById(packId),
    setSoundPack,
  }
}
