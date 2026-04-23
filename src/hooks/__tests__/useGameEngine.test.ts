import { renderHook, act } from "@testing-library/react-native"

import { usePreferencesStore } from "@/stores/preferencesStore"

import { useGameEngine, colors } from "../useGameEngine"

jest.mock("@/hooks/useAudioTones", () => ({
  useAudioTones: () => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    cleanup: jest.fn().mockResolvedValue(undefined),
    noteOn: jest.fn(),
    noteOff: jest.fn(),
    silenceAll: jest.fn(),
    scheduleSequence: jest.fn(),
    playPreview: jest.fn(),
    playJingle: jest.fn(),
    playGameOverJingle: jest.fn(),
    playHighScoreJingle: jest.fn(),
    syncVolume: jest.fn(),
  }),
}))

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Error: "error" },
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
  usePreferencesStore.setState({ soundEnabled: true, hapticsEnabled: true })
})

afterEach(() => {
  jest.useRealTimers()
})

describe("useGameEngine", () => {
  it("starts in idle state with zero score", () => {
    const { result } = renderHook(() => useGameEngine())
    expect(result.current.gameState).toBe("idle")
    expect(result.current.score).toBe(0)
    expect(result.current.level).toBe(1)
  })

  it("transitions to showing state when startGame is called", () => {
    const { result } = renderHook(() => useGameEngine())

    act(() => {
      result.current.startGame()
    })

    // After 500ms delay, it should transition to showing
    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(result.current.gameState).toBe("showing")
    expect(result.current.sequence.length).toBe(1)
  })

  it("transitions from showing to waiting after sequence plays", () => {
    const { result } = renderHook(() => useGameEngine())

    act(() => {
      result.current.startGame()
    })

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(result.current.gameState).toBe("showing")

    // Advance past the sequence interval + tone duration + 100ms buffer
    act(() => {
      jest.advanceTimersByTime(2000)
    })

    expect(result.current.gameState).toBe("waiting")
  })

  it("handles correct input and advances to next round", () => {
    const { result } = renderHook(() => useGameEngine())

    act(() => {
      result.current.startGame()
    })

    // Wait for sequence to be generated
    act(() => {
      jest.advanceTimersByTime(500)
    })

    const firstColor = result.current.sequence[0]

    // Wait for showing -> waiting transition
    act(() => {
      jest.advanceTimersByTime(2000)
    })

    expect(result.current.gameState).toBe("waiting")

    // Simulate button press and release
    act(() => {
      result.current.handleButtonTouch(firstColor)
    })

    act(() => {
      jest.advanceTimersByTime(600)
    })

    act(() => {
      result.current.handleButtonRelease(firstColor)
    })

    // Score should be updated: 1 * 10 = 10
    expect(result.current.score).toBe(10)
    expect(result.current.level).toBe(2)
  })

  it("transitions to gameover on wrong input", () => {
    const { result } = renderHook(() => useGameEngine())

    act(() => {
      result.current.startGame()
    })

    act(() => {
      jest.advanceTimersByTime(500)
    })

    const firstColor = result.current.sequence[0]
    const wrongColor = colors.find((c) => c !== firstColor)!

    // Wait for waiting state
    act(() => {
      jest.advanceTimersByTime(2000)
    })

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
  })

  it("calculates score as sequence.length * 10 per round", () => {
    const { result } = renderHook(() => useGameEngine())

    act(() => {
      result.current.startGame()
    })

    act(() => {
      jest.advanceTimersByTime(500)
    })

    const firstColor = result.current.sequence[0]

    act(() => {
      jest.advanceTimersByTime(2000)
    })

    act(() => {
      result.current.handleButtonTouch(firstColor)
    })
    act(() => {
      jest.advanceTimersByTime(600)
    })
    act(() => {
      result.current.handleButtonRelease(firstColor)
    })

    // Round 1: 1 item * 10 = 10
    expect(result.current.score).toBe(10)
  })

  it("resets game state correctly", () => {
    const { result } = renderHook(() => useGameEngine())

    act(() => {
      result.current.startGame()
    })

    act(() => {
      jest.advanceTimersByTime(500)
    })

    act(() => {
      result.current.resetGame()
    })

    expect(result.current.gameState).toBe("idle")
    expect(result.current.score).toBe(0)
    expect(result.current.level).toBe(1)
    expect(result.current.sequence).toEqual([])
    expect(result.current.playerSequence).toEqual([])
    expect(result.current.activeButton).toBeNull()
  })

  it("returns directly to idle when ending a zero-score game", () => {
    const { result } = renderHook(() => useGameEngine())

    act(() => {
      result.current.startGame()
    })

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(result.current.gameState).toBe("showing")

    act(() => {
      result.current.endGame()
    })

    expect(result.current.gameState).toBe("idle")
    expect(result.current.score).toBe(0)
    expect(result.current.activeButton).toBeNull()
  })

  it("cleans up timeouts on unmount", () => {
    const clearTimeoutSpy = jest.spyOn(globalThis, "clearTimeout")

    const { result, unmount } = renderHook(() => useGameEngine())

    act(() => {
      result.current.startGame()
    })

    act(() => {
      jest.advanceTimersByTime(500)
    })

    unmount()
    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })
})

