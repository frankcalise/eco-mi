# Changelog

All notable changes to Eco Mi are documented here. Entries are appended automatically after each commit during development.

---

## [Unreleased]

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
