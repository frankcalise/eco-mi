import { useState, useEffect, useRef } from "react"

import { Vibration } from "react-native"

import { useAudioTones } from "@/hooks/useAudioTones"
import { saveString, loadString } from "@/utils/storage"

export type GameState = "idle" | "showing" | "waiting" | "gameover"
export type Color = "red" | "blue" | "green" | "yellow"

export const colors: Color[] = ["red", "blue", "green", "yellow"]

export const MIN_TONE_DURATION = 600

export const colorMap = {
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

interface UseGameEngineReturn {
  gameState: GameState
  score: number
  level: number
  highScore: number
  activeButton: Color | null
  soundEnabled: boolean
  sequence: Color[]
  playerSequence: Color[]
  isNewHighScore: boolean

  startGame: () => void
  resetGame: () => void
  handleButtonTouch: (color: Color) => void
  handleButtonRelease: (color: Color) => void
  toggleSound: () => void
}

const HIGH_SCORE_KEY = "simon-high-score"

export function useGameEngine(): UseGameEngineReturn {
  const [sequence, setSequence] = useState<Color[]>([])
  const [playerSequence, setPlayerSequence] = useState<Color[]>([])
  const [gameState, setGameState] = useState<GameState>("idle")
  const [level, setLevel] = useState(1)
  const [score, setScore] = useState(0)
  const [activeButton, setActiveButton] = useState<Color | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [highScore, setHighScore] = useState(0)
  const [isNewHighScore, setIsNewHighScore] = useState(false)

  const timeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const buttonPressStartTime = useRef<number | null>(null)

  const { initialize, cleanup, playSound, startContinuousSound, stopContinuousSoundWithFade } =
    useAudioTones(colorMap, soundEnabled)

  // --- Timeout management (fixes orphaned timer bug) ---

  function addTimeout(fn: () => void, ms: number) {
    const id = setTimeout(() => {
      timeoutsRef.current.delete(id)
      fn()
    }, ms)
    timeoutsRef.current.add(id)
    return id
  }

  function clearAllTimeouts() {
    for (const id of timeoutsRef.current) {
      clearTimeout(id)
    }
    timeoutsRef.current.clear()
  }

  // --- Persistence ---

  function loadHighScore() {
    const saved = loadString(HIGH_SCORE_KEY)
    if (saved) {
      setHighScore(parseInt(saved, 10))
    }
  }

  function saveHighScore(newScore: number) {
    saveString(HIGH_SCORE_KEY, newScore.toString())
  }

  // --- Init + cleanup ---

  useEffect(() => {
    initialize()
    loadHighScore()

    return () => {
      clearAllTimeouts()
      cleanup()
    }
  }, [])

  // --- Game logic ---

  function flashButton(color: Color, duration: number = MIN_TONE_DURATION) {
    setActiveButton(color)
    playSound(color, duration)
    Vibration.vibrate(100)

    addTimeout(() => {
      setActiveButton(null)
    }, duration)
  }

  function showSequence(seq: Color[]) {
    setGameState("showing")

    seq.forEach((color, index) => {
      addTimeout(() => {
        flashButton(color)

        if (index === seq.length - 1) {
          addTimeout(() => {
            setGameState("waiting")
          }, 700)
        }
      }, (index + 1) * 800)
    })
  }

  function startGame() {
    clearAllTimeouts()
    setSequence([])
    setPlayerSequence([])
    setLevel(1)
    setScore(0)
    setGameState("idle")
    setIsNewHighScore(false)

    addTimeout(() => {
      const newSequence = [colors[Math.floor(Math.random() * colors.length)]]
      setSequence(newSequence)
      showSequence(newSequence)
    }, 500)
  }

  function resetGame() {
    clearAllTimeouts()
    setGameState("idle")
    setSequence([])
    setPlayerSequence([])
    setLevel(1)
    setScore(0)
    setActiveButton(null)
    setIsNewHighScore(false)
    buttonPressStartTime.current = null
  }

  function handleButtonTouch(color: Color) {
    if (gameState !== "waiting") return

    buttonPressStartTime.current = Date.now()
    setActiveButton(color)
    startContinuousSound(color)
    Vibration.vibrate(50)

    addTimeout(() => {
      // Ensures minimum duration — cleared on release if held longer
    }, MIN_TONE_DURATION)
  }

  function handleButtonRelease(color: Color) {
    if (gameState !== "waiting") return

    const currentTime = Date.now()
    const pressDuration = buttonPressStartTime.current
      ? currentTime - buttonPressStartTime.current
      : 0

    if (pressDuration < MIN_TONE_DURATION) {
      const remainingTime = MIN_TONE_DURATION - pressDuration
      stopContinuousSoundWithFade(color, 100)

      addTimeout(() => {
        setActiveButton(null)
      }, remainingTime)
    } else {
      setActiveButton(null)
      stopContinuousSoundWithFade(color, 200)
    }

    const newPlayerSequence = [...playerSequence, color]
    setPlayerSequence(newPlayerSequence)

    // Wrong move — game over
    if (color !== sequence[newPlayerSequence.length - 1]) {
      setGameState("gameover")
      Vibration.vibrate([0, 200, 100, 200])

      if (score > highScore) {
        setHighScore(score)
        setIsNewHighScore(true)
        saveHighScore(score)
      }
      return
    }

    // Completed the sequence — advance
    if (newPlayerSequence.length === sequence.length) {
      const newScore = score + newPlayerSequence.length * 10
      const newLevel = level + 1

      setScore(newScore)
      setLevel(newLevel)
      setPlayerSequence([])

      addTimeout(() => {
        const newSequence = [...sequence]
        const randomColor = colors[Math.floor(Math.random() * colors.length)]
        newSequence.push(randomColor)
        setSequence(newSequence)
        showSequence(newSequence)
      }, 1000)
    }
  }

  function toggleSound() {
    setSoundEnabled((prev) => !prev)
  }

  return {
    gameState,
    score,
    level,
    highScore,
    activeButton,
    soundEnabled,
    sequence,
    playerSequence,
    isNewHighScore,

    startGame,
    resetGame,
    handleButtonTouch,
    handleButtonRelease,
    toggleSound,
  }
}
