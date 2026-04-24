import { useEffect, useRef, useState } from "react"
import { Alert, View, Text, TextInput, Platform, Share, StyleSheet } from "react-native"
import { useNavigation, useRouter } from "expo-router"
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
import {
  DAILY_CURRENT_STREAK,
  INITIALS_SKIPPED,
  SAVED_INITIALS,
  STATS_GAMES_PLAYED,
} from "@/config/storageKeys"
import type { GameTheme } from "@/config/themes"
import { useAchievements } from "@/hooks/useAchievements"
import { useHaptics } from "@/hooks/useHaptics"
import { useHighScores, type HighScoreEntry } from "@/hooks/useHighScores"
import { usePostPBPrompt } from "@/hooks/usePostPBPrompt"
import { usePurchases } from "@/hooks/usePurchases"
import { useStoreReview } from "@/hooks/useStoreReview"
import { useTheme } from "@/hooks/useTheme"
import { useTransientTimers } from "@/hooks/useTransientTimers"
import { useGameOverStore } from "@/stores/gameOverStore"
import { usePendingActionStore } from "@/stores/pendingActionStore"
import { GameThemeProvider } from "@/theme/GameThemeContext"
import { motion } from "@/theme/motion"
import { useAnalytics } from "@/utils/analytics"
import { formatDuration } from "@/utils/formatTime"
import { useBreakpoints } from "@/utils/layoutBreakpoints"
import { loadString, saveString } from "@/utils/storage"

const NEAR_MISS_THRESHOLD = 5

type StatPillProps = {
  label: string
  value: string | number
  icon: keyof typeof Ionicons.glyphMap
  borderColor: string
  theme: GameTheme
  delay: number
  isTablet: boolean
  testID?: string
}

function StatPill({
  label,
  value,
  icon,
  borderColor,
  theme,
  delay,
  isTablet,
  testID,
}: StatPillProps) {
  return (
    <EaseView
      style={[
        styles.pill,
        isTablet && styles.pillTablet,
        { borderColor, backgroundColor: theme.surfaceColor },
      ]}
      initialAnimate={{ opacity: 0, translateY: 12, scale: 0.95 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ default: { type: "spring", stiffness: 220, damping: 18, delay } }}
    >
      <View testID={testID} collapsable={false}>
        <Text
          style={[styles.pillLabel, isTablet && styles.pillLabelTablet, { color: borderColor }]}
        >
          {label}
        </Text>
        <View style={[styles.pillRow, isTablet && styles.pillRowTablet]}>
          <Ionicons name={icon} size={isTablet ? 32 : 20} color={borderColor} />
          <Text
            style={[
              styles.pillValue,
              isTablet && styles.pillValueTablet,
              { color: theme.textColor },
            ]}
          >
            {value}
          </Text>
        </View>
      </View>
    </EaseView>
  )
}

