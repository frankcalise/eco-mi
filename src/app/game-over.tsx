import { useEffect, useRef, useState } from "react"
import { View, Text, Platform, Share, StyleSheet } from "react-native"
import { useRouter } from "expo-router"
import * as Sharing from "expo-sharing"
import { Ionicons } from "@expo/vector-icons"
import LottieView from "lottie-react-native"
import { useTranslation } from "react-i18next"
import { EaseView } from "react-native-ease"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type ViewShot from "react-native-view-shot"

import { AchievementToast } from "@/components/AchievementToast"
import { PostPBPrompt } from "@/components/PostPBPrompt"
import { PressableScale } from "@/components/PressableScale"
import { ReviewPrompt } from "@/components/ReviewPrompt"
import { ShareScoreCard } from "@/components/ShareScoreCard"
import { ACHIEVEMENTS } from "@/config/achievements"
import { DAILY_CURRENT_STREAK, STATS_GAMES_PLAYED } from "@/config/storageKeys"
import type { GameTheme } from "@/config/themes"
import { useAchievements } from "@/hooks/useAchievements"
import { usePostPBPrompt } from "@/hooks/usePostPBPrompt"
import { usePurchases } from "@/hooks/usePurchases"
import { useStoreReview } from "@/hooks/useStoreReview"
import { useTheme } from "@/hooks/useTheme"
import { useGameOverStore } from "@/stores/gameOverStore"
import { usePendingActionStore } from "@/stores/pendingActionStore"
import { GameThemeProvider } from "@/theme/GameThemeContext"
import { UI_COLORS } from "@/theme/uiColors"
import { useAnalytics } from "@/utils/analytics"
import { formatDuration } from "@/utils/formatTime"
import { loadString } from "@/utils/storage"

const NEAR_MISS_THRESHOLD = 5

type StatPillProps = {
  label: string
  value: string | number
  icon: keyof typeof Ionicons.glyphMap
  borderColor: string
  theme: GameTheme
  delay: number
  testID?: string
}

function StatPill({ label, value, icon, borderColor, theme, delay, testID }: StatPillProps) {
  return (
    <EaseView
      testID={testID}
      style={[styles.pill, { borderColor, backgroundColor: theme.surfaceColor }]}
      initialAnimate={{ opacity: 0, translateY: 12, scale: 0.95 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ default: { type: "spring", stiffness: 220, damping: 18, delay } }}
    >
      <Text style={[styles.pillLabel, { color: borderColor }]}>{label}</Text>
      <View style={styles.pillRow}>
        <Ionicons name={icon} size={20} color={borderColor} />
        <Text style={[styles.pillValue, { color: theme.textColor }]}>{value}</Text>
      </View>
    </EaseView>
  )
}

export default function GameOverScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { activeTheme } = useTheme()
  const analytics = useAnalytics()
  const shareCardRef = useRef<ViewShot>(null)

  const {
    score,
    level,
    highScore,
    previousHighScore,
    isNewHighScore,
    mode,
    showRemoveAds,
    showContinue,
    sessionTime,
  } = useGameOverStore()

  const { removeAds } = usePurchases()
  const { showReviewPrompt, triggerReviewCheck, dismissReviewPrompt, reviewTrigger } =
    useStoreReview()
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

    // Review + PostPB prompts on new high score — mutually exclusive.
    // If review will show, skip PostPB so they don't stack on the same game-over.
    if (isNewHighScore) {
      const reviewScheduled = triggerReviewCheck("new_high_score", false)
      if (!reviewScheduled && !removeAds) {
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

  const pbDelta = isNewHighScore && previousHighScore > 0 ? score - previousHighScore : null
  const nearMiss =
    !isNewHighScore &&
    highScore > 0 &&
    highScore - score <= NEAR_MISS_THRESHOLD &&
    highScore - score > 0
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

  const setPendingAction = usePendingActionStore((s) => s.setAction)

  function handlePlayAgain() {
    setPendingAction("play_again")
    router.back()
  }

  function handleContinue() {
    setPendingAction("continue")
    router.back()
  }

  function handleMainMenu() {
    setPendingAction("main_menu")
    router.back()
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

          {/* Stat Pills — 2x2 grid mirrors the game pad layout (red/blue/green/yellow) */}
          <View style={styles.statsGrid}>
            <View style={styles.statsGridRow}>
              <StatPill
                testID="pill-score"
                label={t("game:score")}
                value={score}
                icon="flash"
                borderColor={activeTheme.buttonColors.red.color}
                theme={activeTheme}
                delay={250}
              />
              <StatPill
                testID="pill-level"
                label={t("game:level")}
                value={level}
                icon="trending-up"
                borderColor={activeTheme.buttonColors.blue.color}
                theme={activeTheme}
                delay={350}
              />
            </View>
            <View style={styles.statsGridRow}>
              <StatPill
                testID="pill-best"
                label={t("game:best")}
                value={highScore}
                icon="trophy"
                borderColor={activeTheme.buttonColors.green.color}
                theme={activeTheme}
                delay={450}
              />
              <StatPill
                testID="pill-time"
                label={t("game:time")}
                value={formatDuration(sessionTime)}
                icon="time"
                borderColor={activeTheme.buttonColors.yellow.color}
                theme={activeTheme}
                delay={550}
              />
            </View>
          </View>

          {nearMiss !== null && (
            <Text style={[styles.deltaText, { color: activeTheme.warningColor }]}>
              {t("game:nearMiss", { delta: nearMiss })}
            </Text>
          )}
        </View>

        {/* Bottom Section: CTAs */}
        <EaseView
          initialAnimate={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ default: { type: "timing", duration: 300, delay: 700 } }}
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
              style={[styles.shareButton, { borderColor: activeTheme.borderColor }]}
              onPress={handleShare}
              accessibilityLabel={t("game:share")}
              accessibilityRole="button"
            >
              <Ionicons
                name={Platform.OS === "ios" ? "share-outline" : "share-social-outline"}
                size={22}
                color={activeTheme.textColor}
              />
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
  pill: {
    borderRadius: 14,
    borderWidth: 2.5,
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pillLabel: {
    fontFamily: "Oxanium-SemiBold",
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  pillRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  pillValue: {
    fontFamily: "Oxanium-Bold",
    fontSize: 24,
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
    color: UI_COLORS.white,
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
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statsGrid: {
    flexDirection: "column",
    gap: 12,
    marginTop: 20,
    paddingHorizontal: 24,
    width: "100%",
  },
  statsGridRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
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
