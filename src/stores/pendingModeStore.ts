import { create } from "zustand"

import type { GameMode } from "@/hooks/useGameEngine"

type PendingModeState = {
  pendingMode: GameMode | null
  setPendingMode: (mode: GameMode) => void
  clear: () => void
}

/**
 * Cross-screen handoff when the user confirms a mode on /mode-select (tablet).
 * GameScreen applies useGameEngine.setMode and clears — same idea as pendingActionStore.
 */
export const usePendingModeStore = create<PendingModeState>((set) => ({
  pendingMode: null,
  setPendingMode: (mode) => set({ pendingMode: mode }),
  clear: () => set({ pendingMode: null }),
}))
