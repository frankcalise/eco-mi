# Changelog

All notable changes to Eco Mi are documented here. Entries are appended automatically after each commit during development.

---

## [Unreleased]

### Feat (Phase 2)
- `PENDING` — Add Lottie high score celebration animation in GameOverOverlay (placeholder trophy.json — replace with real animation from LottieFiles)
- `PENDING` — Replace all `Vibration.vibrate()` with `expo-haptics` in useGameEngine (Light for flash, Medium for touch, Error for game over)
- `PENDING` — Add sequence progress indicator (dot row) during "waiting" state showing playerSequence.length / sequence.length
- `PENDING` — Add rewarded video "Continue" mechanic: loadRewarded/showRewarded in useAds, continueGame in useGameEngine, "Watch Ad to Continue" button on GameOverOverlay (one per game)
- `PENDING` — Create store review pre-prompt system: `src/hooks/useStoreReview.ts` (guard logic: 5+ games, no ad this session) and `src/components/ReviewPrompt.tsx` (sentiment filter modal with "Love it!" / "Not really" paths)

### Feat (Phase 3)
- `PENDING` — Add seeded daily challenge mode using date-based RNG (`getDailySeed`), daily best score and streak tracking in MMKV
- `PENDING` — Create stats dashboard screen (`src/app/stats.tsx`) and `src/hooks/useStats.ts` with games played, best/average/total score, current/longest streak from MMKV
- `PENDING` — Implement achievement system: 15 achievements in `src/config/achievements.ts`, `src/hooks/useAchievements.ts` for check/unlock logic, `src/app/achievements.tsx` badge grid screen
- `PENDING` — Wire expo-sharing into GameOverOverlay share button with localized score message
- `PENDING` — Add Timed game mode (60s countdown, wrong input replays sequence instead of game over, tracks sequences completed)
- `PENDING` — Add Reverse game mode (player repeats sequence in reverse order)
- `PENDING` — Add Chaos game mode (button positions shuffle after each successful round)
- `PENDING` — Extract all game UI strings into `src/i18n/en.ts` (game, stats, achievements, review sections), replace hardcoded strings with `useTranslation()` across GameScreen, GameOverOverlay, ReviewPrompt, stats, and achievements screens
- `PENDING` — Add Spanish (`src/i18n/es.ts`) and Portuguese (`src/i18n/pt.ts`) translations (~30 strings each), register in i18n resources
- `PENDING` — Record game results to MMKV stats on every game over via `recordGameResult()`
- `PENDING` — Add `GameMode` type (`classic | daily | timed | reverse | chaos`) and `setMode` to useGameEngine, expose `buttonPositions` for chaos mode, `timeRemaining`/`sequencesCompleted` for timed mode

### Fix
- `f2cafd1` — Add `.catch()`/`.finally()` to `initI18n` in `_layout.tsx` to prevent white screen on i18n failure

### Feat
- `f2cafd1` — Create `src/config/difficulty.ts` with speed ramp functions (`getToneDuration`, `getSequenceInterval`, `getInputTimeout`)
- `f2cafd1` — Add seeded RNG (mulberry32) for deterministic test mode via `EXPO_PUBLIC_TEST_SEED` env var
- `f2cafd1` — Add `testID` props to all interactive and state-displaying elements per VISION.md conventions
- `f2cafd1` — Wire Oxanium font as primary in `src/theme/typography.ts`, replace SpaceGrotesk
- `f2cafd1` — Build `GameOverOverlay` component with score summary, high score badge, Play Again and Share buttons
- `f2cafd1` — Extract `GameButton` component encapsulating quadrant button styling and positioning
- `f2cafd1` — Create `usePurchases` hook (RevenueCat) with configure, entitlement check, purchase, and restore flows
- `f2cafd1` — Create `useAds` hook (AdMob) with interstitial preloading, frequency cap, session grace period
- `f2cafd1` — Configure `PostHogProvider` in `_layout.tsx` (conditional on env var)
- `f2cafd1` — Create `useAnalytics` hook with typed event tracking for all core events

### Test
- `f2cafd1` — Write 10 unit tests for `useGameEngine` covering state transitions, scoring, reset, timer cleanup, sound toggle, and seeded RNG

- `883666c` — Wire ads and IAP into game-over flow. Interstitial shown on game over, Remove Ads button on overlay, analytics events tracked. Replaced Modal with absolute-positioned overlay to fix AdMob conflict.

### Refactor
- `06afa99` — Extract `useGameEngine` hook from GameScreen. All game logic (state, timers, audio, scoring) in `src/hooks/useGameEngine.ts`. GameScreen is now presentation-only. Fixed orphaned timeout bugs, stale closures, stale Dimensions, and type hacks.

### Chore
- `8a04ad3` — Upgrade Expo SDK 53 → 55 (RN 0.83.4, React 19.2, React Compiler enabled). Converted app.json → app.config.ts with dynamic AdMob IDs from env vars. Installed all Phase 1–3 native deps. Removed unused boilerplate deps. Stripped unnecessary audio permissions. Confirmed on Android + iOS.

### Docs
- Added `docs/VISION.md` — product vision, architecture, roadmap, monetization, testing, localization, ASO
- Added `docs/ACCOUNTS.md` — account setup guide for Apple, Google Play, RevenueCat, AdMob, PostHog
- Added `docs/BACKLOG.md` — full task backlog derived from VISION.md
- Added `CLAUDE.md` — project-level agent instructions
- Added `.env.example` — environment variable template
- Updated `.gitignore` — added `.env` protection for open source repo
