import { renderHook, act } from "@testing-library/react-native"

import { HIGH_SCORE_PREFIX } from "@/config/storageKeys"
import { saveString } from "@/utils/storage"

import { useGameEngine, colors } from "../useGameEngine"

// Hoisted mock fns so regression tests below can assert call counts on
// specific audio methods (silenceAll in particular — see the silencing
// regression tests at the end of this file).
const mockSilenceAll = jest.fn()
const mockScheduleSequence = jest.fn()

jest.mock("@/hooks/useAudioTones", () => ({
  useAudioTones: () => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    cleanup: jest.fn().mockResolvedValue(undefined),
    noteOn: jest.fn(),
    noteOff: jest.fn(),
    silenceAll: mockSilenceAll,
    scheduleSequence: mockScheduleSequence,
    playPreview: jest.fn(),
    playJingle: jest.fn(),
    playGameOverJingle: jest.fn(),
    playHighScoreJingle: jest.fn(),
    syncVolume: jest.fn(),
  }),
}))

jest.mock("react-native-pulsar", () => ({
  Presets: {
    System: {
      impactLight: jest.fn(),
      impactMedium: jest.fn(),
      impactHeavy: jest.fn(),
      notificationSuccess: jest.fn(),
      notificationError: jest.fn(),
    },
  },
  usePatternComposer: () => ({
    play: jest.fn(),
    stop: jest.fn(),
    parse: jest.fn(),
    isParsed: jest.fn(() => true),
  }),
}))

jest.mock("@/hooks/useStats", () => ({
  recordGameResult: jest.fn(),
}))

jest.mock("@/utils/storage", () => ({
  loadString: jest.fn(() => null),
  saveString: jest.fn(),
}))

beforeEach(() => {
  jest.useFakeTimers()
  mockSilenceAll.mockClear()
  mockScheduleSequence.mockClear()
  ;(saveString as jest.Mock).mockClear()
})

afterEach(() => {
  jest.useRealTimers()
})

/** Helper: start game, complete 1 round, then lose — produces a high score */
function startScoreAndLose() {
  const hook = renderHook(() => useGameEngine())

  // Start game
  act(() => {
    hook.result.current.startGame()
  })
  act(() => {
    jest.advanceTimersByTime(500)
  })

  const correctColor = hook.result.current.sequence[0]
  const wrongColor = colors.find((c) => c !== correctColor)!

  // Wait for waiting state
  act(() => {
    jest.advanceTimersByTime(2000)
  })

  // Complete round 1 (score = 10)
  act(() => {
    hook.result.current.handleButtonTouch(correctColor)
  })
  act(() => {
    jest.advanceTimersByTime(600)
  })
  act(() => {
    hook.result.current.handleButtonRelease(correctColor)
  })

  // Wait for next sequence to show
  act(() => {
    jest.advanceTimersByTime(3000)
  })

  // Wait for waiting state again
  act(() => {
    jest.advanceTimersByTime(3000)
  })

  // Lose on round 2
  act(() => {
    hook.result.current.handleButtonTouch(wrongColor)
  })
  act(() => {
    jest.advanceTimersByTime(600)
  })
  act(() => {
    hook.result.current.handleButtonRelease(wrongColor)
  })

  return hook
}

describe("useGameEngine — bug regressions", () => {
  // BUG: isNewHighScore stays true after continueGame + second loss
  // Expected: isNewHighScore should be false on second game-over after continue
  it("resets isNewHighScore after continueGame and second loss", () => {
    const { result } = startScoreAndLose()

    expect(result.current.gameState).toBe("gameover")
    expect(result.current.score).toBe(10)
    expect(result.current.isNewHighScore).toBe(true)

    // Continue the game
    act(() => {
      result.current.continueGame()
    })
    act(() => {
      jest.advanceTimersByTime(500)
    })

    // Wait for waiting state
    act(() => {
      jest.advanceTimersByTime(3000)
    })

    // Lose again with wrong color
    const wrongColor = colors.find((c) => c !== result.current.sequence[0])!
    act(() => {
      result.current.handleButtonTouch(wrongColor)
    })
    act(() => {
      jest.advanceTimersByTime(600)
    })
    act(() => {
      result.current.handleButtonRelease(wrongColor)
    })

    expect(result.current.gameState).toBe("gameover")
    // BUG: This should be false — same score, not a new high score
    expect(result.current.isNewHighScore).toBe(false)
  })

  // BUG: No input timeout — player can idle in "waiting" state forever
  // Expected: gameState should transition to "gameover" after timeout
  it("transitions to gameover after input timeout in waiting state", () => {
    const hook = renderHook(() => useGameEngine())

    act(() => {
      hook.result.current.startGame()
    })
    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(hook.result.current.gameState).toBe("showing")

    // Wait for showing to complete → waiting
    act(() => {
      jest.advanceTimersByTime(2000)
    })

    expect(hook.result.current.gameState).toBe("waiting")

    // Advance 60 seconds without any input
    act(() => {
      jest.advanceTimersByTime(60000)
    })

    // BUG: gameState is still "waiting" — should be "gameover"
    expect(hook.result.current.gameState).toBe("gameover")
  })
})

