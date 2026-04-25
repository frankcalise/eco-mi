import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import type { LayoutChangeEvent } from "react-native"
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { useFocusEffect, useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { EaseView } from "react-native-ease"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { AnimatedCountdown } from "@/components/AnimatedCountdown"
import { AnimatedNumber } from "@/components/AnimatedNumber"
import { CompactModePickerSheet } from "@/components/CompactModePickerSheet"
import type { CompactModePickerSheetHandle } from "@/components/CompactModePickerSheet.types"
import { GameButton } from "@/components/GameButton"
import { GameHeader } from "@/components/GameHeader"
import { GameStatusBar } from "@/components/GameStatusBar"
import { OnboardingTooltip } from "@/components/OnboardingTooltip"
import { PressableScale } from "@/components/PressableScale"
import { StreakBanner } from "@/components/StreakBanner"
import { TimerRing } from "@/components/TimerRing"
import { INITIALS_SKIPPED, ONBOARDING_COMPLETED, SAVED_INITIALS } from "@/config/storageKeys"
import { isLightTheme } from "@/config/themes"
import { useAds } from "@/hooks/useAds"
import { useGameBoardMetrics } from "@/hooks/useGameBoardMetrics"
import { useGameEngine, type GameMode } from "@/hooks/useGameEngine"
import { useHaptics } from "@/hooks/useHaptics"
import { useHighScores } from "@/hooks/useHighScores"
import { useNotifications, shouldShowNotificationPrompt } from "@/hooks/useNotifications"
import { usePurchases } from "@/hooks/usePurchases"
import { useReducedMotion } from "@/hooks/useReducedMotion"
import { useSoundPack } from "@/hooks/useSoundPack"
import { useTheme } from "@/hooks/useTheme"
import { useGameOverStore } from "@/stores/gameOverStore"
import { usePendingActionStore } from "@/stores/pendingActionStore"
import { usePendingModeStore } from "@/stores/pendingModeStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { GameThemeProvider } from "@/theme/GameThemeContext"
import { motion } from "@/theme/motion"
import { UI_COLORS } from "@/theme/uiColors"
import { useAnalytics } from "@/utils/analytics"
import { useBreakpoints } from "@/utils/layoutBreakpoints"
import { scheduleModePickerPulseSequence } from "@/utils/modePickerPulse"
import { loadString, saveString } from "@/utils/storage"

// Two-beat wrong-input flash. The previous single-beat at opacity 0.25 over
// 100ms was too polite for a fail moment — reads as "hmm" rather than "ouch".
// This schedules a 4-phase opacity pattern (0 → 0.45 → 0.1 → 0.45 → 0) timed
// to fit inside the engine's 300ms wrongFlash window so mistakes actually
// sting. EaseView animates between target values each time `animate.opacity`
// changes; scheduling via local state lets us keyframe without leaving the
// react-native-ease API.
function WrongFlashOverlay({ gameSize }: { gameSize: number }) {
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0)
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 70)
    const t2 = setTimeout(() => setPhase(2), 140)
    const t3 = setTimeout(() => setPhase(3), 210)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [])
  const opacity = phase === 0 ? 0.45 : phase === 1 ? 0.1 : phase === 2 ? 0.45 : 0
  return (
    <EaseView
      style={[gameScreenStyles.wrongFlashOverlay, { borderRadius: gameSize / 2 }]}
      initialAnimate={{ opacity: 0 }}
      animate={{ opacity }}
      transition={{ default: { type: "timing", duration: 70, easing: "easeOut" } }}
    />
  )
}

const gameScreenStyles = StyleSheet.create({
  startButtonShadow: {
    borderRadius: 12,
    shadowColor: UI_COLORS.shadowBlack,
    shadowOffset: { width: 0, height: 4 },
  },
  wrongFlashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: UI_COLORS.red500,
    pointerEvents: "none",
    zIndex: 10,
  },
})

// Idle breathe for the Start button. EaseView drives the scale loop (1 → 1.02,
// reversing) via the shared `motion.breathe` preset. react-native-ease's
// `animate` prop doesn't accept shadow/elevation, so depth breathes in a
// parallel RN Animated loop tuned to the same 1500ms easeInOut reversing
// cadence — shadowRadius 8→16, shadowOpacity 0.3→0.5 on iOS, elevation 6→10
// on Android. The result: the button inhales instead of just scaling.
function BreathingStartButton({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  const reducedMotion = useReducedMotion()
  const breathe = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (reducedMotion) return
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: motion.breathe.duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: motion.breathe.duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    )
    animation.start()
    return () => animation.stop()
  }, [breathe, reducedMotion])

  const shadowRadius = breathe.interpolate({ inputRange: [0, 1], outputRange: [8, 16] })
  const shadowOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.5] })
  const elevation = breathe.interpolate({ inputRange: [0, 1], outputRange: [6, 10] })

  const animatedShadowStyle = Platform.select({
    ios: { shadowRadius, shadowOpacity },
    default: { elevation },
  })

  if (reducedMotion) {
    return (
      <View style={style}>
        <View style={gameScreenStyles.startButtonShadow}>{children}</View>
      </View>
    )
  }

  return (
    <EaseView animate={{ scale: 1.02 }} transition={{ default: motion.breathe }} style={style}>
      <Animated.View style={[gameScreenStyles.startButtonShadow, animatedShadowStyle]}>
        {children}
      </Animated.View>
    </EaseView>
  )
}