export default function GameOverScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { activeTheme } = useTheme()
  const analytics = useAnalytics()
  const haptics = useHaptics()
  const { isTablet } = useBreakpoints()
  const shareCardRef = useRef<ViewShot>(null)

  // Per-field selectors avoid re-rendering on unrelated store writes.
  // A whole-store subscription re-renders on any setGameOver/clear call;
  // primitive-returning selectors only trigger renders when that field changes.
  const score = useGameOverStore((s) => s.score)
  const level = useGameOverStore((s) => s.level)
  const highScore = useGameOverStore((s) => s.highScore)
  const previousHighScore = useGameOverStore((s) => s.previousHighScore)
  const isNewHighScore = useGameOverStore((s) => s.isNewHighScore)
  const mode = useGameOverStore((s) => s.mode)
  const showRemoveAds = useGameOverStore((s) => s.showRemoveAds)
  const showContinue = useGameOverStore((s) => s.showContinue)
  const sessionTime = useGameOverStore((s) => s.sessionTime)
  const needsInitials = useGameOverStore((s) => s.needsInitials)

  const { addHighScore } = useHighScores()

  const [letters, setLetters] = useState(["", "", ""])
  const [initialsSaved, setInitialsSaved] = useState(false)
  const [displayedScore, setDisplayedScore] = useState(0)
  const [playAgainAckScale, setPlayAgainAckScale] = useState(1)

  const scheduleTransient = useTransientTimers()
  const inputRef0 = useRef<TextInput>(null)
  const inputRef1 = useRef<TextInput>(null)
  const inputRef2 = useRef<TextInput>(null)
  // Wrap in useRef(...).current so the array identity is stable across renders.
  // The three ref objects themselves are already stable; this prevents a new
  // array allocation on every render that the React Compiler can't dedupe.
  const inputRefs = useRef([inputRef0, inputRef1, inputRef2]).current

  const allFilled = letters.every((l) => l.length === 1)
  const showInitialsInput = needsInitials && !initialsSaved

  function handleLetterChange(text: string, index: number) {
    const letter = text
      .replace(/[^A-Za-z]/g, "")
      .toUpperCase()
      .slice(-1)
    const next = [...letters]
    next[index] = letter
    setLetters(next)
    if (letter && index < 2) inputRefs[index + 1].current?.focus()
  }

  function handleLetterKeyPress(key: string, index: number) {
    if (key === "Backspace" && !letters[index] && index > 0) {
      const next = [...letters]
      next[index - 1] = ""
      setLetters(next)
      inputRefs[index - 1].current?.focus()
    }
  }

  function handleSaveInitials() {
    if (!allFilled) return
    haptics.play("buttonPress")
    const initials = letters.join("")
    saveString(SAVED_INITIALS, initials)
    const entry: HighScoreEntry = {
      initials,
      score,
      level,
      date: new Date().toISOString(),
      mode,
    }
    addHighScore(entry)
    setInitialsSaved(true)
  }

  function handleSkipInitials() {
    haptics.play("menuTap")
    saveString(INITIALS_SKIPPED, "true")
    setInitialsSaved(true)
  }

  // Auto-focus first input after entrance animation settles
  useEffect(() => {
    if (!showInitialsInput) return
    const timer = setTimeout(() => inputRefs[0].current?.focus(), 400)
    return () => clearTimeout(timer)
  }, [showInitialsInput])

  // Hero score count-up: 0 → score over ~450ms with ease-out quadratic.
  // rAF interpolation (not EaseView) because the pill value is a Text child,
  // and react-native-ease animates transform/opacity, not text content.
  // motion.grand is the conceptual reference for the "hero land" feel.
  useEffect(() => {
    const start = performance.now()
    const durationMs = 450
    let rafId: number
    function tick() {
      const elapsed = performance.now() - start
      const t = Math.min(1, elapsed / durationMs)
      const eased = 1 - (1 - t) * (1 - t)
      setDisplayedScore(Math.round(score * eased))
      if (t < 1) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [score])

  const { removeAds, purchaseRemoveAds } = usePurchases()
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

  // Trigger review/postPB checks + achievement check on mount.
  // The celebration haptic (VICTORY_PATTERN / SPIRAL_PATTERN) fires on
  // GameScreen alongside the jingle — firing again here would stack 720ms
  // patterns awkwardly ~400ms into the first one.
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
  const primaryButtonForeground = activeTheme.primaryForegroundColor

  async function handleShare() {
    haptics.play("menuTap")
    analytics.trackShareTapped(score, level)
    const message = t("game:shareMessage", { level, score, mode: t(`game:modes.${mode}`) })
    try {
      const uri = await shareCardRef.current?.capture?.()
      if (uri) {
        const fileUri = uri.startsWith("file://") ? uri : `file://${uri}`
        await Sharing.shareAsync(fileUri, { mimeType: "image/png", dialogTitle: message })
      } else {
        const result = await Share.share({ message })
        // User cancellation is not an error — stay silent.
        if (result.action === Share.dismissedAction) return
      }
    } catch (err) {
      // Common failure modes: no installed share target (Android) or a
      // native sheet that genuinely fails to open. Surface a themed alert
      // so the button doesn't appear broken, and log so Sentry picks it up.
      console.warn("[game-over] share failed", err)
      Alert.alert(t("share:errorTitle"), t("share:errorBody"))
    }
  }

  const setPendingAction = usePendingActionStore((s) => s.setAction)

  useEffect(() => {
    return navigation.addListener("beforeRemove", () => {
      const { action, setAction } = usePendingActionStore.getState()
      if (!action) {
        // Android/system back from /game-over should always return to a valid idle game state.
        setAction("main_menu")
      }
    })
  }, [navigation])

  function handlePlayAgain() {
    haptics.play("buttonPress")
    // Brief commitment ack: 1 → 1.05 → 1 before navigating. Without this the
    // press feels uncommitted on non-PB games where there's no celebration.
    setPlayAgainAckScale(1.05)
    scheduleTransient(() => setPlayAgainAckScale(1), 100)
    scheduleTransient(() => {
      setPendingAction("play_again")
      router.back()
    }, 200)
  }

  function handleContinue() {
    haptics.play("buttonPress")
    setPendingAction("continue")
    router.back()
  }

  function handleMainMenu() {
    haptics.play("menuTap")
    setPendingAction("main_menu")
    router.back()
  }

  function handleReviewResponse(response: "love_it" | "not_really") {
    analytics.trackReviewPromptShown(reviewTrigger)
    analytics.trackReviewPromptResponse(response)
  }

  async function handleRemoveAds() {
    analytics.trackIapInitiated("ecomi_remove_ads")
    const success = await purchaseRemoveAds()
    if (success) {
      analytics.trackIapCompleted("ecomi_remove_ads")
      dismissPostPBPrompt()
    }
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
        <View style={[styles.content, isTablet && styles.contentTablet]}>
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
              transition={{ default: motion.grand }}
            >
              <Text
                style={[
                  styles.title,
                  isTablet && styles.titleTablet,
                  {
                    color: isNewHighScore ? activeTheme.warningColor : activeTheme.destructiveColor,
                  },
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

            {/* Inline initials — first qualifying game only */}
            {showInitialsInput && (
              <EaseView
                initialAnimate={{ opacity: 0, translateY: 12 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{
                  default: { type: "spring", stiffness: 220, damping: 18, delay: 200 },
                }}
                style={styles.initialsSection}
              >
                <View testID="inline-initials" collapsable={false}>
                  <Text style={[styles.initialsPrompt, { color: activeTheme.secondaryTextColor }]}>
                    {t("game:initialsPrompt")}
                  </Text>
                  <View style={styles.initialsRow}>
                    {[0, 1, 2].map((i) => (
                      <View
                        key={i}
                        style={[styles.initialsBox, { borderColor: activeTheme.accentColor }]}
                      >
                        <TextInput
                          ref={inputRefs[i]}
                          testID={`input-initial-${i + 1}`}
                          style={[styles.initialsText, { color: activeTheme.textColor }]}
                          value={letters[i]}
                          onChangeText={(text) => handleLetterChange(text, i)}
                          onKeyPress={({ nativeEvent }) => handleLetterKeyPress(nativeEvent.key, i)}
                          maxLength={1}
                          autoCapitalize="characters"
                          autoCorrect={false}
                          textAlign="center"
                          selectionColor={activeTheme.accentColor}
                        />
                      </View>
                    ))}
                  </View>
                  <View style={styles.initialsActions}>
                    <PressableScale
                      testID="btn-save-initials"
                      style={[
                        styles.saveButton,
                        {
                          backgroundColor: allFilled
                            ? activeTheme.accentColor
                            : activeTheme.surfaceColor,
                          borderColor: allFilled
                            ? activeTheme.accentColor
                            : activeTheme.borderColor,
                        },
                      ]}
                      onPress={handleSaveInitials}
                      disabled={!allFilled}
                    >
                      <Text
                        style={[
                          styles.saveButtonText,
                          {
                            color: allFilled
                              ? activeTheme.primaryForegroundColor
                              : activeTheme.secondaryTextColor,
                          },
                        ]}
                      >
                        {t("game:saveInitials")}
                      </Text>
                    </PressableScale>
                    <PressableScale testID="btn-skip-initials" onPress={handleSkipInitials}>
                      <Text style={[styles.skipText, { color: activeTheme.secondaryTextColor }]}>
                        {t("game:skipInitials")}
                      </Text>
                    </PressableScale>
                  </View>
                </View>
              </EaseView>
            )}

            {/* Stat Pills — 2x2 grid mirrors the game pad layout (red/blue/green/yellow) */}
            <View style={[styles.statsGrid, isTablet && styles.statsGridTablet]}>
              <View style={[styles.statsGridRow, isTablet && styles.statsGridRowTablet]}>
                <StatPill
                  testID="pill-score"
                  label={t("game:score")}
                  value={displayedScore}
                  icon="flash"
                  borderColor={
                    activeTheme.buttonColors.red.glowColor ?? activeTheme.buttonColors.red.color
                  }
                  theme={activeTheme}
                  delay={0}
                  isTablet={isTablet}
                />
                <StatPill
                  testID="pill-level"
                  label={t("game:level")}
                  value={level}
                  icon="trending-up"
                  borderColor={
                    activeTheme.buttonColors.blue.glowColor ?? activeTheme.buttonColors.blue.color
                  }
                  theme={activeTheme}
                  delay={60}
                  isTablet={isTablet}
                />
              </View>
              <View style={[styles.statsGridRow, isTablet && styles.statsGridRowTablet]}>
                <StatPill
                  testID="pill-best"
                  label={t("game:best")}
                  value={highScore}
                  icon="trophy"
                  borderColor={
                    activeTheme.buttonColors.green.glowColor ?? activeTheme.buttonColors.green.color
                  }
                  theme={activeTheme}
                  delay={120}
                  isTablet={isTablet}
                />
                <StatPill
                  testID="pill-time"
                  label={t("game:time")}
                  value={formatDuration(sessionTime)}
                  icon="time"
                  borderColor={
                    activeTheme.buttonColors.yellow.glowColor ??
                    activeTheme.buttonColors.yellow.color
                  }
                  theme={activeTheme}
                  delay={180}
                  isTablet={isTablet}
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
            initialAnimate={{ opacity: 0, translateY: 16, scale: 0.98 }}
            animate={{ opacity: 1, translateY: 0, scale: 1 }}
            transition={{ default: { ...motion.grand, delay: 350 } }}
            style={styles.bottomSection}
          >
            {showContinue && (
              <PressableScale
                testID="btn-continue"
                style={[
                  styles.continueButton,
                  {
                    backgroundColor: activeTheme.surfaceColor,
                    borderColor: activeTheme.borderColor,
                  },
                ]}
                onPress={handleContinue}
              >
                <Ionicons name="play-forward" size={18} color={activeTheme.textColor} />
                <Text style={[styles.continueText, { color: activeTheme.textColor }]}>
                  {t("game:continue")}
                </Text>
              </PressableScale>
            )}

            <EaseView animate={{ scale: playAgainAckScale }} transition={{ default: motion.snap }}>
              <PressableScale
                testID="btn-play-again"
                style={[styles.playAgainButton, { backgroundColor: activeTheme.accentColor }]}
                onPress={handlePlayAgain}
                accessibilityLabel={t("game:playAgain")}
                accessibilityRole="button"
              >
                <Ionicons name="refresh" size={20} color={primaryButtonForeground} />
                <Text style={[styles.playAgainText, { color: primaryButtonForeground }]}>
                  {t("game:playAgain")}
                </Text>
              </PressableScale>
            </EaseView>

            <View style={styles.bottomRow}>
              <PressableScale
                testID="btn-share"
                style={[
                  styles.shareButton,
                  {
                    backgroundColor: activeTheme.surfaceColor,
                    borderColor: activeTheme.borderColor,
                  },
                ]}
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
              <PressableScale
                testID="btn-home"
                style={styles.mainMenuLink}
                onPress={handleMainMenu}
              >
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
        </View>

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
  content: {
    flex: 1,
    width: "100%",
  },
  contentTablet: {
    alignSelf: "center",
    maxWidth: 680,
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
  initialsActions: {
    alignItems: "center",
    gap: 12,
    marginTop: 16,
  },
  initialsBox: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 2,
    height: 64,
    justifyContent: "center",
    width: 52,
  },
  initialsPrompt: {
    fontFamily: "Oxanium-Medium",
    fontSize: 14,
    marginBottom: 12,
  },
  initialsRow: {
    flexDirection: "row",
    gap: 12,
  },
  initialsSection: {
    alignItems: "center",
    marginTop: 20,
  },
  initialsText: {
    fontFamily: "Oxanium-Bold",
    fontSize: 32,
    textAlign: "center",
  },
  lottie: {
    height: 160,
    width: 160,
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
  pillLabelTablet: {
    fontSize: 15,
    letterSpacing: 1,
    marginBottom: 12,
  },
  pillRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  pillRowTablet: {
    gap: 12,
  },
  pillTablet: {
    borderRadius: 16,
    minHeight: 104,
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  pillValue: {
    fontFamily: "Oxanium-Bold",
    fontSize: 24,
  },
  pillValueTablet: {
    fontSize: 40,
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
  saveButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  saveButtonText: {
    fontFamily: "Oxanium-SemiBold",
    fontSize: 16,
  },
  shareButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  skipText: {
    fontFamily: "Oxanium-Regular",
    fontSize: 14,
    paddingVertical: 4,
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
  statsGridRowTablet: {
    gap: 18,
  },
  statsGridTablet: {
    gap: 18,
    marginTop: 24,
  },
  title: {
    fontFamily: "Oxanium-Bold",
    fontSize: 32,
    textAlign: "center",
  },
  titleTablet: {
    fontSize: 42,
  },
  topSection: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
})
