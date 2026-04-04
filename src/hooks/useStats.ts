import { loadString, saveString } from "@/utils/storage"

const KEYS = {
  gamesPlayed: "ecomi:stats:gamesPlayed",
  totalScore: "ecomi:stats:totalScore",
  bestScore: "ecomi:stats:bestScore",
  currentStreak: "ecomi:daily:currentStreak",
  longestStreak: "ecomi:stats:longestStreak",
  lastPlayedDate: "ecomi:stats:lastPlayedDate",
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

  const currentStreak = getNum(KEYS.currentStreak)
  const longestStreak = getNum(KEYS.longestStreak)
  if (currentStreak > longestStreak) {
    saveString(KEYS.longestStreak, currentStreak.toString())
  }

  const today = new Date().toISOString().split("T")[0]
  saveString(KEYS.lastPlayedDate, today)
}

export function useStats(): Stats {
  return getStats()
}
