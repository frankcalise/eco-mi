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

    // Wait for round 2 sequence to fully play out (advancing 1000ms +
    // showing ~2200ms for level 2). Previous 3000ms wasn't quite enough
    // and only worked because the press-straddle bug let a press during
    // "showing" register on release after SEQUENCE_DONE — see the
    // symmetric input-lock fix.
    act(() => {
      jest.advanceTimersByTime(4000)
    })
    expect(result.current.gameState).toBe("waiting")

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
    // See sibling test — round-2 sequence playback needs ~3200ms.
    act(() => {
      jest.advanceTimersByTime(4000)
    })
    expect(result.current.gameState).toBe("waiting")

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

describe("useGameEngine - reverse mode", () => {
  const originalEnv = process.env.EXPO_PUBLIC_TEST_SEED

  beforeEach(() => {
    // Seeded RNG so the sequence is deterministic across rounds.
    // Seed chosen so round 2's two-item sequence has distinct first/last colors
    // (needed by the "forward order fails in reverse" test below).
    process.env.EXPO_PUBLIC_TEST_SEED = "42"
  })

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.EXPO_PUBLIC_TEST_SEED
    else process.env.EXPO_PUBLIC_TEST_SEED = originalEnv
  })

  it("accepts input in reverse order for two consecutive rounds", () => {
    const { result } = renderHook(() => useGameEngine())

    act(() => {
      result.current.setMode("reverse")
    })
    expect(result.current.mode).toBe("reverse")
    act(() => {
      result.current.startGame()
    })
    expect(result.current.mode).toBe("reverse")
    act(() => {
      jest.advanceTimersByTime(500)
    })

    // Round 1: sequence is [A]; reverse of 1-item sequence = same input.
    const round1Seq = [...result.current.sequence]
    expect(round1Seq).toHaveLength(1)

    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(result.current.gameState).toBe("waiting")

    act(() => {
      result.current.handleButtonTouch(round1Seq[0])
    })
    act(() => {
      jest.advanceTimersByTime(600)
    })
    act(() => {
      result.current.handleButtonRelease(round1Seq[0])
    })

    expect(result.current.score).toBe(10)
    expect(result.current.level).toBe(2)

    // Round 2: sequence is [A, B]; reverse mode expects tap order B then A.
    act(() => {
      jest.advanceTimersByTime(3000)
    })
    const round2Seq = [...result.current.sequence]
    expect(round2Seq).toHaveLength(2)

    act(() => {
      jest.advanceTimersByTime(3000)
    })
    expect(result.current.gameState).toBe("waiting")

    const reversed = [...round2Seq].reverse()
    for (const color of reversed) {
      act(() => {
        result.current.handleButtonTouch(color)
      })
      act(() => {
        jest.advanceTimersByTime(600)
      })
      act(() => {
        result.current.handleButtonRelease(color)
      })
    }

    // Round 1 awarded 10 (1-item), round 2 awarded 20 (2-item) → total 30.
    expect(result.current.score).toBe(30)
    expect(result.current.level).toBe(3)
    expect(result.current.gameState).not.toBe("gameover")
  })

  it("rejects input in forward order when mode is reverse (sequence length >= 2)", () => {
    const { result } = renderHook(() => useGameEngine())

    act(() => {
      result.current.setMode("reverse")
    })
    act(() => {
      result.current.startGame()
    })
    act(() => {
      jest.advanceTimersByTime(500)
    })

    // Clear round 1 (1-item sequence; reverse == forward so ambiguous).
    const round1Seq = [...result.current.sequence]
    act(() => {
      jest.advanceTimersByTime(2000)
    })
    act(() => {
      result.current.handleButtonTouch(round1Seq[0])
    })
    act(() => {
      jest.advanceTimersByTime(600)
    })
    act(() => {
      result.current.handleButtonRelease(round1Seq[0])
    })

    // Round 2 has a 2-item sequence — tapping in FORWARD order must fail.
    act(() => {
      jest.advanceTimersByTime(3000)
    })
    const round2Seq = [...result.current.sequence]
    expect(round2Seq).toHaveLength(2)
    expect(result.current.mode).toBe("reverse")
    // This assertion is load-bearing for the reverse/forward distinction —
    // if seq[0] === seq[1], forward and reverse taps are indistinguishable.
    // If it ever trips, swap EXPO_PUBLIC_TEST_SEED for a seed that splits.
    expect(round2Seq[0]).not.toBe(round2Seq[1])
    act(() => {
      jest.advanceTimersByTime(3000)
    })

    // Forward order: seq[0] first. Reverse-mode expects seq[1] first.
    act(() => {
      result.current.handleButtonTouch(round2Seq[0])
    })
    act(() => {
      jest.advanceTimersByTime(600)
    })
    act(() => {
      result.current.handleButtonRelease(round2Seq[0])
    })

    expect(result.current.gameState).toBe("gameover")
  })
})
