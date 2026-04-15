import { useEffect, useRef, useState } from "react"
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Modal,
} from "react-native"
import * as Haptics from "expo-haptics"
import { useRouter, useFocusEffect } from "expo-router"
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
import { StreakBanner } from "@/components/StreakBanner"
import { InitialEntryModal } from "@/components/InitialEntryModal"
import { PressableScale } from "@/components/PressableScale"
import { TimerRing } from "@/components/TimerRing"
import { DAILY_CURRENT_STREAK, ONBOARDING_COMPLETED, STATS_GAMES_PLAYED } from "@/config/storageKeys"
import { useAds } from "@/hooks/useAds"
import { useGameEngine, colors, type GameMode } from "@/hooks/useGameEngine"
import { useHighScores, type HighScoreEntry } from "@/hooks/useHighScores"
import { usePurchases } from "@/hooks/usePurchases"
import { useSoundPack } from "@/hooks/useSoundPack"
import { useNotifications, shouldShowNotificationPrompt } from "@/hooks/useNotifications"
import { useTheme } from "@/hooks/useTheme"
import { useGameOverStore } from "@/stores/gameOverStore"
import { usePendingActionStore } from "@/stores/pendingActionStore"
import { GameThemeProvider } from "@/theme/GameThemeContext"
import { useAnalytics } from "@/utils/analytics"
import { loadString, saveString } from "@/utils/storage"

const GAME_MODES: { id: GameMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "classic", label: "Classic", icon: "game-controller" },
  { id: "daily", label: "Daily", icon: "calendar" },
  { id: "timed", label: "Timed", icon: "timer" },
  { id: "reverse", label: "Reverse", icon: "swap-horizontal" },
  { id: "chaos", label: "Chaos", icon: "shuffle" },
]

const PULSE_DURATION = 150
const PULSE_COUNT = 3
const DISMISS_DELAY = 200

