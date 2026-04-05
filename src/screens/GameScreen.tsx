import { useEffect, useRef } from "react"
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from "react-native"

import { Ionicons } from "@expo/vector-icons"
import * as Sharing from "expo-sharing"
import { StatusBar } from "expo-status-bar"
import { useTranslation } from "react-i18next"

import { GameButton } from "@/components/GameButton"
import { GameOverOverlay } from "@/components/GameOverOverlay"
import { ReviewPrompt } from "@/components/ReviewPrompt"
import { SOUND_PACKS } from "@/config/soundPacks"
import { themeIds, gameThemes } from "@/config/themes"
import { useAds } from "@/hooks/useAds"
import { useGameEngine, colors, type GameMode } from "@/hooks/useGameEngine"
import { useSoundPack } from "@/hooks/useSoundPack"
import { usePurchases } from "@/hooks/usePurchases"
import { useStoreReview } from "@/hooks/useStoreReview"
import { useTheme } from "@/hooks/useTheme"
import { useAnalytics } from "@/utils/analytics"

const GAME_MODES: { id: GameMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "classic", label: "Classic", icon: "game-controller" },
  { id: "daily", label: "Daily", icon: "calendar" },
  { id: "timed", label: "Timed", icon: "timer" },
  { id: "reverse", label: "Reverse", icon: "swap-horizontal" },
  { id: "chaos", label: "Chaos", icon: "shuffle" },
]

