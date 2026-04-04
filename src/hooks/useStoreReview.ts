import { useState } from "react"

import { loadString } from "@/utils/storage"

const GAMES_PLAYED_KEY = "ecomi:stats:gamesPlayed"
const MIN_GAMES_FOR_REVIEW = 5

type UseStoreReviewReturn = {
  showReviewPrompt: boolean
  triggerReviewCheck: (trigger: string, adShownThisSession: boolean) => void
  dismissReviewPrompt: () => void
  reviewTrigger: string
}

export function useStoreReview(): UseStoreReviewReturn {
  const [showReviewPrompt, setShowReviewPrompt] = useState(false)
  const [reviewTrigger, setReviewTrigger] = useState("")

  function triggerReviewCheck(trigger: string, adShownThisSession: boolean) {
    if (adShownThisSession) return

    const gamesPlayed = parseInt(loadString(GAMES_PLAYED_KEY) ?? "0", 10)
    if (gamesPlayed < MIN_GAMES_FOR_REVIEW) return

    setReviewTrigger(trigger)
    setShowReviewPrompt(true)
  }

  function dismissReviewPrompt() {
    setShowReviewPrompt(false)
    setReviewTrigger("")
  }

  return {
    showReviewPrompt,
    triggerReviewCheck,
    dismissReviewPrompt,
    reviewTrigger,
  }
}
