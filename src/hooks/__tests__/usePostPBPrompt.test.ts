import { renderHook, act } from "@testing-library/react-native"

import { POST_PB_LAST_PROMPT_DATE, STATS_GAMES_PLAYED } from "@/config/storageKeys"
import { storage } from "@/utils/storage"

import { usePostPBPrompt } from "../usePostPBPrompt"

beforeEach(() => {
  storage.clearAll()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe("usePostPBPrompt", () => {
  it("does not show when gamesPlayed < 3", () => {
    storage.set(STATS_GAMES_PLAYED, "2")

    const { result } = renderHook(() => usePostPBPrompt())

    act(() => {
      result.current.triggerPostPBCheck()
    })
    act(() => {
      jest.advanceTimersByTime(3000)
    })

    expect(result.current.showPostPBPrompt).toBe(false)
  })

  it("does not show within 7-day cooldown", () => {
    storage.set(STATS_GAMES_PLAYED, "10")
    storage.set(
      POST_PB_LAST_PROMPT_DATE,
      new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    )

    const { result } = renderHook(() => usePostPBPrompt())

    act(() => {
      result.current.triggerPostPBCheck()
    })
    act(() => {
      jest.advanceTimersByTime(3000)
    })

    expect(result.current.showPostPBPrompt).toBe(false)
  })

  it("shows after 3s delay when all conditions met", () => {
    storage.set(STATS_GAMES_PLAYED, "10")

    const { result } = renderHook(() => usePostPBPrompt())

    act(() => {
      result.current.triggerPostPBCheck()
    })

    expect(result.current.showPostPBPrompt).toBe(false)

    act(() => {
      jest.advanceTimersByTime(3000)
    })

    expect(result.current.showPostPBPrompt).toBe(true)
  })

  it("shows after cooldown expires (>7 days)", () => {
    storage.set(STATS_GAMES_PLAYED, "10")
    storage.set(
      POST_PB_LAST_PROMPT_DATE,
      new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    )

    const { result } = renderHook(() => usePostPBPrompt())

    act(() => {
      result.current.triggerPostPBCheck()
    })
    act(() => {
      jest.advanceTimersByTime(3000)
    })

    expect(result.current.showPostPBPrompt).toBe(true)
  })

  it("saves prompt date to storage on show", () => {
    storage.set(STATS_GAMES_PLAYED, "10")

    const { result } = renderHook(() => usePostPBPrompt())

    act(() => {
      result.current.triggerPostPBCheck()
    })
    act(() => {
      jest.advanceTimersByTime(3000)
    })

    const saved = storage.getString(POST_PB_LAST_PROMPT_DATE)
    expect(saved).toBeDefined()
    expect(new Date(saved!).getTime()).toBeGreaterThan(0)
  })

  it("dismissPostPBPrompt resets state", () => {
    storage.set(STATS_GAMES_PLAYED, "10")

    const { result } = renderHook(() => usePostPBPrompt())

    act(() => {
      result.current.triggerPostPBCheck()
    })
    act(() => {
      jest.advanceTimersByTime(3000)
    })

    expect(result.current.showPostPBPrompt).toBe(true)

    act(() => {
      result.current.dismissPostPBPrompt()
    })

    expect(result.current.showPostPBPrompt).toBe(false)
  })

  it("dismissPostPBPrompt clears pending timer", () => {
    storage.set(STATS_GAMES_PLAYED, "10")

    const { result } = renderHook(() => usePostPBPrompt())

    act(() => {
      result.current.triggerPostPBCheck()
    })
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    // Dismiss before the 3s delay completes
    act(() => {
      result.current.dismissPostPBPrompt()
    })

    // Advance past the original 3s mark
    act(() => {
      jest.advanceTimersByTime(2000)
    })

    expect(result.current.showPostPBPrompt).toBe(false)
  })
})
