import { useEffect, useRef, useState } from "react"
import { Platform } from "react-native"

import {
  InterstitialAd,
  AdEventType,
  TestIds,
} from "react-native-google-mobile-ads"

import { loadString, saveString } from "@/utils/storage"

const INTERSTITIAL_IOS = process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS ?? ""
const INTERSTITIAL_ANDROID = process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID ?? ""

const LAST_INTERSTITIAL_KEY = "ecomi:ads:lastInterstitialTime"
const SESSION_COUNT_KEY = "ecomi:ads:sessionCount"
const GAMES_THIS_SESSION_KEY = "ecomi:ads:gamesPerSession"

const GRACE_PERIOD_SESSIONS = 3
const MIN_GAP_MS = 3 * 60 * 1000
const MIN_ROUNDS_TO_SHOW = 3
const GAMES_BETWEEN_ADS = 2

function getInterstitialAdUnitId(): string {
  if (__DEV__) return TestIds.INTERSTITIAL
  return Platform.select({
    ios: INTERSTITIAL_IOS,
    android: INTERSTITIAL_ANDROID,
    default: TestIds.INTERSTITIAL,
  })
}

type UseAdsReturn = {
  showInterstitial: (roundsPlayed: number, removeAds: boolean) => Promise<boolean>
  incrementGamesPlayed: () => void
  incrementSessionCount: () => void
  adShownThisSession: boolean
}

export function useAds(): UseAdsReturn {
  const [adShownThisSession, setAdShownThisSession] = useState(false)
  const interstitialRef = useRef<InterstitialAd | null>(null)
  const loadedRef = useRef(false)
  const gamesThisSessionRef = useRef(0)

  useEffect(() => {
    loadInterstitial()
    return () => {
      interstitialRef.current = null
    }
  }, [])

  function loadInterstitial() {
    const adUnitId = getInterstitialAdUnitId()
    if (!adUnitId) return

    const interstitial = InterstitialAd.createForAdRequest(adUnitId)
    interstitialRef.current = interstitial

    interstitial.addAdEventListener(AdEventType.LOADED, () => {
      loadedRef.current = true
    })

    interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      loadedRef.current = false
      loadInterstitial()
    })

    interstitial.addAdEventListener(AdEventType.ERROR, () => {
      loadedRef.current = false
    })

    interstitial.load()
  }

  function shouldShowInterstitial(roundsPlayed: number, removeAds: boolean): boolean {
    if (removeAds) return false
    if (roundsPlayed < MIN_ROUNDS_TO_SHOW) return false

    const sessionCount = parseInt(loadString(SESSION_COUNT_KEY) ?? "0", 10)
    if (sessionCount < GRACE_PERIOD_SESSIONS) return false

    if (gamesThisSessionRef.current < GAMES_BETWEEN_ADS) return false

    const lastTime = parseInt(loadString(LAST_INTERSTITIAL_KEY) ?? "0", 10)
    if (Date.now() - lastTime < MIN_GAP_MS) return false

    return true
  }

  async function showInterstitial(
    roundsPlayed: number,
    removeAds: boolean,
  ): Promise<boolean> {
    if (!shouldShowInterstitial(roundsPlayed, removeAds)) return false
    if (!loadedRef.current || !interstitialRef.current) return false

    try {
      interstitialRef.current.show()
      saveString(LAST_INTERSTITIAL_KEY, Date.now().toString())
      gamesThisSessionRef.current = 0
      setAdShownThisSession(true)
      return true
    } catch {
      return false
    }
  }

  function incrementGamesPlayed() {
    gamesThisSessionRef.current += 1
    saveString(GAMES_THIS_SESSION_KEY, gamesThisSessionRef.current.toString())
  }

  function incrementSessionCount() {
    const current = parseInt(loadString(SESSION_COUNT_KEY) ?? "0", 10)
    saveString(SESSION_COUNT_KEY, (current + 1).toString())
  }

  return {
    showInterstitial,
    incrementGamesPlayed,
    incrementSessionCount,
    adShownThisSession,
  }
}