describe("useGameEngine — behavior guards", () => {
  it("resetGame returns to clean idle state", () => {
    const { result } = startScoreAndLose()

    expect(result.current.gameState).toBe("gameover")
    expect(result.current.score).toBeGreaterThan(0)

    act(() => {
      result.current.resetGame()
    })

    expect(result.current.gameState).toBe("idle")
    expect(result.current.score).toBe(0)
    expect(result.current.level).toBe(1)
    expect(result.current.sequence).toEqual([])
    expect(result.current.playerSequence).toEqual([])
    expect(result.current.activeButton).toBeNull()
    expect(result.current.isNewHighScore).toBe(false)
    expect(result.current.continuedThisGame).toBe(false)
  })

  it("continueGame preserves score and sequence content", () => {
    const { result } = startScoreAndLose()

    const scoreBefore = result.current.score
    const sequenceBefore = [...result.current.sequence]

    act(() => {
      result.current.continueGame()
    })

    expect(result.current.score).toBe(scoreBefore)
    expect(result.current.sequence).toEqual(sequenceBefore)
    expect(result.current.playerSequence).toEqual([])
    expect(result.current.continuedThisGame).toBe(true)
  })

  // BUG: endGame does nothing when called during the `advancing` state
  // After the player completes a sequence, the machine transitions waiting → advancing
  // while it schedules the next round. The button stays visible (advancing maps to
  // public "showing") but endGame() returned early because it only checked for
  // "showing" | "waiting", causing a dead zone of ~1000ms where End Game is a no-op.
  it("endGame triggers game-over when called during the advancing state", () => {
    const { result } = renderHook(() => useGameEngine())

    act(() => {
      result.current.startGame()
    })
    // Let the starting → showing transition complete
    act(() => {
      jest.advanceTimersByTime(500)
    })

    // Wait for showing → waiting
    act(() => {
      jest.advanceTimersByTime(2000)
    })

    expect(result.current.gameState).toBe("waiting")

    const correctColor = result.current.sequence[0]

    // Complete the sequence — machine enters `advancing`
    act(() => {
      result.current.handleButtonTouch(correctColor)
    })
    act(() => {
      jest.advanceTimersByTime(100)
    })
    act(() => {
      result.current.handleButtonRelease(correctColor)
    })

    // Do NOT advance timers past the 1000ms advance delay — machine is in `advancing`
    // Score is 10 (1 round completed), so endGame should trigger game-over
    act(() => {
      result.current.endGame()
    })

    expect(result.current.gameState).toBe("gameover")
  })
})

// Regression coverage for the leaked-audio-on-idle bug: `scheduleSequence`
// writes gain automation directly onto the audio render thread's timeline,
// so JS-side cleanup (`clearAllTimeouts`, `cancelVisualSequence`) does not
// reach it. Without `silenceAll`, those events survive across an AppState
// suspend/resume cycle (rewarded ad → main menu) and fire on the idle
// screen. `resetGame` and `continueGame` must both silence the pool
// before transitioning — see useGameEngine.ts:resetGame and continueGame
// for the rationale comments.
describe("useGameEngine — audio silencing on state transitions", () => {
  it("resetGame silences the audio pool", () => {
    const { result } = renderHook(() => useGameEngine())

    // Start a round to register the hook, then reset.
    act(() => {
      result.current.startGame()
    })
    act(() => {
      jest.advanceTimersByTime(500)
    })

    mockSilenceAll.mockClear() // baseline after startup

    act(() => {
      result.current.resetGame()
    })

    expect(mockSilenceAll).toHaveBeenCalledTimes(1)
    expect(result.current.gameState).toBe("idle")
  })

  it("continueGame silences the audio pool before scheduling the replay", () => {
    const { result } = startScoreAndLose()

    expect(result.current.gameState).toBe("gameover")
    mockSilenceAll.mockClear() // ignore any silence calls from the pre-gameover flow

    act(() => {
      result.current.continueGame()
    })

    // silenceAll runs synchronously at the top of continueGame.
    expect(mockSilenceAll).toHaveBeenCalledTimes(1)
  })
})

