import { create } from "zustand"

export type PendingGameAction = "play_again" | "continue" | "main_menu"

type PendingActionState = {
  action: PendingGameAction | null
  setAction: (action: PendingGameAction) => void
  clear: () => void
}

/**
 * Transient cross-screen signal for GameScreen to execute an action
 * after returning from the /game-over route.
 *
 * Pattern:
 *   game-over screen:  setAction("play_again"); router.back()
 *   GameScreen:        useEffect watches action, runs handler, calls clear()
 */
export const usePendingActionStore = create<PendingActionState>((set) => ({
  action: null,
  setAction: (action) => set({ action }),
  clear: () => set({ action: null }),
}))
