import { useEffect, useRef, useState } from "react"
import { Platform } from "react-native"
import {
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
  AdsConsent,
  AdsConsentStatus,
} from "react-native-google-mobile-ads"

import {
  ADS_GAMES_PER_SESSION,
  ADS_LAST_INTERSTITIAL_TIME,
  ADS_SESSION_COUNT,
} from "@/config/storageKeys"
import { loadString, saveString } from "@/utils/storage"

const INTERSTITIAL_IOS = process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS ?? ""
const INTERSTITIAL_ANDROID = process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID ?? ""
const REWARDED_IOS = process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS ?? ""
const REWARDED_ANDROID = process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID ?? ""

const GRACE_PERIOD_SESSIONS = 3
const MIN_GAP_MS = 3 * 60 * 1000
const MIN_ROUNDS_TO_SHOW = 3
const GAMES_BETWEEN_ADS = 2
const REWARDED_TIMEOUT_MS = 60 * 1000
const AD_RETRY_DELAY_MS = 30 * 1000

function getInterstitialAdUnitId(): string {
  if (__DEV__) return TestIds.INTERSTITIAL
  return Platform.select({
    ios: INTERSTITIAL_IOS,
    android: INTERSTITIAL_ANDROID,
    default: TestIds.INTERSTITIAL,
  })
}

function getRewardedAdUnitId(): string {
  if (__DEV__) return TestIds.REWARDED
  return Platform.select({
    ios: REWARDED_IOS,
    android: REWARDED_ANDROID,
    default: TestIds.REWARDED,
  })
}

type UseAdsReturn = {
  showInterstitial: (roundsPlayed: number, removeAds: boolean) => Promise<boolean>
  showRewarded: () => Promise<boolean>
  rewardedReady: boolean
  incrementGamesPlayed: () => void
  incrementSessionCount: () => void
  adShownThisSession: boolean
}

