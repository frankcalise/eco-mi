import { useRef, useState } from "react"

import { loadString, saveString } from "@/utils/storage"

const GAMES_PLAYED_KEY = "ecomi:stats:gamesPlayed"
const LAST_PROMPT_KEY = "ecomi:review:lastPromptDate"
const MIN_GAMES_FOR_REVIEW = 5
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const PROMPT_DELAY_MS = 2500 // show 2.5s after game over

type UseStoreReviewReturn = {
  showReviewPrompt: boolean
  triggerReviewCheck: (trigger: string, adShownThisSession: boolean) => void
  dismissReviewPrompt: () => void
  reviewTrigger: string
}

export function useStoreReview(): UseStoreReviewReturn {
  const [showReviewPrompt, setShowReviewPrompt] = useState(false)
  const [reviewTrigger, setReviewTrigger] = useState("")
  const delayTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  function isWithinCooldown(): boolean {
    const lastPrompt = loadString(LAST_PROMPT_KEY)
    if (!lastPrompt) return false
    return Date.now() - parseInt(lastPrompt, 10) < COOLDOWN_MS
  }

  function triggerReviewCheck(trigger: string, adShownThisSession: boolean) {
    if (adShownThisSession) return

    const gamesPlayed = parseInt(loadString(GAMES_PLAYED_KEY) ?? "0", 10)
    if (gamesPlayed < MIN_GAMES_FOR_REVIEW) return

    if (isWithinCooldown()) return

    // Delay so the game-over overlay is visible first
    if (delayTimeout.current) clearTimeout(delayTimeout.current)
    delayTimeout.current = setTimeout(() => {
      setReviewTrigger(trigger)
      setShowReviewPrompt(true)
      saveString(LAST_PROMPT_KEY, Date.now().toString())
    }, PROMPT_DELAY_MS)
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
