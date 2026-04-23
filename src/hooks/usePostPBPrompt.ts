import { useEffect, useRef, useState } from "react"

import { POST_PB_LAST_PROMPT_DATE, STATS_GAMES_PLAYED } from "@/config/storageKeys"
import { loadString, saveString } from "@/utils/storage"

const MIN_GAMES = 3
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000
const PROMPT_DELAY_MS = 3000

type UsePostPBPromptReturn = {
  showPostPBPrompt: boolean
  triggerPostPBCheck: () => void
  dismissPostPBPrompt: () => void
}

export function usePostPBPrompt(): UsePostPBPromptReturn {
  const [showPostPBPrompt, setShowPostPBPrompt] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function triggerPostPBCheck() {
    const gamesPlayed = parseInt(loadString(STATS_GAMES_PLAYED) ?? "0", 10)
    if (gamesPlayed < MIN_GAMES) return

    const lastPrompt = loadString(POST_PB_LAST_PROMPT_DATE)
    if (lastPrompt) {
      const elapsed = Date.now() - new Date(lastPrompt).getTime()
      if (elapsed < COOLDOWN_MS) return
    }

    timerRef.current = setTimeout(() => {
      setShowPostPBPrompt(true)
      saveString(POST_PB_LAST_PROMPT_DATE, new Date().toISOString())
    }, PROMPT_DELAY_MS)
  }

  function dismissPostPBPrompt() {
    setShowPostPBPrompt(false)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  return { showPostPBPrompt, triggerPostPBCheck, dismissPostPBPrompt }
}
