import { useEffect, useRef, useState } from "react"
import { View, Text, Share, StyleSheet } from "react-native"
import type ViewShot from "react-native-view-shot"
import { useRouter, useLocalSearchParams } from "expo-router"
import * as Sharing from "expo-sharing"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import LottieView from "lottie-react-native"
import { EaseView } from "react-native-ease"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { AchievementToast } from "@/components/AchievementToast"
import { PostPBPrompt } from "@/components/PostPBPrompt"
import { PressableScale } from "@/components/PressableScale"
import { ReviewPrompt } from "@/components/ReviewPrompt"
import { ShareScoreCard } from "@/components/ShareScoreCard"
import { ACHIEVEMENTS } from "@/config/achievements"
import { DAILY_CURRENT_STREAK, STATS_GAMES_PLAYED } from "@/config/storageKeys"
import { useAchievements } from "@/hooks/useAchievements"
import type { GameMode } from "@/hooks/useGameEngine"
import { usePostPBPrompt } from "@/hooks/usePostPBPrompt"
import { usePurchases } from "@/hooks/usePurchases"
import { useStoreReview } from "@/hooks/useStoreReview"
import { useTheme } from "@/hooks/useTheme"
import { GameThemeProvider } from "@/theme/GameThemeContext"
import { useAnalytics } from "@/utils/analytics"
import { loadString } from "@/utils/storage"

const NEAR_MISS_THRESHOLD = 5

