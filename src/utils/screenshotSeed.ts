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

type AchievementRecord = Record<AchievementId, boolean>

export function seedScreenshotData() {
  // --- Stats ---
  saveString(STATS_GAMES_PLAYED, "87")
  saveString(STATS_TOTAL_SCORE, "12450")
  saveString(STATS_BEST_SCORE, "340")
  saveString(DAILY_CURRENT_STREAK, "5")
  saveString(STATS_LONGEST_STREAK, "12")

  // --- Achievements (unlock a healthy subset) ---
  const unlocked: AchievementRecord = {
    first_game: true,
    score_100: true,
    score_500: false,
    score_1000: false,
    level_5: true,
    level_10: true,
    level_12: true,
    level_15: false,
    level_20: false,
    streak_3: true,
    streak_7: true,
    streak_14: false,
    daily_first: true,
    games_10: true,
    games_50: true,
    games_100: false,
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
