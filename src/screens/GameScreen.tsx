import { useEffect, useRef, useState } from "react"
import { View, Text, Pressable, StyleSheet, useWindowDimensions, Modal } from "react-native"
import * as Haptics from "expo-haptics"
import * as Sharing from "expo-sharing"
import { StatusBar } from "expo-status-bar"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { EaseView } from "react-native-ease"

import { AnimatedCountdown } from "@/components/AnimatedCountdown"
import { GameButton } from "@/components/GameButton"
import { GameOverOverlay } from "@/components/GameOverOverlay"
import { ReviewPrompt } from "@/components/ReviewPrompt"
import { TimerRing } from "@/components/TimerRing"
import { SOUND_PACKS } from "@/config/soundPacks"
import { themeIds, gameThemes } from "@/config/themes"
import { useAds } from "@/hooks/useAds"
import { useGameEngine, colors, type GameMode } from "@/hooks/useGameEngine"
import { usePurchases } from "@/hooks/usePurchases"
import { useSoundPack } from "@/hooks/useSoundPack"
import { useStoreReview } from "@/hooks/useStoreReview"
import { useTheme } from "@/hooks/useTheme"
import { useAnalytics } from "@/utils/analytics"
import { loadString } from "@/utils/storage"

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

function ModeItem({
  m,
  isSelected,
  isPulsing,
  pulsePhase,
  streak,
  theme,
  onPress,
}: {
  m: (typeof GAME_MODES)[number]
  isSelected: boolean
  isPulsing: boolean
  pulsePhase: "bright" | "dim"
  streak: number
  theme: { textColor: string; secondaryTextColor: string; borderColor: string }
  onPress: () => void
}) {
  const { t } = useTranslation()

  const pulseBright = isPulsing && pulsePhase === "bright"
  const showGreen = isSelected || pulseBright

  return (
    <Pressable testID={`btn-mode-${m.id}`} onPress={onPress}>
      <EaseView
        animate={{
          scale: pulseBright ? 1.03 : 1,
          backgroundColor: pulseBright
            ? "rgba(34, 197, 94, 0.25)"
            : isSelected
              ? "rgba(34, 197, 94, 0.1)"
              : "rgba(0, 0, 0, 0)",
        }}
        transition={{
          default: { type: "timing", duration: PULSE_DURATION, easing: "easeOut" },
        }}
        style={[
          styles.modeItem,
          { borderColor: showGreen ? "#22c55e" : theme.borderColor },
        ]}
      >
        <Ionicons
          name={m.icon}
          size={22}
          color={showGreen ? "#22c55e" : theme.secondaryTextColor}
        />
        <View style={styles.modeItemText}>
          <Text
            style={[
              styles.modeItemLabel,
              { color: showGreen ? "#22c55e" : theme.textColor },
            ]}
          >
            {t(`game:modes.${m.id}`)}
            {m.id === "daily" && streak > 0 ? ` (${streak}d)` : ""}
          </Text>
          <Text style={[styles.modeItemDesc, { color: theme.secondaryTextColor }]}>
            {t(`game:modeDescriptions.${m.id}`)}
          </Text>
        </View>
        <EaseView
          animate={{ opacity: isSelected ? 1 : 0, scale: isSelected ? 1 : 0.5 }}
          transition={{ default: { type: "spring", stiffness: 400, damping: 15 } }}
        >
          <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
        </EaseView>
      </EaseView>
    </Pressable>
  )
}

