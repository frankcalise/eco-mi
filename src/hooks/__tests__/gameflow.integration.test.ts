import { renderHook, act } from "@testing-library/react-native"

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
  process.env.EXPO_PUBLIC_TEST_SEED = "42"
})

afterEach(() => {
  jest.useRealTimers()
  delete process.env.EXPO_PUBLIC_TEST_SEED
})

/** Helper: advance past the showing phase into waiting */
function waitForWaiting(sequenceLength: number) {
  // Each color takes getToneDuration + getSequenceInterval to show (~1400ms for level 1)
  // Plus initial 500ms delay. Be generous with timing.
  jest.advanceTimersByTime(500 + sequenceLength * 2000)
}

/** Helper: tap a color and release after tone duration */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tapColor(
  hook: { result: { current: ReturnType<typeof useGameEngine> } },
  color: (typeof colors)[number],
) {
  act(() => {
    hook.result.current.handleButtonTouch(color)
  })
  act(() => {
    jest.advanceTimersByTime(600)
  })
  act(() => {
    hook.result.current.handleButtonRelease(color)
  })
}

describe("Happy path — Classic mode", () => {
  it("plays 3 rounds with seeded sequence and tracks score/level", () => {
    const hook = renderHook(() => useGameEngine())

    // Start game
    act(() => {
      hook.result.current.startGame()
    })

    // === Level 1: 1 color in sequence ===
    act(() => {
      waitForWaiting(1)
    })
    expect(hook.result.current.gameState).toBe("waiting")
    expect(hook.result.current.level).toBe(1)

    const color1 = hook.result.current.sequence[0]
    tapColor(hook, color1)

    // Should advance to level 2
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(hook.result.current.level).toBe(2)
    expect(hook.result.current.score).toBe(10)

    // === Level 2: 2 colors in sequence ===
    act(() => {
      waitForWaiting(2)
    })

    tapColor(hook, hook.result.current.sequence[0])
    act(() => {
      jest.advanceTimersByTime(200)
    })
    tapColor(hook, hook.result.current.sequence[1])

    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(hook.result.current.level).toBe(3)
    expect(hook.result.current.score).toBe(30)

    // === Level 3: 3 colors in sequence ===
    act(() => {
      waitForWaiting(3)
    })

    tapColor(hook, hook.result.current.sequence[0])
    act(() => {
      jest.advanceTimersByTime(200)
    })
    tapColor(hook, hook.result.current.sequence[1])
    act(() => {
      jest.advanceTimersByTime(200)
    })
    tapColor(hook, hook.result.current.sequence[2])

    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(hook.result.current.level).toBe(4)
    expect(hook.result.current.score).toBe(60)
  })

  it("triggers game over on wrong input", () => {
    const hook = renderHook(() => useGameEngine())

    act(() => {
      hook.result.current.startGame()
    })
    act(() => {
      waitForWaiting(1)
    })

    const correctColor = hook.result.current.sequence[0]
    const wrongColor = colors.find((c) => c !== correctColor)!

    tapColor(hook, wrongColor)

    expect(hook.result.current.gameState).toBe("gameover")
    expect(hook.result.current.score).toBe(0)
  })
})

describe("Play again flow", () => {
  it("starts fresh game after game over", () => {
    const hook = renderHook(() => useGameEngine())

    // Start and lose
    act(() => {
      hook.result.current.startGame()
    })
    act(() => {
      waitForWaiting(1)
    })

    const wrongColor = colors.find((c) => c !== hook.result.current.sequence[0])!
    tapColor(hook, wrongColor)

    expect(hook.result.current.gameState).toBe("gameover")

    // Start new game
    act(() => {
      hook.result.current.startGame()
    })

    expect(hook.result.current.score).toBe(0)
    expect(hook.result.current.level).toBe(1)
    expect(hook.result.current.isNewHighScore).toBe(false)
    expect(hook.result.current.continuedThisGame).toBe(false)

    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(hook.result.current.gameState).toBe("showing")
  })
})

describe("Continue flow", () => {
  it("replays sequence after continue with score preserved", () => {
    const hook = renderHook(() => useGameEngine())

    // Start, complete round 1, then lose on round 2
    act(() => {
      hook.result.current.startGame()
    })
    act(() => {
      waitForWaiting(1)
    })

    const color1 = hook.result.current.sequence[0]
    tapColor(hook, color1)

    // Wait for level 2 sequence
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    act(() => {
      waitForWaiting(2)
    })

    // Lose on round 2
    const wrongColor = colors.find((c) => c !== hook.result.current.sequence[0])!
    tapColor(hook, wrongColor)

    expect(hook.result.current.gameState).toBe("gameover")
    expect(hook.result.current.score).toBe(10)

    const sequenceBefore = [...hook.result.current.sequence]

    // Continue
    act(() => {
      hook.result.current.continueGame()
    })

    expect(hook.result.current.continuedThisGame).toBe(true)
    expect(hook.result.current.score).toBe(10)
    expect(hook.result.current.sequence).toEqual(sequenceBefore)
    expect(hook.result.current.playerSequence).toEqual([])

    // Should transition to showing after delay
    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(hook.result.current.gameState).toBe("showing")
  })
})

describe("Reset from idle", () => {
  it("does nothing harmful when resetting from idle", () => {
    const hook = renderHook(() => useGameEngine())

    act(() => {
      hook.result.current.resetGame()
    })

    expect(hook.result.current.gameState).toBe("idle")
    expect(hook.result.current.score).toBe(0)
    expect(hook.result.current.level).toBe(1)
  })

  it("resets mid-game to idle", () => {
    const hook = renderHook(() => useGameEngine())

    act(() => {
      hook.result.current.startGame()
    })
    act(() => {
      waitForWaiting(1)
    })

    // Complete a round
    tapColor(hook, hook.result.current.sequence[0])
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    expect(hook.result.current.score).toBe(10)

    // Reset mid-game
    act(() => {
      hook.result.current.resetGame()
    })

    expect(hook.result.current.gameState).toBe("idle")
    expect(hook.result.current.score).toBe(0)
    expect(hook.result.current.level).toBe(1)
    expect(hook.result.current.sequence).toEqual([])
  })
})

describe("Seeded RNG determinism", () => {
  it("produces the same sequence across multiple game instances", () => {
    const hook1 = renderHook(() => useGameEngine())
    const hook2 = renderHook(() => useGameEngine())

    act(() => {
      hook1.result.current.startGame()
    })
    act(() => {
      jest.advanceTimersByTime(500)
    })

    act(() => {
      hook2.result.current.startGame()
    })
    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(hook1.result.current.sequence[0]).toBe(hook2.result.current.sequence[0])
  })
})
