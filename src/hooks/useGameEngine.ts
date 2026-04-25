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
  previewPadTouch: (color: Color) => void
  previewPadRelease: (color: Color) => void
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
  const [state, send, actorRef] = useMachine(gameEngineMachine)
  const haptics = useHaptics()

  // Local UI state
  const [activeButton, setActiveButton] = useState<Color | null>(null)
  const [wrongFlash, setWrongFlash] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [inputTimeRemaining, setInputTimeRemaining] = useState<number | null>(null)
  const [buttonPositions, setButtonPositions] = useState<Color[]>([...colors])
  const [isShuffling, setIsShuffling] = useState(false)
  const [timerDelta, setTimerDelta] = useState<number | null>(null)
  const [sessionTime, setSessionTime] = useState(0)

  // Refs for state that JS-event handlers carry across renders (UI debounce,
  // audio-clock continuations) but the machine doesn't track. Anything that
  // existed only to compensate for stale closures (contextRef, scoreRef,
  // sideEffectsFiredRef) is gone — the consolidated state-watching effect
  // reads `state.context` live on each transition.
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inputCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const buttonPressStartTime = useRef<number | null>(null)
  const inputLocked = useRef(false)
  const continueLocked = useRef(false)
  const visualSequenceTokenRef = useRef(0)
  const timerBonusRef = useRef(0)
  const wrongCountRef = useRef(0)
  const lastHapticSecond = useRef(-1)
  const deltaClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionStartTimeRef = useRef<number | null>(null)
  const prevStateValueRef = useRef<string>("idle")

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
        // Hand off to the machine — the consolidated state-watching effect's
        // `gameover` branch handles silenceAll + persistence + haptics.
        send({ type: "TIMER_EXPIRED" })
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

  // --- Visual sequence playback ---

  function flashButton(color: Color, duration: number) {
    setActiveButton(color)
    haptics.play("sequenceFlash")
    addTimeout(() => setActiveButton(null), duration)
  }

  function cancelVisualSequence() {
    visualSequenceTokenRef.current += 1
    setActiveButton(null)
  }

  function runShowSequence(seq: Color[], currentLevel: number) {
    const token = ++visualSequenceTokenRef.current
    const toneDuration = getToneDuration(currentLevel)
    const interval = getSequenceInterval(currentLevel)
    const flashDuration = Math.min(toneDuration, interval - 80)

    // Audio: pre-schedule entire sequence on the audio clock (zero JS jitter).
    scheduleSequence(seq, interval / 1000, toneDuration / 1000)

    // Visuals: per-step setTimeout chain. Each callback bails if the token
    // has been bumped (cancelVisualSequence on state exit, or another
    // entry into "showing" superseding this one).
    seq.forEach((color, index) => {
      addTimeout(
        () => {
          if (token !== visualSequenceTokenRef.current) return
          flashButton(color, flashDuration)
          if (index === seq.length - 1) {
            addTimeout(() => {
              if (token !== visualSequenceTokenRef.current) return
              send({ type: "SEQUENCE_DONE" })
            }, flashDuration + 100)
          }
        },
        (index + 1) * interval,
      )
    })
  }

  function startInputCountdown(totalMs: number) {
    if (inputCountdownRef.current) clearInterval(inputCountdownRef.current)
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

  // --- Consolidated state-watching effect ---
  //
  // Single dispatcher keyed on raw machine state.value (NOT the public
  // projection — `starting`/`advancing`/`replaying` are distinct triggers).
  // Side effects that belong to a state transition live here; per-event
  // imperative side effects (touch noteOn, release noteOff) stay inline
  // in their handlers because they need sub-frame audio latency.
  //
  // Subscribes directly to the actor (rather than running on a state.value
  // useEffect) so transitions triggered inside timer callbacks dispatch
  // synchronously — preserving the original code's "schedule next phase
  // inside the addTimeout that fired this one" pattern, which matters for
  // single-tick advanceTimersByTime test choreography.
  //
  // This collapses the prior stale-closure surface (timer-tick reading
  // contextRef, continueGame's nested addTimeouts, handleGameOverSideEffects
  // reachable from 3 paths) into one place that reads context live on every
  // transition.
  useEffect(() => {
    const sub = actorRef.subscribe((snapshot) => {
      const next = snapshot.value as string
      const prev = prevStateValueRef.current
      if (prev === next) return
      prevStateValueRef.current = next
      const live = snapshot.context

      // Exit-side cleanup
      if (prev === "waiting") {
        if (inputCountdownRef.current) {
          clearInterval(inputCountdownRef.current)
          inputCountdownRef.current = null
        }
        setInputTimeRemaining(null)
      }

      // Enter-side dispatch
      dispatchEnter(next, live)
    })
    return () => sub.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorRef])

  function dispatchEnter(next: string, live: typeof state.context) {
    switch (next) {
      case "idle":
        stopTimer()
        silenceAll()
        cancelVisualSequence()
        clearAllTimeouts()
        lastHapticSecond.current = -1
        break

      case "starting":
        // Reach via START (fresh game) or CONTINUE (replay preserved sequence).
        // silenceAll guards against AppState resume un-pausing residual audio
        // from the prior session (e.g. rewarded-ad dismiss → continue path).
        stopTimer()
        silenceAll()
        cancelVisualSequence()
        lastHapticSecond.current = -1
        if (live.mode === "timed" && !live.continuedThisGame) startTimer(60)
        // Schedule the SET_INITIAL_SEQUENCE event 500ms after entry.
        // Fresh start: generate a 1-color sequence.
        // Continue: replay live.sequence (preserved by setupContinue).
        addTimeout(() => {
          const seqToShow = live.continuedThisGame
            ? [...live.sequence]
            : [colors[getNextColorIndex()]]
          send({ type: "SET_INITIAL_SEQUENCE", sequence: seqToShow })
        }, 500)
        break

      case "showing":
        runShowSequence(live.sequence, live.level)
        break

      case "waiting":
        if (live.mode !== "timed") startInputCountdown(getInputTimeout(live.sequence.length))
        break

      case "replaying":
        // Defensive: kill any tail of the previous showing's audio queue
        // before the 500ms machine delay elapses and we re-enter showing.
        silenceAll()
        break

      case "advancing":
        // 400ms post-input pause, then chaos shuffle (if applicable), then
        // 600ms beat, then ADVANCE_COMPLETE → showing → effect re-fires for
        // the new sequence.
        addTimeout(() => {
          const newSeq = [...live.sequence, colors[getNextColorIndex()]]
          if (live.mode === "chaos") {
            const dur = animateShuffleSequence(live.level)
            addTimeout(() => send({ type: "ADVANCE_COMPLETE", newSequence: newSeq }), dur + 600)
          } else {
            addTimeout(() => send({ type: "ADVANCE_COMPLETE", newSequence: newSeq }), 600)
          }
        }, 400)
        break

      case "gameover":
        stopTimer()
        silenceAll()
        cancelVisualSequence()
        haptics.play("wrongButton")
        // markGameOver (machine action) just ran; live context is post-mark.
        // isNewHighScore precisely captures "this gameover bumped highScore"
        // — markGameOver guards on `score > prevHighScore && !prevIsNewHighScore`.
        // setupContinue clears isNewHighScore, so a higher score after CONTINUE
        // re-fires this branch.
        if (live.isNewHighScore) saveHighScore(live.score)
        // recordGameResult fires once per game session (first gameover only).
        // After CONTINUE, continuedThisGame is true; subsequent gameovers do
        // not double-record. This matches the prior `!gameResultRecorded`
        // guard, which was preserved across setupContinue.
        if (!live.continuedThisGame) recordGameResult(live.score)
        if (live.mode === "daily") saveDailyResult(live.score)
        if (sessionStartTimeRef.current !== null) {
          const elapsed = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000)
          setSessionTime(elapsed)
        }
        break
    }
  }

  // --- Public actions ---

  function startGame() {
    clearAllTimeouts()
    cancelVisualSequence()
    inputLocked.current = false
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
    // Effect on entering "starting" handles: stopTimer, silenceAll,
    // startTimer (if timed), and the addTimeout(SET_INITIAL_SEQUENCE).
  }

  function resetGame() {
    clearAllTimeouts()
    cancelVisualSequence()
    inputLocked.current = false
    setWrongFlash(false)
    setButtonPositions([...colors])
    setIsShuffling(false)
    send({ type: "RESET" })
    // Effect on entering "idle" handles: stopTimer, silenceAll, etc.
  }

  function endGame() {
    const sv = state.value as string
    if (sv !== "showing" && sv !== "waiting" && sv !== "advancing") return
    if (ctx.score === 0) {
      setButtonPositions([...colors])
      setIsShuffling(false)
      send({ type: "RESET" })
      return
    }
    clearAllTimeouts()
    cancelVisualSequence()
    inputLocked.current = false
    setWrongFlash(false)
    send({ type: "END_GAME" })
    // Effect on entering "gameover" handles: stopTimer, silenceAll, haptic, persistence
  }

  function continueGame() {
    if (state.value !== "gameover") return
    if (continueLocked.current) return
    continueLocked.current = true
    clearAllTimeouts()
    cancelVisualSequence()
    inputLocked.current = false
    setWrongFlash(false)
    send({ type: "CONTINUE" })
    // Effect on entering "starting" with continuedThisGame=true handles the
    // 500ms-delayed SET_INITIAL_SEQUENCE using the preserved sequence.
    // Release the UI debounce after the init has fired.
    addTimeout(() => {
      continueLocked.current = false
    }, 700)
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

  // Idle-state free play: the player can tap pads on the main menu to trigger
  // the pad tone + glow + haptic without starting a game. Does not touch any
  // machine state — no playerSequence, no score, no transitions. If the
  // engine is ever not in "idle" when these fire (state moved on between
  // touch and release, etc.), they fall back to cleaning up transient state
  // without advancing anything.
  function previewPadTouch(color: Color) {
    if (state.value !== "idle") return
    if (inputLocked.current) return
    inputLocked.current = true

    buttonPressStartTime.current = Date.now()
    setActiveButton(color)
    noteOn(color)
    haptics.play("buttonPress")
  }

  function previewPadRelease(color: Color) {
    // Symmetric lock guard — see handleButtonRelease for rationale.
    if (state.value !== "idle" || !inputLocked.current) {
      if (inputLocked.current) {
        noteOff(color)
        setActiveButton(null)
        buttonPressStartTime.current = null
        inputLocked.current = false
      }
      return
    }
    // Use level-1 tone duration as the visual-hold floor — the same minimum
    // the game uses for quick taps during waiting. Keeps the glow legible on
    // snap taps without lingering after long presses.
    const toneDuration = getToneDuration(1)
    const pressDuration = buttonPressStartTime.current
      ? Date.now() - buttonPressStartTime.current
      : 0
    noteOff(color)
    if (pressDuration < toneDuration) {
      addTimeout(() => setActiveButton(null), toneDuration - pressDuration)
    } else {
      setActiveButton(null)
    }
    buttonPressStartTime.current = null
    inputLocked.current = false
  }

  function handleButtonRelease(color: Color) {
    // Symmetric lock guard. Without `!inputLocked.current` here, a press that
    // fired during "showing" (rejected by handleButtonTouch's state check)
    // followed by a release after SEQUENCE_DONE propagates would still dispatch
    // CORRECT_INPUT with no preceding noteOn / activeButton / haptic — input
    // registered as correct, but silent. Requiring the lock matches the
    // contract: only releases that pair with an accepted press validate.
    if (state.value !== "waiting" || !inputLocked.current) {
      // Lock is set but state moved on (backgrounding, INPUT_TIMEOUT, etc.).
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

    // Check correctness
    const newPlayerLen = ctx.playerSequence.length + 1
    const expectedIndex =
      mode === "reverse" ? ctx.sequence.length - 1 - (newPlayerLen - 1) : newPlayerLen - 1
    const expectedColor = ctx.sequence[expectedIndex]

    if (color !== expectedColor) {
      haptics.play("wrongButton")
      const shouldFlashWrongInput = mode === "timed" || ctx.score > 0
      if (shouldFlashWrongInput) {
        setWrongFlash(true)
        addTimeout(() => setWrongFlash(false), 300)
      }
      if (mode === "timed") {
        wrongCountRef.current += 1
        timerBonusRef.current -= wrongCountRef.current
        showTimerDelta(-wrongCountRef.current)
      }
      // Machine handles the rest:
      // - timed mode: WRONG_INPUT → replaying → (500ms) → showing
      //   (consolidated effect schedules the audio replay on showing entry)
      // - non-timed: WRONG_INPUT → gameover (effect handles silence + persistence)
      send({ type: "WRONG_INPUT" })
      inputLocked.current = false
      return
    }

    // Correct input
    const willComplete = newPlayerLen === ctx.sequence.length
    if (willComplete && mode === "timed") {
      timerBonusRef.current += 2
      showTimerDelta(2)
    }
    // Machine handles round advancement:
    // - sequence-incomplete: stays in waiting, appends playerSequence
    // - sequence-complete: → advancing (consolidated effect schedules
    //   the 400/600ms beat + chaos shuffle + ADVANCE_COMPLETE)
    send({ type: "CORRECT_INPUT", color })
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
    previewPadTouch,
    previewPadRelease,
    playPreview,
    playJingle,
    playGameOverJingle,
    playHighScoreJingle,
    setMode: setModeAction,
  }
}
