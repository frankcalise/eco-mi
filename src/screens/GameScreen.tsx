import { useEffect, useRef, useState } from "react"
import type { LayoutChangeEvent } from "react-native"
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native"
import * as Haptics from "expo-haptics"
import { useFocusEffect, useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { EaseView } from "react-native-ease"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { AnimatedCountdown } from "@/components/AnimatedCountdown"
import { AnimatedNumber } from "@/components/AnimatedNumber"
import { GameButton } from "@/components/GameButton"
import { GameHeader } from "@/components/GameHeader"
import { GameStatusBar } from "@/components/GameStatusBar"
import { ModeItem } from "@/components/ModeItem"
import { OnboardingTooltip } from "@/components/OnboardingTooltip"
import { PressableScale } from "@/components/PressableScale"
import { StreakBanner } from "@/components/StreakBanner"
import { TimerRing } from "@/components/TimerRing"
import {
  DAILY_CURRENT_STREAK,
  INITIALS_SKIPPED,
  ONBOARDING_COMPLETED,
  SAVED_INITIALS,
} from "@/config/storageKeys"
import { useAds } from "@/hooks/useAds"
import { useGameBoardMetrics } from "@/hooks/useGameBoardMetrics"
import { useGameEngine, type GameMode } from "@/hooks/useGameEngine"
import { useHighScores } from "@/hooks/useHighScores"
import { useNotifications, shouldShowNotificationPrompt } from "@/hooks/useNotifications"
import { usePurchases } from "@/hooks/usePurchases"
import { useSoundPack } from "@/hooks/useSoundPack"
import { useTheme } from "@/hooks/useTheme"
import { useGameOverStore } from "@/stores/gameOverStore"
import { usePendingActionStore } from "@/stores/pendingActionStore"
import { GameThemeProvider } from "@/theme/GameThemeContext"
import { UI_COLORS } from "@/theme/uiColors"
import { useAnalytics } from "@/utils/analytics"
import { useBreakpoints } from "@/utils/layoutBreakpoints"
import { loadString, saveString } from "@/utils/storage"

const GAME_MODES: { id: GameMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "classic", label: "Classic", icon: "game-controller" },
  { id: "daily", label: "Daily", icon: "calendar" },
  { id: "timed", label: "Timed", icon: "timer" },
  { id: "reverse", label: "Reverse", icon: "swap-horizontal" },
  { id: "chaos", label: "Chaos", icon: "shuffle" },
]

const PULSE_DURATION = 150
const PULSE_COUNT = 2
const DISMISS_DELAY = 200

