import { useRef, useState } from "react"

import { REVIEW_LAST_PROMPT_DATE, STATS_GAMES_PLAYED } from "@/config/storageKeys"
import { loadString, saveString } from "@/utils/storage"

const MIN_GAMES_FOR_REVIEW = 5
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const PROMPT_DELAY_MS = 2500 // show 2.5s after game over

type UseStoreReviewReturn = {
  showReviewPrompt: boolean
  /** Returns true if the prompt will be shown (conditions met), false if skipped. */
  triggerReviewCheck: (trigger: string, adShownThisSession: boolean) => boolean
  dismissReviewPrompt: () => void
  reviewTrigger: string
}

export function useStoreReview(): UseStoreReviewReturn {
  const [showReviewPrompt, setShowReviewPrompt] = useState(false)
  const [reviewTrigger, setReviewTrigger] = useState("")
  const delayTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  function isWithinCooldown(): boolean {
    const lastPrompt = loadString(REVIEW_LAST_PROMPT_DATE)
    if (!lastPrompt) return false
    return Date.now() - parseInt(lastPrompt, 10) < COOLDOWN_MS
  }

  function triggerReviewCheck(trigger: string, adShownThisSession: boolean): boolean {
    if (adShownThisSession) return false

    const gamesPlayed = parseInt(loadString(STATS_GAMES_PLAYED) ?? "0", 10)
    if (gamesPlayed < MIN_GAMES_FOR_REVIEW) return false

    if (isWithinCooldown()) return false

    // Delay so the game-over overlay is visible first
    if (delayTimeout.current) clearTimeout(delayTimeout.current)
    delayTimeout.current = setTimeout(() => {
      setReviewTrigger(trigger)
      setShowReviewPrompt(true)
      saveString(REVIEW_LAST_PROMPT_DATE, Date.now().toString())
    }, PROMPT_DELAY_MS)
    return true
  }

  function dismissReviewPrompt() {
    setShowReviewPrompt(false)
    setReviewTrigger("")
    if (delayTimeout.current) {
      clearTimeout(delayTimeout.current)
      delayTimeout.current = null
    }
  }

  return {
    showReviewPrompt,
    triggerReviewCheck,
    dismissReviewPrompt,
    reviewTrigger,
  }
}
