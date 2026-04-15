import { useState, useEffect, useRef } from "react"
import * as Haptics from "expo-haptics"
import type { OscillatorType } from "react-native-audio-api"
import { useMachine } from "@xstate/react"

import { getToneDuration, getSequenceInterval, getInputTimeout } from "@/config/difficulty"
import { pickShuffleSequence, getShuffleStepDelay } from "@/config/shuffleAnimations"
import { type GameTheme, gameThemes } from "@/config/themes"
import { useAudioTones } from "@/hooks/useAudioTones"
import { recordGameResult } from "@/hooks/useStats"
import { saveString, loadString } from "@/utils/storage"
import {
  DAILY_CURRENT_STREAK,
  DAILY_LAST_PLAYED,
  DAILY_PREFIX,
  HIGH_SCORE_PREFIX,
  STATS_LONGEST_STREAK,
} from "@/config/storageKeys"

import {
  gameEngineMachine,
  toPublicState,
  colors,
  type Color,
  type GameMode,
  type PublicGameState as GameState,
} from "./gameEngineMachine"

export { colors }
export type { Color, GameMode, GameState }

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
    red: { color: theme.buttonColors.red.color, activeColor: theme.buttonColors.red.activeColor, sound: soundFrequencies.red, position: buttonPositionMap.red },
    blue: { color: theme.buttonColors.blue.color, activeColor: theme.buttonColors.blue.activeColor, sound: soundFrequencies.blue, position: buttonPositionMap.blue },
    green: { color: theme.buttonColors.green.color, activeColor: theme.buttonColors.green.activeColor, sound: soundFrequencies.green, position: buttonPositionMap.green },
    yellow: { color: theme.buttonColors.yellow.color, activeColor: theme.buttonColors.yellow.activeColor, sound: soundFrequencies.yellow, position: buttonPositionMap.yellow },
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
  wrongFlash: boolean
  timerDelta: number | null

  startGame: () => void
  resetGame: () => void
  endGame: () => void
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
  return `${HIGH_SCORE_PREFIX}${mode}`
}

function getDailySeed(): number {
  const now = new Date()
  return parseInt(`${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`, 10)
}

function getTodayKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function getTestSeed(): number | null {
  const raw = process.env.EXPO_PUBLIC_TEST_SEED
  return raw ? parseInt(raw, 10) : null
}

