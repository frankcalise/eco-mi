export type AchievementId =
  | "first_game"
  | "score_100"
  | "score_500"
  | "score_1000"
  | "level_5"
  | "level_10"
  | "level_15"
  | "level_20"
  | "streak_3"
  | "streak_7"
  | "streak_14"
  | "daily_first"
  | "games_10"
  | "games_50"
  | "games_100"

export type Achievement = {
  id: AchievementId
  title: string
  description: string
  icon: string
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_game",
    title: "First Steps",
    description: "Complete your first game",
    icon: "footsteps",
  },
  { id: "score_100", title: "Triple Digits", description: "Score 100 points", icon: "star" },
  { id: "score_500", title: "High Roller", description: "Score 500 points", icon: "star-half" },
  { id: "score_1000", title: "Memory Master", description: "Score 1000 points", icon: "trophy" },
  { id: "level_5", title: "Getting Warmed Up", description: "Reach level 5", icon: "flame" },
  { id: "level_10", title: "On Fire", description: "Reach level 10", icon: "bonfire" },
  { id: "level_15", title: "Unstoppable", description: "Reach level 15", icon: "rocket" },
  { id: "level_20", title: "Legendary", description: "Reach level 20", icon: "diamond" },
  {
    id: "streak_3",
    title: "Consistent",
    description: "3-day daily challenge streak",
    icon: "calendar",
  },
  {
    id: "streak_7",
    title: "Dedicated",
    description: "7-day daily challenge streak",
    icon: "calendar-number",
  },
  {
    id: "streak_14",
    title: "Devotee",
    description: "14-day daily challenge streak",
    icon: "medal",
  },
  {
    id: "daily_first",
    title: "Daily Player",
    description: "Complete a daily challenge",
    icon: "today",
  },
  { id: "games_10", title: "Regular", description: "Play 10 games", icon: "game-controller" },
  { id: "games_50", title: "Veteran", description: "Play 50 games", icon: "shield" },
  { id: "games_100", title: "Centurion", description: "Play 100 games", icon: "ribbon" },
]