export function GameScreen() {
  const { t } = useTranslation()
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const gameSize = Math.min(width * 0.8, height * 0.5)
  const buttonSize = gameSize * 0.4

  const { soundPack, setSoundPack } = useSoundPack()
  const { theme, setTheme } = useTheme()

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
    continueGame,
    handleButtonTouch,
    handleButtonRelease,
    toggleSound,
    playPreview,
    playJingle,
    setMode,
    mode,
    timeRemaining,
    sequencesCompleted,
    buttonPositions,
    isShuffling,
  } = useGameEngine({ oscillatorType: soundPack.oscillatorType, theme })

  const {
    showInterstitial,
    showRewarded,
    rewardedReady,
    incrementGamesPlayed,
    incrementSessionCount,
    adShownThisSession,
  } = useAds()
  const { removeAds, purchaseRemoveAds } = usePurchases()
  const analytics = useAnalytics()
  const { showReviewPrompt, triggerReviewCheck, dismissReviewPrompt, reviewTrigger } =
    useStoreReview()
  const sessionCounted = useRef(false)
  const [modeModalVisible, setModeModalVisible] = useState(false)
  const [settingsModalVisible, setSettingsModalVisible] = useState(false)
  const [pulsingMode, setPulsingMode] = useState<GameMode | null>(null)
  const [pulsePhase, setPulsePhase] = useState<"bright" | "dim">("bright")
  const pulseTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const [soundTogglePop, setSoundTogglePop] = useState(false)
  const [poppingSoundPack, setPoppingSoundPack] = useState<string | null>(null)
  const [poppingTheme, setPoppingTheme] = useState<string | null>(null)
  const isIdle = gameState === "idle"

  // Neon sign color cycling for idle title
  const NEON_COLOR_ORDER = ["red", "blue", "green", "yellow"] as const
  const [neonColorIndex, setNeonColorIndex] = useState(0)
  const neonIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isIdle) {
      setNeonColorIndex(0)
      neonIntervalRef.current = setInterval(() => {
        setNeonColorIndex((prev) => (prev + 1) % 4)
      }, 2000)
    } else {
      if (neonIntervalRef.current) {
        clearInterval(neonIntervalRef.current)
        neonIntervalRef.current = null
      }
    }
    return () => {
      if (neonIntervalRef.current) {
        clearInterval(neonIntervalRef.current)
        neonIntervalRef.current = null
      }
    }
  }, [isIdle])

  const titleColor = isIdle
    ? theme.buttonColors[NEON_COLOR_ORDER[neonColorIndex]].color
    : theme.textColor

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
      pulseTimers.current.push(
        setTimeout(() => setPulsePhase("dim"), delay + PULSE_DURATION),
      )
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
        analytics.trackGameCompleted(score, level, true)
        triggerReviewCheck("new_high_score", adShownThisSession)
      }

      // Check daily streak milestones (3-day, 7-day)
      if (mode === "daily") {
        const streak = parseInt(loadString("ecomi:daily:currentStreak") ?? "0", 10)
        if (streak === 3 || streak === 7) {
          triggerReviewCheck(`streak_${streak}`, adShownThisSession)
        }
      }
    }

    if (prevGameState.current !== "idle" && gameState === "idle") {
      playJingle()
    }

    prevGameState.current = gameState
  }, [gameState])

  async function handleStartGame() {
    // Show interstitial before starting next game (not on game over)
    const adShown = await showInterstitial(level, removeAds)
    if (adShown) {
      analytics.trackAdShown("interstitial", "game_over")
    }

    analytics.trackGameStarted()
    startGame()
  }

  async function handleContinue() {
    const shown = await showRewarded()
    if (shown) {
      analytics.trackAdRewardedWatched("continue")
      continueGame()
    }
  }

  function handleReviewResponse(response: "love_it" | "not_really") {
    analytics.trackReviewPromptShown(reviewTrigger)
    analytics.trackReviewPromptResponse(response)
  }

  async function handleShare() {
    analytics.trackShareTapped(score, level)
    const message = t("game:shareMessage", { level, score })
    const isAvailable = await Sharing.isAvailableAsync()
    if (isAvailable) {
      await Sharing.shareAsync("https://ecomi.app", {
        dialogTitle: message,
        mimeType: "text/plain",
      })
    }
  }

  async function handleRemoveAds() {
    analytics.trackIapInitiated("ecomi_remove_ads")
    const success = await purchaseRemoveAds()
    if (success) {
      analytics.trackIapCompleted("ecomi_remove_ads")
    }
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
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundColor,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <StatusBar style={theme.statusBarStyle} backgroundColor={theme.backgroundColor} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setModeModalVisible(true)
          }}
          disabled={!isIdle}
          style={styles.headerAction}
        >
          <Ionicons
            name="game-controller"
            size={26}
            color={isIdle ? theme.textColor : theme.secondaryTextColor}
            style={{ opacity: isIdle ? 1 : 0.4 }}
          />
        </Pressable>
        <EaseView
          animate={{ scale: isIdle ? 1.03 : 1 }}
          transition={{
            default: { type: "timing", duration: 1500, easing: "easeInOut", loop: "reverse" },
          }}
        >
          <Text style={[styles.title, { color: titleColor }]}>{t("game:title")}</Text>
        </EaseView>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setSettingsModalVisible(true)
          }}
          disabled={!isIdle}
          style={styles.headerAction}
        >
          <Ionicons
            name="settings-outline"
            size={26}
            color={isIdle ? theme.textColor : theme.secondaryTextColor}
            style={{ opacity: isIdle ? 1 : 0.4 }}
          />
        </Pressable>
      </View>

      {/* Score Display */}
      <View style={styles.scoreContainer}>
        <View style={[styles.scoreBox, { backgroundColor: theme.surfaceColor }]}>
          <Text style={[styles.scoreLabel, { color: theme.secondaryTextColor }]}>
            {t("game:level")}
          </Text>
          <Text testID="text-level" style={[styles.scoreValue, { color: theme.textColor }]}>
            {level}
          </Text>
        </View>
        <View style={[styles.scoreBox, { backgroundColor: theme.surfaceColor }]}>
          <Text style={[styles.scoreLabel, { color: theme.secondaryTextColor }]}>
            {t("game:score")}
          </Text>
          <Text testID="text-score" style={[styles.scoreValue, { color: theme.textColor }]}>
            {score}
          </Text>
        </View>
        <View style={[styles.scoreBox, { backgroundColor: theme.surfaceColor }]}>
          <Text style={[styles.scoreLabel, { color: theme.secondaryTextColor }]}>
            {t("game:best")}
          </Text>
          <Text testID="text-high-score" style={[styles.scoreValue, { color: theme.textColor }]}>
            {highScore}
          </Text>
        </View>
      </View>

      {/* Game Board */}
      <View style={styles.gameBoard}>
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
              themeColor={theme.buttonColors[color].color}
              themeActiveColor={theme.buttonColors[color].activeColor}
            />
          ))}

          {/* Center Circle */}
          <View style={styles.centerCircleWrapper}>
            {showTimerRing && (
              <View style={styles.timerRingContainer}>
                <TimerRing progress={timeRemaining! / 60} size={80} strokeWidth={4} theme={theme} />
              </View>
            )}
            <View
              style={[
                styles.centerCircle,
                { backgroundColor: theme.backgroundColor, borderColor: theme.borderColor },
                showTimerRing && styles.centerCircleNoRing,
              ]}
            >
              {mode === "timed" && timeRemaining !== null && gameState !== "idle" ? (
                <AnimatedCountdown
                  value={Math.ceil(timeRemaining)}
                  color={timeRemaining <= 10 ? "#ef4444" : theme.textColor}
                  style={styles.centerTimer}
                />
              ) : (
                <Text style={[styles.centerText, { color: theme.textColor }]}>
                  {t("game:title")}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        {gameState === "idle" && (
          <Pressable testID="btn-start" style={styles.startButton} onPress={handleStartGame}>
            <Ionicons name="play" size={24} color="white" />
            <Text style={styles.buttonText}>{t("game:startGame")}</Text>
          </Pressable>
        )}

        {(gameState === "showing" || gameState === "waiting") && (
          <Pressable style={styles.resetButton} onPress={resetGame}>
            <Ionicons name="stop" size={24} color="white" />
            <Text style={styles.buttonText}>{t("game:reset")}</Text>
          </Pressable>
        )}
      </View>

      {/* Game Status */}
      <View style={styles.statusContainer}>
        {gameState === "idle" && (
          <Text style={[styles.statusText, { color: theme.secondaryTextColor }]}>
            {t("game:pressStart")}
          </Text>
        )}
        {gameState === "showing" && (
          <Text style={[styles.statusText, styles.showingText]}>{t("game:watchSequence")}</Text>
        )}
        {gameState === "waiting" && (
          <Text style={[styles.statusText, styles.waitingText]}>{t("game:repeatSequence")}</Text>
        )}
        <View style={styles.progressRow}>
          {(gameState === "showing" || gameState === "waiting") &&
            sequence.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  gameState === "waiting" && i < playerSequence.length && styles.progressDotFilled,
                ]}
              />
            ))}
        </View>
      </View>

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
          <Pressable style={[styles.modalContent, { backgroundColor: theme.backgroundColor }]}>
            <Text style={[styles.modalTitle, { color: theme.textColor }]}>
              {t("game:modeSelect")}
            </Text>
            {GAME_MODES.map((m) => {
              const streak =
                m.id === "daily" ? parseInt(loadString("ecomi:daily:currentStreak") ?? "0", 10) : 0
              return (
                <ModeItem
                  key={m.id}
                  m={m}
                  isSelected={mode === m.id}
                  isPulsing={pulsingMode === m.id}
                  pulsePhase={pulsePhase}
                  streak={streak}
                  theme={theme}
                  onPress={() => handleModeSelect(m.id)}
                />
              )
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Settings Modal */}
      <Modal
        visible={settingsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSettingsModalVisible(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.backgroundColor }]}>
            <Text style={[styles.modalTitle, { color: theme.textColor }]}>
              {t("game:settings")}
            </Text>

            {/* Sound Toggle */}
            <View style={styles.settingsSection}>
              <Text style={[styles.settingsSectionLabel, { color: theme.secondaryTextColor }]}>
                {t("game:soundToggle")}
              </Text>
              <Pressable
                testID="btn-sound-toggle"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  toggleSound()
                  setSoundTogglePop(true)
                  setTimeout(() => setSoundTogglePop(false), 150)
                }}
              >
                <EaseView
                  animate={{ scale: soundTogglePop ? 1.05 : 1 }}
                  transition={{ default: { type: "timing", duration: 75, easing: "easeOut" } }}
                  style={[styles.soundToggleBtn, soundEnabled && styles.soundToggleBtnActive]}
                >
                  <Ionicons
                    name={soundEnabled ? "volume-high" : "volume-mute"}
                    size={20}
                    color="white"
                  />
                  <Text style={styles.soundToggleText}>{soundEnabled ? "On" : "Off"}</Text>
                </EaseView>
              </Pressable>
            </View>

            {/* Sound Pack */}
            <View style={styles.settingsSection}>
              <Text style={[styles.settingsSectionLabel, { color: theme.secondaryTextColor }]}>
                {t("game:soundPack")}
              </Text>
              <View style={styles.settingsRow}>
                {SOUND_PACKS.map((pack) => {
                  const isSelected = pack.id === soundPack.id
                  const isPopping = poppingSoundPack === pack.id
                  return (
                    <Pressable
                      key={pack.id}
                      testID={`btn-sound-pack-${pack.id}`}
                      onPress={() => {
                        if (pack.id === soundPack.id) return
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        setSoundPack(pack.id)
                        playPreview(pack.oscillatorType)
                        setPoppingSoundPack(pack.id)
                        setTimeout(() => setPoppingSoundPack(null), 150)
                      }}
                    >
                      <EaseView
                        animate={{ scale: isPopping ? 1.08 : 1 }}
                        transition={{
                          default: { type: "spring", stiffness: 400, damping: 15 },
                        }}
                        style={[
                          styles.selectorButton,
                          { borderColor: isSelected ? "#22c55e" : theme.borderColor },
                          isSelected && styles.selectorButtonActive,
                        ]}
                      >
                        <Text
                          style={{
                            color: isSelected ? "#22c55e" : theme.secondaryTextColor,
                            fontFamily: "Oxanium-Regular",
                            fontSize: 12,
                          }}
                        >
                          {pack.name}
                        </Text>
                      </EaseView>
                    </Pressable>
                  )
                })}
              </View>
            </View>

            {/* Theme */}
            <View style={styles.settingsSection}>
              <Text style={[styles.settingsSectionLabel, { color: theme.secondaryTextColor }]}>
                {t("game:theme")}
              </Text>
              <View style={styles.settingsRow}>
                {themeIds.map((id) => {
                  const isPopping = poppingTheme === id
                  return (
                    <Pressable
                      key={id}
                      testID={`btn-theme-${id}`}
                      onPress={() => {
                        if (id === theme.id) return
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        setTheme(id)
                        setPoppingTheme(id)
                        setTimeout(() => setPoppingTheme(null), 150)
                      }}
                    >
                      <EaseView
                        animate={{ scale: isPopping ? 1.08 : 1 }}
                        transition={{
                          default: { type: "spring", stiffness: 400, damping: 15 },
                        }}
                        style={[
                          styles.themeCircle,
                          { backgroundColor: gameThemes[id].buttonColors.red.color },
                          id === theme.id && styles.themeCircleSelected,
                        ]}
                      />
                    </Pressable>
                  )
                })}
              </View>
            </View>

            {/* Remove Ads */}
            {!removeAds && (
              <View style={styles.settingsSection}>
                <Pressable style={styles.removeAdsBtn} onPress={handleRemoveAds}>
                  <Ionicons name="shield-checkmark" size={18} color="white" />
                  <Text style={styles.removeAdsBtnText}>{t("game:removeAds")}</Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <GameOverOverlay
        visible={gameState === "gameover"}
        score={score}
        level={level}
        highScore={highScore}
        isNewHighScore={isNewHighScore}
        showRemoveAds={!removeAds && adShownThisSession}
        showContinue={rewardedReady && !continuedThisGame}
        onPlayAgain={handleStartGame}
        onContinue={handleContinue}
        onShare={handleShare}
        onRemoveAds={handleRemoveAds}
        onHome={resetGame}
      />

      <ReviewPrompt
        visible={showReviewPrompt}
        onDismiss={dismissReviewPrompt}
        onResponse={handleReviewResponse}
      />
    </View>
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
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingHorizontal: 20,
    width: "100%",
  },
  headerAction: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
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
    maxWidth: 360,
    padding: 20,
    width: "100%",
  },
  modalTitle: {
    fontFamily: "Oxanium-Bold",
    fontSize: 20,
    marginBottom: 16,
    textAlign: "center",
  },
  modeItem: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modeItemDesc: {
    fontFamily: "Oxanium-Regular",
    fontSize: 12,
    marginTop: 2,
  },
  modeItemLabel: {
    fontFamily: "Oxanium-SemiBold",
    fontSize: 15,
  },
  modeItemText: {
    flex: 1,
  },
  progressDot: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  progressDotFilled: {
    backgroundColor: "#22c55e",
  },
  progressRow: {
    flexDirection: "row",
    gap: 6,
    height: 18,
    justifyContent: "center",
    marginTop: 8,
  },
  removeAdsBtn: {
    alignItems: "center",
    backgroundColor: "#8b5cf6",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  removeAdsBtnText: {
    color: "white",
    fontFamily: "Oxanium-SemiBold",
    fontSize: 14,
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
  selectorButton: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectorButtonActive: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
  },
  settingsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  settingsSection: {
    marginBottom: 16,
  },
  settingsSectionLabel: {
    fontFamily: "Oxanium-Medium",
    fontSize: 13,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  showingText: {
    color: "#fbbf24",
    fontFamily: "Oxanium-Regular",
  },
  soundToggleBtn: {
    alignItems: "center",
    backgroundColor: "#6b7280",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  soundToggleBtnActive: {
    backgroundColor: "#22c55e",
  },
  soundToggleText: {
    color: "white",
    fontFamily: "Oxanium-SemiBold",
    fontSize: 14,
  },
  startButton: {
    alignItems: "center",
    backgroundColor: "#22c55e",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  statusContainer: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  statusText: {
    color: "#a0a0a0",
    fontFamily: "Oxanium-Regular",
    fontSize: 16,
    textAlign: "center",
  },
  themeCircle: {
    borderColor: "transparent",
    borderRadius: 16,
    borderWidth: 3,
    height: 32,
    width: 32,
  },
  themeCircleSelected: {
    borderColor: "#ffffff",
  },
  timerRingContainer: {
    left: 0,
    position: "absolute",
    top: 0,
  },
  title: {
    color: "white",
    fontFamily: "Oxanium-Bold",
    fontSize: 36,
    letterSpacing: 4,
  },
  waitingText: {
    color: "#22c55e",
    fontFamily: "Oxanium-Regular",
  },
})
