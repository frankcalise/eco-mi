/**
 * Centralized MMKV storage key constants.
 * All keys used throughout the app should be defined here to prevent
 * drift, duplication, and typos.
 */

// Analytics
export const ANALYTICS_DISTINCT_ID = "ecomi:analytics:distinctId"
export const ANALYTICS_FIRST_SEEN = "ecomi:analytics:firstSeenAt"

// Tracking consent
export const TRACKING_ASKED = "ecomi:tracking:asked"

// Purchases / IAP
export const PURCHASES_REMOVE_ADS = "ecomi:purchases:removeAds"
export const PURCHASES_ENTITLEMENT_PREFIX = "ecomi:purchases:entitlement:"

// Ads
export const ADS_LAST_INTERSTITIAL_TIME = "ecomi:ads:lastInterstitialTime"
export const ADS_SESSION_COUNT = "ecomi:ads:sessionCount"
export const ADS_GAMES_PER_SESSION = "ecomi:ads:gamesPerSession"

// Game engine
export const HIGH_SCORE_PREFIX = "ecomi:highScore:"
export const DAILY_PREFIX = "ecomi:daily:"
export const DAILY_CURRENT_STREAK = "ecomi:daily:currentStreak"
export const DAILY_LAST_PLAYED = "ecomi:daily:lastPlayed"

// Stats
export const STATS_GAMES_PLAYED = "ecomi:stats:gamesPlayed"
export const STATS_TOTAL_SCORE = "ecomi:stats:totalScore"
export const STATS_BEST_SCORE = "ecomi:stats:bestScore"
export const STATS_LONGEST_STREAK = "ecomi:stats:longestStreak"
export const STATS_LAST_PLAYED_DATE = "ecomi:stats:lastPlayedDate"

// Review
export const REVIEW_LAST_PROMPT_DATE = "ecomi:review:lastPromptDate"

// Settings
export const SETTINGS_SELECTED_THEME = "ecomi:settings:selectedTheme"
export const SETTINGS_SELECTED_SOUND_PACK = "ecomi:settings:selectedSoundPack"
export const SETTINGS_THEME_SCHEME = "ignite.themeScheme"
export const SETTINGS_SOUND_ENABLED = "ecomi:settings:soundEnabled"
export const SETTINGS_HAPTICS_ENABLED = "ecomi:settings:hapticsEnabled"
export const SETTINGS_NOTIFY_DAILY = "ecomi:settings:notifyDaily"
export const SETTINGS_NOTIFY_STREAK = "ecomi:settings:notifyStreak"
export const SETTINGS_NOTIFY_WINBACK = "ecomi:settings:notifyWinback"

// Achievements
export const ACHIEVEMENTS = "ecomi:achievements"

// Onboarding
export const ONBOARDING_COMPLETED = "ecomi:onboarding:completed"

// Notifications
export const NOTIFICATIONS_PERMISSION_ASKED = "ecomi:notifications:permissionAsked"

// Post-PB IAP prompt
export const POST_PB_LAST_PROMPT_DATE = "ecomi:postPB:lastPromptDate"

// High scores (leaderboard)
export const HIGH_SCORES_PREFIX = "ecomi:highScores:"

// Transient: action to execute on GameScreen focus (from game-over screen)
export const PENDING_GAME_ACTION = "ecomi:pending:gameAction"
