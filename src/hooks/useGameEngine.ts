import { useState, useEffect, useRef } from "react"
import { useMachine } from "@xstate/react"
import type { OscillatorType } from "react-native-audio-api"

import { getToneDuration, getSequenceInterval, getInputTimeout } from "@/config/difficulty"
import { pickShuffleSequence, getShuffleStepDelay } from "@/config/shuffleAnimations"
import {
  DAILY_CURRENT_STREAK,
  DAILY_LAST_PLAYED,
  DAILY_PREFIX,
  HIGH_SCORE_PREFIX,
  STATS_LONGEST_STREAK,
} from "@/config/storageKeys"
import { type GameTheme, gameThemes } from "@/config/themes"
import { useAudioTones } from "@/hooks/useAudioTones"
import { useHaptics } from "@/hooks/useHaptics"
import { recordGameResult } from "@/hooks/useStats"
import { saveString, loadString } from "@/utils/storage"

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
  sessionTime: number
  getSessionTime: () => number

  startGame: () => void
  resetGame: () => void
  endGame: () => void
  continueGame: () => void
  handleButtonTouch: (color: Color) => void
  handleButtonRelease: (color: Color) => void
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
  return parseInt(
    `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`,
    10,
  )
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
  const haptics = useHaptics()

  // Local UI state
  const [activeButton, setActiveButton] = useState<Color | null>(null)
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
  const continueLocked = useRef(false)
  const sideEffectsFiredRef = useRef(false)
  const visualSequenceTokenRef = useRef(0)
  const timerBonusRef = useRef(0)
  const wrongCountRef = useRef(0)
  const lastHapticSecond = useRef(-1)
  const [timerDelta, setTimerDelta] = useState<number | null>(null)
  const deltaClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionStartTimeRef = useRef<number | null>(null)
  const [sessionTime, setSessionTime] = useState(0)

  function showTimerDelta(value: number, clearAfterMs = 2000) {
    if (deltaClearTimeoutRef.current) clearTimeout(deltaClearTimeoutRef.current)
    setTimerDelta(value)
    deltaClearTimeoutRef.current = setTimeout(() => {
      setTimerDelta(null)
      deltaClearTimeoutRef.current = null
    }, clearAfterMs)
  }
  const testSeed = getTestSeed()
  const seededRng = useRef(testSeed !== null ? mulberry32(testSeed) : null)
  const scoreRef = useRef(0)

  const activeColorMap = options?.theme ? getColorMapForTheme(options.theme) : colorMap

  const {
    initialize,
    cleanup,
    noteOn,
    noteOff,
    silenceAll,
    scheduleSequence,
    playPreview,
    playJingle,
    playGameOverJingle,
    playHighScoreJingle,
  } = useAudioTones(activeColorMap, options?.oscillatorType, options?.onAudioContextRecycle)

  const ctx = state.context
  const gameState = toPublicState(state.value as string)
  const mode = ctx.mode

  // Mirror machine context into a ref so deferred callbacks (setInterval,
  // setTimeout, audio-clock completions) read live values instead of the
  // render-time snapshot captured by JS closure. Without this, the timer
  // tick and the 500ms continue-replay callback read stale `ctx.*` fields,
  // and `handleGameOverSideEffects` can't observe `gameResultRecorded`
  // flipping when called twice in one game.
  const contextRef = useRef(ctx)
  useEffect(() => {
    contextRef.current = ctx
  }, [ctx])

  // Keep scoreRef in sync for timer callbacks
  useEffect(() => {
    scoreRef.current = ctx.score
  }, [ctx.score])

  // --- Timeout management ---

  function addTimeout(fn: () => void, ms: number) {
    const id = setTimeout(() => {
      timeoutsRef.current.delete(id)
      fn()
    }, ms)
    timeoutsRef.current.add(id)
    return id
  }

  function clearAllTimeouts() {
    for (const id of timeoutsRef.current) clearTimeout(id)
    timeoutsRef.current.clear()
    if (inputCountdownRef.current) {
      clearInterval(inputCountdownRef.current)
      inputCountdownRef.current = null
    }
    setInputTimeRemaining(null)
  }

  function getNextColorIndex(): number {
    return seededRng.current
      ? Math.floor(seededRng.current() * colors.length)
      : Math.floor(Math.random() * colors.length)
  }

  // --- Persistence ---

  function loadHighScore() {
    const saved = loadString(highScoreKey(mode))
    send({ type: "SET_HIGH_SCORE", highScore: saved ? parseInt(saved, 10) : 0 })
  }

  function saveHighScore(s: number) {
    saveString(highScoreKey(mode), s.toString())
  }

  function saveDailyResult(finalScore: number) {
    const todayKey = getTodayKey()
    const bestKey = `${DAILY_PREFIX}${todayKey}:bestScore`
    const currentBest = parseInt(loadString(bestKey) ?? "0", 10)
    if (finalScore > currentBest) saveString(bestKey, finalScore.toString())

    const lastPlayed = loadString(DAILY_LAST_PLAYED) ?? ""
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
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
      const remaining = durationSec + timerBonusRef.current - (Date.now() - startTime) / 1000
      if (remaining <= 0) {
        stopTimer()
        clearAllTimeouts()
        silenceAll()
        send({ type: "TIMER_EXPIRED" })
        haptics.play("wrongButton")
        handleGameOverSideEffects()
      } else {
        setTimeRemaining(remaining)
        const sec = Math.ceil(remaining)
        if (sec !== lastHapticSecond.current && sec <= 10 && sec > 0) {
          lastHapticSecond.current = sec
          const urgency = sec <= 3 ? "high" : sec <= 5 ? "medium" : "low"
          haptics.play("countdownTick", { urgency })
        }
      }
    }, 100)
  }

  function handleGameOverSideEffects() {
    // Read live context instead of the render-time `ctx`/`mode` closures.
    // This function is reachable from startTimer's setInterval (where
    // `ctx` is captured at the render when `startTimer` was invoked), from
    // endGame(), and from the non-timed wrong-input branch of
    // handleButtonRelease — any two of which could fire in the same
    // game-over transition (e.g. a timer tick landing the same frame as
    // endGame before stopTimer cancels the interval). `gameResultRecorded`
    // guards the machine-side recordGameResult, but saveHighScore and
    // saveDailyResult have no such guard, so a local once-per-transition
    // ref is belt-and-suspenders against double writes. It resets on
    // start/reset/continue so legitimate repeat game-overs (e.g. losing
    // again after continueGame) still persist a higher score.
    if (sideEffectsFiredRef.current) return
    sideEffectsFiredRef.current = true
    const live = contextRef.current
    const sc = scoreRef.current
    if (sc > live.highScore) saveHighScore(sc)
    if (!live.gameResultRecorded) recordGameResult(sc)
    if (live.mode === "daily") saveDailyResult(sc)
  }

  // --- Sequence playback ---

  function flashButton(color: Color, duration: number) {
    setActiveButton(color)
    haptics.play("sequenceFlash")
    addTimeout(() => setActiveButton(null), duration)
  }

  function showSequence(seq: Color[], currentLevel: number) {
    const token = visualSequenceTokenRef.current
    const toneDuration = getToneDuration(currentLevel)
    const interval = getSequenceInterval(currentLevel)
    const flashDuration = Math.min(toneDuration, interval - 80)

    // Audio: pre-schedule entire sequence on the audio clock (zero JS jitter)
    scheduleSequence(seq, interval / 1000, toneDuration / 1000)

    // Visual: still via setTimeout (doesn't need audio-clock precision)
    seq.forEach((color, index) => {
      addTimeout(
        () => {
          if (token !== visualSequenceTokenRef.current) return
          flashButton(color, flashDuration)
          if (index === seq.length - 1) {
            addTimeout(() => {
              if (token !== visualSequenceTokenRef.current) return
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
                    if (inputCountdownRef.current) {
                      clearInterval(inputCountdownRef.current)
                      inputCountdownRef.current = null
                    }
                    setInputTimeRemaining(null)
                  }
                }, 200)
              }
            }, flashDuration + 100)
          }
        },
        (index + 1) * interval,
      )
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
    return () => {
      clearAllTimeouts()
      stopTimer()
      cleanup()
    }
  }, [])

  useEffect(() => {
    loadHighScore()
  }, [mode])

  // Clean up countdown interval when machine exits waiting (e.g., INPUT_TIMEOUT fires autonomously)
  useEffect(() => {
    const sv = state.value as string
    if (sv !== "waiting" && inputCountdownRef.current) {
      clearInterval(inputCountdownRef.current)
      inputCountdownRef.current = null
      setInputTimeRemaining(null)
    }
  }, [state.value])

  // Capture elapsed session time whenever the machine enters gameover
  const prevStateValueRef = useRef<string>(state.value as string)
  useEffect(() => {
    const sv = state.value as string
    const prev = prevStateValueRef.current
    if (prev !== "gameover" && sv === "gameover" && sessionStartTimeRef.current !== null) {
      const elapsed = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000)
      setSessionTime(elapsed)
    }
    prevStateValueRef.current = sv
  }, [state.value])

  function cancelVisualSequence() {
    visualSequenceTokenRef.current += 1
    setActiveButton(null)
  }

  // --- Public actions ---

  function startGame() {
    clearAllTimeouts()
    stopTimer()
    cancelVisualSequence()
    inputLocked.current = false
    sideEffectsFiredRef.current = false
    timerBonusRef.current = 0
    wrongCountRef.current = 0
    lastHapticSecond.current = -1
    if (deltaClearTimeoutRef.current) clearTimeout(deltaClearTimeoutRef.current)
    deltaClearTimeoutRef.current = null
    setTimerDelta(null)
    sessionStartTimeRef.current = Date.now()
    setSessionTime(0)
    setWrongFlash(false)
    setButtonPositions([...colors])
    setIsShuffling(false)

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
    clearAllTimeouts()
    stopTimer()
    cancelVisualSequence()
    // `scheduleSequence` writes gain automation directly onto the audio
    // render thread's timeline — `clearAllTimeouts` only reaches JS timers.
    // Without this, events survive a reset and can resurface audibly after
    // an AppState suspend/resume cycle (e.g. rewarded ad → main menu).
    silenceAll()
    inputLocked.current = false
    sideEffectsFiredRef.current = false
    setWrongFlash(false)
    setButtonPositions([...colors])
    setIsShuffling(false)
    send({ type: "RESET" })
  }

  function endGame() {
    const sv = state.value as string
    if (sv !== "showing" && sv !== "waiting" && sv !== "advancing") return
    clearAllTimeouts()
    stopTimer()
    cancelVisualSequence()
    silenceAll()
    inputLocked.current = false
    setWrongFlash(false)
    if (ctx.score === 0) {
      setButtonPositions([...colors])
      setIsShuffling(false)
      send({ type: "RESET" })
      return
    }
    haptics.play("wrongButton")
    send({ type: "END_GAME" })
    handleGameOverSideEffects()
  }

  function continueGame() {
    if (state.value !== "gameover") return
    if (continueLocked.current) return
    continueLocked.current = true
    clearAllTimeouts()
    cancelVisualSequence()
    // Kill anything left on the audio clock from the pre-game-over sequence
    // *before* scheduling the replay. AppState resume on ad dismiss can
    // un-pause the context mid-queue; without this, residual events overlap
    // the replayed sequence. See resetGame for the same rationale.
    silenceAll()
    inputLocked.current = false
    sideEffectsFiredRef.current = false
    setWrongFlash(false)
    const sequenceToReplay = [...ctx.sequence]
    const levelToReplay = ctx.level
    send({ type: "CONTINUE" })

    addTimeout(() => {
      send({ type: "SET_INITIAL_SEQUENCE", sequence: sequenceToReplay })
      addTimeout(() => {
        continueLocked.current = false
        showSequence(sequenceToReplay, levelToReplay)
      }, 0)
    }, 500)
  }

  function handleButtonTouch(color: Color) {
    if (state.value !== "waiting") return
    if (inputLocked.current) return
    inputLocked.current = true

    buttonPressStartTime.current = Date.now()
    setActiveButton(color)
    noteOn(color)
    haptics.play("buttonPress")
  }

  function handleButtonRelease(color: Color) {
    if (state.value !== "waiting") {
      // State moved on between touch and release (backgrounding, INPUT_TIMEOUT, etc.).
      // Release transient press state so the pad doesn't stay lit/audible/locked.
      if (inputLocked.current) {
        noteOff(color)
        setActiveButton(null)
        buttonPressStartTime.current = null
        inputLocked.current = false
      }
      return
    }
    const toneDuration = getToneDuration(ctx.level)
    const pressDuration = buttonPressStartTime.current
      ? Date.now() - buttonPressStartTime.current
      : 0

    // Audio: always release immediately (150ms fade handles smoothness)
    noteOff(color)

    // Visual: keep button lit for minimum toneDuration on quick taps
    if (pressDuration < toneDuration) {
      addTimeout(() => setActiveButton(null), toneDuration - pressDuration)
    } else {
      setActiveButton(null)
    }

    // Clear input countdown
    if (inputCountdownRef.current) {
      clearInterval(inputCountdownRef.current)
      inputCountdownRef.current = null
    }
    setInputTimeRemaining(null)

    // Check correctness
    const newPlayerLen = ctx.playerSequence.length + 1
    const expectedIndex =
      mode === "reverse" ? ctx.sequence.length - 1 - (newPlayerLen - 1) : newPlayerLen - 1
    const expectedColor = ctx.sequence[expectedIndex]

    if (color !== expectedColor) {
      silenceAll()
      haptics.play("wrongButton")
      // Drop pending sequence / chaos shuffle timers so nothing fires after gameover or reset.
      if (mode !== "timed") {
        clearAllTimeouts()
        cancelVisualSequence()
      }
      const shouldFlashWrongInput = mode === "timed" || ctx.score > 0
      if (shouldFlashWrongInput) {
        setWrongFlash(true)
        addTimeout(() => setWrongFlash(false), 300)
      }
      send({ type: "WRONG_INPUT" })

      if (mode === "timed") {
        wrongCountRef.current += 1
        timerBonusRef.current -= wrongCountRef.current
        showTimerDelta(-wrongCountRef.current)
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
        showTimerDelta(2)
      }
      addTimeout(() => {
        if (mode === "chaos") {
          const shuffleDuration = animateShuffleSequence(ctx.level + 1)
          addTimeout(() => {
            const newSeq = [...ctx.sequence, colors[getNextColorIndex()]]
            send({ type: "ADVANCE_COMPLETE", newSequence: newSeq })
            showSequence(newSeq, ctx.level + 1)
          }, shuffleDuration + 600)
        } else {
          addTimeout(() => {
            const newSeq = [...ctx.sequence, colors[getNextColorIndex()]]
            send({ type: "ADVANCE_COMPLETE", newSequence: newSeq })
            showSequence(newSeq, ctx.level + 1)
          }, 600)
        }
      }, 400)
    }

    inputLocked.current = false
  }

  function getSessionTime(): number {
    if (!sessionStartTimeRef.current) return 0
    return Math.floor((Date.now() - sessionStartTimeRef.current) / 1000)
  }

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
    sessionTime,
    getSessionTime,

    startGame,
    resetGame,
    endGame,
    continueGame,
    handleButtonTouch,
    handleButtonRelease,
    playPreview,
    playJingle,
    playGameOverJingle,
    playHighScoreJingle,
    setMode: setModeAction,
  }
}
