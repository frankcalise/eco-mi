import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Vibration,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"

import { useAudioTones } from "@/hooks/useAudioTones"
import { saveString, loadString } from "@/utils/storage"

type GameState = "idle" | "showing" | "waiting" | "gameover"
type Color = "red" | "blue" | "green" | "yellow"

const colors: Color[] = ["red", "blue", "green", "yellow"]

const colorMap = {
  red: {
    color: "#ef4444",
    activeColor: "#fca5a5",
    sound: 220,
    position: "topLeft" as const,
  },
  blue: {
    color: "#3b82f6",
    activeColor: "#93c5fd",
    sound: 277,
    position: "topRight" as const,
  },
  green: {
    color: "#22c55e",
    activeColor: "#86efac",
    sound: 330,
    position: "bottomLeft" as const,
  },
  yellow: {
    color: "#eab308",
    activeColor: "#fde047",
    sound: 415,
    position: "bottomRight" as const,
  },
}

const { width, height } = Dimensions.get("window")
const gameSize = Math.min(width * 0.8, height * 0.5)
const buttonSize = gameSize * 0.4

export function GameScreen() {
  const [sequence, setSequence] = useState<Color[]>([])
  const [playerSequence, setPlayerSequence] = useState<Color[]>([])
  const [gameState, setGameState] = useState<GameState>("idle")
  const [level, setLevel] = useState(1)
  const [score, setScore] = useState(0)
  const [activeButton, setActiveButton] = useState<Color | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [highScore, setHighScore] = useState(0)

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Use our new audio hook
  const { initialize, cleanup, playSound, startContinuousSound, stopContinuousSound } =
    useAudioTones(colorMap, soundEnabled)

  // Initialize audio and load high score
  useEffect(() => {
    initialize()
    loadHighScore()

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      cleanup()
    }
  }, [initialize, cleanup])

  const loadHighScore = async () => {
    try {
      const savedHighScore = loadString("simon-high-score")
      if (savedHighScore) {
        setHighScore(parseInt(savedHighScore, 10))
      }
    } catch (error) {
      console.log("Error loading high score:", error)
    }
  }

  const saveHighScore = async (score: number) => {
    try {
      saveString("simon-high-score", score.toString())
    } catch (error) {
      console.log("Error saving high score:", error)
    }
  }

  const flashButton = useCallback(
    (color: Color, duration: number = 600) => {
      setActiveButton(color)
      playSound(color, duration)
      Vibration.vibrate(100)

      // Cast the timeout ID to NodeJS.Timeout
      const timeout = setTimeout(() => {
        setActiveButton(null)
      }, duration) as unknown as NodeJS.Timeout

      timeoutRef.current = timeout
    },
    [playSound],
  )

  const showSequence = useCallback(
    (seq: Color[]) => {
      setGameState("showing")

      seq.forEach((color, index) => {
        setTimeout(
          () => {
            flashButton(color)

            if (index === seq.length - 1) {
              setTimeout(() => {
                setGameState("waiting")
              }, 700)
            }
          },
          (index + 1) * 800,
        )
      })
    },
    [flashButton],
  )

  const startGame = useCallback(() => {
    setSequence([])
    setPlayerSequence([])
    setLevel(1)
    setScore(0)
    setGameState("idle")

    setTimeout(() => {
      const newSequence = [colors[Math.floor(Math.random() * colors.length)]]
      setSequence(newSequence)
      showSequence(newSequence)
    }, 500)
  }, [showSequence])

  const resetGame = useCallback(() => {
    setGameState("idle")
    setSequence([])
    setPlayerSequence([])
    setLevel(1)
    setScore(0)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setActiveButton(null)
  }, [])

  const handleButtonTouch = useCallback(
    (color: Color) => {
      if (gameState !== "waiting") return

      setActiveButton(color)
      startContinuousSound(color)
      Vibration.vibrate(50)
    },
    [gameState, startContinuousSound],
  )

  const handleButtonRelease = useCallback(
    (color: Color) => {
      if (gameState !== "waiting") return

      setActiveButton(null)
      stopContinuousSound(color)

      const newPlayerSequence = [...playerSequence, color]
      setPlayerSequence(newPlayerSequence)

      // Check if the player's move is correct
      if (color !== sequence[newPlayerSequence.length - 1]) {
        // Wrong move - game over
        setGameState("gameover")
        Vibration.vibrate([0, 200, 100, 200])

        // Update high score
        if (score > highScore) {
          setHighScore(score)
          saveHighScore(score)
        }
        return
      }

      // Check if player completed the sequence
      if (newPlayerSequence.length === sequence.length) {
        // Player completed the sequence correctly
        const newScore = score + newPlayerSequence.length * 10
        const newLevel = level + 1

        setScore(newScore)
        setLevel(newLevel)
        setPlayerSequence([])

        // Add new color to sequence and show it
        setTimeout(() => {
          const newSequence = [...sequence]
          const randomColor = colors[Math.floor(Math.random() * colors.length)]
          newSequence.push(randomColor)
          setSequence(newSequence)
          showSequence(newSequence)
        }, 1000)
      }
    },
    [
      gameState,
      playerSequence,
      sequence,
      score,
      highScore,
      level,
      showSequence,
      stopContinuousSound,
    ],
  )

  const getButtonStyle = (color: Color) => {
    const baseStyle = [styles.gameButton]
    const colorStyle = { backgroundColor: colorMap[color].color }
    const activeStyle =
      activeButton === color
        ? { backgroundColor: colorMap[color].activeColor, transform: [{ scale: 1.05 }] }
        : {}

    return [baseStyle, colorStyle, activeStyle]
  }

  const getButtonPosition = (color: Color) => {
    const position = colorMap[color].position
    switch (position) {
      case "topLeft":
        return [styles.topLeft]
      case "topRight":
        return [styles.topRight]
      case "bottomLeft":
        return [styles.bottomLeft]
      case "bottomRight":
        return [styles.bottomRight]
      default:
        return []
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
        <View style={styles.gameContainer}>
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

        <TouchableOpacity style={styles.soundButton} onPress={() => setSoundEnabled(!soundEnabled)}>
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
            {score === highScore && score > 0 && (
              <Text style={styles.highScoreText}>🎉 New High Score! 🎉</Text>
            )}
          </View>
        )}
      </View>
    </View>
  )
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
  buttonText: {
    color: "white",
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
    fontSize: 10,
    fontWeight: "bold",
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
  gameButton: {
    borderRadius: 20,
    elevation: 8,
    height: buttonSize,
    position: "absolute",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
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
  gameOverContainer: {
    alignItems: "center",
  },
  gameOverText: {
    color: "#ef4444",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  highScoreText: {
    color: "#fbbf24",
    fontSize: 16,
    fontWeight: "bold",
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
    fontSize: 16,
    textAlign: "center",
  },
  subtitle: {
    color: "#a0a0a0",
    fontSize: 16,
    marginTop: 5,
  },
  title: {
    color: "white",
    fontSize: 48,
    fontWeight: "bold",
    letterSpacing: 4,
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
  waitingText: {
    color: "#22c55e",
  },
})
