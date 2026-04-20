import type { GameTheme } from "@/config/themes"
import type { GameMode } from "@/hooks/useGameEngine"

export type CompactModePickerSheetHandle = {
  /** Android: animated hide before unmount. iOS / web: no-op. */
  hideIfNeeded: () => Promise<void>
}

export type CompactModePickerSheetProps = {
  visible: boolean
  onVisibleChange: (visible: boolean) => void
  /** When set, native dismiss (swipe, outside tap) is disabled on both platforms. */
  pulsingMode: GameMode | null
  selectedMode: GameMode
  pulsePhase: "bright" | "dim"
  theme: GameTheme
  onSelectMode: (id: GameMode) => void
}