describe("useGameEngine - seeded RNG", () => {
  const originalEnv = process.env.EXPO_PUBLIC_TEST_SEED

  beforeEach(() => {
    process.env.EXPO_PUBLIC_TEST_SEED = "42"
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.EXPO_PUBLIC_TEST_SEED = originalEnv
    } else {
      delete process.env.EXPO_PUBLIC_TEST_SEED
    }
  })

  it("produces deterministic sequences with the same seed", () => {
    const { result: result1 } = renderHook(() => useGameEngine())

    act(() => {
      result1.current.startGame()
    })
    act(() => {
      jest.advanceTimersByTime(500)
    })

    const seq1Color = result1.current.sequence[0]

    const { result: result2 } = renderHook(() => useGameEngine())

    act(() => {
      result2.current.startGame()
    })
    act(() => {
      jest.advanceTimersByTime(500)
    })

    const seq2Color = result2.current.sequence[0]

    expect(seq1Color).toBe(seq2Color)
  })
})

describe("useGameEngine - continueGame", () => {
  /** Helper: start a game, wait for waiting state, then lose */
  function startAndLose() {
    const hook = renderHook(() => useGameEngine())

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

    // Tap wrong
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

  it("replays the sequence after continueGame", () => {
    const { result } = startAndLose()

    expect(result.current.gameState).toBe("gameover")
    const sequenceBefore = [...result.current.sequence]

    act(() => {
      result.current.continueGame()
    })

    // continuedThisGame should be true
    expect(result.current.continuedThisGame).toBe(true)
    // Sequence should be preserved
    expect(result.current.sequence).toEqual(sequenceBefore)
    // Player sequence should be reset
    expect(result.current.playerSequence).toEqual([])

    // After delay, should transition to showing
    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(result.current.gameState).toBe("showing")

    act(() => {
      jest.advanceTimersByTime(2500)
    })

    expect(result.current.gameState).toBe("waiting")
  })

  it("does nothing if called when not in gameover state", () => {
    const { result } = renderHook(() => useGameEngine())

    act(() => {
      result.current.continueGame()
    })

    expect(result.current.gameState).toBe("idle")
    expect(result.current.continuedThisGame).toBe(false)
  })

  it("resets continuedThisGame on new game", () => {
    const { result } = startAndLose()

    act(() => {
      result.current.continueGame()
    })

    expect(result.current.continuedThisGame).toBe(true)

    act(() => {
      result.current.startGame()
    })

    expect(result.current.continuedThisGame).toBe(false)
  })
})

describe("useGameEngine - sessionTime", () => {
  it("tracks session time from startGame to gameover", () => {
    const { result } = renderHook(() => useGameEngine())

    expect(result.current.sessionTime).toBe(0)

    act(() => {
      result.current.startGame()
    })
    act(() => {
      jest.advanceTimersByTime(500)
    })

    const firstColor = result.current.sequence[0]
    const wrongColor = colors.find((c) => c !== firstColor)!

    // Advance into waiting state
    act(() => {
      jest.advanceTimersByTime(2000)
    })

    // Simulate the player thinking for several more seconds
    act(() => {
      jest.advanceTimersByTime(3000)
    })

    // End the game via wrong input
    act(() => {
      result.current.handleButtonTouch(wrongColor)
    })
    act(() => {
      jest.advanceTimersByTime(100)
    })
    act(() => {
      result.current.handleButtonRelease(wrongColor)
    })

    expect(result.current.gameState).toBe("gameover")
    // Total elapsed: 500 + 2000 + 3000 + 100 = 5600ms → floor(5.6) = 5
    expect(result.current.sessionTime).toBeGreaterThanOrEqual(5)
  })

  it("resets session time on new startGame", () => {
    const { result } = renderHook(() => useGameEngine())

    act(() => {
      result.current.startGame()
    })
    act(() => {
      jest.advanceTimersByTime(500)
    })

    const firstColor = result.current.sequence[0]
    const wrongColor = colors.find((c) => c !== firstColor)!

    act(() => {
      jest.advanceTimersByTime(2000)
    })
    act(() => {
      jest.advanceTimersByTime(3000)
    })

    act(() => {
      result.current.handleButtonTouch(wrongColor)
    })
    act(() => {
      jest.advanceTimersByTime(100)
    })
    act(() => {
      result.current.handleButtonRelease(wrongColor)
    })

    expect(result.current.sessionTime).toBeGreaterThan(0)

    // Start a new game — session time should reset
    act(() => {
      result.current.startGame()
    })

    expect(result.current.sessionTime).toBe(0)
  })
})

describe("useGameEngine - isNewHighScore", () => {
  it("sets isNewHighScore when score beats highScore", () => {
    const { result } = renderHook(() => useGameEngine())

    act(() => {
      result.current.startGame()
    })
    act(() => {
      jest.advanceTimersByTime(500)
    })

    const firstColor = result.current.sequence[0]

    // Wait for waiting
    act(() => {
      jest.advanceTimersByTime(2000)
    })

    // Complete round 1 (score = 10)
    act(() => {
      result.current.handleButtonTouch(firstColor)
    })
    act(() => {
      jest.advanceTimersByTime(600)
    })
    act(() => {
      result.current.handleButtonRelease(firstColor)
    })

    expect(result.current.score).toBe(10)

    // Wait for next sequence
    act(() => {
      jest.advanceTimersByTime(3000)
    })

    // Now lose on round 2
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
    // Score (10) > highScore (0) so this is a new high score
    expect(result.current.isNewHighScore).toBe(true)
  })

  it("resets isNewHighScore on startGame", () => {
    const { result } = renderHook(() => useGameEngine())

    act(() => {
      result.current.startGame()
    })
    act(() => {
      jest.advanceTimersByTime(500)
    })

    const firstColor = result.current.sequence[0]

    act(() => {
      jest.advanceTimersByTime(2000)
    })

    // Complete a round then lose
    act(() => {
      result.current.handleButtonTouch(firstColor)
    })
    act(() => {
      jest.advanceTimersByTime(600)
    })
    act(() => {
      result.current.handleButtonRelease(firstColor)
    })
    act(() => {
      jest.advanceTimersByTime(3000)
    })

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

    expect(result.current.isNewHighScore).toBe(true)

    // Start new game — should reset
    act(() => {
      result.current.startGame()
    })

    expect(result.current.isNewHighScore).toBe(false)
  })
})
