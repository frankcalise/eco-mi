import { useEffect, useRef } from "react"
import { Platform, StyleSheet, View } from "react-native"
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { usePurchases } from "@/hooks/usePurchases"
import { useAnalytics } from "@/utils/analytics"

const BANNER_IOS = process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS ?? ""
const BANNER_ANDROID = process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID ?? ""

function getBannerAdUnitId(): string {
  if (__DEV__) return TestIds.BANNER
  return Platform.select({ ios: BANNER_IOS, android: BANNER_ANDROID, default: TestIds.BANNER })
}

type AnchoredBannerProps = {
  placement: string
}

// Reserve the slot height before the ad loads to prevent layout shift / accidental-tap
// policy risk. Anchored adaptive banners run 50–100dp depending on device; 60 is a safe
// minimum that absorbs the variance without leaving a visible gap once filled.
const ESTIMATED_BANNER_HEIGHT = 60

export function AnchoredBanner({ placement }: AnchoredBannerProps) {
  const { removeAds } = usePurchases()
  const insets = useSafeAreaInsets()
  const analytics = useAnalytics()
  const trackedRef = useRef(false)

  useEffect(() => {
    trackedRef.current = false
  }, [placement])

  if (removeAds) return null

  const adUnitId = getBannerAdUnitId()
  if (!adUnitId) return null

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: insets.bottom, minHeight: ESTIMATED_BANNER_HEIGHT },
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdLoaded={() => {
          if (trackedRef.current) return
          trackedRef.current = true
          analytics.trackAdShown("banner", placement)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    width: "100%",
  },
})
