/**
 * Seeds MMKV with polished data for App Store screenshots.
 * Call from a dev menu or temporary button — NOT shipped to production.
 *
 * Usage: import { seedScreenshotData } from "@/utils/screenshotSeed"
 *        seedScreenshotData()
 */
import type { AchievementId } from "@/config/achievements"
import {
  ACHIEVEMENTS as ACHIEVEMENTS_KEY,
  DAILY_CURRENT_STREAK,
  HIGH_SCORES_PREFIX,
  STATS_BEST_SCORE,
  STATS_GAMES_PLAYED,
  STATS_LONGEST_STREAK,
  STATS_TOTAL_SCORE,
} from "@/config/storageKeys"
import { save, saveString } from "@/utils/storage"

type AchievementEntry = { unlocked: boolean; unlockedAt?: string }
type AchievementRecord = Record<AchievementId, AchievementEntry>

export function seedScreenshotData() {
  // --- Stats ---
  saveString(STATS_GAMES_PLAYED, "87")
  saveString(STATS_TOTAL_SCORE, "12450")
  saveString(STATS_BEST_SCORE, "340")
  saveString(DAILY_CURRENT_STREAK, "5")
  saveString(STATS_LONGEST_STREAK, "12")

  // --- Achievements (unlock a healthy subset) ---
  const unlocked: AchievementRecord = {
    first_game: { unlocked: true, unlockedAt: "2026-04-01T10:00:00.000Z" },
    score_100: { unlocked: true, unlockedAt: "2026-04-03T10:00:00.000Z" },
    score_500: { unlocked: false },
    score_1000: { unlocked: false },
    level_5: { unlocked: true, unlockedAt: "2026-04-02T10:00:00.000Z" },
    level_10: { unlocked: true, unlockedAt: "2026-04-05T10:00:00.000Z" },
    level_12: { unlocked: true, unlockedAt: "2026-04-08T10:00:00.000Z" },
    level_15: { unlocked: false },
    level_20: { unlocked: false },
    streak_3: { unlocked: true, unlockedAt: "2026-04-04T10:00:00.000Z" },
    streak_7: { unlocked: true, unlockedAt: "2026-04-10T10:00:00.000Z" },
    streak_14: { unlocked: false },
    daily_first: { unlocked: true, unlockedAt: "2026-04-02T10:00:00.000Z" },
    games_10: { unlocked: true, unlockedAt: "2026-04-03T10:00:00.000Z" },
    games_50: { unlocked: true, unlockedAt: "2026-04-09T10:00:00.000Z" },
    games_100: { unlocked: false },
  }
  save(ACHIEVEMENTS_KEY, unlocked)

  // --- Leaderboard (classic mode, 5 entries) ---
  const leaderboard = [
    { initials: "ACE", score: 340, level: 12, date: "2026-04-10", mode: "classic" },
    { initials: "ACE", score: 280, level: 10, date: "2026-04-08", mode: "classic" },
    { initials: "ACE", score: 210, level: 8, date: "2026-04-05", mode: "classic" },
    { initials: "ACE", score: 150, level: 6, date: "2026-04-03", mode: "classic" },
    { initials: "ACE", score: 100, level: 5, date: "2026-04-01", mode: "classic" },
  ]
  save(`${HIGH_SCORES_PREFIX}:classic`, leaderboard)

  console.log("[screenshotSeed] Data seeded for screenshots")
}
