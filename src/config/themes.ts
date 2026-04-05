import type { Color } from "@/hooks/useGameEngine"

export interface GameThemeButtonColor {
  color: string
  activeColor: string
}

export interface GameTheme {
  id: string
  name: string
  buttonColors: Record<Color, GameThemeButtonColor>
  backgroundColor: string
  textColor: string
  secondaryTextColor: string
}

export const gameThemes: Record<string, GameTheme> = {
  classic: {
    id: "classic",
    name: "Classic",
    buttonColors: {
      red: { color: "#ef4444", activeColor: "#fca5a5" },
      blue: { color: "#3b82f6", activeColor: "#93c5fd" },
      green: { color: "#22c55e", activeColor: "#86efac" },
      yellow: { color: "#eab308", activeColor: "#fde047" },
    },
    backgroundColor: "#1a1a2e",
    textColor: "#ffffff",
    secondaryTextColor: "#a0a0a0",
  },
  neon: {
    id: "neon",
    name: "Neon",
    buttonColors: {
      red: { color: "#00fff5", activeColor: "#80fffa" },
      blue: { color: "#ff00ff", activeColor: "#ff80ff" },
      green: { color: "#39ff14", activeColor: "#9cff8a" },
      yellow: { color: "#ff6600", activeColor: "#ff9955" },
    },
    backgroundColor: "#0a0a0a",
    textColor: "#ffffff",
    secondaryTextColor: "#888888",
  },
  retro: {
    id: "retro",
    name: "Retro",
    buttonColors: {
      red: { color: "#c0392b", activeColor: "#e57368" },
      blue: { color: "#2c3e50", activeColor: "#5d7a94" },
      green: { color: "#27ae60", activeColor: "#6dcea0" },
      yellow: { color: "#f39c12", activeColor: "#f7c56e" },
    },
    backgroundColor: "#2c2c2c",
    textColor: "#f0e6d3",
    secondaryTextColor: "#998877",
  },
  pastel: {
    id: "pastel",
    name: "Pastel",
    buttonColors: {
      red: { color: "#f8a5c2", activeColor: "#fcd4e2" },
      blue: { color: "#a3d8f4", activeColor: "#d1ecfa" },
      green: { color: "#b8e6c8", activeColor: "#dcf3e4" },
      yellow: { color: "#ffeaa7", activeColor: "#fff5d3" },
    },
    backgroundColor: "#f5f0ff",
    textColor: "#2d2d3f",
    secondaryTextColor: "#7a7a9a",
  },
}

export const themeIds = Object.keys(gameThemes)

export function getThemeById(id: string): GameTheme {
  return gameThemes[id] ?? gameThemes.classic
}
