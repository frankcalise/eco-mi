import type { Ionicons } from "@expo/vector-icons"

import type { GameMode } from "@/hooks/useGameEngine"

export const GAME_MODES: { id: GameMode; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "classic", icon: "game-controller" },
  { id: "daily", icon: "calendar" },
  { id: "timed", icon: "timer" },
  { id: "reverse", icon: "swap-horizontal" },
  { id: "chaos", icon: "shuffle" },
]