export default function GameOverScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { activeTheme } = useTheme()
  const analytics = useAnalytics()
  const shareCardRef = useRef<ViewShot>(null)

  const params = useLocalSearchParams<{
    score?: string
    level?: string
    highScore?: string
    previousHighScore?: string
    isNewHighScore?: string
    mode?: string
    showRemoveAds?: string
    showContinue?: string
  }>()

  const score = parseInt(params.score ?? "0", 10)
  const level = parseInt(params.level ?? "1", 10)
  const highScore = parseInt(params.highScore ?? "0", 10)
  const previousHighScore = parseInt(params.previousHighScore ?? "0", 10)
  const isNewHighScore = params.isNewHighScore === "true"
  const mode = (params.mode ?? "classic") as GameMode
  const showRemoveAds = params.showRemoveAds === "true"
  const showContinue = params.showContinue === "true"

  const { removeAds } = usePurchases()
  const { showReviewPrompt, triggerReviewCheck, dismissReviewPrompt, reviewTrigger } = useStoreReview()
  const { showPostPBPrompt, triggerPostPBCheck, dismissPostPBPrompt } = usePostPBPrompt()
  const { checkAchievements, newlyUnlocked, clearNewlyUnlocked } = useAchievements()

  const [achievementToast, setAchievementToast] = useState<{
    title: string
    description: string
    icon?: string
  } | null>(null)

  const triggeredRef = useRef(false)

  // Trigger review/postPB checks + achievement check on mount
  useEffect(() => {
    if (triggeredRef.current) return
    triggeredRef.current = true

    const gamesPlayed = parseInt(loadString(STATS_GAMES_PLAYED) ?? "0", 10)
    const currentStreak = parseInt(loadString(DAILY_CURRENT_STREAK) ?? "0", 10)

    // Check achievement unlocks
    checkAchievements({
      score,
      level,
      gamesPlayed,
      currentStreak,
      isDaily: mode === "daily",
    })

    // Review + PostPB prompts on new high score
    if (isNewHighScore) {
      triggerReviewCheck("new_high_score", false)
      if (!removeAds) {
        triggerPostPBCheck()
      }
    }

    // Daily streak milestone review prompt (3-day, 7-day)
    if (mode === "daily" && (currentStreak === 3 || currentStreak === 7)) {
      triggerReviewCheck(`streak_${currentStreak}`, false)
    }
  }, [])

  // Show achievement toast when newlyUnlocked changes
  useEffect(() => {
    if (newlyUnlocked.length > 0) {
      const id = newlyUnlocked[0]
      const achievement = ACHIEVEMENTS.find((a) => a.id === id)
      setAchievementToast({
        title: t(`achievements:${id}`),
        description: t(`achievements:${id}_desc`),
        icon: achievement?.icon,
      })
      clearNewlyUnlocked()
    }
  }, [newlyUnlocked])

  const pbDelta =
    isNewHighScore && previousHighScore > 0 ? score - previousHighScore : null
  const nearMiss =
    !isNewHighScore && highScore > 0 && highScore - score <= NEAR_MISS_THRESHOLD && highScore - score > 0
      ? highScore - score
      : null

  async function handleShare() {
    analytics.trackShareTapped(score, level)
    const message = t("game:shareMessage", { level, score, mode: t(`game:modes.${mode}`) })
    try {
      const uri = await shareCardRef.current?.capture?.()
      if (uri) {
        const fileUri = uri.startsWith("file://") ? uri : `file://${uri}`
        await Sharing.shareAsync(fileUri, { mimeType: "image/png", dialogTitle: message })
      } else {
        await Share.share({ message })
      }
    } catch {}
  }

  function handlePlayAgain() {
    router.replace({ pathname: "/", params: { action: "play_again" } })
  }

  function handleContinue() {
    router.replace({ pathname: "/", params: { action: "continue" } })
  }

  function handleMainMenu() {
    router.replace("/")
  }

  function handleReviewResponse(response: "love_it" | "not_really") {
    analytics.trackReviewPromptShown(reviewTrigger)
    analytics.trackReviewPromptResponse(response)
  }

  async function handleRemoveAds() {
    analytics.trackIapInitiated("ecomi_remove_ads")
  }

  return (
    <GameThemeProvider value={activeTheme}>
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom + 16,
            backgroundColor: activeTheme.backgroundColor,
          },
        ]}
      >
        {/* Top Section: Animation + Title + Stats */}
        <View style={styles.topSection}>
          {isNewHighScore && (
            <EaseView
              initialAnimate={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ default: { type: "spring", stiffness: 200, damping: 15 } }}
            >
              <LottieView
                source={require("../../assets/animations/trophy.json")}
                autoPlay
                loop={false}
                style={styles.lottie}
              />
            </EaseView>
          )}

          <EaseView
            initialAnimate={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ default: { type: "timing", duration: 300 } }}
          >
            <Text
              style={[
                styles.title,
                { color: isNewHighScore ? activeTheme.warningColor : activeTheme.destructiveColor },
              ]}
            >
              {isNewHighScore ? t("game:newHighScore") : t("game:gameOver")}
            </Text>
          </EaseView>

          {/* PB delta directly under title when new high score */}
          {pbDelta !== null && (
            <EaseView
              initialAnimate={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ default: { type: "timing", duration: 300, delay: 150 } }}
            >
              <Text style={[styles.deltaTextTitle, { color: activeTheme.accentColor }]}>
                {t("game:pbDelta", { delta: pbDelta })}
              </Text>
            </EaseView>
          )}

          {/* Stat Pills */}
          <EaseView
            initialAnimate={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ default: { type: "timing", duration: 300, delay: 100 } }}
            style={styles.statsRow}
          >
            <View style={[styles.statPill, { backgroundColor: activeTheme.surfaceColor }]}>
              <Text style={[styles.statValue, { color: activeTheme.textColor }]}>{score}</Text>
              <Text style={[styles.statLabel, { color: activeTheme.secondaryTextColor }]}>
                {t("game:score")}
              </Text>
            </View>
            <View style={[styles.statPill, { backgroundColor: activeTheme.surfaceColor }]}>
              <Text style={[styles.statValue, { color: activeTheme.textColor }]}>{level}</Text>
              <Text style={[styles.statLabel, { color: activeTheme.secondaryTextColor }]}>
                {t("game:level")}
              </Text>
            </View>
            <View style={[styles.statPill, { backgroundColor: activeTheme.surfaceColor }]}>
              <Text style={[styles.statValue, { color: activeTheme.textColor }]}>{highScore}</Text>
              <Text style={[styles.statLabel, { color: activeTheme.secondaryTextColor }]}>
                {t("game:best")}
              </Text>
            </View>
          </EaseView>

          {nearMiss !== null && (
            <Text style={[styles.deltaText, { color: activeTheme.warningColor }]}>
              {t("game:nearMiss", { delta: nearMiss })}
            </Text>
          )}

          {/* Navigation Links */}
          <EaseView
            initialAnimate={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ default: { type: "timing", duration: 300, delay: 250 } }}
            style={styles.linkRow}
          >
            <PressableScale onPress={() => router.push("/stats")}>
              <Text style={[styles.linkText, { color: activeTheme.secondaryTextColor }]}>
                {t("stats:title")}
              </Text>
            </PressableScale>
            <PressableScale onPress={() => router.push("/achievements")}>
              <Text style={[styles.linkText, { color: activeTheme.secondaryTextColor }]}>
                {t("achievements:title")}
              </Text>
            </PressableScale>
            <PressableScale onPress={() => router.push({ pathname: "/leaderboard", params: { mode } })}>
              <Text style={[styles.linkText, { color: activeTheme.secondaryTextColor }]}>
                {t("game:leaderboard")}
              </Text>
            </PressableScale>
          </EaseView>
        </View>

        {/* Bottom Section: CTAs */}
        <EaseView
          initialAnimate={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ default: { type: "timing", duration: 300, delay: 300 } }}
          style={styles.bottomSection}
        >
          {showContinue && (
            <PressableScale
              testID="btn-continue"
              style={[styles.continueButton, { borderColor: activeTheme.borderColor }]}
              onPress={handleContinue}
            >
              <Ionicons name="play-forward" size={18} color={activeTheme.textColor} />
              <Text style={[styles.continueText, { color: activeTheme.textColor }]}>
                {t("game:continue")}
              </Text>
            </PressableScale>
          )}

          <PressableScale
            testID="btn-play-again"
            style={[styles.playAgainButton, { backgroundColor: activeTheme.accentColor }]}
            onPress={handlePlayAgain}
            accessibilityLabel={t("game:playAgain")}
            accessibilityRole="button"
          >
            <Ionicons name="refresh" size={20} color="white" />
            <Text style={styles.playAgainText}>{t("game:playAgain")}</Text>
          </PressableScale>

          <View style={styles.bottomRow}>
            <PressableScale
              testID="btn-share"
              style={[styles.shareButton, { backgroundColor: activeTheme.surfaceColor }]}
              onPress={handleShare}
              accessibilityLabel={t("game:share")}
              accessibilityRole="button"
            >
              <Ionicons name="share-outline" size={22} color={activeTheme.textColor} />
            </PressableScale>
            <PressableScale testID="btn-home" style={styles.mainMenuLink} onPress={handleMainMenu}>
              <Text style={[styles.mainMenuText, { color: activeTheme.secondaryTextColor }]}>
                {t("game:mainMenu")}
              </Text>
            </PressableScale>
            <View style={styles.bottomRowSpacer} />
          </View>

          {showRemoveAds && (
            <PressableScale
              testID="btn-remove-ads"
              style={styles.removeAdsLink}
              onPress={() => router.push("/settings")}
            >
              <Ionicons name="close-circle-outline" size={16} color={activeTheme.warningColor} />
              <Text style={[styles.removeAdsText, { color: activeTheme.warningColor }]}>
                {t("game:removeAds")}
              </Text>
            </PressableScale>
          )}
        </EaseView>

        <ShareScoreCard
          ref={shareCardRef}
          score={score}
          level={level}
          mode={mode}
          isNewHighScore={isNewHighScore}
          theme={activeTheme}
        />

        <ReviewPrompt
          visible={showReviewPrompt}
          theme={activeTheme}
          onDismiss={dismissReviewPrompt}
          onResponse={handleReviewResponse}
        />
        <PostPBPrompt
          visible={showPostPBPrompt && !showReviewPrompt}
          theme={activeTheme}
          onRemoveAds={handleRemoveAds}
          onDismiss={dismissPostPBPrompt}
        />
        <AchievementToast
          title={achievementToast?.title ?? ""}
          description={achievementToast?.description ?? ""}
          icon={achievementToast?.icon}
          visible={achievementToast !== null}
          onHide={() => setAchievementToast(null)}
        />
      </View>
    </GameThemeProvider>
  )
}

