import {
  DAILY_CURRENT_STREAK,
  STATS_BEST_SCORE,
  STATS_GAMES_PLAYED,
  STATS_LAST_PLAYED_DATE,
  STATS_LONGEST_STREAK,
  STATS_TOTAL_SCORE,
} from "@/config/storageKeys"
import { loadString, saveString } from "@/utils/storage"

const KEYS = {
  gamesPlayed: STATS_GAMES_PLAYED,
  totalScore: STATS_TOTAL_SCORE,
  bestScore: STATS_BEST_SCORE,
  currentStreak: DAILY_CURRENT_STREAK,
  longestStreak: STATS_LONGEST_STREAK,
  lastPlayedDate: STATS_LAST_PLAYED_DATE,
}

export type Stats = {
  gamesPlayed: number
  totalScore: number
  bestScore: number
  averageScore: number
  currentStreak: number
  longestStreak: number
}

function getNum(key: string): number {
  return parseInt(loadString(key) ?? "0", 10)
}

export function getStats(): Stats {
  const gamesPlayed = getNum(KEYS.gamesPlayed)
  const totalScore = getNum(KEYS.totalScore)
  const bestScore = getNum(KEYS.bestScore)
  const currentStreak = getNum(KEYS.currentStreak)
  const longestStreak = getNum(KEYS.longestStreak)

  return {
    gamesPlayed,
    totalScore,
    bestScore,
    averageScore: gamesPlayed > 0 ? Math.round(totalScore / gamesPlayed) : 0,
    currentStreak,
    longestStreak,
  }
}

export function recordGameResult(score: number) {
  const gamesPlayed = getNum(KEYS.gamesPlayed) + 1
  saveString(KEYS.gamesPlayed, gamesPlayed.toString())

  const totalScore = getNum(KEYS.totalScore) + score
  saveString(KEYS.totalScore, totalScore.toString())

  const bestScore = getNum(KEYS.bestScore)
  if (score > bestScore) {
    saveString(KEYS.bestScore, score.toString())
  }

  const today = new Date().toISOString().split("T")[0]
  saveString(KEYS.lastPlayedDate, today)
}

export function useStats(): Stats {
  return getStats()
}
