import { create } from "zustand"

type SessionAdState = {
  rewardedWatchedThisSession: number
  tiredOfAdsShownThisSession: boolean
  swappedCtaGameOversThisSession: number
  incrementRewardedWatched: () => void
  markTiredOfAdsShown: () => void
  incrementSwappedCtaGameOvers: () => void
}

const REWARDED_SWAP_THRESHOLD = 2
const REWARDED_SWAP_GAMEOVER_CAP = 4

export const useSessionAdStore = create<SessionAdState>((set) => ({
  rewardedWatchedThisSession: 0,
  tiredOfAdsShownThisSession: false,
  swappedCtaGameOversThisSession: 0,
  incrementRewardedWatched: () =>
    set((s) => ({ rewardedWatchedThisSession: s.rewardedWatchedThisSession + 1 })),
  markTiredOfAdsShown: () => set({ tiredOfAdsShownThisSession: true }),
  incrementSwappedCtaGameOvers: () =>
    set((s) => ({ swappedCtaGameOversThisSession: s.swappedCtaGameOversThisSession + 1 })),
}))

type SwapInputs = {
  rewardedWatchedThisSession: number
  tiredOfAdsShownThisSession: boolean
  swappedCtaGameOversThisSession: number
}

export function shouldSwapRemoveAdsCta(s: SwapInputs): boolean {
  if (s.tiredOfAdsShownThisSession) return false
  if (s.rewardedWatchedThisSession < REWARDED_SWAP_THRESHOLD) return false
  if (s.swappedCtaGameOversThisSession >= REWARDED_SWAP_GAMEOVER_CAP) return false
  return true
}
