import { useEffect, useRef } from "react"
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, useWindowDimensions } from "react-native"

import { Ionicons } from "@expo/vector-icons"

import { GameButton } from "@/components/GameButton"
import { GameOverOverlay } from "@/components/GameOverOverlay"
import { useAds } from "@/hooks/useAds"
import { useGameEngine, colors } from "@/hooks/useGameEngine"
import { usePurchases } from "@/hooks/usePurchases"
import { useAnalytics } from "@/utils/analytics"

export function GameScreen() {
  const { width, height } = useWindowDimensions()
  const gameSize = Math.min(width * 0.8, height * 0.5)
  const buttonSize = gameSize * 0.4

  const {
    gameState,
    score,
    level,
    highScore,
    activeButton,
    soundEnabled,
    isNewHighScore,
    startGame,
    resetGame,
    handleButtonTouch,
    handleButtonRelease,
    toggleSound,
  } = useGameEngine()

  const { showInterstitial, incrementGamesPlayed, incrementSessionCount, adShownThisSession } =
    useAds()
  const { removeAds, purchaseRemoveAds } = usePurchases()
  const analytics = useAnalytics()
  const sessionCounted = useRef(false)

  // Count session on first mount
  useEffect(() => {
    if (!sessionCounted.current) {
      incrementSessionCount()
      sessionCounted.current = true
    }
  }, [])

  // Track game over + show interstitial
  const prevGameState = useRef(gameState)
  useEffect(() => {
    if (prevGameState.current !== "gameover" && gameState === "gameover") {
      incrementGamesPlayed()
      analytics.trackGameOver(score, level)

      if (isNewHighScore) {
        analytics.trackGameCompleted(score, level, true)
      }

      showInterstitial(level, removeAds).then((shown) => {
        if (shown) {
          analytics.trackAdShown("interstitial", "game_over")
        }
      })
    }
    prevGameState.current = gameState
  }, [gameState])

  function handleStartGame() {
    analytics.trackGameStarted()
    startGame()
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
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Eco Mi</Text>
        <Text style={styles.subtitle}>Memory Challenge Game</Text>
      </View>

      {/* Score Display */}
      <View style={styles.scoreContainer}>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>Level</Text>
          <Text testID="text-level" style={styles.scoreValue}>{level}</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>Score</Text>
          <Text testID="text-score" style={styles.scoreValue}>{score}</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>Best</Text>
          <Text testID="text-high-score" style={styles.scoreValue}>{highScore}</Text>
        </View>
      </View>

      {/* Game Board */}
      <View style={styles.gameBoard}>
        <View style={gameContainerStyle}>
          {colors.map((color) => (
            <GameButton
              key={color}
              color={color}
              isActive={activeButton === color}
              disabled={gameState !== "waiting"}
              buttonSize={buttonSize}
              gameSize={gameSize}
              onPressIn={() => handleButtonTouch(color)}
              onPressOut={() => handleButtonRelease(color)}
            />
          ))}

          {/* Center Circle */}
          <View style={styles.centerCircle}>
            <Text style={styles.centerText}>Eco Mi</Text>
          </View>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        {gameState === "idle" && (
          <TouchableOpacity testID="btn-start" style={styles.startButton} onPress={handleStartGame}>
            <Ionicons name="play" size={24} color="white" />
            <Text style={styles.buttonText}>Start Game</Text>
          </TouchableOpacity>
        )}


        {(gameState === "showing" || gameState === "waiting") && (
          <TouchableOpacity style={styles.resetButton} onPress={resetGame}>
            <Ionicons name="stop" size={24} color="white" />
            <Text style={styles.buttonText}>Reset</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity testID="btn-sound-toggle" style={styles.soundButton} onPress={toggleSound}>
          <Ionicons name={soundEnabled ? "volume-high" : "volume-mute"} size={24} color="white" />
          <Text style={styles.buttonText}>Sound</Text>
        </TouchableOpacity>
      </View>

      {/* Game Status */}
      <View style={styles.statusContainer}>
        {gameState === "idle" && <Text style={styles.statusText}>Press Start Game to begin!</Text>}
        {gameState === "showing" && (
          <Text style={[styles.statusText, styles.showingText]}>Watch the sequence...</Text>
        )}
        {gameState === "waiting" && (
          <Text style={[styles.statusText, styles.waitingText]}>Repeat the sequence!</Text>
        )}
      </View>

      <GameOverOverlay
        visible={gameState === "gameover"}
        score={score}
        level={level}
        highScore={highScore}
        isNewHighScore={isNewHighScore}
        showRemoveAds={!removeAds && adShownThisSession}
        onPlayAgain={handleStartGame}
        onRemoveAds={handleRemoveAds}
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
  waitingText: {
    color: "#22c55e",
    fontFamily: "Oxanium-Regular",
  },
})
