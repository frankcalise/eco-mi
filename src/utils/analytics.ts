import { usePostHog } from "posthog-react-native"

type EventProperties = Record<string, string | number | boolean>

/**
 * Typed analytics event tracking.
 * Returns capture functions that no-op if PostHog is not configured.
 */
export function useAnalytics() {
  const posthog = usePostHog()

  function capture(event: string, properties?: EventProperties) {
    posthog?.capture(event, properties)
  }

  return {
    trackGameStarted(mode = "classic") {
      capture("game_started", { mode })
    },
    trackGameOver(score: number, level: number, sessionTimeS: number, reason = "wrong_input") {
      capture("game_over", { score, level, sessionTimeS, reason })
    },
    trackGameCompleted(
      score: number,
      level: number,
      isHighScore: boolean,
      sessionTimeS: number,
      mode = "classic",
    ) {
      capture("game_completed", { score, level, isHighScore, sessionTimeS, mode })
    },
    trackAdShown(type: string, placement: string) {
      capture("ad_shown", { type, placement })
    },
    trackAdRewardedWatched(placement: string) {
      capture("ad_rewarded_watched", { placement })
    },
    trackIapInitiated(productId: string) {
      capture("iap_initiated", { productId })
    },
    trackIapCompleted(productId: string, revenue?: number) {
      const props: EventProperties = { productId }
      if (revenue !== undefined) props.revenue = revenue
      capture("iap_completed", props)
    },
    trackShareTapped(score: number, level: number) {
      capture("share_tapped", { score, level })
    },
    trackReviewPromptShown(trigger: string) {
      capture("review_prompt_shown", { trigger })
    },
    trackReviewPromptResponse(response: string) {
      capture("review_prompt_response", { response })
    },
    trackAudioContextRecycle(nodeCount: number) {
      capture("audio_context_recycled", { nodeCount })
    },
    trackTiredOfAdsPromptShown(lifetimeCount: number) {
      capture("tired_of_ads_prompt_shown", { lifetimeCount })
    },
    trackTiredOfAdsPromptDismissed() {
      capture("tired_of_ads_prompt_dismissed")
    },
    trackTiredOfAdsPromptConverted() {
      capture("tired_of_ads_prompt_converted")
    },
    trackRemoveAdsCtaSwapped(rewardedWatched: number) {
      capture("remove_ads_cta_swapped", { rewardedWatched })
    },
    trackRemoveAdsCtaTap(variant: "passive" | "swapped") {
      capture("remove_ads_cta_tap", { variant })
    },
  }
}
