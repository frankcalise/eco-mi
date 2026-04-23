import { renderHook, act } from "@testing-library/react-native"

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