export function GameScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { width, height } = useWindowDimensions()
  const { isTablet } = useBreakpoints()
  const isTabletLandscape = isTablet && width > height
  const isTabletPortrait = isTablet && !isTabletLandscape
  const insets = useSafeAreaInsets()

  const { soundPack } = useSoundPack()
  const { activeTheme } = useTheme()
  const analytics = useAnalytics()

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
    syncSoundState,
  } = useGameEngine({
    oscillatorType: soundPack.oscillatorType,
    theme: activeTheme,
    onAudioContextRecycle: (nodeCount) => {
      analytics.trackAudioContextRecycle(nodeCount)
    },
  })

  useFocusEffect(() => {
    syncSoundState()
  })

  const pendingAction = usePendingActionStore((s) => s.action)
  const clearPendingAction = usePendingActionStore((s) => s.clear)

  useEffect(() => {
    if (!pendingAction) return
    clearPendingAction()
    if (pendingAction === "play_again") {
      queuedAutoStart.current = true
      resetGame()
    } else if (pendingAction === "continue") handleContinue()
    else if (pendingAction === "main_menu") resetGame()
  }, [pendingAction])

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
  const [modeModalVisible, setModeModalVisible] = useState(false)
  const previousHighScoreRef = useRef(highScore)
  const [pulsingMode, setPulsingMode] = useState<GameMode | null>(null)
  const [pulsePhase, setPulsePhase] = useState<"bright" | "dim">("bright")
  const pulseTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const isIdle = gameState === "idle"
  const showResetButton = gameState === "showing" || gameState === "waiting"
  const shouldShowBoardHighlights = gameState === "showing" || gameState === "waiting"
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

  function handleModeSelect(id: GameMode) {
    if (id === mode) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    pulseTimers.current.forEach(clearTimeout)
    pulseTimers.current = []

    setMode(id)
    setPulsingMode(id)
    setPulsePhase("bright")

    let delay = 0
    for (let i = 0; i < PULSE_COUNT; i++) {
      pulseTimers.current.push(setTimeout(() => setPulsePhase("dim"), delay + PULSE_DURATION))
      if (i < PULSE_COUNT - 1) {
        pulseTimers.current.push(
          setTimeout(() => setPulsePhase("bright"), delay + PULSE_DURATION * 2),
        )
      }
      delay += PULSE_DURATION * 2
    }

    pulseTimers.current.push(
      setTimeout(() => {
        setPulsingMode(null)
        setModeModalVisible(false)
      }, delay + DISMISS_DELAY),
    )
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

  const prevGameState = useRef(gameState)
  useEffect(() => {
    if (prevGameState.current !== "gameover" && gameState === "gameover") {
      incrementGamesPlayed()
      const elapsed = getSessionTime()
      analytics.trackGameOver(score, level, elapsed)

      if (isNewHighScore) {
        playHighScoreJingle()
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        analytics.trackGameCompleted(score, level, true, elapsed)
      } else {
        playGameOverJingle()
      }

      rescheduleAfterGameOver()

      const qualifies = checkIsHighScore(score, mode)
      const savedInitials = loadString(SAVED_INITIALS)
      const initialsSkipped = loadString(INITIALS_SKIPPED) === "true"

      if (qualifies && savedInitials) {
        const updated = addHighScore({
          initials: savedInitials,
          score,
          level,
          date: new Date().toISOString(),
          mode,
        })
        const rank = updated.findIndex((entry) => entry.score === score)
        navigateToGameOver(false, rank >= 0 ? rank : null)
      } else if (qualifies && initialsSkipped) {
        const updated = addHighScore({
          initials: "---",
          score,
          level,
          date: new Date().toISOString(),
          mode,
        })
        const rank = updated.findIndex((entry) => entry.score === score)
        navigateToGameOver(false, rank >= 0 ? rank : null)
      } else if (qualifies) {
        navigateToGameOver(true, getRank(score, mode))
      } else {
        navigateToGameOver(false, null)
      }
    }

    if (prevGameState.current !== "idle" && gameState === "idle") {
      if (shouldShowNotificationPrompt()) {
        router.push("/notifications")
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
    backgroundColor: "rgba(0, 0, 0, 0.5)" as const,
    borderColor: "rgba(255, 255, 255, 0.2)" as const,
    borderRadius: gameSize / 2,
    borderWidth,
    height: gameSize,
    position: "relative" as const,
    width: gameSize,
  }

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
          { backgroundColor: activeTheme.surfaceColor },
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
          { backgroundColor: activeTheme.surfaceColor },
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
          { backgroundColor: activeTheme.surfaceColor },
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
      {wrongFlash && (
        <EaseView
          style={[styles.wrongFlashOverlay, { borderRadius: gameSize / 2 }]}
          initialAnimate={{ opacity: 0 }}
          animate={{ opacity: 0.25 }}
          transition={{ default: { type: "timing", duration: 100 } }}
        />
      )}
      <View style={gameContainerStyle}>
        {buttonPositions.map((color, index) => (
          <GameButton
            key={color}
            color={color}
            index={index}
            isActive={shouldShowBoardHighlights && activeButton === color}
            disabled={gameState !== "waiting" || isShuffling}
            buttonSize={buttonSize}
            gameSize={gameSize}
            slotInset={slotInset}
            isShuffling={isShuffling}
            onPressIn={() => handleButtonTouch(color)}
            onPressOut={() => handleButtonRelease(color)}
            themeColor={activeTheme.buttonColors[color].color}
            themeActiveColor={activeTheme.buttonColors[color].activeColor}
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
                color={timeRemaining <= 10 ? "#ef4444" : activeTheme.textColor}
                style={centerTimerStyle}
              />
            ) : inputTimeRemaining !== null ? (
              <AnimatedCountdown
                value={inputTimeRemaining}
                color={inputTimeRemaining <= 3 ? "#ef4444" : "#fbbf24"}
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

  const idleActionsNode = (
    <View style={[styles.idleActions, isTabletPortrait && styles.idleActionsTabletPortrait]}>
      <PressableScale
        testID="btn-leaderboard"
        accessibilityLabel={t("a11y:leaderboard")}
        accessibilityRole="button"
        style={[styles.idleActionButton, { borderColor: activeTheme.borderColor }]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          router.push({ pathname: "/leaderboard", params: { mode } })
        }}
      >
        <Ionicons name="trophy" size={20} color={activeTheme.warningColor} />
      </PressableScale>
      <PressableScale
        testID="btn-stats"
        accessibilityLabel={t("a11y:stats")}
        accessibilityRole="button"
        style={[styles.idleActionButton, { borderColor: activeTheme.borderColor }]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          router.push("/stats")
        }}
      >
        <Ionicons name="stats-chart" size={20} color={activeTheme.secondaryTextColor} />
      </PressableScale>
      <PressableScale
        testID="btn-achievements"
        accessibilityLabel={t("a11y:achievements")}
        accessibilityRole="button"
        style={[styles.idleActionButton, { borderColor: activeTheme.borderColor }]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          router.push("/achievements")
        }}
      >
        <Ionicons name="ribbon" size={20} color={activeTheme.secondaryTextColor} />
      </PressableScale>
    </View>
  )

  const startButtonNode = (
    <EaseView
      animate={{ scale: 1.02 }}
      transition={{
        default: {
          type: "timing",
          duration: 1200,
          easing: "easeInOut",
          loop: "reverse",
        },
      }}
      style={[styles.startButtonWrapper, isTabletPortrait && styles.startButtonWrapperTabletPortrait]}
    >
      <PressableScale
        testID="btn-start"
        accessibilityLabel={t("a11y:startGame")}
        accessibilityRole="button"
        style={[styles.startButton, { backgroundColor: activeTheme.accentColor }]}
        onPress={handleStartGame}
      >
        <Ionicons name="play" size={24} color="white" />
        <Text style={styles.startButtonText}>{t("game:startGame")}</Text>
      </PressableScale>
    </EaseView>
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
          onModePress={() => setModeModalVisible(true)}
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
                    <EaseView
                      animate={{ scale: 1.02 }}
                      transition={{
                        default: {
                          type: "timing",
                          duration: 1200,
                          easing: "easeInOut",
                          loop: "reverse",
                        },
                      }}
                      style={styles.startButtonWrapperTablet}
                    >
                      <PressableScale
                        testID="btn-start"
                        accessibilityLabel={t("a11y:startGame")}
                        accessibilityRole="button"
                        style={[styles.startButton, { backgroundColor: activeTheme.accentColor }]}
                        onPress={handleStartGame}
                      >
                        <Ionicons name="play" size={24} color="white" />
                        <Text style={styles.startButtonText}>{t("game:startGame")}</Text>
                      </PressableScale>
                    </EaseView>
                    <View style={styles.idleActions}>
                      <PressableScale
                        testID="btn-leaderboard"
                        accessibilityLabel={t("a11y:leaderboard")}
                        accessibilityRole="button"
                        style={[styles.idleActionButton, { borderColor: activeTheme.borderColor }]}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          router.push({ pathname: "/leaderboard", params: { mode } })
                        }}
                      >
                        <Ionicons name="trophy" size={20} color={activeTheme.warningColor} />
                      </PressableScale>
                      <PressableScale
                        testID="btn-stats"
                        accessibilityLabel={t("a11y:stats")}
                        accessibilityRole="button"
                        style={[styles.idleActionButton, { borderColor: activeTheme.borderColor }]}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          router.push("/stats")
                        }}
                      >
                        <Ionicons
                          name="stats-chart"
                          size={20}
                          color={activeTheme.secondaryTextColor}
                        />
                      </PressableScale>
                      <PressableScale
                        testID="btn-achievements"
                        accessibilityLabel={t("a11y:achievements")}
                        accessibilityRole="button"
                        style={[styles.idleActionButton, { borderColor: activeTheme.borderColor }]}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          router.push("/achievements")
                        }}
                      >
                        <Ionicons name="ribbon" size={20} color={activeTheme.secondaryTextColor} />
                      </PressableScale>
                    </View>
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
                  styles.compactStatusSlot,
                  isTabletPortrait && styles.compactStatusSlotTabletPortrait,
                ]}
              >
                {!isIdle && statusBarNode}
              </View>
              <View
                style={[
                  styles.compactBannerSlot,
                  isTabletPortrait && styles.compactBannerSlotTabletPortrait,
                ]}
              >
                {isIdle && <StreakBanner theme={activeTheme} />}
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

        <Modal
          visible={modeModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!pulsingMode) setModeModalVisible(false)
          }}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              if (!pulsingMode) setModeModalVisible(false)
            }}
          >
            <Pressable
              style={[styles.modalContent, { backgroundColor: activeTheme.backgroundColor }]}
            >
              <Text style={[styles.modalTitle, { color: activeTheme.textColor }]}>
                {t("game:modeSelect")}
              </Text>
              {GAME_MODES.map((entry) => {
                const streak =
                  entry.id === "daily" ? parseInt(loadString(DAILY_CURRENT_STREAK) ?? "0", 10) : 0
                return (
                  <ModeItem
                    key={entry.id}
                    mode={entry}
                    isSelected={mode === entry.id}
                    isPulsing={pulsingMode === entry.id}
                    pulsePhase={pulsePhase}
                    streak={streak}
                    theme={activeTheme}
                    onPress={() => handleModeSelect(entry.id)}
                  />
                )
              })}
            </Pressable>
          </Pressable>
        </Modal>
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
  container: {
    alignItems: "center",
    backgroundColor: UI_COLORS.classicBackground,
    flex: 1,
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
  compactBannerSlot: {
    alignItems: "center",
    justifyContent: "flex-start",
    minHeight: 44,
    width: "100%",
  },
  compactBannerSlotTabletPortrait: {
    minHeight: 52,
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
  compactStatusSlot: {
    alignItems: "center",
    justifyContent: "flex-start",
    minHeight: 36,
    width: "100%",
  },
  compactStatusSlotTabletPortrait: {
    minHeight: 72,
    width: "100%",
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
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: UI_COLORS.backdropModal,
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    borderRadius: 16,
    maxWidth: 380,
    padding: 20,
    width: "85%",
  },
  modalTitle: {
    fontFamily: "Oxanium-Bold",
    fontSize: 20,
    marginBottom: 16,
    textAlign: "center",
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
    elevation: 6,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 16,
    shadowColor: UI_COLORS.shadowBlack,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
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
  wrongFlashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: UI_COLORS.red500,
    zIndex: 10,
  },
})
