import { HIGH_SCORES_PREFIX } from "@/config/storageKeys"
import { load, save } from "@/utils/storage"

const MAX_ENTRIES = 10

export type GameMode = "classic" | "daily" | "timed" | "reverse" | "chaos"

export type HighScoreEntry = {
  initials: string
  score: number
  level: number
  date: string
  mode: GameMode
}

function storageKey(mode: GameMode): string {
  return `${HIGH_SCORES_PREFIX}:${mode}`
}

function getHighScores(mode: GameMode): HighScoreEntry[] {
  const stored = load<HighScoreEntry[]>(storageKey(mode))
  if (!stored || !Array.isArray(stored)) return []
  return stored.sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES)
}

function isHighScore(score: number, mode: GameMode): boolean {
  if (score <= 0) return false
  const scores = getHighScores(mode)
  if (scores.length < MAX_ENTRIES) return true
  return score > scores[scores.length - 1].score
}

function addHighScore(entry: HighScoreEntry): HighScoreEntry[] {
  const scores = getHighScores(entry.mode)
  scores.push(entry)
  scores.sort((a, b) => b.score - a.score)
  const capped = scores.slice(0, MAX_ENTRIES)
  save(storageKey(entry.mode), capped)
  return capped
}

export function useHighScores() {
  return { getHighScores, isHighScore, addHighScore }
}
