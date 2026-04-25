import { useEffect, useRef, useState } from "react"

import {
  ADS_LIFETIME_INTERSTITIALS_SHOWN,
  IAP_TIRED_OF_ADS_PROMPT_SHOWN,
} from "@/config/storageKeys"
import { useSessionAdStore } from "@/stores/sessionAdStore"
import { loadString, saveString } from "@/utils/storage"

const LIFETIME_THRESHOLD = 3
const PROMPT_DELAY_MS = 400

type UseTiredOfAdsPromptReturn = {
  showTiredOfAdsPrompt: boolean
  triggerTiredOfAdsCheck: () => void
  dismissTiredOfAdsPrompt: () => void
  markPromptShown: () => void
}

/**
 * Gates the post-Nth-interstitial "Tired of ads?" conversion modal.
 *
 * One-shot for v1: once dismissed or converted, IAP_TIRED_OF_ADS_PROMPT_SHOWN
 * persists "true" in MMKV and the prompt never re-fires. Re-prompt cadence
 * (#8, #15) intentionally deferred — measure conversion before layering.
 */
export function useTiredOfAdsPrompt(): UseTiredOfAdsPromptReturn {
  const [showTiredOfAdsPrompt, setShowTiredOfAdsPrompt] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function triggerTiredOfAdsCheck() {
    if (loadString(IAP_TIRED_OF_ADS_PROMPT_SHOWN) === "true") return

    const lifetime = parseInt(loadString(ADS_LIFETIME_INTERSTITIALS_SHOWN) ?? "0", 10)
    if (lifetime < LIFETIME_THRESHOLD) return

    timerRef.current = setTimeout(() => {
      setShowTiredOfAdsPrompt(true)
      useSessionAdStore.getState().markTiredOfAdsShown()
    }, PROMPT_DELAY_MS)
  }

  function dismissTiredOfAdsPrompt() {
    setShowTiredOfAdsPrompt(false)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function markPromptShown() {
    saveString(IAP_TIRED_OF_ADS_PROMPT_SHOWN, "true")
  }

  return {
    showTiredOfAdsPrompt,
    triggerTiredOfAdsCheck,
    dismissTiredOfAdsPrompt,
    markPromptShown,
  }
}
