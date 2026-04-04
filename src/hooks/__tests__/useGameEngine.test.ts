import { renderHook, act } from "@testing-library/react-native"

import { useGameEngine, colors } from "../useGameEngine"

// Mock audio tones — the hook expects these functions
jest.mock("@/hooks/useAudioTones", () => ({
  useAudioTones: () => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    cleanup: jest.fn().mockResolvedValue(undefined),
    playSound: jest.fn(),
    startContinuousSound: jest.fn(),
    stopContinuousSoundWithFade: jest.fn(),
  }),
}))

jest.mock("@/utils/storage", () => ({
  loadString: jest.fn(() => null),
  saveString: jest.fn(),
}))

beforeEach(() => {
  jest.useFakeTimers()
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

  it("cleans up timeouts on unmount", () => {
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout")

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

  it("toggles sound state", () => {
    const { result } = renderHook(() => useGameEngine())

    expect(result.current.soundEnabled).toBe(true)

    act(() => {
      result.current.toggleSound()
    })

    expect(result.current.soundEnabled).toBe(false)

    act(() => {
      result.current.toggleSound()
    })

    expect(result.current.soundEnabled).toBe(true)
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
