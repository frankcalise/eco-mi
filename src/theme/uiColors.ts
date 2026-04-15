/**
 * Named color constants for literal RGB/hex values used outside of the
 * GameTheme system. Centralizes values flagged by
 * `react-native/no-color-literals`.
 *
 * Use GameTheme (`useTheme().activeTheme`) whenever the color should
 * adapt to the active pack (Classic/Neon/Retro/Pastel). Use these
 * constants for:
 *   - Loading/splash states where GameTheme isn't resolved yet
 *   - Universal shadow/overlay/backdrop colors
 *   - Brand accents (Remove Ads purple) that don't rotate with theme
 *   - Absolute white/black text when readability is guaranteed by
 *     context (e.g. text on a brand-colored button).
 */
export const UI_COLORS = {
  // Universals — same in every theme
  white: "#ffffff",
  black: "#000000",
  shadowBlack: "#000",

  // Classic theme duplicates — used before theme context resolves
  classicBackground: "#1a1a2e",
  classicSurfaceDim: "#a0a0a0",

  // Named semantic colors (non-themed)
  brandPurple: "#8b5cf6",

  // Direct palette shortcuts (keep until theme-usage refactor)
  red500: "#ef4444",
  amber400: "#fbbf24",
  amber500: "#f59e0b",
  green500: "#22c55e",

  // Transparent overlays
  whiteMuted: "rgba(255, 255, 255, 0.6)",
  whiteFaint: "rgba(255, 255, 255, 0.1)",
  backdropStrong: "rgba(0, 0, 0, 0.85)",
  backdropModal: "rgba(0, 0, 0, 0.7)",
  backdropSoft: "rgba(0, 0, 0, 0.5)",

  // Tinted surfaces (10% + 20% variants)
  greenTint10: "rgba(34, 197, 94, 0.1)",
  greenTint20: "rgba(34, 197, 94, 0.2)",
  amberTint10: "rgba(251, 191, 36, 0.1)",
  amberTint15: "rgba(251, 191, 36, 0.15)",
  amberTint30: "rgba(251, 191, 36, 0.3)",
  orangeTint10: "rgba(245, 158, 11, 0.1)",
  neutralTint30: "rgba(128, 128, 128, 0.3)",
} as const