// Regression coverage for the rewarded-ad continue bug: before the fix in
// GameScreen.tsx's useFocusEffect, the engine would be reset to idle mid-ad
// (the focus-effect's pendingAction guard failed because the pending-action
// useEffect had already cleared the store synchronously on commit). By the
// time continueGame() finally ran after the ad resolved, the machine was no
// longer in gameover, so the function bailed via its guard at useGameEngine.ts
// line ~494. Result: the user watched the ad, earned the reward, and landed
// on main menu with no replay.
//
// The screen-level fix guards the rewarded-ad async window so the engine does
// not get reset out from under the continue flow before the ad resolves.
describe("useGameEngine — rewarded continue replay", () => {
  it("continueGame schedules the sequence replay after the 500ms delay", () => {
    const { result } = startScoreAndLose()

    expect(result.current.gameState).toBe("gameover")
    const sequenceAtGameOver = [...result.current.sequence]
    mockScheduleSequence.mockClear() // ignore schedule calls from the pre-gameover flow

    act(() => {
      result.current.continueGame()
    })

    // continueGame queues two nested addTimeouts: 500ms outer, 0ms inner.
    // The outer fires → sends SET_INITIAL_SEQUENCE + queues inner. The inner
    // fires (next microtask) → showSequence → scheduleSequence. Advance past
    // both in one call to flush the chain.
    act(() => {
      jest.advanceTimersByTime(600)
    })

    expect(mockScheduleSequence).toHaveBeenCalled()
    // First positional arg to scheduleSequence is the array of colors.
    expect(mockScheduleSequence.mock.calls[0][0]).toEqual(sequenceAtGameOver)
  })

  it("continueGame does nothing if the engine left gameover state before it ran", () => {
    // Simulates what happened pre-fix: resetGame fired mid-ad (moving the
    // engine to idle), then continueGame was invoked when showRewarded
    // resolved. The guard at the top of continueGame should protect against
    // scheduling a replay in that case.
    const { result } = startScoreAndLose()

    act(() => {
      result.current.resetGame() // simulate the spurious mid-ad reset
    })

    expect(result.current.gameState).toBe("idle")
    mockScheduleSequence.mockClear()

    act(() => {
      result.current.continueGame() // would run when showRewarded resolves
    })
    act(() => {
      jest.advanceTimersByTime(500)
    })
    act(() => {
      jest.advanceTimersByTime(0)
    })

    expect(mockScheduleSequence).not.toHaveBeenCalled()
    expect(result.current.gameState).toBe("idle")
  })
})

