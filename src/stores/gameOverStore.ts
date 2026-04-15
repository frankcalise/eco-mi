import { create } from "zustand"

import type { GameMode } from "@/hooks/useGameEngine"

type GameOverData = {
  score: number
  level: number
  highScore: number
  previousHighScore: number
  isNewHighScore: boolean
  mode: GameMode
  showRemoveAds: boolean
  showContinue: boolean
}

type GameOverState = GameOverData & {
  setGameOver: (data: GameOverData) => void
  clear: () => void
}

const DEFAULTS: GameOverData = {
  score: 0,
  level: 1,
  highScore: 0,
  previousHighScore: 0,
  isNewHighScore: false,
  mode: "classic",
  showRemoveAds: false,
  showContinue: false,
}

/**
 * Holds the snapshot of game-over state for rendering on /game-over screen.
 * GameScreen writes via setGameOver() before router.push("/game-over").
 * Avoids the string serialization dance that route params would require.
 */
export const useGameOverStore = create<GameOverState>((set) => ({
  ...DEFAULTS,
  setGameOver: (data) => set(data),
  clear: () => set(DEFAULTS),
}))
