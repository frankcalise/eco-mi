import { renderHook, act } from "@testing-library/react-native"

import { REVIEW_LAST_PROMPT_DATE, STATS_GAMES_PLAYED } from "@/config/storageKeys"
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
    storage.set(STATS_GAMES_PLAYED, "4")

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
    storage.set(STATS_GAMES_PLAYED, "10")

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
    storage.set(STATS_GAMES_PLAYED, "10")
    // Last prompted 10 days ago
    storage.set(REVIEW_LAST_PROMPT_DATE, (Date.now() - 10 * 24 * 60 * 60 * 1000).toString())

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
    storage.set(STATS_GAMES_PLAYED, "10")

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
    storage.set(STATS_GAMES_PLAYED, "10")
    // Last prompted 31 days ago
    storage.set(REVIEW_LAST_PROMPT_DATE, (Date.now() - 31 * 24 * 60 * 60 * 1000).toString())

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
    storage.set(STATS_GAMES_PLAYED, "10")

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

  it("triggerReviewCheck returns true when prompt will show", () => {
    storage.set(STATS_GAMES_PLAYED, "10")

    const { result } = renderHook(() => useStoreReview())

    let scheduled: boolean | undefined
    act(() => {
      scheduled = result.current.triggerReviewCheck("new_high_score", false)
    })

    expect(scheduled).toBe(true)
  })

  it("triggerReviewCheck returns false when conditions not met", () => {
    storage.set(STATS_GAMES_PLAYED, "3")

    const { result } = renderHook(() => useStoreReview())

    let scheduled: boolean | undefined
    act(() => {
      scheduled = result.current.triggerReviewCheck("new_high_score", false)
    })

    expect(scheduled).toBe(false)
  })
})
