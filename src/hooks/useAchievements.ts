import { useState, useEffect } from "react"

import { ACHIEVEMENTS, type AchievementId } from "@/config/achievements"
import { ACHIEVEMENTS as ACHIEVEMENTS_STORAGE_KEY } from "@/config/storageKeys"
import { load, save } from "@/utils/storage"

type AchievementRecord = Record<string, { unlocked: boolean; unlockedAt?: string }>

type UseAchievementsReturn = {
  achievements: AchievementRecord
  newlyUnlocked: AchievementId[]
  checkAchievements: (context: AchievementContext) => void
  clearNewlyUnlocked: () => void
  isUnlocked: (id: AchievementId) => boolean
}

type AchievementContext = {
  score: number
  level: number
  gamesPlayed: number
  currentStreak: number
  isDaily: boolean
}

function loadAchievements(): AchievementRecord {
  return load<AchievementRecord>(ACHIEVEMENTS_STORAGE_KEY) ?? {}
}

function saveAchievements(data: AchievementRecord) {
  save(ACHIEVEMENTS_STORAGE_KEY, data)
}

function unlock(
  record: AchievementRecord,
  id: AchievementId,
  newUnlocks: AchievementId[],
): AchievementRecord {
  if (record[id]?.unlocked) return record
  newUnlocks.push(id)
  return {
    ...record,
    [id]: { unlocked: true, unlockedAt: new Date().toISOString() },
  }
}

export function useAchievements(): UseAchievementsReturn {
  const [achievements, setAchievements] = useState<AchievementRecord>(loadAchievements)
  const [newlyUnlocked, setNewlyUnlocked] = useState<AchievementId[]>([])

  useEffect(() => {
    setAchievements(loadAchievements())
  }, [])

  function checkAchievements(ctx: AchievementContext) {
    let record = { ...achievements }
    const newUnlocks: AchievementId[] = []

    if (ctx.gamesPlayed >= 1) record = unlock(record, "first_game", newUnlocks)
    if (ctx.gamesPlayed >= 10) record = unlock(record, "games_10", newUnlocks)
    if (ctx.gamesPlayed >= 50) record = unlock(record, "games_50", newUnlocks)
    if (ctx.gamesPlayed >= 100) record = unlock(record, "games_100", newUnlocks)

    if (ctx.score >= 100) record = unlock(record, "score_100", newUnlocks)
    if (ctx.score >= 500) record = unlock(record, "score_500", newUnlocks)
    if (ctx.score >= 1000) record = unlock(record, "score_1000", newUnlocks)

    if (ctx.level >= 5) record = unlock(record, "level_5", newUnlocks)
    if (ctx.level >= 10) record = unlock(record, "level_10", newUnlocks)
    if (ctx.level >= 15) record = unlock(record, "level_15", newUnlocks)
    if (ctx.level >= 20) record = unlock(record, "level_20", newUnlocks)

    if (ctx.currentStreak >= 3) record = unlock(record, "streak_3", newUnlocks)
    if (ctx.currentStreak >= 7) record = unlock(record, "streak_7", newUnlocks)
    if (ctx.currentStreak >= 14) record = unlock(record, "streak_14", newUnlocks)

    if (ctx.isDaily) record = unlock(record, "daily_first", newUnlocks)

    if (newUnlocks.length > 0) {
      saveAchievements(record)
      setAchievements(record)
      setNewlyUnlocked(newUnlocks)
    }
  }

  function clearNewlyUnlocked() {
    setNewlyUnlocked([])
  }

  function isUnlocked(id: AchievementId): boolean {
    return !!achievements[id]?.unlocked
  }

  return {
    achievements,
    newlyUnlocked,
    checkAchievements,
    clearNewlyUnlocked,
    isUnlocked,
  }
}

export { ACHIEVEMENTS }