// Regression coverage for BACKLOG "handleGameOverSideEffects can double-fire
// saveHighScore / saveDailyResult". The function is called from both endGame
// and the non-timed wrong-input branch of handleButtonRelease. gameResultRecorded
// guards the inner recordGameResult call inside the machine, but saveHighScore
// and saveDailyResult write paths have no such guard. Today's code only reaches
// the function once per game, but this test codifies the invariant so the
// architectural refactor (single state-watching effect) can't regress it.
describe("useGameEngine — high-score persistence guard", () => {
  function countHighScoreWrites(): number {
    return (saveString as jest.Mock).mock.calls.filter(([key]: [string]) =>
      key.startsWith(HIGH_SCORE_PREFIX),
    ).length
  }

  it("saveString(highScoreKey) fires at most once across a normal game-over flow", () => {
    const { result } = startScoreAndLose()

    expect(result.current.gameState).toBe("gameover")
    expect(result.current.score).toBe(10)
    // Score 10 beats the default highScore 0 → one write expected.
    expect(countHighScoreWrites()).toBe(1)
  })

  it("does not re-persist the high score if endGame is called after game-over", () => {
    const { result } = startScoreAndLose()

    expect(result.current.gameState).toBe("gameover")
    const writesAfterLoss = countHighScoreWrites()

    // endGame guards at useGameEngine.ts:480 against states outside
    // showing/waiting/advancing; invoking it in gameover should be a no-op.
    act(() => {
      result.current.endGame()
    })

    expect(countHighScoreWrites()).toBe(writesAfterLoss)
  })

  // BACKLOG: "startTimer reads stale ctx". Pre-fix, the timer's setInterval
  // callback closed over the render-time `ctx` and called
  // handleGameOverSideEffects with that snapshot. After consolidation, the
  // timer just sends TIMER_EXPIRED; the gameover dispatch reads live context
  // from actor.subscribe. Verify expiry produces exactly one highScore write
  // with the live score.
  it("timer expiry persists the live score exactly once", () => {
    const hook = renderHook(() => useGameEngine())

    act(() => {
      hook.result.current.setMode("timed")
    })
    act(() => {
      hook.result.current.startGame()
    })
    act(() => {
      jest.advanceTimersByTime(500)
    })
    // Showing → waiting (level 1)
    act(() => {
      jest.advanceTimersByTime(2500)
    })
    expect(hook.result.current.gameState).toBe("waiting")

    const correct = hook.result.current.sequence[0]
    act(() => {
      hook.result.current.handleButtonTouch(correct)
    })
    act(() => {
      jest.advanceTimersByTime(600)
    })
    act(() => {
      hook.result.current.handleButtonRelease(correct)
    })
    expect(hook.result.current.score).toBe(10)
    ;(saveString as jest.Mock).mockClear()

    // Run the 60s timed clock to expiry. Multiple ticks may be inflight when
    // remaining<=0; the consolidated dispatch's prev===next guard ensures the
    // gameover branch fires exactly once.
    act(() => {
      jest.advanceTimersByTime(70_000)
    })

    expect(hook.result.current.gameState).toBe("gameover")
    expect(countHighScoreWrites()).toBe(1)
  })

  // BACKLOG: "handleGameOverSideEffects double-fire" — covers the persistence
  // path across continue + re-gameover. saveHighScore must be gated by
  // isNewHighScore (cleared on setupContinue, re-asserted only when the new
  // score beats the post-first-gameover highScore). Re-losing at the same
  // score must NOT re-write.
  it("does not re-persist highScore on a same-score gameover after continue", () => {
    const { result } = startScoreAndLose()

    expect(result.current.gameState).toBe("gameover")
    expect(result.current.score).toBe(10)
    expect(countHighScoreWrites()).toBe(1) // first loss wrote high=10
    ;(saveString as jest.Mock).mockClear()

    act(() => {
      result.current.continueGame()
    })
    act(() => {
      jest.advanceTimersByTime(700)
    })
    // continueGame preserves score (10) and sequence (length 2 from round 2
    // pre-loss). Without playing further taps, end the game directly: same
    // score 10 == existing highScore 10. markGameOver guards on score > high
    // → isNewHighScore stays false → saveHighScore must NOT fire.
    act(() => {
      jest.advanceTimersByTime(3000) // reach waiting from the replay
    })
    expect(result.current.gameState).toBe("waiting")
    act(() => {
      result.current.endGame()
    })
    expect(result.current.gameState).toBe("gameover")
    expect(result.current.score).toBe(10)
    expect(countHighScoreWrites()).toBe(0)
  })
})

describe("useGameEngine — symmetric input-lock", () => {
  // Bug class: handleButtonTouch checks state.value at touch time and
  // handleButtonRelease checks at release time. If those reads straddle
  // a transition (press during "showing" just before SEQUENCE_DONE
  // propagates, release after the machine reaches "waiting"), the touch
  // path bails silently (no noteOn / haptic / activeButton / inputLocked)
  // but the release path used to validate and dispatch CORRECT_INPUT
  // anyway — input registered as correct, no audio / no flash.
  // The fix: handleButtonRelease requires inputLocked.current to take
  // the validation path, so an unmatched release no-ops symmetrically.
  it("does not register a release whose paired touch was rejected", () => {
    const hook = renderHook(() => useGameEngine())

    act(() => {
      hook.result.current.startGame()
    })
    // Engine has just entered "starting" — well before the 500ms
    // SET_INITIAL_SEQUENCE fires, so we're nowhere near "waiting".
    expect(hook.result.current.gameState).toBe("showing")

    const playerSeqBefore = hook.result.current.playerSequence.length

    // Touch fires while state is not "waiting" → handleButtonTouch
    // early-returns: no inputLocked, no noteOn, no activeButton.
    act(() => {
      hook.result.current.handleButtonTouch("red")
    })
    expect(hook.result.current.activeButton).toBeNull()

    // Advance to "waiting" so the release-time state check would pass
    // under the old (asymmetric) guard.
    act(() => {
      jest.advanceTimersByTime(3000)
    })
    expect(hook.result.current.gameState).toBe("waiting")

    // Release. Old behaviour: dispatched CORRECT_INPUT (or WRONG_INPUT)
    // even though the touch never registered. New behaviour: no-op.
    act(() => {
      hook.result.current.handleButtonRelease("red")
    })

    // playerSequence must not have grown, and we must still be in
    // "waiting" — no autonomous transition triggered by a phantom input.
    expect(hook.result.current.playerSequence.length).toBe(playerSeqBefore)
    expect(hook.result.current.gameState).toBe("waiting")
  })
})