const styles = StyleSheet.create({
  bottomRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  bottomRowSpacer: {
    width: 50,
  },
  bottomSection: {
    gap: 12,
    paddingHorizontal: 24,
    width: "100%",
  },
  container: {
    alignItems: "center",
    flex: 1,
    justifyContent: "space-between",
  },
  continueButton: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 12,
  },
  continueText: {
    fontFamily: "Oxanium-SemiBold",
    fontSize: 14,
  },
  deltaText: {
    fontFamily: "Oxanium-SemiBold",
    fontSize: 15,
    marginTop: 8,
    textAlign: "center",
  },
  deltaTextTitle: {
    fontFamily: "Oxanium-SemiBold",
    fontSize: 16,
    marginTop: 8,
    textAlign: "center",
  },
  linkRow: {
    flexDirection: "row",
    gap: 24,
    marginTop: 24,
  },
  linkText: {
    fontFamily: "Oxanium-Medium",
    fontSize: 13,
  },
  lottie: {
    height: 100,
    width: 100,
  },
  mainMenuLink: {
    paddingVertical: 8,
  },
  mainMenuText: {
    fontFamily: "Oxanium-Medium",
    fontSize: 14,
  },
  playAgainButton: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 16,
    width: "100%",
  },
  playAgainText: {
    color: "white",
    fontFamily: "Oxanium-SemiBold",
    fontSize: 16,
  },
  removeAdsLink: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: 6,
    paddingVertical: 4,
  },
  removeAdsText: {
    fontFamily: "Oxanium-Medium",
    fontSize: 13,
  },
  shareButton: {
    alignItems: "center",
    borderRadius: 12,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statLabel: {
    fontFamily: "Oxanium-Regular",
    fontSize: 12,
    marginTop: 4,
  },
  statPill: {
    alignItems: "center",
    borderRadius: 12,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    paddingHorizontal: 24,
    width: "100%",
  },
  statValue: {
    fontFamily: "Oxanium-Bold",
    fontSize: 28,
  },
  title: {
    fontFamily: "Oxanium-Bold",
    fontSize: 32,
    textAlign: "center",
  },
  topSection: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
})
