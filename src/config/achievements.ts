export type AchievementId =
  | "first_game"
  | "score_100"
  | "score_500"
  | "score_1000"
  | "level_5"
  | "level_10"
  | "level_12"
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
  icon: string
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_game", icon: "footsteps" },
  { id: "score_100", icon: "star" },
  { id: "score_500", icon: "star-half" },
  { id: "score_1000", icon: "trophy" },
  { id: "level_5", icon: "flame" },
  { id: "level_10", icon: "bonfire" },
  { id: "level_12", icon: "flash" },
  { id: "level_15", icon: "rocket" },
  { id: "level_20", icon: "diamond" },
  { id: "streak_3", icon: "calendar" },
  { id: "streak_7", icon: "calendar-number" },
  { id: "streak_14", icon: "medal" },
  { id: "daily_first", icon: "today" },
  { id: "games_10", icon: "game-controller" },
  { id: "games_50", icon: "shield" },
  { id: "games_100", icon: "ribbon" },
]
