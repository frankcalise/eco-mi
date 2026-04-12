import { useState, useEffect, useRef } from "react"
import * as Haptics from "expo-haptics"
import type { OscillatorType } from "react-native-audio-api"

import { getToneDuration, getSequenceInterval, getInputTimeout } from "@/config/difficulty"
import { pickShuffleSequence, getShuffleStepDelay } from "@/config/shuffleAnimations"
import { type GameTheme, gameThemes } from "@/config/themes"
import { useAudioTones } from "@/hooks/useAudioTones"
import { recordGameResult } from "@/hooks/useStats"
import { saveString, loadString } from "@/utils/storage"

export type GameState = "idle" | "showing" | "waiting" | "gameover"
export type GameMode = "classic" | "daily" | "timed" | "reverse" | "chaos"
export type Color = "red" | "blue" | "green" | "yellow"

export const colors: Color[] = ["red", "blue", "green", "yellow"]

const soundFrequencies: Record<Color, number> = {
  red: 220,
  blue: 277,
  green: 330,
  yellow: 415,
}

const buttonPositionMap: Record<Color, "topLeft" | "topRight" | "bottomLeft" | "bottomRight"> = {
  red: "topLeft",
  blue: "topRight",
  green: "bottomLeft",
  yellow: "bottomRight",
}

export function getColorMapForTheme(theme: GameTheme) {
  return {
    red: {
      color: theme.buttonColors.red.color,
      activeColor: theme.buttonColors.red.activeColor,
      sound: soundFrequencies.red,
      position: buttonPositionMap.red,
    },
    blue: {
      color: theme.buttonColors.blue.color,
      activeColor: theme.buttonColors.blue.activeColor,
      sound: soundFrequencies.blue,
      position: buttonPositionMap.blue,
    },
    green: {
      color: theme.buttonColors.green.color,
      activeColor: theme.buttonColors.green.activeColor,
      sound: soundFrequencies.green,
      position: buttonPositionMap.green,
    },
    yellow: {
      color: theme.buttonColors.yellow.color,
      activeColor: theme.buttonColors.yellow.activeColor,
      sound: soundFrequencies.yellow,
      position: buttonPositionMap.yellow,
    },
  }
}

export const colorMap = getColorMapForTheme(gameThemes.classic)

interface UseGameEngineOptions {
  mode?: GameMode
  oscillatorType?: OscillatorType
  theme?: GameTheme
  onAudioContextRecycle?: (nodeCount: number) => void
}

interface UseGameEngineReturn {
  gameState: GameState
  mode: GameMode
  score: number
  level: number
  highScore: number
  activeButton: Color | null
  soundEnabled: boolean
  sequence: Color[]
  playerSequence: Color[]
  isNewHighScore: boolean
  continuedThisGame: boolean
  timeRemaining: number | null
  sequencesCompleted: number
  buttonPositions: Color[]
  isShuffling: boolean
  inputTimeRemaining: number | null

  startGame: () => void
  resetGame: () => void
  continueGame: () => void
  handleButtonTouch: (color: Color) => void
  handleButtonRelease: (color: Color) => void
  toggleSound: () => void
  playPreview: (overrideType?: OscillatorType) => void
  playJingle: () => void
  playGameOverJingle: () => void
  playHighScoreJingle: () => void
  setMode: (mode: GameMode) => void
}

function highScoreKey(mode: string): string {
  return `ecomi:highScore:${mode}`
}
const DAILY_HIGH_SCORE_PREFIX = "ecomi:daily:"
const DAILY_STREAK_KEY = "ecomi:daily:currentStreak"
const DAILY_LAST_PLAYED_KEY = "ecomi:daily:lastPlayed"

function getDailySeed(): number {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return parseInt(`${year}${month}${day}`, 10)
}

