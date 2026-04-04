import { View, Text, TouchableOpacity, StyleSheet, StatusBar, useWindowDimensions } from "react-native"

import { Ionicons } from "@expo/vector-icons"

import { useGameEngine, colors, colorMap, Color } from "@/hooks/useGameEngine"

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

  const dynamicStyles = getDynamicStyles(gameSize, buttonSize)

  function getButtonStyle(color: Color) {
    const colorStyle = { backgroundColor: colorMap[color].color }
    const activeStyle =
      activeButton === color
        ? { backgroundColor: colorMap[color].activeColor, transform: [{ scale: 1.05 as const }] }
        : {}

    return [dynamicStyles.gameButton, colorStyle, activeStyle]
  }

  function getButtonPosition(color: Color) {
    const position = colorMap[color].position
    switch (position) {
      case "topLeft":
        return dynamicStyles.topLeft
      case "topRight":
        return dynamicStyles.topRight
      case "bottomLeft":
        return dynamicStyles.bottomLeft
      case "bottomRight":
        return dynamicStyles.bottomRight
    }
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
          <Text style={styles.scoreValue}>{level}</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>Score</Text>
          <Text style={styles.scoreValue}>{score}</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>Best</Text>
          <Text style={styles.scoreValue}>{highScore}</Text>
        </View>
      </View>

      {/* Game Board */}
      <View style={styles.gameBoard}>
        <View style={dynamicStyles.gameContainer}>
          {colors.map((color) => (
            <TouchableOpacity
              key={color}
              style={[getButtonStyle(color), getButtonPosition(color)]}
              onPressIn={() => handleButtonTouch(color)}
              onPressOut={() => handleButtonRelease(color)}
              disabled={gameState !== "waiting"}
              activeOpacity={0.8}
            >
              {activeButton === color && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
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
          <TouchableOpacity style={styles.startButton} onPress={startGame}>
            <Ionicons name="play" size={24} color="white" />
            <Text style={styles.buttonText}>Start Game</Text>
          </TouchableOpacity>
        )}

        {gameState === "gameover" && (
          <TouchableOpacity style={styles.playAgainButton} onPress={startGame}>
            <Ionicons name="refresh" size={24} color="white" />
            <Text style={styles.buttonText}>Play Again</Text>
          </TouchableOpacity>
        )}

        {(gameState === "showing" || gameState === "waiting") && (
          <TouchableOpacity style={styles.resetButton} onPress={resetGame}>
            <Ionicons name="stop" size={24} color="white" />
            <Text style={styles.buttonText}>Reset</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.soundButton} onPress={toggleSound}>
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
        {gameState === "gameover" && (
          <View style={styles.gameOverContainer}>
            <Text style={styles.gameOverText}>Game Over!</Text>
            <Text style={styles.statusText}>
              You reached level {level} with {score} points
            </Text>
            {isNewHighScore && <Text style={styles.highScoreText}>New High Score!</Text>}
          </View>
        )}
      </View>
    </View>
  )
}

function getDynamicStyles(gameSize: number, buttonSize: number) {
  return StyleSheet.create({
    bottomLeft: {
      borderBottomLeftRadius: buttonSize / 2,
      bottom: gameSize * 0.05,
      left: gameSize * 0.05,
    },
    bottomRight: {
      borderBottomRightRadius: buttonSize / 2,
      bottom: gameSize * 0.05,
      right: gameSize * 0.05,
    },
    gameButton: {
      borderRadius: 20,
      elevation: 8,
      height: buttonSize,
      position: "absolute",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 4.65,
      width: buttonSize,
    },
    gameContainer: {
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      borderColor: "rgba(255, 255, 255, 0.2)",
      borderRadius: gameSize / 2,
      borderWidth: 4,
      height: gameSize,
      position: "relative",
      width: gameSize,
    },
    topLeft: {
      borderTopLeftRadius: buttonSize / 2,
      left: gameSize * 0.05,
      top: gameSize * 0.05,
    },
    topRight: {
      borderTopRightRadius: buttonSize / 2,
      right: gameSize * 0.05,
      top: gameSize * 0.05,
    },
  })
}

const styles = StyleSheet.create({
  activeIndicator: {
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 8,
    height: 16,
    left: "50%",
    position: "absolute",
    top: "50%",
    transform: [{ translateX: -8 }, { translateY: -8 }],
    width: 16,
  },
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
  gameOverContainer: {
    alignItems: "center",
  },
  gameOverText: {
    color: "#ef4444",
    fontFamily: "Oxanium-Bold",
    fontSize: 20,
    marginBottom: 8,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  highScoreText: {
    color: "#fbbf24",
    fontFamily: "Oxanium-Bold",
    fontSize: 16,
    marginTop: 8,
  },
  playAgainButton: {
    alignItems: "center",
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
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
    fontSize: 12,
    marginBottom: 5,
  },
  scoreValue: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
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
