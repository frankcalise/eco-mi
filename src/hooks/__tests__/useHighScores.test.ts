import { renderHook } from "@testing-library/react-native"

import { storage } from "@/utils/storage"

import { useHighScores, type HighScoreEntry, type GameMode } from "../useHighScores"

function makeEntry(score: number, mode: GameMode = "classic", level = 1): HighScoreEntry {
  return { initials: "TST", score, level, date: "2026-04-11", mode }
}

beforeEach(() => {
  storage.clearAll()
})

describe("useHighScores", () => {
  it("returns empty array when no scores exist", () => {
    const { result } = renderHook(() => useHighScores())
    expect(result.current.getHighScores("classic")).toEqual([])
  })

  it("returns scores sorted highest first", () => {
    const { result } = renderHook(() => useHighScores())

    result.current.addHighScore(makeEntry(50))
    result.current.addHighScore(makeEntry(100))
    result.current.addHighScore(makeEntry(75))

    const scores = result.current.getHighScores("classic")
    expect(scores.map((s) => s.score)).toEqual([100, 75, 50])
  })

  it("caps at 5 entries", () => {
    const { result } = renderHook(() => useHighScores())

    for (let i = 1; i <= 7; i++) {
      result.current.addHighScore(makeEntry(i * 10))
    }

    const scores = result.current.getHighScores("classic")
    expect(scores).toHaveLength(5)
    expect(scores[0].score).toBe(70)
    expect(scores[4].score).toBe(30)
  })

  it("isHighScore returns true when list has fewer than 5 entries", () => {
    const { result } = renderHook(() => useHighScores())

    result.current.addHighScore(makeEntry(100))
    expect(result.current.isHighScore(1, "classic")).toBe(true)
  })

  it("isHighScore returns true when score beats lowest in full list", () => {
    const { result } = renderHook(() => useHighScores())

    for (let i = 1; i <= 5; i++) {
      result.current.addHighScore(makeEntry(i * 10))
    }

    // Lowest is 10, so 15 should qualify
    expect(result.current.isHighScore(15, "classic")).toBe(true)
  })

  it("isHighScore returns false when score does not beat lowest in full list", () => {
    const { result } = renderHook(() => useHighScores())

    for (let i = 1; i <= 5; i++) {
      result.current.addHighScore(makeEntry(i * 10))
    }

    // Lowest is 10, so 5 should not qualify
    expect(result.current.isHighScore(5, "classic")).toBe(false)
  })

  it("getRank returns correct 0-based index for qualifying score", () => {
    const { result } = renderHook(() => useHighScores())

    result.current.addHighScore(makeEntry(100))
    result.current.addHighScore(makeEntry(50))
    result.current.addHighScore(makeEntry(25))

    // 75 should slot in at index 1 (between 100 and 50)
    expect(result.current.getRank(75, "classic")).toBe(1)
    // 200 should slot in at index 0
    expect(result.current.getRank(200, "classic")).toBe(0)
  })

  it("getRank returns null for non-qualifying score in full list", () => {
    const { result } = renderHook(() => useHighScores())

    for (let i = 1; i <= 5; i++) {
      result.current.addHighScore(makeEntry(i * 10))
    }

    // 5 doesn't beat lowest (10), full list
    expect(result.current.getRank(5, "classic")).toBeNull()
    // 0 always returns null
    expect(result.current.getRank(0, "classic")).toBeNull()
  })

  it("isHighScore returns false for score of 0", () => {
    const { result } = renderHook(() => useHighScores())
    expect(result.current.isHighScore(0, "classic")).toBe(false)
  })

  it("keeps scores isolated per mode", () => {
    const { result } = renderHook(() => useHighScores())

    result.current.addHighScore(makeEntry(100, "classic"))
    result.current.addHighScore(makeEntry(200, "timed"))

    const classic = result.current.getHighScores("classic")
    const timed = result.current.getHighScores("timed")

    expect(classic).toHaveLength(1)
    expect(classic[0].score).toBe(100)
    expect(timed).toHaveLength(1)
    expect(timed[0].score).toBe(200)
  })

  it("addHighScore returns the updated sorted list", () => {
    const { result } = renderHook(() => useHighScores())

    result.current.addHighScore(makeEntry(50))
    const updated = result.current.addHighScore(makeEntry(100))

    expect(updated).toHaveLength(2)
    expect(updated[0].score).toBe(100)
    expect(updated[1].score).toBe(50)
  })
})