function getTodayKey(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Mulberry32 seeded PRNG — deterministic random from a 32-bit seed.
 * Returns a float in [0, 1).
 */
function mulberry32(seed: number): () => number {
  let state = seed | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function getTestSeed(): number | null {
  const raw = process.env.EXPO_PUBLIC_TEST_SEED
  return raw ? parseInt(raw, 10) : null
}

export function useGameEngine(options?: UseGameEngineOptions): UseGameEngineReturn {
  const [mode, setMode] = useState<GameMode>(options?.mode ?? "classic")
  const [sequence, setSequence] = useState<Color[]>([])
  const [playerSequence, setPlayerSequence] = useState<Color[]>([])
  const [gameState, setGameState] = useState<GameState>("idle")
  const [level, setLevel] = useState(1)
  const [score, setScore] = useState(0)
  const [activeButton, setActiveButton] = useState<Color | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [highScore, setHighScore] = useState(0)
  const [isNewHighScore, setIsNewHighScore] = useState(false)
  const [continuedThisGame, setContinuedThisGame] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [sequencesCompleted, setSequencesCompleted] = useState(0)
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [buttonPositions, setButtonPositions] = useState<Color[]>([...colors])
  const [isShuffling, setIsShuffling] = useState(false)
  const [inputTimeRemaining, setInputTimeRemaining] = useState<number | null>(null)
  const inputCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const scoreRef = useRef(0)
  const timeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const inputTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const buttonPressStartTime = useRef<number | null>(null)
  const testSeed = getTestSeed()
  const seededRng = useRef(testSeed !== null ? mulberry32(testSeed) : null)

  const activeColorMap = options?.theme ? getColorMapForTheme(options.theme) : colorMap

  const {
    initialize,
    cleanup,
    playSound,
    playPreview,
    playJingle,
    playGameOverJingle,
    playHighScoreJingle,
    startContinuousSound,
    stopContinuousSoundWithFade,
  } = useAudioTones(
    activeColorMap,
    soundEnabled,
    options?.oscillatorType,
    options?.onAudioContextRecycle,
  )

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
    if (inputTimeoutRef.current) {
      clearTimeout(inputTimeoutRef.current)
      inputTimeoutRef.current = null
    }
    if (inputCountdownRef.current) {
      clearInterval(inputCountdownRef.current)
      inputCountdownRef.current = null
    }
    setInputTimeRemaining(null)
  }

  // --- Sequence generation (seeded or random) ---

  function getNextColorIndex(_sequencePosition: number): number {
    if (seededRng.current) {
      return Math.floor(seededRng.current() * colors.length)
    }
    return Math.floor(Math.random() * colors.length)
  }

  // --- Persistence ---

  function loadHighScore() {
    const saved = loadString(highScoreKey(mode))
    setHighScore(saved ? parseInt(saved, 10) : 0)
  }

  function saveHighScore(newScore: number) {
    saveString(highScoreKey(mode), newScore.toString())
  }

  function saveDailyResult(finalScore: number) {
    const todayKey = getTodayKey()
    const bestKey = `${DAILY_HIGH_SCORE_PREFIX}${todayKey}:bestScore`
    const currentBest = parseInt(loadString(bestKey) ?? "0", 10)
    if (finalScore > currentBest) {
      saveString(bestKey, finalScore.toString())
    }

    const lastPlayed = loadString(DAILY_LAST_PLAYED_KEY) ?? ""
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`

    if (lastPlayed === yesterdayKey) {
      const streak = parseInt(loadString(DAILY_STREAK_KEY) ?? "1", 10)
      const newStreak = streak + 1
      saveString(DAILY_STREAK_KEY, newStreak.toString())
      const longestStreak = parseInt(loadString("ecomi:stats:longestStreak") ?? "0", 10)
      if (newStreak > longestStreak) {
        saveString("ecomi:stats:longestStreak", newStreak.toString())
      }
    } else if (lastPlayed !== todayKey) {
      saveString(DAILY_STREAK_KEY, "1")
      const longestStreak = parseInt(loadString("ecomi:stats:longestStreak") ?? "0", 10)
      if (longestStreak === 0) {
        saveString("ecomi:stats:longestStreak", "1")
      }
    }

    saveString(DAILY_LAST_PLAYED_KEY, todayKey)
  }

  // --- Init + cleanup ---

  useEffect(() => {
    scoreRef.current = score
  }, [score])

  useEffect(() => {
    loadHighScore()
  }, [mode])

  useEffect(() => {
    initialize()
    loadHighScore()

    return () => {
      clearAllTimeouts()
      stopTimer()
      cleanup()
    }
  }, [])

  // --- Game logic ---

  function flashButton(color: Color, duration: number) {
    setActiveButton(color)
    playSound(color, duration)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    addTimeout(() => {
      setActiveButton(null)
    }, duration)
  }

  function showSequence(seq: Color[], currentLevel: number) {
    setGameState("showing")
    const toneDuration = getToneDuration(currentLevel)
    const interval = getSequenceInterval(currentLevel)

    seq.forEach((color, index) => {
      addTimeout(
        () => {
          flashButton(color, toneDuration)

          if (index === seq.length - 1) {
            addTimeout(() => {
              setGameState("waiting")
              if (mode !== "timed") {
                if (inputTimeoutRef.current) clearTimeout(inputTimeoutRef.current)
                if (inputCountdownRef.current) clearInterval(inputCountdownRef.current)
                const totalMs = getInputTimeout(seq.length)
                const startTime = Date.now()
                setInputTimeRemaining(null)
                inputCountdownRef.current = setInterval(() => {
                  const elapsed = Date.now() - startTime
                  const remaining = Math.ceil((totalMs - elapsed) / 1000)
                  if (remaining <= 5 && remaining > 0) {
                    setInputTimeRemaining(remaining)
                  }
                }, 200)
                inputTimeoutRef.current = setTimeout(() => {
                  inputTimeoutRef.current = null
                  if (inputCountdownRef.current) {
                    clearInterval(inputCountdownRef.current)
                    inputCountdownRef.current = null
                  }
                  setInputTimeRemaining(null)
                  setGameState("gameover")
                  stopTimer()
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
                  const currentScore = scoreRef.current
                  if (currentScore > highScore) {
                    setHighScore(currentScore)
                    setIsNewHighScore(true)
                    saveHighScore(currentScore)
                  }
                  recordGameResult(currentScore)
                }, totalMs)
              }
            }, toneDuration + 100)
          }
        },
        (index + 1) * interval,
      )
    })
  }

  function stopTimer() {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    setTimeRemaining(null)
  }

  function startTimer(durationSec: number) {
    stopTimer()
    setTimeRemaining(durationSec)
    const startTime = Date.now()
    timerIntervalRef.current = setInterval(() => {
      const elapsedMs = Date.now() - startTime
      const remaining = durationSec - elapsedMs / 1000
      if (remaining <= 0) {
        stopTimer()
        clearAllTimeouts()
        setGameState("gameover")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)

        const currentScore = scoreRef.current
        if (currentScore > highScore) {
          setHighScore(currentScore)
          setIsNewHighScore(true)
          saveHighScore(currentScore)
        }
        recordGameResult(currentScore)
      } else {
        setTimeRemaining(remaining)
      }
    }, 100)
  }

  function animateShuffleSequence(currentLevel: number): number {
    const steps = pickShuffleSequence(currentLevel, buttonPositions)
    const stepDelay = getShuffleStepDelay(currentLevel)

    setIsShuffling(true)

    steps.forEach((step, i) => {
      addTimeout(() => {
        setButtonPositions(step)

        if (i === steps.length - 1) {
          addTimeout(() => {
            setIsShuffling(false)
          }, stepDelay)
        }
      }, i * stepDelay)
    })

    // Total duration: steps * stepDelay + final settle delay
    return steps.length * stepDelay + stepDelay
  }

  function startGame() {
    clearAllTimeouts()
    stopTimer()
    if (mode === "daily") {
      seededRng.current = mulberry32(getDailySeed())
    } else if (testSeed !== null) {
      seededRng.current = mulberry32(testSeed)
    } else {
      seededRng.current = null
    }
    setSequence([])
    setPlayerSequence([])
    setLevel(1)
    setScore(0)
    setGameState("idle")
    setIsNewHighScore(false)
    setContinuedThisGame(false)
    setSequencesCompleted(0)
    setButtonPositions([...colors])
    setIsShuffling(false)

    if (mode === "timed") {
      startTimer(60)
    }

    addTimeout(() => {
      const newSequence = [colors[getNextColorIndex(0)]]
      setSequence(newSequence)
      showSequence(newSequence, 1)
    }, 500)
  }

  function resetGame() {
    clearAllTimeouts()
    stopTimer()
    setGameState("idle")
    setSequence([])
    setPlayerSequence([])
    setLevel(1)
    setScore(0)
    setActiveButton(null)
    setIsNewHighScore(false)
    setContinuedThisGame(false)
    setSequencesCompleted(0)
    setButtonPositions([...colors])
    setIsShuffling(false)
    buttonPressStartTime.current = null
  }

  function continueGame() {
    if (gameState !== "gameover") return
    clearAllTimeouts()
    setContinuedThisGame(true)
    setIsNewHighScore(false)
    setPlayerSequence([])
    setActiveButton(null)

    addTimeout(() => {
      showSequence(sequence, level)
    }, 500)
  }

  function handleButtonTouch(color: Color) {
    if (gameState !== "waiting") return
    const toneDuration = getToneDuration(level)

    buttonPressStartTime.current = Date.now()
    setActiveButton(color)
    startContinuousSound(color)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    addTimeout(() => {
      // Ensures minimum duration — cleared on release if held longer
    }, toneDuration)
  }

  function handleButtonRelease(color: Color) {
    if (gameState !== "waiting") return
    const toneDuration = getToneDuration(level)

    const currentTime = Date.now()
    const pressDuration = buttonPressStartTime.current
      ? currentTime - buttonPressStartTime.current
      : 0

    if (pressDuration < toneDuration) {
      const remainingTime = toneDuration - pressDuration
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

    // Clear input timeout and countdown on any tap
    if (inputTimeoutRef.current) {
      clearTimeout(inputTimeoutRef.current)
      inputTimeoutRef.current = null
    }
    if (inputCountdownRef.current) {
      clearInterval(inputCountdownRef.current)
      inputCountdownRef.current = null
    }
    setInputTimeRemaining(null)

    // Wrong move — check for expected color based on mode
    const expectedIndex =
      mode === "reverse"
        ? sequence.length - 1 - (newPlayerSequence.length - 1)
        : newPlayerSequence.length - 1
    const expectedColor = sequence[expectedIndex]

    if (color !== expectedColor) {
      if (mode === "timed") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        setPlayerSequence([])
        addTimeout(() => {
          showSequence(sequence, level)
        }, 500)
        return
      }

      setGameState("gameover")
      stopTimer()
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)

      if (score > highScore) {
        setHighScore(score)
        setIsNewHighScore(true)
        saveHighScore(score)
      }

      recordGameResult(score)

      if (mode === "daily") {
        saveDailyResult(score)
      }
      return
    }

    // Completed the sequence — advance
    if (newPlayerSequence.length === sequence.length) {
      const newScore = score + newPlayerSequence.length * 10
      const newLevel = level + 1

      setScore(newScore)
      setLevel(newLevel)

      if (mode === "timed") {
        setSequencesCompleted((prev) => prev + 1)
      }

      // Brief delay so the last dot renders as filled and button animation settles
      addTimeout(() => {
        setPlayerSequence([])

        if (mode === "chaos") {
          const shuffleDuration = animateShuffleSequence(newLevel)

          addTimeout(() => {
            const newSequence = [...sequence]
            newSequence.push(colors[getNextColorIndex(newSequence.length)])
            setSequence(newSequence)
            showSequence(newSequence, newLevel)
          }, shuffleDuration + 200)
        } else {
          addTimeout(() => {
            const newSequence = [...sequence]
            newSequence.push(colors[getNextColorIndex(newSequence.length)])
            setSequence(newSequence)
            showSequence(newSequence, newLevel)
          }, 600)
        }
      }, 400)
    }
  }

  function toggleSound() {
    setSoundEnabled((prev) => !prev)
  }

  return {
    gameState,
    mode,
    score,
    level,
    highScore,
    activeButton,
    soundEnabled,
    sequence,
    playerSequence,
    isNewHighScore,
    continuedThisGame,
    timeRemaining,
    sequencesCompleted,
    buttonPositions,
    isShuffling,
    inputTimeRemaining,

    startGame,
    resetGame,
    continueGame,
    handleButtonTouch,
    handleButtonRelease,
    toggleSound,
    playPreview,
    playJingle,
    playGameOverJingle,
    playHighScoreJingle,
    setMode,
  }
}