export function GameScreen() {
  const { t } = useTranslation()
  const { width, height } = useWindowDimensions()
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
    setMode,
    mode,
    timeRemaining,
    sequencesCompleted,
    buttonPositions,
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

  // Count session on first mount
  useEffect(() => {
    if (!sessionCounted.current) {
      incrementSessionCount()
      sessionCounted.current = true
    }
  }, [])

  // Track game over (no ad here — interstitial shows on Play Again)
  const prevGameState = useRef(gameState)
  useEffect(() => {
    if (prevGameState.current !== "gameover" && gameState === "gameover") {
      incrementGamesPlayed()
      analytics.trackGameOver(score, level)

      if (isNewHighScore) {
        analytics.trackGameCompleted(score, level, true)
        triggerReviewCheck("new_high_score", adShownThisSession)
      }
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
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar style={theme.statusBarStyle} backgroundColor={theme.backgroundColor} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.textColor }]}>{t("game:title")}</Text>
        <Text style={[styles.subtitle, { color: theme.secondaryTextColor }]}>{t("game:subtitle")}</Text>
      </View>

      {/* Score Display */}
      <View style={styles.scoreContainer}>
        <View style={styles.scoreBox}>
          <Text style={[styles.scoreLabel, { color: theme.secondaryTextColor }]}>{t("game:level")}</Text>
          <Text testID="text-level" style={[styles.scoreValue, { color: theme.textColor }]}>{level}</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={[styles.scoreLabel, { color: theme.secondaryTextColor }]}>{t("game:score")}</Text>
          <Text testID="text-score" style={[styles.scoreValue, { color: theme.textColor }]}>{score}</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={[styles.scoreLabel, { color: theme.secondaryTextColor }]}>{t("game:best")}</Text>
          <Text testID="text-high-score" style={[styles.scoreValue, { color: theme.textColor }]}>{highScore}</Text>
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
              disabled={gameState !== "waiting"}
              buttonSize={buttonSize}
              gameSize={gameSize}
              onPressIn={() => handleButtonTouch(color)}
              onPressOut={() => handleButtonRelease(color)}
              themeColor={theme.buttonColors[color].color}
              themeActiveColor={theme.buttonColors[color].activeColor}
            />
          ))}

          {/* Center Circle */}
          <View style={styles.centerCircle}>
            {mode === "timed" && timeRemaining !== null && gameState !== "idle" ? (
              <Text style={[styles.centerTimer, { color: timeRemaining <= 10 ? "#ef4444" : theme.textColor }]}>
                {timeRemaining}
              </Text>
            ) : (
              <Text style={[styles.centerText, { color: theme.textColor }]}>{t("game:title")}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        {gameState === "idle" && (
          <>
            <TouchableOpacity testID="btn-start" style={styles.startButton} onPress={handleStartGame}>
              <Ionicons name="play" size={24} color="white" />
              <Text style={styles.buttonText}>{t("game:startGame")}</Text>
            </TouchableOpacity>

            <View style={styles.soundPackRow}>
              {SOUND_PACKS.map((pack) => {
                const isSelected = pack.id === soundPack.id
                return (
                  <TouchableOpacity
                    key={pack.id}
                    testID={`btn-sound-pack-${pack.id}`}
                    style={[
                      styles.selectorButton,
                      { borderColor: isSelected ? "#22c55e" : theme.borderColor },
                      isSelected && styles.selectorButtonActive,
                    ]}
                    onPress={() => {
                      setSoundPack(pack.id)
                      playPreview(pack.oscillatorType)
                    }}
                  >
                    <Text style={{ color: isSelected ? "#22c55e" : theme.secondaryTextColor, fontFamily: "Oxanium-Regular", fontSize: 12 }}>
                      {pack.name}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <View style={styles.themeRow}>
              {themeIds.map((id) => (
                <TouchableOpacity
                  key={id}
                  testID={`btn-theme-${id}`}
                  style={[
                    styles.themeCircle,
                    { backgroundColor: gameThemes[id].buttonColors.red.color },
                    id === theme.id && styles.themeCircleSelected,
                  ]}
                  onPress={() => setTheme(id)}
                />
              ))}
            </View>

            <View style={styles.modeRow}>
              {GAME_MODES.map((m) => {
                const isSelected = mode === m.id
                return (
                  <TouchableOpacity
                    key={m.id}
                    testID={`btn-mode-${m.id}`}
                    style={[
                      styles.selectorButton,
                      { borderColor: isSelected ? "#22c55e" : theme.borderColor, flexDirection: "row", gap: 4 },
                      isSelected && styles.selectorButtonActive,
                    ]}
                    onPress={() => setMode(m.id)}
                  >
                    <Ionicons name={m.icon} size={14} color={isSelected ? "#22c55e" : theme.secondaryTextColor} />
                    <Text style={{ color: isSelected ? "#22c55e" : theme.secondaryTextColor, fontFamily: "Oxanium-Regular", fontSize: 11 }}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </>
        )}


        {(gameState === "showing" || gameState === "waiting") && (
          <TouchableOpacity style={styles.resetButton} onPress={resetGame}>
            <Ionicons name="stop" size={24} color="white" />
            <Text style={styles.buttonText}>{t("game:reset")}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity testID="btn-sound-toggle" style={styles.soundButton} onPress={toggleSound}>
          <Ionicons name={soundEnabled ? "volume-high" : "volume-mute"} size={24} color="white" />
          <Text style={styles.buttonText}>{t("game:sound")}</Text>
        </TouchableOpacity>
      </View>

      {/* Game Status */}
      <View style={styles.statusContainer}>
        {gameState === "idle" && <Text style={[styles.statusText, { color: theme.secondaryTextColor }]}>{t("game:pressStart")}</Text>}
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
    backgroundColor: "black",
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 40,
    borderWidth: 4,
    height: 80,
    justifyContent: "center",
    left: "50%",
    position: "absolute",
    top: "50%",
    transform: [{ translateX: -40 }, { translateY: -40 }],
    width: 80,
  },
  centerTimer: {
    fontFamily: "Oxanium-Bold",
    fontSize: 24,
  },
  centerText: {
    color: "white",
    fontFamily: "Oxanium-Regular",
    fontSize: 10,
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
    marginBottom: 20,
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
    backgroundColor: "rgba(0, 0, 0, 0.3)",
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
  showingText: {
    color: "#fbbf24",
    fontFamily: "Oxanium-Regular",
  },
  soundButton: {
    alignItems: "center",
    backgroundColor: "#6b7280",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
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
  subtitle: {
    color: "#a0a0a0",
    fontFamily: "Oxanium-Medium",
    fontSize: 16,
    marginTop: 5,
  },
  title: {
    color: "white",
    fontFamily: "Oxanium-Bold",
    fontSize: 48,
    letterSpacing: 4,
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
  soundPackRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    width: "100%",
  },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
    width: "100%",
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
  themeRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    width: "100%",
  },
  waitingText: {
    color: "#22c55e",
    fontFamily: "Oxanium-Regular",
  },
})