export function GameScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { width, height } = useWindowDimensions()
  const { isTablet } = useBreakpoints()
  /** Expo UI sheets are iOS/Android-only; other platforms use /mode-select. */
  const compactNativeSheetsAvailable = Platform.OS === "ios" || Platform.OS === "android"
  const isTabletLandscape = isTablet && width > height
  const isTabletPortrait = isTablet && !isTabletLandscape
  const insets = useSafeAreaInsets()

  const { soundPack } = useSoundPack()
  const { activeTheme } = useTheme()
  const colorblindPatternsEnabled = usePreferencesStore((s) => s.colorblindPatternsEnabled)
  const analytics = useAnalytics()
  const haptics = useHaptics()

  const {
    gameState,
    score,
    level,
    highScore,
    activeButton,
    isNewHighScore,
    continuedThisGame,
    sequence,
    playerSequence,
    startGame,
    resetGame,
    endGame,
    continueGame,
    handleButtonTouch,
    handleButtonRelease,
    previewPadTouch,
    previewPadRelease,
    playJingle,
    playGameOverJingle,
    playHighScoreJingle,
    setMode,
    mode,
    timeRemaining,
    buttonPositions,
    isShuffling,
    inputTimeRemaining,
    wrongFlash,
    timerDelta,
    getSessionTime,
  } = useGameEngine({
    oscillatorType: soundPack.oscillatorType,
    theme: activeTheme,
    onAudioContextRecycle: (nodeCount) => {
      analytics.trackAudioContextRecycle(nodeCount)
    },
  })

  const gameStateRef = useRef(gameState)
  gameStateRef.current = gameState
  const resetGameRef = useRef(resetGame)
  resetGameRef.current = resetGame
  const handleContinueRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const clearPendingActionRef = useRef<() => void>(() => {})

  /**
   * After /game-over pops, we should never stay on the main screen with the engine still in
   * gameover — the bottom panel hides start + idle actions in that state. If returning from
   * game-over without the pending-action effect running (timing / nav focus), reset here.
   *
   * Two guards, both required:
   *   1. `action === "continue"` — covers the synchronous case where the pending action is
   *      still queued when focus is gained.
   *   2. `continueInFlight.current` — covers the rewarded-continue async case. The pending-action
   *      useEffect runs on commit (before nav animation completes), clears the store, and starts
   *      `handleContinue` which awaits `showRewarded`. By the time useFocusEffect fires, the store
   *      is empty but `continueInFlight` is true — without this guard we'd reset the engine mid-ad
   *      and strand the user on main menu with no replay after they watched the ad.
   */
  useFocusEffect(
    useCallback(() => {
      if (usePendingActionStore.getState().action === "continue") return
      if (continueInFlight.current) return
      if (gameStateRef.current === "gameover") {
        resetGameRef.current()
      }
    }, []),
  )

  const pendingAction = usePendingActionStore((s) => s.action)
  const clearPendingAction = usePendingActionStore((s) => s.clear)
  handleContinueRef.current = handleContinue
  clearPendingActionRef.current = clearPendingAction

  // Mount-once semantics intentional: we react to pendingAction changes only, and deliberately
  // call through refs so we always invoke the current render's resetGame / handleContinue /
  // clearPendingAction. Capturing them directly would freeze the mount-time identities — e.g.
  // resetGame from useGameEngine is recreated on each render, so a stale capture would reset
  // a detached engine snapshot and leave the live one untouched.
  useEffect(() => {
    if (!pendingAction) return
    clearPendingActionRef.current()
    if (pendingAction === "play_again") {
      queuedAutoStart.current = true
      resetGameRef.current()
    } else if (pendingAction === "continue") void handleContinueRef.current()
    else if (pendingAction === "main_menu") resetGameRef.current()
  }, [pendingAction])

  const pendingMode = usePendingModeStore((s) => s.pendingMode)
  const clearPendingMode = usePendingModeStore((s) => s.clear)

  useEffect(() => {
    if (!pendingMode) return
    const next = pendingMode
    clearPendingMode()
    setMode(next)
  }, [pendingMode, clearPendingMode, setMode])

  const {
    showInterstitial,
    showRewarded,
    rewardedReady,
    incrementGamesPlayed,
    incrementSessionCount,
    adShownThisSession,
  } = useAds()
  const { removeAds } = usePurchases()
  const { isHighScore: checkIsHighScore, addHighScore, getRank } = useHighScores()
  const { rescheduleAfterGameOver } = useNotifications()
  const sessionCounted = useRef(false)
  const continueInFlight = useRef(false)
  const queuedAutoStart = useRef(false)
  const [compactModeSheetVisible, setCompactModeSheetVisible] = useState(false)
  const compactModePickerRef = useRef<CompactModePickerSheetHandle>(null)
  const previousHighScoreRef = useRef(highScore)
  const [pulsingMode, setPulsingMode] = useState<GameMode | null>(null)
  const [pulsePhase, setPulsePhase] = useState<"bright" | "dim">("bright")
  const pulseTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const isIdle = gameState === "idle"
  const showResetButton = gameState === "showing" || gameState === "waiting"
  // `idle` is included so the free-play tap-to-play flow on the main menu
  // actually lights up the pad the player just pressed; previously the
  // isActive gate suppressed the visual so the tone played without feedback.
  const shouldShowBoardHighlights =
    gameState === "showing" || gameState === "waiting" || gameState === "idle"
  const [boardArea, setBoardArea] = useState({ width: 0, height: 0 })
  const [onboardingDone, setOnboardingDone] = useState(
    () => loadString(ONBOARDING_COMPLETED) === "true",
  )
  const showOnboardingTooltip = !onboardingDone && gameState === "waiting"

  useEffect(() => {
    if (!onboardingDone && (playerSequence.length === 1 || wrongFlash)) {
      saveString(ONBOARDING_COMPLETED, "true")
      setOnboardingDone(true)
    }
  }, [playerSequence.length, onboardingDone, wrongFlash])

  function openModePicker() {
    if (isTablet || !compactNativeSheetsAvailable) {
      router.push({ pathname: "/mode-select", params: { currentMode: mode } })
      return
    }
    setCompactModeSheetVisible(true)
  }

  /**
   * Compact path only: setMode runs immediately; tablet path uses /mode-select + pendingModeStore
   * so the engine updates after pulse (see mode-select.tsx).
   */
  function handleCompactModeSelect(id: GameMode) {
    if (id === mode) return

    haptics.play("buttonPress")

    pulseTimers.current.forEach(clearTimeout)
    pulseTimers.current = []

    setMode(id)
    setPulsingMode(id)
    setPulsePhase("bright")

    scheduleModePickerPulseSequence(pulseTimers, setPulsePhase, () => {
      void (async () => {
        setPulsingMode(null)
        await compactModePickerRef.current?.hideIfNeeded()
        setCompactModeSheetVisible(false)
      })()
    })
  }

  useEffect(() => {
    return () => pulseTimers.current.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    if (!sessionCounted.current) {
      incrementSessionCount()
      sessionCounted.current = true
    }
  }, [])

  const mountJingleFired = useRef(false)
  useEffect(() => {
    if (!mountJingleFired.current && gameState === "idle") {
      mountJingleFired.current = true
      playJingle()
    }
  }, [])

  // Screen-reader announcements: full sequence on entering "showing", and a
  // game-over summary on transition. Visual flashes proceed silently after.
  const lastAnnouncedShowingRef = useRef(false)
  useEffect(() => {
    if (gameState === "showing" && !lastAnnouncedShowingRef.current) {
      lastAnnouncedShowingRef.current = true
      const pads = sequence.map((c) => t(`a11y:padColor_${c}`)).join(", ")
      AccessibilityInfo.announceForAccessibility(t("a11y:watchSequence", { pads }))
    } else if (gameState !== "showing") {
      lastAnnouncedShowingRef.current = false
    }
  }, [gameState, sequence, t])

  const lastAnnouncedGameOverRef = useRef(false)
  useEffect(() => {
    if (gameState === "gameover" && !lastAnnouncedGameOverRef.current) {
      lastAnnouncedGameOverRef.current = true
      AccessibilityInfo.announceForAccessibility(t("a11y:gameOver", { score, level }))
    } else if (gameState !== "gameover") {
      lastAnnouncedGameOverRef.current = false
    }
  }, [gameState, score, level, t])

  // Ref-wrap every unstable identity the gameover transition effect touches. The effect
  // intentionally fires only on gameState (and a few primitive deps) — we don't want it
  // re-running on every render. But that means direct references would be pinned to the
  // mount-time closure, and hook returns like `analytics` (PostHog re-inits after hydration),
  // `haptics`, `router`, and the useHighScores / useNotifications / useAds hooks can all
  // hand back new identities across renders. A stale analytics handle, for example, would
  // silently drop trackGameOver events after PostHog hydrates asynchronously; a stale
  // navigateToGameOver would push against an outdated highScore/sessionTime snapshot.
  const analyticsRef = useRef(analytics)
  analyticsRef.current = analytics
  const hapticsRef = useRef(haptics)
  hapticsRef.current = haptics
  const routerRef = useRef(router)
  routerRef.current = router
  const checkIsHighScoreRef = useRef(checkIsHighScore)
  checkIsHighScoreRef.current = checkIsHighScore
  const addHighScoreRef = useRef(addHighScore)
  addHighScoreRef.current = addHighScore
  const getRankRef = useRef(getRank)
  getRankRef.current = getRank
  const rescheduleAfterGameOverRef = useRef(rescheduleAfterGameOver)
  rescheduleAfterGameOverRef.current = rescheduleAfterGameOver
  const incrementGamesPlayedRef = useRef(incrementGamesPlayed)
  incrementGamesPlayedRef.current = incrementGamesPlayed
  const playHighScoreJingleRef = useRef(playHighScoreJingle)
  playHighScoreJingleRef.current = playHighScoreJingle
  const playGameOverJingleRef = useRef(playGameOverJingle)
  playGameOverJingleRef.current = playGameOverJingle
  const navigateToGameOverRef = useRef<
    (needsInitials?: boolean, leaderboardRank?: number | null) => void
  >(() => {})
  navigateToGameOverRef.current = navigateToGameOver

  const prevGameState = useRef(gameState)
  useEffect(() => {
    if (prevGameState.current !== "gameover" && gameState === "gameover") {
      incrementGamesPlayedRef.current()
      const elapsed = getSessionTime()
      analyticsRef.current.trackGameOver(score, level, elapsed)

      if (isNewHighScore) {
        playHighScoreJingleRef.current()
        hapticsRef.current.play("newHighScore")
        analyticsRef.current.trackGameCompleted(score, level, true, elapsed)
      } else {
        playGameOverJingleRef.current()
        hapticsRef.current.play("gameOver")
      }

      rescheduleAfterGameOverRef.current()

      const qualifies = checkIsHighScoreRef.current(score, mode)
      const savedInitials = loadString(SAVED_INITIALS)
      const initialsSkipped = loadString(INITIALS_SKIPPED) === "true"

      if (qualifies && savedInitials) {
        const updated = addHighScoreRef.current({
          initials: savedInitials,
          score,
          level,
          date: new Date().toISOString(),
          mode,
        })
        const rank = updated.findIndex((entry) => entry.score === score)
        navigateToGameOverRef.current(false, rank >= 0 ? rank : null)
      } else if (qualifies && initialsSkipped) {
        const updated = addHighScoreRef.current({
          initials: "---",
          score,
          level,
          date: new Date().toISOString(),
          mode,
        })
        const rank = updated.findIndex((entry) => entry.score === score)
        navigateToGameOverRef.current(false, rank >= 0 ? rank : null)
      } else if (qualifies) {
        navigateToGameOverRef.current(true, getRankRef.current(score, mode))
      } else {
        navigateToGameOverRef.current(false, null)
      }
    }

    if (prevGameState.current !== "idle" && gameState === "idle") {
      if (shouldShowNotificationPrompt()) {
        routerRef.current.push("/notifications")
      }
    }

    prevGameState.current = gameState
  }, [gameState, getSessionTime, isNewHighScore, level, mode, score])

  async function handleStartGame() {
    previousHighScoreRef.current = highScore
    const adShown = await showInterstitial(level, removeAds)
    if (adShown) {
      analytics.trackAdShown("interstitial", "game_over")
    }

    analytics.trackGameStarted()
    startGame()
  }

  function navigateToGameOver(needsInitials = false, leaderboardRank: number | null = null) {
    useGameOverStore.getState().setGameOver({
      score,
      level,
      highScore,
      previousHighScore: previousHighScoreRef.current,
      isNewHighScore,
      mode,
      showRemoveAds: !removeAds && adShownThisSession,
      showContinue: rewardedReady && !continuedThisGame,
      sessionTime: getSessionTime(),
      needsInitials,
      leaderboardRank,
    })
    router.push("/game-over")
  }

  async function handleContinue() {
    if (continueInFlight.current) return
    continueInFlight.current = true
    const shown = await showRewarded()
    if (shown) {
      analytics.trackAdRewardedWatched("continue")
      continueGame()
    } else {
      navigateToGameOver()
    }
    continueInFlight.current = false
  }

  function handleBoardAreaLayout(event: LayoutChangeEvent) {
    const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout
    setBoardArea((current) =>
      current.width === nextWidth && current.height === nextHeight
        ? current
        : { width: nextWidth, height: nextHeight },
    )

    if (queuedAutoStart.current && gameState === "idle") {
      queuedAutoStart.current = false
      void handleStartGame()
    }
  }

  const fallbackBoardWidth = isTablet ? width * 0.52 : width - 40
  const fallbackBoardHeight = isTablet ? height * 0.48 : height * 0.38
  const availableBoardWidth = boardArea.width > 0 ? boardArea.width : fallbackBoardWidth
  const availableBoardHeight = boardArea.height > 0 ? boardArea.height : fallbackBoardHeight
  const {
    gameSize,
    buttonSize,
    centerDiameter,
    centerDiameterNoRing,
    ringSize,
    borderWidth,
    centerTranslateOffset,
    slotInset,
  } = useGameBoardMetrics({
    availableWidth: availableBoardWidth,
    availableHeight: availableBoardHeight,
    freeze: !isIdle,
  })
  const centerTimerStyle = {
    fontFamily: "Oxanium-Bold" as const,
    fontSize: Math.round(centerDiameter * 0.3),
  }
  const showTimerRing = mode === "timed" && timeRemaining !== null && gameState !== "idle"
  const centerModeFontSize = isTablet
    ? Math.max(12, Math.round(centerDiameter * 0.18))
    : Math.max(9, Math.min(14, Math.round(centerDiameter * 0.13)))
  const centerModeLetterSpacing = isTablet
    ? Math.max(1, Math.round(centerDiameter * 0.02))
    : Math.max(0.5, Math.round(centerDiameter * 0.01))

  const gameContainerStyle = {
    backgroundColor: activeTheme.panelColor,
    borderColor: activeTheme.panelBorderColor,
    borderRadius: gameSize / 2,
    borderWidth,
    height: gameSize,
    position: "relative" as const,
    width: gameSize,
  }
  const primaryButtonForeground = activeTheme.primaryForegroundColor

  const scoreBoxes = (
    <View
      style={[
        styles.scoreContainer,
        isTabletLandscape
          ? styles.scoreContainerTabletLandscape
          : isTablet
            ? styles.scoreContainerTabletPortrait
            : styles.scoreContainerCompact,
      ]}
    >
      <View
        style={[
          styles.scoreBox,
          isTabletLandscape && styles.scoreBoxTabletLandscape,
          isTablet && !isTabletLandscape && styles.scoreBoxTabletPortrait,
          {
            backgroundColor: activeTheme.surfaceColor,
            borderColor: activeTheme.borderColor,
          },
        ]}
      >
        <Text
          style={[
            styles.scoreLabel,
            isTabletLandscape && styles.scoreLabelTabletLandscape,
            { color: activeTheme.secondaryTextColor },
          ]}
        >
          {t("game:level")}
        </Text>
        <AnimatedNumber
          testID="text-level"
          accessibilityLabel={t("game:level")}
          value={level}
          style={[
            styles.scoreValue,
            isTablet && styles.scoreValueTablet,
            { color: activeTheme.textColor },
          ]}
        />
      </View>
      <View
        style={[
          styles.scoreBox,
          isTabletLandscape && styles.scoreBoxTabletLandscape,
          isTablet && !isTabletLandscape && styles.scoreBoxTabletPortrait,
          {
            backgroundColor: activeTheme.surfaceColor,
            borderColor: activeTheme.borderColor,
          },
        ]}
      >
        <Text
          style={[
            styles.scoreLabel,
            isTabletLandscape && styles.scoreLabelTabletLandscape,
            { color: activeTheme.secondaryTextColor },
          ]}
        >
          {t("game:score")}
        </Text>
        <AnimatedNumber
          testID="text-score"
          accessibilityLabel={t("game:score")}
          value={score}
          style={[
            styles.scoreValue,
            isTablet && styles.scoreValueTablet,
            { color: activeTheme.textColor },
          ]}
        />
      </View>
      <View
        style={[
          styles.scoreBox,
          isTabletLandscape && styles.scoreBoxTabletLandscape,
          isTablet && !isTabletLandscape && styles.scoreBoxTabletPortrait,
          {
            backgroundColor: activeTheme.surfaceColor,
            borderColor: activeTheme.borderColor,
          },
        ]}
      >
        <Text
          style={[
            styles.scoreLabel,
            isTabletLandscape && styles.scoreLabelTabletLandscape,
            { color: activeTheme.secondaryTextColor },
          ]}
        >
          {t("game:best")}
        </Text>
        <AnimatedNumber
          testID="text-high-score"
          accessibilityLabel={t("game:best")}
          value={highScore}
          style={[
            styles.scoreValue,
            isTablet && styles.scoreValueTablet,
            { color: activeTheme.textColor },
          ]}
        />
      </View>
    </View>
  )

  const board = (
    <View style={styles.gameBoard}>
      {wrongFlash && <WrongFlashOverlay gameSize={gameSize} />}
      <View style={gameContainerStyle}>
        {buttonPositions.map((color, index) => (
          <GameButton
            key={color}
            color={color}
            index={index}
            isActive={shouldShowBoardHighlights && activeButton === color}
            // Enabled in "waiting" (gameplay) and "idle" (free-play tapping).
            // Everything else (showing, advancing, gameover, replaying) locks
            // pads so the user can't interrupt sequence playback or resolve
            // animations.
            disabled={(gameState !== "waiting" && gameState !== "idle") || isShuffling}
            buttonSize={buttonSize}
            gameSize={gameSize}
            slotInset={slotInset}
            isShuffling={isShuffling}
            onPressIn={() =>
              gameState === "idle" ? previewPadTouch(color) : handleButtonTouch(color)
            }
            onPressOut={() =>
              gameState === "idle" ? previewPadRelease(color) : handleButtonRelease(color)
            }
            themeColor={activeTheme.buttonColors[color].color}
            themeActiveColor={activeTheme.buttonColors[color].activeColor}
            themeGlowColor={activeTheme.buttonColors[color].glowColor}
            showPattern={colorblindPatternsEnabled}
          />
        ))}

        <View
          style={[
            styles.centerCircleWrapper,
            {
              height: ringSize,
              width: ringSize,
              transform: [
                { translateX: -centerTranslateOffset },
                { translateY: -centerTranslateOffset },
              ],
            },
          ]}
        >
          {showTimerRing && (
            <View style={styles.timerRingContainer}>
              <TimerRing
                progress={timeRemaining! / 60}
                size={ringSize}
                strokeWidth={borderWidth}
                theme={activeTheme}
              />
            </View>
          )}
          <View
            style={[
              styles.centerCircle,
              {
                backgroundColor: activeTheme.backgroundColor,
                borderColor: activeTheme.borderColor,
                borderRadius: centerDiameter / 2,
                borderWidth,
                height: centerDiameter,
                width: centerDiameter,
              },
              showTimerRing && styles.centerCircleNoBorder,
              showTimerRing && {
                borderRadius: centerDiameterNoRing / 2,
                height: centerDiameterNoRing,
                width: centerDiameterNoRing,
              },
            ]}
          >
            {mode === "timed" && timeRemaining !== null && gameState !== "idle" ? (
              <AnimatedCountdown
                value={Math.ceil(timeRemaining)}
                color={timeRemaining <= 10 ? activeTheme.destructiveColor : activeTheme.textColor}
                style={centerTimerStyle}
              />
            ) : inputTimeRemaining !== null ? (
              <AnimatedCountdown
                value={inputTimeRemaining}
                color={
                  inputTimeRemaining <= 3 ? activeTheme.destructiveColor : activeTheme.warningColor
                }
                style={centerTimerStyle}
              />
            ) : (
              <Text
                style={[
                  styles.centerText,
                  {
                    color: activeTheme.secondaryTextColor,
                    fontSize: centerModeFontSize,
                    letterSpacing: centerModeLetterSpacing,
                    lineHeight: Math.round(centerModeFontSize * 1.05),
                    maxWidth: centerDiameterNoRing * 0.72,
                  },
                ]}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                numberOfLines={1}
              >
                {t(`game:modes.${mode}`)}
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  )

  const statusBarNode = (
    <GameStatusBar
      gameState={gameState}
      sequence={sequence}
      playerSequence={playerSequence}
      theme={activeTheme}
      timerDelta={mode === "timed" ? timerDelta : null}
    />
  )

  const isLight = isLightTheme(activeTheme)
  const idleActionConfigs = [
    {
      key: "leaderboard",
      testID: "btn-leaderboard",
      accessibilityLabel: t("a11y:leaderboard"),
      icon: "trophy" as const,
      tone: activeTheme.warningColor,
      onPress: () => {
        haptics.play("menuTap")
        router.push({ pathname: "/leaderboard", params: { mode } })
      },
    },
    {
      key: "stats",
      testID: "btn-stats",
      accessibilityLabel: t("a11y:stats"),
      icon: "stats-chart" as const,
      tone: activeTheme.buttonColors.blue.glowColor ?? activeTheme.buttonColors.blue.color,
      onPress: () => {
        haptics.play("menuTap")
        router.push("/stats")
      },
    },
    {
      key: "achievements",
      testID: "btn-achievements",
      accessibilityLabel: t("a11y:achievements"),
      icon: "ribbon" as const,
      tone: activeTheme.accentColor,
      onPress: () => {
        haptics.play("menuTap")
        router.push("/achievements")
      },
    },
  ]

  function renderIdleActionButtons() {
    return idleActionConfigs.map((action) => {
      const isRetroStats = activeTheme.id === "retro" && action.key === "stats"
      const backgroundAlpha = isLight ? "22" : isRetroStats ? "24" : "18"
      const borderAlpha = isLight ? "66" : isRetroStats ? "5C" : "40"
      const backgroundColor = `${action.tone}${backgroundAlpha}`
      const borderColor = `${action.tone}${borderAlpha}`
      const iconColor = isLight
        ? activeTheme.textColor
        : isRetroStats
          ? activeTheme.buttonColors.blue.activeColor
          : action.tone

      return (
        <PressableScale
          key={action.key}
          testID={action.testID}
          accessibilityLabel={action.accessibilityLabel}
          accessibilityRole="button"
          style={[styles.idleActionButton, { backgroundColor, borderColor }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={action.onPress}
        >
          <Ionicons name={action.icon} size={20} color={iconColor} />
        </PressableScale>
      )
    })
  }

  const idleActionsNode = (
    <View style={[styles.idleActions, isTabletPortrait && styles.idleActionsTabletPortrait]}>
      {renderIdleActionButtons()}
    </View>
  )

  const startButtonNode = (
    <BreathingStartButton
      style={[
        styles.startButtonWrapper,
        isTabletPortrait && styles.startButtonWrapperTabletPortrait,
      ]}
    >
      <PressableScale
        testID="btn-start"
        accessibilityLabel={t("a11y:startGame")}
        accessibilityRole="button"
        style={[styles.startButton, { backgroundColor: activeTheme.accentColor }]}
        onPress={handleStartGame}
      >
        <Ionicons name="play" size={24} color={primaryButtonForeground} />
        <Text style={[styles.startButtonText, { color: primaryButtonForeground }]}>
          {t("game:startGame")}
        </Text>
      </PressableScale>
    </BreathingStartButton>
  )

  const resetButtonNode = showResetButton ? (
    <PressableScale
      testID="btn-reset"
      accessibilityLabel={t("a11y:endGame")}
      accessibilityRole="button"
      style={styles.resetButton}
      onPress={endGame}
    >
      <Ionicons name="stop" size={24} color="white" />
      <Text style={styles.buttonText}>{t("game:endGame")}</Text>
    </PressableScale>
  ) : null

  return (
    <GameThemeProvider value={activeTheme}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: activeTheme.backgroundColor,
            paddingTop: insets.top + 32,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        <StatusBar
          style={activeTheme.statusBarStyle}
          backgroundColor={activeTheme.backgroundColor}
        />

        <GameHeader
          isIdle={isIdle}
          theme={activeTheme}
          onModePress={openModePicker}
          onSettingsPress={() => router.push("/settings")}
        />

        {isTabletLandscape ? (
          <View style={styles.mainAreaTablet}>
            <View style={styles.boardColumn}>
              <View style={styles.onboardingSlot}>
                <OnboardingTooltip visible={showOnboardingTooltip} theme={activeTheme} />
              </View>
              <View style={styles.boardMeasureArea} onLayout={handleBoardAreaLayout}>
                {board}
              </View>
            </View>

            <View style={styles.secondaryColumn}>
              <View style={styles.secondaryTop}>
                {scoreBoxes}
                {isIdle && <StreakBanner theme={activeTheme} style={styles.streakBannerTablet} />}
              </View>

              <View style={styles.secondaryMiddle}>{!isIdle && statusBarNode}</View>

              <View style={styles.secondaryBottom}>
                {isIdle ? (
                  <>
                    <BreathingStartButton style={styles.startButtonWrapperTablet}>
                      <PressableScale
                        testID="btn-start"
                        accessibilityLabel={t("a11y:startGame")}
                        accessibilityRole="button"
                        style={[styles.startButton, { backgroundColor: activeTheme.accentColor }]}
                        onPress={handleStartGame}
                      >
                        <Ionicons name="play" size={24} color={primaryButtonForeground} />
                        <Text style={[styles.startButtonText, { color: primaryButtonForeground }]}>
                          {t("game:startGame")}
                        </Text>
                      </PressableScale>
                    </BreathingStartButton>
                    <View style={styles.idleActions}>{renderIdleActionButtons()}</View>
                  </>
                ) : (
                  showResetButton && (
                    <PressableScale
                      testID="btn-reset"
                      accessibilityLabel={t("a11y:endGame")}
                      accessibilityRole="button"
                      style={styles.resetButton}
                      onPress={endGame}
                    >
                      <Ionicons name="stop" size={24} color="white" />
                      <Text style={styles.buttonText}>{t("game:endGame")}</Text>
                    </PressableScale>
                  )
                )}
              </View>
            </View>
          </View>
        ) : (
          <>
            {scoreBoxes}
            <View style={styles.onboardingSlot}>
              <OnboardingTooltip visible={showOnboardingTooltip} theme={activeTheme} />
            </View>
            <View style={styles.boardMeasureAreaCompact} onLayout={handleBoardAreaLayout}>
              {board}
            </View>

            <View
              style={[
                styles.compactBottomPanel,
                isTabletPortrait && styles.compactBottomPanelTabletPortrait,
              ]}
            >
              <View
                style={[
                  styles.compactTopInfoSlot,
                  isTabletPortrait && styles.compactTopInfoSlotTabletPortrait,
                ]}
              >
                {isIdle ? <StreakBanner theme={activeTheme} /> : statusBarNode}
              </View>
              <View
                style={[
                  styles.compactPrimarySlot,
                  isTabletPortrait && styles.compactPrimarySlotTabletPortrait,
                ]}
              >
                {isIdle ? startButtonNode : resetButtonNode}
              </View>
              <View
                style={[
                  styles.compactActionsSlot,
                  isTabletPortrait && styles.compactActionsSlotTabletPortrait,
                ]}
              >
                {isIdle ? idleActionsNode : null}
              </View>
            </View>
          </>
        )}

        {compactNativeSheetsAvailable && !isTablet ? (
          <CompactModePickerSheet
            ref={compactModePickerRef}
            visible={compactModeSheetVisible}
            onVisibleChange={(visible) => {
              if (!visible && !pulsingMode) setCompactModeSheetVisible(false)
            }}
            pulsingMode={pulsingMode}
            selectedMode={mode}
            pulsePhase={pulsePhase}
            theme={activeTheme}
            onSelectMode={handleCompactModeSelect}
          />
        ) : null}
      </View>
    </GameThemeProvider>
  )
}

const styles = StyleSheet.create({
  boardColumn: {
    flex: 6,
  },
  boardMeasureArea: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  boardMeasureAreaCompact: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingBottom: 24,
    width: "100%",
  },
  buttonText: {
    color: UI_COLORS.white,
    fontFamily: "Oxanium-SemiBold",
    fontSize: 16,
    fontWeight: "600",
  },
  centerCircle: {
    alignItems: "center",
    justifyContent: "center",
  },
  centerCircleNoBorder: {
    borderWidth: 0,
  },
  centerCircleWrapper: {
    alignItems: "center",
    justifyContent: "center",
    left: "50%",
    position: "absolute",
    top: "50%",
  },
  centerText: {
    color: UI_COLORS.white,
    fontFamily: "Oxanium-Medium",
    textAlign: "center",
    textTransform: "uppercase",
  },
  compactActionsSlot: {
    alignItems: "center",
    justifyContent: "flex-start",
    minHeight: 48,
    width: "100%",
  },
  compactActionsSlotTabletPortrait: {
    minHeight: 60,
    width: "100%",
  },
  compactBottomPanel: {
    marginBottom: 12,
    paddingHorizontal: 20,
    width: "100%",
  },
  compactBottomPanelTabletPortrait: {
    alignItems: "center",
    marginBottom: 20,
  },
  compactPrimarySlot: {
    alignItems: "center",
    justifyContent: "flex-start",
    minHeight: 64,
    width: "100%",
  },
  compactPrimarySlotTabletPortrait: {
    minHeight: 78,
    width: "100%",
  },
  compactTopInfoSlot: {
    alignItems: "center",
    justifyContent: "flex-start",
    minHeight: 62,
    width: "100%",
  },
  compactTopInfoSlotTabletPortrait: {
    minHeight: 72,
    width: "100%",
  },
  container: {
    alignItems: "center",
    backgroundColor: UI_COLORS.classicBackground,
    flex: 1,
  },
  gameBoard: {
    alignItems: "center",
    justifyContent: "center",
  },
  idleActionButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  idleActions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    marginTop: 8,
  },
  idleActionsTabletPortrait: {
    marginTop: 0,
  },
  mainAreaTablet: {
    flex: 1,
    flexDirection: "row",
    gap: 20,
    paddingHorizontal: 20,
    width: "100%",
  },
  onboardingSlot: {
    alignItems: "center",
    height: 48,
    justifyContent: "center",
  },
  resetButton: {
    alignItems: "center",
    backgroundColor: UI_COLORS.red500,
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  scoreBox: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 80,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  scoreBoxTabletLandscape: {
    minWidth: 120,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  scoreBoxTabletPortrait: {
    minWidth: 120,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  scoreContainer: {
    width: "100%",
  },
  scoreContainerCompact: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 30,
    width: "80%",
  },
  scoreContainerTabletLandscape: {
    alignSelf: "center",
    flexDirection: "row",
    gap: 16,
    justifyContent: "center",
    marginBottom: 24,
    width: "100%",
  },
  scoreContainerTabletPortrait: {
    alignSelf: "center",
    flexDirection: "row",
    gap: 16,
    justifyContent: "center",
    marginBottom: 36,
    width: "88%",
  },
  scoreLabel: {
    color: UI_COLORS.classicSurfaceDim,
    fontFamily: "Oxanium-Regular",
    fontSize: 12,
    marginBottom: 5,
  },
  scoreLabelTabletLandscape: {
    marginBottom: 8,
  },
  scoreValue: {
    color: UI_COLORS.white,
    fontFamily: "Oxanium-Bold",
    fontSize: 24,
  },
  scoreValueTablet: {
    fontSize: 28,
  },
  secondaryBottom: {
    alignItems: "center",
    width: "100%",
  },
  secondaryColumn: {
    flex: 4,
    justifyContent: "space-between",
    paddingBottom: 24,
    paddingTop: 56,
  },
  secondaryMiddle: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  secondaryTop: {
    alignItems: "center",
    gap: 16,
    width: "100%",
  },
  startButton: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 16,
  },
  startButtonText: {
    color: UI_COLORS.white,
    fontFamily: "Oxanium-Bold",
    fontSize: 18,
  },
  startButtonWrapper: {
    width: "70%",
  },
  startButtonWrapperTablet: {
    width: "100%",
  },
  startButtonWrapperTabletPortrait: {
    width: "74%",
  },
  streakBannerTablet: {
    marginBottom: 0,
    width: "100%",
  },
  timerRingContainer: {
    left: 0,
    position: "absolute",
    top: 0,
  },
})