export function GameScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const gameSize = Math.min(width * 0.8, height * 0.5)
  const buttonSize = gameSize * 0.4

  const { soundPack } = useSoundPack()
  const { activeTheme } = useTheme()
  const analytics = useAnalytics()

  const {
    gameState,
    score,
    level,
    highScore,
    activeButton,
    soundEnabled,
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
    toggleSound,
    playPreview,
    playJingle,
    playGameOverJingle,
    playHighScoreJingle,
    setMode,
    mode,
    timeRemaining,
    sequencesCompleted,
    buttonPositions,
    isShuffling,
    inputTimeRemaining,
    wrongFlash,
    timerDelta,
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
    if (pendingAction === "play_again") handleStartGame()
    else if (pendingAction === "continue") handleContinue()
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
  const { isHighScore: checkIsHighScore, addHighScore } = useHighScores()
  const { rescheduleAfterGameOver } = useNotifications()
  const sessionCounted = useRef(false)
  const [modeModalVisible, setModeModalVisible] = useState(false)
  const [showInitialEntry, setShowInitialEntry] = useState(false)
  const pendingGameOver = useRef(false)
  const leaderboardRecorded = useRef(false)
  const previousHighScoreRef = useRef(highScore)
  const [pulsingMode, setPulsingMode] = useState<GameMode | null>(null)
  const [pulsePhase, setPulsePhase] = useState<"bright" | "dim">("bright")
  const pulseTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const isIdle = gameState === "idle"
  const [onboardingDone, setOnboardingDone] = useState(() => loadString(ONBOARDING_COMPLETED) === "true")
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

    // Clear any in-flight pulse timers
    pulseTimers.current.forEach(clearTimeout)
    pulseTimers.current = []

    setMode(id)
    setPulsingMode(id)
    setPulsePhase("bright")

    // Schedule pulse sequence: bright→dim→bright→dim→bright→dim then dismiss
    let delay = 0
    for (let i = 0; i < PULSE_COUNT; i++) {
      // dim phase
      pulseTimers.current.push(setTimeout(() => setPulsePhase("dim"), delay + PULSE_DURATION))
      // bright phase (except after last pulse)
      if (i < PULSE_COUNT - 1) {
        pulseTimers.current.push(
          setTimeout(() => setPulsePhase("bright"), delay + PULSE_DURATION * 2),
        )
      }
      delay += PULSE_DURATION * 2
    }

    // After pulses finish, clean up and dismiss
    pulseTimers.current.push(
      setTimeout(() => {
        setPulsingMode(null)
        setModeModalVisible(false)
      }, delay + DISMISS_DELAY),
    )
  }

  // Clean up pulse timers on unmount
  useEffect(() => {
    return () => pulseTimers.current.forEach(clearTimeout)
  }, [])

  // Count session on first mount
  useEffect(() => {
    if (!sessionCounted.current) {
      incrementSessionCount()
      sessionCounted.current = true
    }
  }, [])

  // Play idle jingle on initial mount
  const mountJingleFired = useRef(false)
  useEffect(() => {
    if (!mountJingleFired.current && gameState === "idle") {
      mountJingleFired.current = true
      playJingle()
    }
  }, [])

  // Track game over and idle-entry jingle
  const prevGameState = useRef(gameState)
  useEffect(() => {
    if (prevGameState.current !== "gameover" && gameState === "gameover") {
      incrementGamesPlayed()
      analytics.trackGameOver(score, level)

      if (isNewHighScore) {
        playHighScoreJingle()
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        analytics.trackGameCompleted(score, level, true)
      } else {
        playGameOverJingle()
      }

      // Check if score qualifies for local top 10 — show initials modal first if so
      if (checkIsHighScore(score, mode) && !leaderboardRecorded.current) {
        leaderboardRecorded.current = true
        pendingGameOver.current = true
        setShowInitialEntry(true)
      }

      rescheduleAfterGameOver()

      // Navigate to game-over screen only if initials modal isn't pending
      // (if it is, handleInitialSubmit will navigate after submission).
      // Skip the game-over screen entirely for a score of 0 — nothing to show,
      // just bounce back to the main menu.
      if (!pendingGameOver.current) {
        if (score === 0) {
          resetGame()
        } else {
          navigateToGameOver()
        }
      }
    }

    if (prevGameState.current !== "idle" && gameState === "idle") {
      playJingle()
      if (shouldShowNotificationPrompt()) {
        router.push("/notifications")
      }
    }

    prevGameState.current = gameState
  }, [gameState])

  async function handleStartGame() {
    leaderboardRecorded.current = false
    previousHighScoreRef.current = highScore
    const adShown = await showInterstitial(level, removeAds)
    if (adShown) {
      analytics.trackAdShown("interstitial", "game_over")
    }

    analytics.trackGameStarted()
    startGame()
  }

  function navigateToGameOver() {
    useGameOverStore.getState().setGameOver({
      score,
      level,
      highScore,
      previousHighScore: previousHighScoreRef.current,
      isNewHighScore,
      mode,
      showRemoveAds: !removeAds && adShownThisSession,
      showContinue: rewardedReady && !continuedThisGame,
    })
    router.push("/game-over")
  }

  async function handleContinue() {
    const shown = await showRewarded()
    if (shown) {
      analytics.trackAdRewardedWatched("continue")
      continueGame()
    } else {
      // Ad not earned — return to game-over so user can try again or quit
      navigateToGameOver()
    }
  }

  function handleInitialSubmit(initials: string) {
    const entry: HighScoreEntry = {
      initials,
      score,
      level,
      date: new Date().toISOString(),
      mode,
    }
    addHighScore(entry)
    setShowInitialEntry(false)
    pendingGameOver.current = false
    navigateToGameOver()
  }


  const showTimerRing = mode === "timed" && timeRemaining !== null && gameState !== "idle"

  const gameContainerStyle = {
    backgroundColor: "rgba(0, 0, 0, 0.5)" as const,
    borderColor: "rgba(255, 255, 255, 0.2)" as const,
    borderRadius: gameSize / 2,
    borderWidth: 4,
    height: gameSize,
    position: "relative" as const,
    width: gameSize,
  }

  return (
    <GameThemeProvider value={activeTheme}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: activeTheme.backgroundColor,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <StatusBar style={activeTheme.statusBarStyle} backgroundColor={activeTheme.backgroundColor} />

      <GameHeader
        mode={mode}
        gameState={gameState}
        isIdle={isIdle}
        theme={activeTheme}
        onModePress={() => setModeModalVisible(true)}
        onSettingsPress={() => router.push("/settings")}
      />

      {/* Score Display */}
      <View style={styles.scoreContainer}>
        <View style={[styles.scoreBox, { backgroundColor: activeTheme.surfaceColor }]}>
          <Text style={[styles.scoreLabel, { color: activeTheme.secondaryTextColor }]}>
            {t("game:level")}
          </Text>
          <AnimatedNumber
            testID="text-level"
            accessibilityLabel={t("game:level")}
            value={level}
            style={[styles.scoreValue, { color: activeTheme.textColor }]}
          />
        </View>
        <View style={[styles.scoreBox, { backgroundColor: activeTheme.surfaceColor }]}>
          <Text style={[styles.scoreLabel, { color: activeTheme.secondaryTextColor }]}>
            {t("game:score")}
          </Text>
          <AnimatedNumber
            testID="text-score"
            accessibilityLabel={t("game:score")}
            value={score}
            style={[styles.scoreValue, { color: activeTheme.textColor }]}
          />
        </View>
        <View style={[styles.scoreBox, { backgroundColor: activeTheme.surfaceColor }]}>
          <Text style={[styles.scoreLabel, { color: activeTheme.secondaryTextColor }]}>
            {t("game:best")}
          </Text>
          <AnimatedNumber
            testID="text-high-score"
            accessibilityLabel={t("game:best")}
            value={highScore}
            style={[styles.scoreValue, { color: activeTheme.textColor }]}
          />
        </View>
      </View>

      {/* Reserved space prevents layout shift when tooltip appears on first run */}
      <View style={styles.onboardingSlot}>
        <OnboardingTooltip visible={showOnboardingTooltip} theme={activeTheme} />
      </View>

      {/* Game Board */}
      <View style={styles.gameBoard}>
        {wrongFlash && (
          <EaseView
            style={styles.wrongFlashOverlay}
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
              isActive={activeButton === color}
              disabled={gameState !== "waiting" || isShuffling}
              buttonSize={buttonSize}
              gameSize={gameSize}
              isShuffling={isShuffling}
              onPressIn={() => handleButtonTouch(color)}
              onPressOut={() => handleButtonRelease(color)}
              themeColor={activeTheme.buttonColors[color].color}
              themeActiveColor={activeTheme.buttonColors[color].activeColor}
            />
          ))}

          {/* Center Circle */}
          <View style={styles.centerCircleWrapper}>
            {showTimerRing && (
              <View style={styles.timerRingContainer}>
                <TimerRing
                  progress={timeRemaining! / 60}
                  size={80}
                  strokeWidth={4}
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
                },
                showTimerRing && styles.centerCircleNoRing,
              ]}
            >
              {mode === "timed" && timeRemaining !== null && gameState !== "idle" ? (
                <AnimatedCountdown
                  value={Math.ceil(timeRemaining)}
                  color={timeRemaining <= 10 ? "#ef4444" : activeTheme.textColor}
                  style={styles.centerTimer}
                />
              ) : inputTimeRemaining !== null ? (
                <AnimatedCountdown
                  value={inputTimeRemaining}
                  color={inputTimeRemaining <= 3 ? "#ef4444" : "#fbbf24"}
                  style={styles.centerTimer}
                />
              ) : (
                <Text style={[styles.centerText, { color: activeTheme.textColor }]}>
                  {t("game:title")}
                </Text>
              )}
            </View>
            {timerDelta !== null && (
              <EaseView
                // Pop in at 1.2x and fully opaque, then drift up + shrink + fade
                key={`${timerDelta}-${Date.now()}`}
                initialAnimate={{ opacity: 1, scale: 1.2, translateY: 0 }}
                animate={{ opacity: 0, scale: 1, translateY: -70 }}
                transition={{
                  default: { type: "timing", duration: 900, easing: "easeOut" },
                }}
                style={styles.timerDeltaFloat}
              >
                <View style={[styles.timerDeltaPill, { backgroundColor: activeTheme.backgroundColor }]}>
                  <Text
                    style={[
                      styles.timerDeltaText,
                      { color: timerDelta > 0 ? activeTheme.accentColor : activeTheme.destructiveColor },
                    ]}
                  >
                    {timerDelta > 0 ? `+${timerDelta}s` : `${timerDelta}s`}
                  </Text>
                </View>
              </EaseView>
            )}
          </View>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        {gameState === "idle" && (
          <>
            <StreakBanner theme={activeTheme} />
            <EaseView
              animate={{ scale: 1.02 }}
              transition={{
                default: { type: "timing", duration: 1200, easing: "easeInOut", loop: "reverse" },
              }}
              style={styles.startButtonWrapper}
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
          </>
        )}

        {(gameState === "showing" || gameState === "waiting") && (
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
        )}
      </View>

      <GameStatusBar
        gameState={gameState}
        sequence={sequence}
        playerSequence={playerSequence}
        theme={activeTheme}
      />

      {/* Mode Selector Modal */}
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
            {GAME_MODES.map((m) => {
              const streak =
                m.id === "daily" ? parseInt(loadString(DAILY_CURRENT_STREAK) ?? "0", 10) : 0
              return (
                <ModeItem
                  key={m.id}
                  mode={m}
                  isSelected={mode === m.id}
                  isPulsing={pulsingMode === m.id}
                  pulsePhase={pulsePhase}
                  streak={streak}
                  theme={activeTheme}
                  onPress={() => handleModeSelect(m.id)}
                />
              )
            })}
          </Pressable>
        </Pressable>
      </Modal>

      <InitialEntryModal
        visible={showInitialEntry}
        score={score}
        level={level}
        theme={activeTheme}
        onSubmit={handleInitialSubmit}
        onDismiss={() => {
          setShowInitialEntry(false)
          pendingGameOver.current = false
          // User skipped initials — still route to the game-over screen
          // (score isn't recorded to leaderboard, but the overlay should still show)
          navigateToGameOver()
        }}
      />

      </View>
    </GameThemeProvider>
  )
}

