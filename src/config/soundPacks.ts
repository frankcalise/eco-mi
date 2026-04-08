import type { OscillatorType } from "react-native-audio-api"

export interface SoundPack {
  id: string
  name: string
  oscillatorType: OscillatorType
  description: string
}

export const SOUND_PACKS: SoundPack[] = [
  {
    id: "sine",
    name: "Classic",
    oscillatorType: "sine",
    description: "Warm, smooth sine wave",
  },
  {
    id: "square",
    name: "Retro",
    oscillatorType: "square",
    description: "Retro chiptune feel",
  },
  {
    id: "sawtooth",
    name: "Buzzy",
    oscillatorType: "sawtooth",
    description: "Buzzy, aggressive sawtooth",
  },
  {
    id: "triangle",
    name: "Mellow",
    oscillatorType: "triangle",
    description: "Softer, mellow triangle wave",
  },
]

export const DEFAULT_SOUND_PACK_ID = "sine"

export function getSoundPackById(id: string): SoundPack {
  return SOUND_PACKS.find((p) => p.id === id) ?? SOUND_PACKS[0]
}
