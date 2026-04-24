import type { Color } from "@/hooks/useGameEngine"
import { getReadableForeground } from "@/utils/color"

export interface GameThemeButtonColor {
  color: string
  activeColor: string
  glowColor?: string
}

export interface GameTheme {
  id: string
  name: string
  free: boolean
  buttonColors: Record<Color, GameThemeButtonColor>
  titleCycleColors: string[]
  backgroundColor: string
  textColor: string
  secondaryTextColor: string
  statusBarStyle: "light" | "dark"
  surfaceColor: string
  borderColor: string
  panelColor: string
  panelBorderColor: string
  accentColor: string
  primaryForegroundColor: "#000000" | "#ffffff"
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
      red: { color: "#ef4444", activeColor: "#fca5a5", glowColor: "#ef4444" },
      blue: { color: "#3b82f6", activeColor: "#93c5fd", glowColor: "#3b82f6" },
      green: { color: "#22c55e", activeColor: "#86efac", glowColor: "#22c55e" },
      yellow: { color: "#eab308", activeColor: "#fde047", glowColor: "#eab308" },
    },
    titleCycleColors: ["#ef4444", "#60a5fa", "#4ade80"],
    backgroundColor: "#1a1a2e",
    textColor: "#ffffff",
    secondaryTextColor: "#a0a0a0",
    statusBarStyle: "light",
    surfaceColor: "rgba(0, 0, 0, 0.3)",
    borderColor: "rgba(255, 255, 255, 0.2)",
    accentColor: "#22c55e",
    panelColor: "rgba(0, 0, 0, 0.5)",
    panelBorderColor: "rgba(255, 255, 255, 0.2)",
    primaryForegroundColor: getReadableForeground("#22c55e"),
    destructiveColor: "#ef4444",
    warningColor: "#fbbf24",
    linkColor: "#3b82f6",
  },
  neon: {
    id: "neon",
    name: "Neon",
    free: false,
    buttonColors: {
      red: { color: "#00fff5", activeColor: "#80fffa", glowColor: "#00fff5" },
      blue: { color: "#ff00ff", activeColor: "#ff80ff", glowColor: "#ff00ff" },
      green: { color: "#39ff14", activeColor: "#9cff8a", glowColor: "#39ff14" },
      yellow: { color: "#ff6600", activeColor: "#ff9955", glowColor: "#ff6600" },
    },
    titleCycleColors: ["#00fff5", "#ff4dff", "#7dff63"],
    backgroundColor: "#0a0a0a",
    textColor: "#ffffff",
    secondaryTextColor: "#888888",
    statusBarStyle: "light",
    surfaceColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "rgba(57, 255, 20, 0.22)",
    accentColor: "#39ff14",
    panelColor: "rgba(255, 255, 255, 0.03)",
    panelBorderColor: "rgba(57, 255, 20, 0.22)",
    primaryForegroundColor: getReadableForeground("#39ff14"),
    destructiveColor: "#ff0055",
    warningColor: "#ff6600",
    linkColor: "#00fff5",
  },
  retro: {
    id: "retro",
    name: "Retro",
    free: false,
    buttonColors: {
      red: { color: "#c0392b", activeColor: "#e57368", glowColor: "#c0392b" },
      blue: { color: "#2c3e50", activeColor: "#5d7a94", glowColor: "#56708a" },
      green: { color: "#27ae60", activeColor: "#6dcea0", glowColor: "#27ae60" },
      yellow: { color: "#f39c12", activeColor: "#f7c56e", glowColor: "#f39c12" },
    },
    titleCycleColors: ["#cf5d4d", "#6f8faa", "#53c97e"],
    backgroundColor: "#2c2c2c",
    textColor: "#f0e6d3",
    secondaryTextColor: "#b0a089",
    statusBarStyle: "light",
    surfaceColor: "rgba(240, 230, 211, 0.08)",
    borderColor: "rgba(176, 160, 137, 0.28)",
    accentColor: "#27ae60",
    panelColor: "rgba(240, 230, 211, 0.06)",
    panelBorderColor: "rgba(176, 160, 137, 0.24)",
    primaryForegroundColor: getReadableForeground("#27ae60"),
    destructiveColor: "#c0392b",
    warningColor: "#f39c12",
    linkColor: "#2c3e50",
  },
  pastel: {
    id: "pastel",
    name: "Pastel",
    free: false,
    buttonColors: {
      red: { color: "#f8a5c2", activeColor: "#fcd4e2", glowColor: "#db7fa1" },
      blue: { color: "#a3d8f4", activeColor: "#d1ecfa", glowColor: "#63add8" },
      green: { color: "#b8e6c8", activeColor: "#dcf3e4", glowColor: "#78ba92" },
      yellow: { color: "#ffeaa7", activeColor: "#fff5d3", glowColor: "#d8bb4a" },
    },
    titleCycleColors: ["#d986a6", "#69a9cf", "#73b98e"],
    backgroundColor: "#f5f0ff",
    textColor: "#2d2d3f",
    secondaryTextColor: "#6a6a8a",
    statusBarStyle: "dark",
    surfaceColor: "rgba(108, 92, 231, 0.08)",
    borderColor: "rgba(108, 92, 231, 0.22)",
    accentColor: "#6c5ce7",
    panelColor: "rgba(108, 92, 231, 0.12)",
    panelBorderColor: "rgba(108, 92, 231, 0.2)",
    primaryForegroundColor: getReadableForeground("#6c5ce7"),
    destructiveColor: "#e17055",
    warningColor: "#fdcb6e",
    linkColor: "#74b9ff",
  },
}

export const themeIds = Object.keys(gameThemes)

export function getThemeById(id: string): GameTheme {
  return gameThemes[id] ?? gameThemes.classic
}

/** True when the theme uses a light backdrop (dark status-bar glyphs).
 * Pastel is the only light theme today — callers use this to gate
 * shadow-heavy treatments that read too loud on a pale surface. */
export function isLightTheme(theme: GameTheme): boolean {
  return theme.statusBarStyle === "dark"
}