const styles = StyleSheet.create({
  buttonText: {
    color: "white",
    fontFamily: "Oxanium-SemiBold",
    fontSize: 16,
    fontWeight: "600",
  },
  centerCircle: {
    alignItems: "center",
    borderRadius: 40,
    borderWidth: 4,
    height: 80,
    justifyContent: "center",
    width: 80,
  },
  centerCircleNoRing: {
    borderRadius: 36,
    borderWidth: 0,
    height: 72,
    width: 72,
  },
  centerCircleWrapper: {
    alignItems: "center",
    height: 80,
    justifyContent: "center",
    left: "50%",
    position: "absolute",
    top: "50%",
    transform: [{ translateX: -40 }, { translateY: -40 }],
    width: 80,
  },
  centerText: {
    color: "white",
    fontFamily: "Oxanium-Regular",
    fontSize: 10,
  },
  centerTimer: {
    fontFamily: "Oxanium-Bold",
    fontSize: 24,
  },
  onboardingSlot: {
    alignItems: "center",
    height: 48,
    justifyContent: "center",
  },
  timerDeltaFloat: {
    alignItems: "center",
    left: "50%",
    position: "absolute",
    top: "50%",
    transform: [{ translateX: -50 }, { translateY: -60 }],
    width: 100,
  },
  timerDeltaPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  timerDeltaText: {
    fontFamily: "Oxanium-Bold",
    fontSize: 20,
    textAlign: "center",
  },
  container: {
    alignItems: "center",
    backgroundColor: "#1a1a2e",
    flex: 1,
    justifyContent: "center",
    paddingVertical: 20,
  },
  controlsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  gameBoard: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
  },
  gestureRoot: {
    flex: 1,
  },
  wrongFlashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#ef4444",
    borderRadius: 999,
    zIndex: 10,
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
    marginTop: 16,
  },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
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
  resetButton: {
    alignItems: "center",
    backgroundColor: "#ef4444",
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
  scoreContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 30,
    width: "80%",
  },
  scoreLabel: {
    color: "#a0a0a0",
    fontFamily: "Oxanium-Regular",
    fontSize: 12,
    marginBottom: 5,
  },
  scoreValue: {
    color: "white",
    fontFamily: "Oxanium-Bold",
    fontSize: 24,
  },
  showingText: {
    color: "#fbbf24",
    fontFamily: "Oxanium-Regular",
  },
  startButton: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  startButtonText: {
    color: "white",
    fontFamily: "Oxanium-Bold",
    fontSize: 18,
  },
  startButtonWrapper: {
    width: "70%",
  },
  timerRingContainer: {
    left: 0,
    position: "absolute",
    top: 0,
  },
  waitingText: {
    color: "#22c55e",
    fontFamily: "Oxanium-Regular",
  },
})
