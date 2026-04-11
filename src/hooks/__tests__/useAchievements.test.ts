import { renderHook, act } from "@testing-library/react-native"

import { storage } from "@/utils/storage"

import { useAchievements } from "../useAchievements"

beforeEach(() => {
  storage.clearAll()
})

describe("useAchievements", () => {
  const baseContext = {
    score: 0,
    level: 1,
    gamesPlayed: 0,
    currentStreak: 0,
    isDaily: false,
  }

  it("starts with no unlocked achievements", () => {
    const { result } = renderHook(() => useAchievements())
    expect(result.current.isUnlocked("first_game")).toBe(false)
    expect(result.current.newlyUnlocked).toEqual([])
  })

  it("unlocks first_game after 1 game played", () => {
    const { result } = renderHook(() => useAchievements())

    act(() => {
      result.current.checkAchievements({ ...baseContext, gamesPlayed: 1 })
    })

    expect(result.current.isUnlocked("first_game")).toBe(true)
    expect(result.current.newlyUnlocked).toContain("first_game")
  })

  it("unlocks multiple game count tiers at once", () => {
    const { result } = renderHook(() => useAchievements())

    act(() => {
      result.current.checkAchievements({ ...baseContext, gamesPlayed: 100 })
    })

    expect(result.current.isUnlocked("first_game")).toBe(true)
    expect(result.current.isUnlocked("games_10")).toBe(true)
    expect(result.current.isUnlocked("games_50")).toBe(true)
    expect(result.current.isUnlocked("games_100")).toBe(true)
    expect(result.current.newlyUnlocked).toHaveLength(4)
  })

  it("unlocks score achievements at correct thresholds", () => {
    const { result } = renderHook(() => useAchievements())

    act(() => {
      result.current.checkAchievements({ ...baseContext, score: 99 })
    })
    expect(result.current.isUnlocked("score_100")).toBe(false)

    act(() => {
      result.current.checkAchievements({ ...baseContext, score: 100 })
    })
    expect(result.current.isUnlocked("score_100")).toBe(true)
  })

  it("unlocks level achievements at correct thresholds", () => {
    const { result } = renderHook(() => useAchievements())

    act(() => {
      result.current.checkAchievements({ ...baseContext, level: 5 })
    })
    expect(result.current.isUnlocked("level_5")).toBe(true)
    expect(result.current.isUnlocked("level_10")).toBe(false)
  })

  it("unlocks streak achievements", () => {
    const { result } = renderHook(() => useAchievements())

    act(() => {
      result.current.checkAchievements({ ...baseContext, currentStreak: 7 })
    })

    expect(result.current.isUnlocked("streak_3")).toBe(true)
    expect(result.current.isUnlocked("streak_7")).toBe(true)
    expect(result.current.isUnlocked("streak_14")).toBe(false)
  })

  it("unlocks daily_first for daily mode", () => {
    const { result } = renderHook(() => useAchievements())

    act(() => {
      result.current.checkAchievements({ ...baseContext, isDaily: true })
    })

    expect(result.current.isUnlocked("daily_first")).toBe(true)
  })

  it("does not re-unlock already unlocked achievements", () => {
    const { result } = renderHook(() => useAchievements())

    act(() => {
      result.current.checkAchievements({ ...baseContext, gamesPlayed: 1 })
    })
    expect(result.current.newlyUnlocked).toContain("first_game")

    // Clear newly unlocked, then check again — should not re-add
    act(() => {
      result.current.clearNewlyUnlocked()
    })

    act(() => {
      result.current.checkAchievements({ ...baseContext, gamesPlayed: 1 })
    })
    // first_game was already unlocked, so newlyUnlocked should be empty
    expect(result.current.newlyUnlocked).toEqual([])
  })

  it("clearNewlyUnlocked empties the array", () => {
    const { result } = renderHook(() => useAchievements())

    act(() => {
      result.current.checkAchievements({ ...baseContext, gamesPlayed: 1 })
    })
    expect(result.current.newlyUnlocked).toHaveLength(1)

    act(() => {
      result.current.clearNewlyUnlocked()
    })
    expect(result.current.newlyUnlocked).toEqual([])
  })

  it("persists achievements across hook re-renders", () => {
    const { result, rerender } = renderHook(() => useAchievements())

    act(() => {
      result.current.checkAchievements({ ...baseContext, gamesPlayed: 1 })
    })

    rerender({})

    expect(result.current.isUnlocked("first_game")).toBe(true)
  })
})