export function useGameEngine(options?: UseGameEngineOptions): UseGameEngineReturn {
  const [state, send] = useMachine(gameEngineMachine)

  // Local UI state
  const [activeButton, setActiveButton] = useState<Color | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [wrongFlash, setWrongFlash] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [inputTimeRemaining, setInputTimeRemaining] = useState<number | null>(null)
  const [buttonPositions, setButtonPositions] = useState<Color[]>([...colors])
  const [isShuffling, setIsShuffling] = useState(false)

  // Refs
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inputCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const buttonPressStartTime = useRef<number | null>(null)
  const inputLocked = useRef(false)
  const timerBonusRef = useRef(0)
  const wrongCountRef = useRef(0)
  const lastHapticSecond = useRef(-1)
  const [timerDelta, setTimerDelta] = useState<number | null>(null)
  const testSeed = getTestSeed()
  const seededRng = useRef(testSeed !== null ? mulberry32(testSeed) : null)
  const scoreRef = useRef(0)

  const activeColorMap = options?.theme ? getColorMapForTheme(options.theme) : colorMap

  const {
    initialize, cleanup, playSound, playPreview, playJingle,
    playGameOverJingle, playHighScoreJingle, startContinuousSound, stopContinuousSoundWithFade,
  } = useAudioTones(activeColorMap, soundEnabled, options?.oscillatorType, options?.onAudioContextRecycle)

  const ctx = state.context
  const gameState = toPublicState(state.value as string)
  const mode = ctx.mode

  // Keep scoreRef in sync for timer callbacks
  useEffect(() => { scoreRef.current = ctx.score }, [ctx.score])

  // --- Timeout management ---

  function addTimeout(fn: () => void, ms: number) {
    const id = setTimeout(() => { timeoutsRef.current.delete(id); fn() }, ms)
    timeoutsRef.current.add(id)
    return id
  }

  function clearAllTimeouts() {
    for (const id of timeoutsRef.current) clearTimeout(id)
    timeoutsRef.current.clear()
    if (inputCountdownRef.current) { clearInterval(inputCountdownRef.current); inputCountdownRef.current = null }
    setInputTimeRemaining(null)
  }

  function getNextColorIndex(): number {
    return seededRng.current ? Math.floor(seededRng.current() * colors.length) : Math.floor(Math.random() * colors.length)
  }

  // --- Persistence ---

  function loadHighScore() {
    const saved = loadString(highScoreKey(mode))
    send({ type: "SET_HIGH_SCORE", highScore: saved ? parseInt(saved, 10) : 0 })
  }

  function saveHighScore(s: number) { saveString(highScoreKey(mode), s.toString()) }

  function saveDailyResult(finalScore: number) {
    const todayKey = getTodayKey()
    const bestKey = `${DAILY_PREFIX}${todayKey}:bestScore`
    const currentBest = parseInt(loadString(bestKey) ?? "0", 10)
    if (finalScore > currentBest) saveString(bestKey, finalScore.toString())

    const lastPlayed = loadString(DAILY_LAST_PLAYED) ?? ""
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`

    if (lastPlayed === yesterdayKey) {
      const streak = parseInt(loadString(DAILY_CURRENT_STREAK) ?? "1", 10)
      const newStreak = streak + 1
      saveString(DAILY_CURRENT_STREAK, newStreak.toString())
      const longestStreak = parseInt(loadString(STATS_LONGEST_STREAK) ?? "0", 10)
      if (newStreak > longestStreak) saveString(STATS_LONGEST_STREAK, newStreak.toString())
    } else if (lastPlayed !== todayKey) {
      saveString(DAILY_CURRENT_STREAK, "1")
      const longestStreak = parseInt(loadString(STATS_LONGEST_STREAK) ?? "0", 10)
      if (longestStreak === 0) saveString(STATS_LONGEST_STREAK, "1")
    }
    saveString(DAILY_LAST_PLAYED, todayKey)
  }

  // --- Timers ---

  function stopTimer() {
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null }
    setTimeRemaining(null)
  }

  function startTimer(durationSec: number) {
    stopTimer()
    setTimeRemaining(durationSec)
    const startTime = Date.now()
    timerIntervalRef.current = setInterval(() => {
      const remaining = durationSec + timerBonusRef.current - (Date.now() - startTime) / 1000
      if (remaining <= 0) {
        stopTimer(); clearAllTimeouts()
        send({ type: "TIMER_EXPIRED" })
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        handleGameOverSideEffects()
      } else {
        setTimeRemaining(remaining)
        const sec = Math.ceil(remaining)
        if (sec !== lastHapticSecond.current && sec <= 10 && sec > 0) {
          lastHapticSecond.current = sec
          if (sec <= 3) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
          else if (sec <= 5) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }
      }
    }, 100)
  }

  function handleGameOverSideEffects() {
    const sc = scoreRef.current
    if (sc > ctx.highScore) saveHighScore(sc)
    if (!ctx.gameResultRecorded) recordGameResult(sc)
    if (mode === "daily") saveDailyResult(sc)
  }

  // --- Sequence playback ---

  function flashButton(color: Color, duration: number) {
    setActiveButton(color)
    playSound(color, duration)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    addTimeout(() => setActiveButton(null), duration)
  }

  function showSequence(seq: Color[], currentLevel: number) {
    const toneDuration = getToneDuration(currentLevel)
    const interval = getSequenceInterval(currentLevel)
    const flashDuration = Math.min(toneDuration, interval - 80)

    seq.forEach((color, index) => {
      addTimeout(() => {
        flashButton(color, flashDuration)
        if (index === seq.length - 1) {
          addTimeout(() => {
            send({ type: "SEQUENCE_DONE" })
            if (mode !== "timed") {
              const totalMs = getInputTimeout(seq.length)
              const startTime = Date.now()
              setInputTimeRemaining(null)
              inputCountdownRef.current = setInterval(() => {
                const elapsed = Date.now() - startTime
                const remaining = Math.ceil((totalMs - elapsed) / 1000)
                if (remaining <= 5 && remaining > 0) setInputTimeRemaining(remaining)
                else if (remaining <= 0) {
                  if (inputCountdownRef.current) { clearInterval(inputCountdownRef.current); inputCountdownRef.current = null }
                  setInputTimeRemaining(null)
                }
              }, 200)
            }
          }, flashDuration + 100)
        }
      }, (index + 1) * interval)
    })
  }

  function animateShuffleSequence(currentLevel: number): number {
    const steps = pickShuffleSequence(currentLevel, buttonPositions)
    const stepDelay = getShuffleStepDelay(currentLevel)
    setIsShuffling(true)
    steps.forEach((step, i) => {
      addTimeout(() => {
        setButtonPositions(step)
        if (i === steps.length - 1) addTimeout(() => setIsShuffling(false), stepDelay)
      }, i * stepDelay)
    })
    return steps.length * stepDelay + stepDelay
  }

  // --- Init ---

  useEffect(() => {
    initialize()
    loadHighScore()
    return () => { clearAllTimeouts(); stopTimer(); cleanup() }
  }, [])

  useEffect(() => { loadHighScore() }, [mode])

  // Clean up countdown interval when machine exits waiting (e.g., INPUT_TIMEOUT fires autonomously)
  useEffect(() => {
    const sv = state.value as string
    if (sv !== "waiting" && inputCountdownRef.current) {
      clearInterval(inputCountdownRef.current)
      inputCountdownRef.current = null
      setInputTimeRemaining(null)
    }
  }, [state.value])

  // --- Public actions ---

  function startGame() {
    clearAllTimeouts(); stopTimer()
    inputLocked.current = false
    timerBonusRef.current = 0
    wrongCountRef.current = 0
    lastHapticSecond.current = -1
    setTimerDelta(null)
    setActiveButton(null); setButtonPositions([...colors]); setIsShuffling(false)

    // Seed RNG
    if (mode === "daily") seededRng.current = mulberry32(getDailySeed())
    else if (testSeed !== null) seededRng.current = mulberry32(testSeed)
    else seededRng.current = null

    send({ type: "START" })

    if (mode === "timed") startTimer(60)

    addTimeout(() => {
      const newSeq = [colors[getNextColorIndex()]]
      send({ type: "SET_INITIAL_SEQUENCE", sequence: newSeq })
      showSequence(newSeq, 1)
    }, 500)
  }

  function resetGame() {
    clearAllTimeouts(); stopTimer()
    inputLocked.current = false
    setActiveButton(null); setButtonPositions([...colors]); setIsShuffling(false)
    send({ type: "RESET" })
  }

  function endGame() {
    const sv = state.value as string
    if (sv !== "showing" && sv !== "waiting") return
    clearAllTimeouts(); stopTimer()
    inputLocked.current = false
    setActiveButton(null)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    send({ type: "END_GAME" })
    handleGameOverSideEffects()
  }

  function continueGame() {
    if (state.value !== "gameover") return
    clearAllTimeouts()
    inputLocked.current = false
    setActiveButton(null)
    send({ type: "CONTINUE" })

    addTimeout(() => {
      // Replay existing sequence (preserved by setupContinue action)
      showSequence(ctx.sequence, ctx.level)
      // Machine transitions starting → showing via SET_INITIAL_SEQUENCE
      send({ type: "SET_INITIAL_SEQUENCE", sequence: ctx.sequence })
    }, 500)
  }

  function handleButtonTouch(color: Color) {
    if (state.value !== "waiting") return
    if (inputLocked.current) return
    inputLocked.current = true

    buttonPressStartTime.current = Date.now()
    setActiveButton(color)
    startContinuousSound(color)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  }

  function handleButtonRelease(color: Color) {
    if (state.value !== "waiting") return
    const toneDuration = getToneDuration(ctx.level)
    const pressDuration = buttonPressStartTime.current ? Date.now() - buttonPressStartTime.current : 0

    if (pressDuration < toneDuration) {
      stopContinuousSoundWithFade(color, 100)
      addTimeout(() => setActiveButton(null), toneDuration - pressDuration)
    } else {
      setActiveButton(null)
      stopContinuousSoundWithFade(color, 200)
    }

    // Clear input countdown
    if (inputCountdownRef.current) { clearInterval(inputCountdownRef.current); inputCountdownRef.current = null }
    setInputTimeRemaining(null)

    // Check correctness
    const newPlayerLen = ctx.playerSequence.length + 1
    const expectedIndex = mode === "reverse" ? ctx.sequence.length - 1 - (newPlayerLen - 1) : newPlayerLen - 1
    const expectedColor = ctx.sequence[expectedIndex]

    if (color !== expectedColor) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setWrongFlash(true)
      addTimeout(() => setWrongFlash(false), 300)
      send({ type: "WRONG_INPUT" })

      if (mode === "timed") {
        wrongCountRef.current += 1
        timerBonusRef.current -= wrongCountRef.current
        setTimerDelta(-wrongCountRef.current)
        addTimeout(() => setTimerDelta(null), 1000)
        addTimeout(() => showSequence(ctx.sequence, ctx.level), 500)
      } else {
        handleGameOverSideEffects()
      }
      inputLocked.current = false
      return
    }

    // Correct input
    const willComplete = newPlayerLen === ctx.sequence.length
    send({ type: "CORRECT_INPUT", color })

    if (willComplete) {
      if (mode === "timed") {
        timerBonusRef.current += 2
        setTimerDelta(2)
        addTimeout(() => setTimerDelta(null), 1000)
      }
      addTimeout(() => {
        if (mode === "chaos") {
          const shuffleDuration = animateShuffleSequence(ctx.level + 1)
          addTimeout(() => {
            const newSeq = [...ctx.sequence, colors[getNextColorIndex()]]
            send({ type: "ADVANCE_COMPLETE", newSequence: newSeq })
            showSequence(newSeq, ctx.level + 1)
          }, shuffleDuration + 200)
        } else {
          addTimeout(() => {
            const newSeq = [...ctx.sequence, colors[getNextColorIndex()]]
            send({ type: "ADVANCE_COMPLETE", newSequence: newSeq })
            showSequence(newSeq, ctx.level + 1)
          }, 200)
        }
      }, 400)
    }

    inputLocked.current = false
  }

  function toggleSound() { setSoundEnabled((prev) => !prev) }

  function setModeAction(newMode: GameMode) {
    send({ type: "SET_MODE", mode: newMode })
  }

  return {
    gameState,
    mode: ctx.mode,
    score: ctx.score,
    level: ctx.level,
    highScore: ctx.highScore,
    activeButton,
    soundEnabled,
    sequence: ctx.sequence,
    playerSequence: ctx.playerSequence,
    isNewHighScore: ctx.isNewHighScore,
    continuedThisGame: ctx.continuedThisGame,
    timeRemaining,
    sequencesCompleted: ctx.sequencesCompleted,
    buttonPositions,
    isShuffling,
    inputTimeRemaining,
    wrongFlash,
    timerDelta,

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
    setMode: setModeAction,
  }
}