export function useAds(): UseAdsReturn {
  const [adShownThisSession, setAdShownThisSession] = useState(false)
  const [rewardedReady, setRewardedReady] = useState(false)
  const interstitialRef = useRef<InterstitialAd | null>(null)
  const rewardedRef = useRef<RewardedAd | null>(null)
  const loadedRef = useRef(false)
  const rewardedLoadedRef = useRef(false)
  const gamesThisSessionRef = useRef(0)
  const rewardedShowingRef = useRef(false)
  const interstitialUnsubsRef = useRef<(() => void)[]>([])
  const rewardedUnsubsRef = useRef<(() => void)[]>([])
  const interstitialRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rewardedRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Default to non-personalized until consent resolves — safe default for EEA/UK/CH.
  const npaRef = useRef(true)

  async function requestConsent() {
    try {
      await AdsConsent.requestInfoUpdate()
      await AdsConsent.loadAndShowConsentFormIfRequired()
      const info = await AdsConsent.getConsentInfo()
      if (info.status === AdsConsentStatus.NOT_REQUIRED) {
        // Outside EEA/UK/CH — personalized ads permitted by default.
        npaRef.current = false
      } else if (info.status === AdsConsentStatus.OBTAINED) {
        // TCF purpose 3 (ad personalization) and 4 (ad profile) must both be granted.
        try {
          const purposes = await AdsConsent.getPurposeConsents()
          npaRef.current = !(purposes.charAt(2) === "1" && purposes.charAt(3) === "1")
        } catch {
          npaRef.current = true
        }
      } else {
        // REQUIRED but not OBTAINED, or UNKNOWN — serve non-personalized.
        npaRef.current = true
      }
    } catch {
      // Consent errors should not block the app from functioning. Keep NPA = true,
      // which is the conservative, policy-safe default for EEA/UK/CH.
    }
  }

  function teardownInterstitial() {
    if (interstitialRetryRef.current) {
      clearTimeout(interstitialRetryRef.current)
      interstitialRetryRef.current = null
    }
    for (const unsub of interstitialUnsubsRef.current) unsub()
    interstitialUnsubsRef.current = []
    interstitialRef.current = null
  }

  function teardownRewarded() {
    if (rewardedRetryRef.current) {
      clearTimeout(rewardedRetryRef.current)
      rewardedRetryRef.current = null
    }
    for (const unsub of rewardedUnsubsRef.current) unsub()
    rewardedUnsubsRef.current = []
    rewardedRef.current = null
  }

  useEffect(() => {
    async function init() {
      await requestConsent()
      loadInterstitial()
      loadRewarded()
    }
    init()
    return () => {
      teardownInterstitial()
      teardownRewarded()
    }
  }, [])

  function loadInterstitial() {
    const adUnitId = getInterstitialAdUnitId()
    if (!adUnitId) return

    teardownInterstitial()
    const interstitial = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: npaRef.current,
    })
    interstitialRef.current = interstitial

    interstitialUnsubsRef.current = [
      interstitial.addAdEventListener(AdEventType.LOADED, () => {
        loadedRef.current = true
        if (interstitialRetryRef.current) {
          clearTimeout(interstitialRetryRef.current)
          interstitialRetryRef.current = null
        }
      }),
      interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        loadedRef.current = false
        loadInterstitial()
      }),
      interstitial.addAdEventListener(AdEventType.ERROR, () => {
        loadedRef.current = false
        // A transient load failure (network blip, no fill) must not kill ad
        // serving for the rest of the session. Schedule a debounced reload.
        if (interstitialRetryRef.current) clearTimeout(interstitialRetryRef.current)
        interstitialRetryRef.current = setTimeout(() => {
          interstitialRetryRef.current = null
          loadInterstitial()
        }, AD_RETRY_DELAY_MS)
      }),
    ]

    interstitial.load()
  }

  function loadRewarded() {
    const adUnitId = getRewardedAdUnitId()
    if (!adUnitId) return

    teardownRewarded()
    const rewarded = RewardedAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: npaRef.current,
    })
    rewardedRef.current = rewarded

    rewardedUnsubsRef.current = [
      rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        rewardedLoadedRef.current = true
        setRewardedReady(true)
        if (rewardedRetryRef.current) {
          clearTimeout(rewardedRetryRef.current)
          rewardedRetryRef.current = null
        }
      }),
      rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        rewardedLoadedRef.current = false
        setRewardedReady(false)
        loadRewarded()
      }),
      rewarded.addAdEventListener(AdEventType.ERROR, () => {
        rewardedLoadedRef.current = false
        setRewardedReady(false)
        // A transient load failure must not permanently disable the continue
        // offer. Schedule a debounced reload.
        if (rewardedRetryRef.current) clearTimeout(rewardedRetryRef.current)
        rewardedRetryRef.current = setTimeout(() => {
          rewardedRetryRef.current = null
          loadRewarded()
        }, AD_RETRY_DELAY_MS)
      }),
    ]

    rewarded.load()
  }

  function showRewarded(): Promise<boolean> {
    if (!rewardedLoadedRef.current || !rewardedRef.current) return Promise.resolve(false)
    if (rewardedShowingRef.current) return Promise.resolve(false)

    const rewarded = rewardedRef.current
    let earned = false
    rewardedShowingRef.current = true

    return new Promise<boolean>((resolve) => {
      let settled = false
      let timeoutId: ReturnType<typeof setTimeout> | null = null

      function settle(result: boolean) {
        if (settled) return
        settled = true
        if (timeoutId) clearTimeout(timeoutId)
        rewardedShowingRef.current = false
        unsubReward()
        unsubClose()
        unsubError()
        resolve(result)
      }

      const unsubReward = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true
      })

      const unsubClose = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        setAdShownThisSession(true)
        settle(earned)
      })

      const unsubError = rewarded.addAdEventListener(AdEventType.ERROR, () => {
        settle(false)
      })

      // Safety net: some Android OEMs dismiss the ad without firing CLOSED/ERROR
      // (memory pressure, activity restart mid-ad). Without this fallback the
      // continue-in-flight guard in GameScreen stays stuck forever.
      timeoutId = setTimeout(() => settle(earned), REWARDED_TIMEOUT_MS)

      try {
        rewarded.show()
      } catch {
        settle(false)
      }
    })
  }

  function shouldShowInterstitial(roundsPlayed: number, removeAds: boolean): boolean {
    if (removeAds) return false
    if (roundsPlayed < MIN_ROUNDS_TO_SHOW) return false

    const sessionCount = parseInt(loadString(ADS_SESSION_COUNT) ?? "0", 10)
    if (sessionCount < GRACE_PERIOD_SESSIONS) return false

    if (gamesThisSessionRef.current < GAMES_BETWEEN_ADS) return false

    const lastTime = parseInt(loadString(ADS_LAST_INTERSTITIAL_TIME) ?? "0", 10)
    if (Date.now() - lastTime < MIN_GAP_MS) return false

    return true
  }

  async function showInterstitial(roundsPlayed: number, removeAds: boolean): Promise<boolean> {
    if (!shouldShowInterstitial(roundsPlayed, removeAds)) return false
    if (!loadedRef.current || !interstitialRef.current) return false

    try {
      interstitialRef.current.show()
      saveString(ADS_LAST_INTERSTITIAL_TIME, Date.now().toString())
      gamesThisSessionRef.current = 0
      setAdShownThisSession(true)
      return true
    } catch {
      return false
    }
  }

  function incrementGamesPlayed() {
    gamesThisSessionRef.current += 1
    saveString(ADS_GAMES_PER_SESSION, gamesThisSessionRef.current.toString())
  }

  function incrementSessionCount() {
    const current = parseInt(loadString(ADS_SESSION_COUNT) ?? "0", 10)
    saveString(ADS_SESSION_COUNT, (current + 1).toString())
  }

  return {
    showInterstitial,
    showRewarded,
    rewardedReady,
    incrementGamesPlayed,
    incrementSessionCount,
    adShownThisSession,
  }
}
