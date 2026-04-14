import type { Color } from "@/hooks/useGameEngine"

export interface GameThemeButtonColor {
  color: string
  activeColor: string
}

export interface GameTheme {
  id: string
  name: string
  free: boolean
  buttonColors: Record<Color, GameThemeButtonColor>
  backgroundColor: string
  textColor: string
  secondaryTextColor: string
  statusBarStyle: "light" | "dark"
  surfaceColor: string
  borderColor: string
  accentColor: string
  destructiveColor: string
  warningColor: string
  linkColor: string
}

export const gameThemes: Record<string, GameTheme> = {
  classic: {
    id: "classic",
    name: "Classic",
    free: true,
    buttonColors: {
      red: { color: "#ef4444", activeColor: "#fca5a5" },
      blue: { color: "#3b82f6", activeColor: "#93c5fd" },
      green: { color: "#22c55e", activeColor: "#86efac" },
      yellow: { color: "#eab308", activeColor: "#fde047" },
    },
    backgroundColor: "#1a1a2e",
    textColor: "#ffffff",
    secondaryTextColor: "#a0a0a0",
    statusBarStyle: "light",
    surfaceColor: "rgba(0, 0, 0, 0.3)",
    borderColor: "rgba(255, 255, 255, 0.2)",
    accentColor: "#22c55e",
    destructiveColor: "#ef4444",
    warningColor: "#fbbf24",
    linkColor: "#3b82f6",
  },
  neon: {
    id: "neon",
    name: "Neon",
    free: false,
    buttonColors: {
      red: { color: "#00fff5", activeColor: "#80fffa" },
      blue: { color: "#ff00ff", activeColor: "#ff80ff" },
      green: { color: "#39ff14", activeColor: "#9cff8a" },
      yellow: { color: "#ff6600", activeColor: "#ff9955" },
    },
    backgroundColor: "#0a0a0a",
    textColor: "#ffffff",
    secondaryTextColor: "#888888",
    statusBarStyle: "light",
    surfaceColor: "rgba(0, 0, 0, 0.3)",
    borderColor: "rgba(255, 255, 255, 0.2)",
    accentColor: "#39ff14",
    destructiveColor: "#ff0055",
    warningColor: "#ff6600",
    linkColor: "#00fff5",
  },
  retro: {
    id: "retro",
    name: "Retro",
    free: false,
    buttonColors: {
      red: { color: "#c0392b", activeColor: "#e57368" },
      blue: { color: "#2c3e50", activeColor: "#5d7a94" },
      green: { color: "#27ae60", activeColor: "#6dcea0" },
      yellow: { color: "#f39c12", activeColor: "#f7c56e" },
    },
    backgroundColor: "#2c2c2c",
    textColor: "#f0e6d3",
    secondaryTextColor: "#998877",
    statusBarStyle: "light",
    surfaceColor: "rgba(0, 0, 0, 0.3)",
    borderColor: "rgba(255, 255, 255, 0.2)",
    accentColor: "#27ae60",
    destructiveColor: "#c0392b",
    warningColor: "#f39c12",
    linkColor: "#2c3e50",
  },
  pastel: {
    id: "pastel",
    name: "Pastel",
    free: false,
    buttonColors: {
      red: { color: "#f8a5c2", activeColor: "#fcd4e2" },
      blue: { color: "#a3d8f4", activeColor: "#d1ecfa" },
      green: { color: "#b8e6c8", activeColor: "#dcf3e4" },
      yellow: { color: "#ffeaa7", activeColor: "#fff5d3" },
    },
    backgroundColor: "#f5f0ff",
    textColor: "#2d2d3f",
    secondaryTextColor: "#7a7a9a",
    statusBarStyle: "dark",
    surfaceColor: "rgba(0, 0, 0, 0.06)",
    borderColor: "rgba(0, 0, 0, 0.15)",
    accentColor: "#6c5ce7",
    destructiveColor: "#e17055",
    warningColor: "#fdcb6e",
    linkColor: "#74b9ff",
  },
}

export const themeIds = Object.keys(gameThemes)

export function getThemeById(id: string): GameTheme {
  return gameThemes[id] ?? gameThemes.classic
}
