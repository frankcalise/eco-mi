import { renderHook, act } from "@testing-library/react-native"

import { useGameEngine, colors } from "../useGameEngine"

jest.mock("@/hooks/useAudioTones", () => ({
  useAudioTones: () => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    cleanup: jest.fn().mockResolvedValue(undefined),
    playSound: jest.fn(),
    playSequenceTones: jest.fn().mockReturnValue(null),
    startContinuousSound: jest.fn(),
    stopContinuousSoundWithFade: jest.fn(),
  }),
}))

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
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
})

afterEach(() => {
  jest.useRealTimers()
})

function startTimedGame() {
  const hook = renderHook(() => useGameEngine())

  // Set timed mode
  act(() => {
    hook.result.current.setMode("timed")
  })

  // Start game
  act(() => {
    hook.result.current.startGame()
  })

  // Wait for sequence generation
  act(() => {
    jest.advanceTimersByTime(500)
  })

  return hook
}

function advanceToWaiting() {
  // Advance past sequence playback to waiting state
  act(() => {
    jest.advanceTimersByTime(2000)
  })
}

function tapWrong(result: ReturnType<typeof useGameEngine>) {
  const correctColor = result.sequence[0]
  const wrongColor = colors.find((c) => c !== correctColor)!

  act(() => {
    result.handleButtonTouch(wrongColor)
  })
  act(() => {
    jest.advanceTimersByTime(200)
  })
  act(() => {
    result.handleButtonRelease(wrongColor)
  })
}

function tapCorrectSequence(result: ReturnType<typeof useGameEngine>) {
  for (let i = 0; i < result.sequence.length; i++) {
    const color = result.sequence[i]
    act(() => {
      result.handleButtonTouch(color)
    })
    act(() => {
      jest.advanceTimersByTime(200)
    })
    act(() => {
      result.handleButtonRelease(color)
    })
    // Brief gap between inputs
    act(() => {
      jest.advanceTimersByTime(100)
    })
  }
}

describe("useGameEngine — timed mode penalties", () => {
  it("sets timerDelta to -1 on first wrong input", () => {
    const { result } = startTimedGame()
    advanceToWaiting()

    tapWrong(result.current)

    expect(result.current.timerDelta).toBe(-1)
  })

  it("escalates penalty to -2 on second wrong input", () => {
    const { result } = startTimedGame()
    advanceToWaiting()

    // First wrong
    tapWrong(result.current)
    expect(result.current.timerDelta).toBe(-1)

    // Wait for replay (500ms) + sequence playback + buffer
    act(() => {
      jest.advanceTimersByTime(3000)
    })

    // Second wrong
    tapWrong(result.current)
    expect(result.current.timerDelta).toBe(-2)
  })

  it("grants +2s bonus on correct sequence completion", () => {
    const { result } = startTimedGame()
    advanceToWaiting()

    tapCorrectSequence(result.current)

    expect(result.current.timerDelta).toBe(2)
  })

  it("clears timerDelta to null after 1 second", () => {
    const { result } = startTimedGame()
    advanceToWaiting()

    tapWrong(result.current)
    expect(result.current.timerDelta).toBe(-1)

    act(() => {
      jest.advanceTimersByTime(1000)
    })

    expect(result.current.timerDelta).toBeNull()
  })

  it("resets wrong count on new game", () => {
    const { result } = startTimedGame()
    advanceToWaiting()

    // Get one wrong input (penalty = -1)
    tapWrong(result.current)
    expect(result.current.timerDelta).toBe(-1)

    // Start a brand new timed game
    act(() => {
      result.current.setMode("timed")
    })
    act(() => {
      result.current.startGame()
    })
    act(() => {
      jest.advanceTimersByTime(500)
    })
    advanceToWaiting()

    // First wrong input in new game should be -1 again (not -2)
    tapWrong(result.current)
    expect(result.current.timerDelta).toBe(-1)
  })

  it("does not set timerDelta for non-timed modes", () => {
    const { result } = renderHook(() => useGameEngine())

    act(() => {
      result.current.startGame()
    })
    act(() => {
      jest.advanceTimersByTime(500)
    })
    advanceToWaiting()

    const correctColor = result.current.sequence[0]
    const wrongColor = colors.find((c) => c !== correctColor)!

    act(() => {
      result.current.handleButtonTouch(wrongColor)
    })
    act(() => {
      jest.advanceTimersByTime(200)
    })
    act(() => {
      result.current.handleButtonRelease(wrongColor)
    })

    expect(result.current.gameState).toBe("gameover")
    expect(result.current.timerDelta).toBeNull()
  })
})
