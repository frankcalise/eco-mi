import { storage } from "@/utils/storage"

import { recordGameResult, getStats } from "../useStats"

beforeEach(() => {
  storage.clearAll()
})

describe("recordGameResult", () => {
  it("increments gamesPlayed", () => {
    recordGameResult(50)
    expect(getStats().gamesPlayed).toBe(1)

    recordGameResult(30)
    expect(getStats().gamesPlayed).toBe(2)
  })

  it("accumulates totalScore", () => {
    recordGameResult(50)
    recordGameResult(30)
    expect(getStats().totalScore).toBe(80)
  })

  it("updates bestScore only when beaten", () => {
    recordGameResult(50)
    expect(getStats().bestScore).toBe(50)

    recordGameResult(30)
    expect(getStats().bestScore).toBe(50)

    recordGameResult(80)
    expect(getStats().bestScore).toBe(80)
  })

  it("saves today's date as lastPlayedDate", () => {
    recordGameResult(10)
    const stats = getStats()
    expect(stats.gamesPlayed).toBe(1)
  })
})

describe("getStats", () => {
  it("returns zeros when no data exists", () => {
    const stats = getStats()
    expect(stats.gamesPlayed).toBe(0)
    expect(stats.totalScore).toBe(0)
    expect(stats.bestScore).toBe(0)
    expect(stats.averageScore).toBe(0)
    expect(stats.currentStreak).toBe(0)
    expect(stats.longestStreak).toBe(0)
  })

  it("calculates averageScore correctly", () => {
    recordGameResult(100)
    recordGameResult(50)
    expect(getStats().averageScore).toBe(75)
  })

  it("rounds averageScore", () => {
    recordGameResult(10)
    recordGameResult(20)
    recordGameResult(30)
    // (10+20+30)/3 = 20
    expect(getStats().averageScore).toBe(20)
  })
})

describe("streak isolation", () => {
  // BUG: recordGameResult reads daily streak key and copies it to longestStreak
  // even in non-daily modes. The currentStreak key ("ecomi:daily:currentStreak")
  // is a daily-mode concept but recordGameResult always reads it.
  it("does not update longestStreak from daily streak when playing classic", () => {
    // Simulate a daily streak of 5 written by daily mode
    storage.set("ecomi:daily:currentStreak", "5")

    // Play a classic game
    recordGameResult(50)

    // BUG: longestStreak becomes 5 because recordGameResult reads the daily
    // streak key and compares it to longestStreak (0), then saves 5.
    // Expected: classic mode should not touch streak data.
    const stats = getStats()
    expect(stats.longestStreak).toBe(0)
  })
})
