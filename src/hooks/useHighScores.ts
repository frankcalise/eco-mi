import { load, save } from "@/utils/storage"

const STORAGE_KEY = "ecomi:highScores"
const MAX_ENTRIES = 10

export type GameMode = "classic" | "daily" | "timed" | "reverse" | "chaos"

export type HighScoreEntry = {
  initials: string
  score: number
  level: number
  date: string
  mode: GameMode
}

function getHighScores(): HighScoreEntry[] {
  const stored = load<HighScoreEntry[]>(STORAGE_KEY)
  if (!stored || !Array.isArray(stored)) return []
  return stored.sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES)
}

function isHighScore(score: number): boolean {
  if (score <= 0) return false
  const scores = getHighScores()
  if (scores.length < MAX_ENTRIES) return true
  return score > scores[scores.length - 1].score
}

function addHighScore(entry: HighScoreEntry): HighScoreEntry[] {
  const scores = getHighScores()
  scores.push(entry)
  scores.sort((a, b) => b.score - a.score)
  const capped = scores.slice(0, MAX_ENTRIES)
  save(STORAGE_KEY, capped)
  return capped
}

export function useHighScores() {
  return { getHighScores, isHighScore, addHighScore }
}
