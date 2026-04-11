import { renderHook, act } from "@testing-library/react-native"

import { storage } from "@/utils/storage"

import { useStoreReview } from "../useStoreReview"

beforeEach(() => {
  storage.clearAll()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe("useStoreReview", () => {
  it("does not show prompt when gamesPlayed < 5", () => {
    storage.set("ecomi:stats:gamesPlayed", "4")

    const { result } = renderHook(() => useStoreReview())

    act(() => {
      result.current.triggerReviewCheck("new_high_score", false)
    })
    act(() => {
      jest.advanceTimersByTime(3000)
    })

    expect(result.current.showReviewPrompt).toBe(false)
  })

  it("does not show prompt when adShownThisSession is true", () => {
    storage.set("ecomi:stats:gamesPlayed", "10")

    const { result } = renderHook(() => useStoreReview())

    act(() => {
      result.current.triggerReviewCheck("new_high_score", true)
    })
    act(() => {
      jest.advanceTimersByTime(3000)
    })

    expect(result.current.showReviewPrompt).toBe(false)
  })

  it("does not show prompt within 30-day cooldown", () => {
    storage.set("ecomi:stats:gamesPlayed", "10")
    // Last prompted 10 days ago
    storage.set("ecomi:review:lastPromptDate", (Date.now() - 10 * 24 * 60 * 60 * 1000).toString())

    const { result } = renderHook(() => useStoreReview())

    act(() => {
      result.current.triggerReviewCheck("new_high_score", false)
    })
    act(() => {
      jest.advanceTimersByTime(3000)
    })

    expect(result.current.showReviewPrompt).toBe(false)
  })

  it("shows prompt after 2500ms delay when all conditions met", () => {
    storage.set("ecomi:stats:gamesPlayed", "10")

    const { result } = renderHook(() => useStoreReview())

    act(() => {
      result.current.triggerReviewCheck("new_high_score", false)
    })

    // Not shown yet (before delay)
    expect(result.current.showReviewPrompt).toBe(false)

    act(() => {
      jest.advanceTimersByTime(2500)
    })

    expect(result.current.showReviewPrompt).toBe(true)
    expect(result.current.reviewTrigger).toBe("new_high_score")
  })

  it("shows prompt after cooldown expires", () => {
    storage.set("ecomi:stats:gamesPlayed", "10")
    // Last prompted 31 days ago
    storage.set("ecomi:review:lastPromptDate", (Date.now() - 31 * 24 * 60 * 60 * 1000).toString())

    const { result } = renderHook(() => useStoreReview())

    act(() => {
      result.current.triggerReviewCheck("streak_milestone", false)
    })
    act(() => {
      jest.advanceTimersByTime(3000)
    })

    expect(result.current.showReviewPrompt).toBe(true)
  })

  it("dismissReviewPrompt resets state", () => {
    storage.set("ecomi:stats:gamesPlayed", "10")

    const { result } = renderHook(() => useStoreReview())

    act(() => {
      result.current.triggerReviewCheck("new_high_score", false)
    })
    act(() => {
      jest.advanceTimersByTime(3000)
    })

    expect(result.current.showReviewPrompt).toBe(true)

    act(() => {
      result.current.dismissReviewPrompt()
    })

    expect(result.current.showReviewPrompt).toBe(false)
    expect(result.current.reviewTrigger).toBe("")
  })
})
