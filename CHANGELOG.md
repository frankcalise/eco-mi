# Changelog

All notable changes to Eco Mi are documented here. Entries are appended automatically after each commit during development.

---

## [Unreleased]

### Refactor (v1.1.0 — Route Migrations & State Architecture)

- **Leaderboard route** (`/leaderboard`) — extracted HighScoreTable from in-screen Modal into dedicated Expo Router screen. Mode tabs redesigned with idle-action-button sizing + green-accent selected state (matches mode selector / sound pack pattern). Swipe-between-modes gesture removed, GestureHandlerRootView wrapper dropped. Empty state uses trophy-outline icon + title (matches stats.tsx). Added missing `game:leaderboard` i18n key.
- **Settings route** (`/settings`) — extracted GameSettingsModal into full screen. New sections: haptics toggle, per-notification-type toggles (daily / streak / win-back), all persisted to MMKV. Sound state now persisted via `SETTINGS_SOUND_ENABLED`, synced on GameScreen focus. `useNotifications` respects per-type keys before scheduling. Restore Purchases restyled as outlined hollow button. useAudioTones instance in settings for preview playback without disrupting gameplay audio.
- **Game-over route** (`/game-over`) — Duolingo-style full-screen experience replacing the `<GameOverOverlay>` modal. Stat pills (Score/Level/Best), PB delta under title on new high score, trophy Lottie, navigation links aligned under each pill (Statistics/Achievements/Leaderboard), full-width Play Again CTA, platform-aware share icon (iOS share-outline / Android share-social-outline), outlined Watch Ad to Continue, Main Menu link. ReviewPrompt, PostPBPrompt, and AchievementToast relocated onto this screen (with `checkAchievements` call on mount). Score of 0 bypasses game-over entirely and bounces to idle.
- **Zustand stores** — `pendingActionStore` (cross-screen signals: play_again / continue / main_menu) replaces string route params. `gameOverStore` replaces 8 stringly-typed route params with a typed object — GameScreen writes, game-over reads.
- **`useStoreReview.triggerReviewCheck` now returns boolean** — game-over uses this to make Review and PostPB prompts mutually exclusive. If review schedules, PostPB is skipped for that session.
- **Deleted**: `GameOverOverlay.tsx`, `GameSettingsModal.tsx`, 14 obsolete route-param parse lines.

### Fix (v1.1.0)

- **InitialEntryModal dismiss** now navigates to game-over screen instead of stranding the user with no UI (score isn't recorded on dismiss, but the overlay still shows).
- **InitialEntryModal title color** uses theme.warningColor (amber) instead of red — matches the "New High Score!" title on /game-over.
- **Navigation race condition** — high-score game-over no longer navigates to /game-over before InitialEntryModal renders on iOS. Gated by `pendingGameOver.current` instead of `leaderboardRecorded.current`.
- **Navigation white flash** — root View wrapper + stack `contentStyle.backgroundColor` set to classic theme color. No more white corners during slide transitions (in production builds). Also renders a dark View instead of `null` during fonts/i18n load.
- **Main Menu reset** — tapping Main Menu from game-over now triggers resetGame so GameScreen returns to idle (btn-start visible).
- **Duplicate leaderboard entry on rewarded-ad continue** — added `leaderboardRecorded` ref guard.
- **Android share** — replaced iOS-only `Share.share({ url })` with `expo-sharing` which handles FileProvider content URIs. Image now shares correctly on Android.
- **Remove Ads centering on Android** — `alignSelf: "center"` on the row.
- **Onboarding tooltip loop in timed mode** — dismisses after any first attempt (correct or wrong), not just correct input.
- **Onboarding tooltip layout shift** — wrapped in fixed-height reserved slot so first-run content doesn't jump.
- **Splash background alignment** — changed from `#191015` to `#1a1a2e` to match Classic theme and eliminate color flash on launch.

### Feat (v1.1.0)

- **Game-over 2x2 stat pill grid** — 4 pills (Score/Level/Best/Time) laid out in a 2x2 grid that mirrors the game-pad color layout (red TL, blue TR, green BL, yellow BR). Each pill has a thick colored border matching its game-board position, a colored icon (flash/trending-up/trophy/time), and a staggered spring entrance (250/350/450/550ms). Bottom CTA section delay bumped to 700ms to cascade after the pills. New Time pill uses `formatDuration(sessionTime)`. Content centered within each pill (label above icon+value, matches main-menu stacking). Statistics/Achievements/Leaderboard nav links removed from game-over — those entry points remain on the idle screen.
- **Session time tracking in useGameEngine** — `sessionTime` (elapsed seconds) captured via `sessionStartTimeRef` on `startGame` and finalized on every `gameover` transition. Exposed through the hook return and persisted to `gameOverStore` for the /game-over screen.
- **Timed mode wrong-input penalty** — escalating time deduction (1s first wrong, 2s second, etc.) + 2s bonus on correct sequence. Status-line feedback: "Great job! +2s" / "Oops, try again! -Ns" with 2-second display + fade in/out. Stale clear timers cancel on new delta so consecutive inputs don't clear early.
- **Timed countdown haptics** — light impact under 10s, medium under 5s, heavy under 3s. Fires once per second boundary.
- **Level 12 achievement** — "Getting Serious" fills feedback gap between levels 10-15. Localized en/es/pt.
- **Localized iOS permission strings** — custom config plugin creates es.lproj/pt.lproj InfoPlist.strings for ATT and microphone dialogs.
- **Progress dot micro-animations** — spring fill-in when player taps correct input, new dot on level-up pops in (outer EaseView mount animation via stable keys). Last dot now animates on sequence complete (render gate widened to include advancing/replaying states).
- **Mode selector pulse** — 3→2 pulses, snappier dismiss.
- **npm-blocking PreToolUse hook** — `.claude/settings.json` denies any `npm *` bash commands with a reminder to use bun.

### Chore (v1.1.0 — Lint Cleanup Pass)

- **Lint baseline reset** — full codebase sweep reducing 79 errors → 0 errors. Remaining 16 `react-hooks/exhaustive-deps` warnings are intentional (mount-only effects). Organized as 5 focused commits: auto-fix (`eslint --fix` across `src/`), dead-code deletion (unused imports/vars/styles), inline-style extraction to StyleSheet entries, color-literal consolidation into `UI_COLORS` constants, and PostToolUse hook activation.
- **New `src/theme/uiColors.ts`** — named constants (`white`, `shadowBlack`, `classicBackground`, `brandPurple`, `red500`, `greenTint10`, `backdropModal`, etc.) for the hex/rgb values previously inlined across 17 files. Each name describes what the value *is* in this app, not an abstract palette index.
- **Note:** `src/theme/{colors,colorsDark,spacing,spacingDark,timing,typography,theme,styles,types}.ts` are Ignite boilerplate with zero imports — safe to delete in a follow-up pass.
- **PostToolUse lint hook** — `.claude/hooks/lint-edit.sh` runs `eslint <file> --cache` scoped to the just-edited file on every Edit/Write/MultiEdit. No `--fix` (would race with subsequent Edit calls). Errors surface as system reminders so they're fixed in-context rather than accumulating as debt.

### Dependencies

- **Added**: `zustand` (state management), `expo-sharing` (cross-platform share sheet)

### Feat (v1.1.0 Phase C — Retention & Polish)

- **Notification permission pre-prompt** — full-screen route (`/notifications`) with bell icon, explains daily reminders and streak protection before OS dialog. Shown once on idle after 3+ games. Localized en/es/pt.
- **First-launch onboarding** — tooltip "Tap the button that lit up!" appears during first waiting state, auto-dismisses after first correct input
- **Wrong-input juice** — red flash overlay (300ms, EaseView opacity) + error haptic on wrong input across all modes
- **Game-over emotional arc** — staggered card animation (title/stats/actions), PB delta text ("+X from your previous best!"), near-miss text ("So close! Just X away") when within 5 points, title shows "New High Score!" in warningColor on PB
- **Visual score card sharing** — branded themed card captured via react-native-view-shot, shared as image + fallback text
- **Local notifications** — 3 local schedules (daily reminder 19:00, streak-save 10:00 next day, win-back after 3 days). Permission asked after 3+ games. Reschedules on every game-over.
- **Streak loss-aversion banner** — "Day N streak — play Daily to keep it!" on idle screen when streak active + not played today
- **Stats empty state** — icon + "No games yet" message + "Play Now" CTA when gamesPlayed === 0
- **Play button dominance** — full-width, larger padding, shadow/elevation, themed accentColor, idle pulse animation. Secondary icons in separate row below.
- **Post-PB soft IAP prompt** — "New Personal Best! Go ad-free" modal after PB with 7-day cooldown, 3-game minimum, skipped if ReviewPrompt showing

### Refactor (v1.1.0 Phase B — Code Foundation)

- **XState game engine** — replaced bare `useState<GameState>` with XState v5 state machine (`gameEngineMachine.ts`). Enforces valid transitions declaratively; machine states `idle → starting → showing → waiting → advancing → gameover` with `replaying` for timed-mode wrong-input. Internal states map to the existing public API — no consumer changes. Mermaid state diagram at `docs/game-engine-states.md`.
- **GameScreen split** — 1526 → 806 lines. Extracted `ModeItem`, `GameHeader` (with neon cycling state), `GameStatusBar`, `GameSettingsModal` (290 lines, owns its own hooks).
- **Semantic color tokens** — added `accentColor`, `destructiveColor`, `warningColor`, `linkColor` to `GameTheme`. Migrated `GameOverOverlay` and `ReviewPrompt` from hardcoded hex values. Fixed invisible text on Pastel theme.
- **ModalOverlay component** — shared backdrop + card + EaseView spring animation. Adopted by `ReviewPrompt`.
- **Storage keys consolidation** — 25+ MMKV key constants centralized in `src/config/storageKeys.ts`, replacing inline strings across 15 files.
- **ThemeProvider memo cleanup** — removed 5 redundant `useMemo`/`useCallback` wrappers (React Compiler handles these).

### Feat (v1.1.0 Phase A — Signal & Telemetry)

- **PostHog device context** — installed `expo-application`, `expo-device`, `expo-file-system`. All events now carry `$app_version`, `$os_name`, `$device_model`, etc.
- **PostHog identify** — stable anonymous device ID (MMKV + nanoid), person properties: `firstSeenAt`, `preferredLocale`, `themeMode`, `hasPurchasedPremium`.
- **Super properties** — `environment` and `appVariant` on every event (including SDK-emitted events like `$screen`).
- **Route tracking** — `RouteTracker` component emits `posthog.screen()` on expo-router navigation, registers `$pathname` as super property.
- **expo-insights** — installed for Expo dashboard update adoption telemetry.

### Fix (v1.0.1)

- Remove duplicate `@react-navigation/native` causing crash on launch — two copies of `@react-navigation/core` created mismatched PreventRemoveContext
- Resolve App Store ATT rejection (5.1.1(v)) — added `NSUserTrackingUsageDescription` purpose string, collapsed pre-prompt to single "Continue" button that always fires the system ATT dialog

### Fix

- `isNewHighScore` flag now resets when using rewarded ad continue — previously showed the high score celebration a second time on the subsequent game-over
- Added input timeout to "waiting" state — players can no longer idle indefinitely mid-sequence. After `sequenceLength * 2000ms` with no input, the game ends. Timer clears on any button tap.
- Daily streak no longer leaks into non-daily mode stats — `recordGameResult()` was reading the daily streak key and copying it to `longestStreak` on every game-over regardless of mode. Streak-to-longest logic now only runs inside `saveDailyResult()` (daily mode only).
- Fix all missing diacritical marks in ES/PT translations (accents, cedillas, tildes)
- Replace hardcoded English "On"/"Off", "Unlock Sound/Theme" with i18n keys across settings
- Localize all 15 achievement titles and descriptions into ES/PT (previously English-only)
- Fix misleading ATT tracking screen copy: "Share Statistics" → "Allow Tracking"
- Add "Maybe Later" dismiss option and backdrop tap-to-dismiss on ReviewPrompt (previously forced binary choice)
- Add `SplashScreen.preventAutoHideAsync()` / `hideAsync()` — eliminates blank frame on cold start
- Wire up achievements and stats screen navigation from idle screen
- Invoke `checkAchievements()` on game over — achievements now actually unlock during gameplay
- Wrap settings modal content in `ScrollView` — Restore Purchases reachable on small screens
- Per-mode high scores — "Best" now shows current mode's best instead of cross-mode. Fixes incorrect "New High Score!" celebrations when switching modes.
- Input timeout increased (5s base + 2s/item) with visible 5-second countdown in center circle before game ends. Gold at 5s, red at 3s.
- Dismiss buttons (game-over X, initial entry X) no longer overlap content — absolute positioning moved to EaseView wrapper
- Sound pack preview shows inline "Enable sound to preview" hint when tapped while muted
- Mid-game "Reset" replaced with "End Game" — triggers normal game-over flow (score recorded, overlay shown, high score entry) instead of silently discarding the run

### Feat

- `PressableScale` reusable component — animated spring scale (0.96) + opacity (0.85) press feedback on all 26 action buttons across the app. Eliminates "dead tap" feel on every interactive element. Built on `react-native-ease` EaseView.
- `AnimatedNumber` component — rolling digit counter effect on Level, Score, and Best pill boxes. Numbers slide up/fade out and slide in/fade in on value change via spring animation (~300ms).
- Native screen transitions via Expo Router `<Stack>` — screens slide in from right (iOS native), tracking screen fades. No more hard cuts between routes.
- Game over sensory treatment: overlay fades/scales in (spring animation), descending minor jingle for regular game-over, triumphant ascending jingle for new high score, Success haptic on high score.
- Achievement unlock toasts — custom `AchievementToast` component (no reanimated dependency) with spring slide-in animation, auto-dismiss, achievement icon, and localized title/description in gold theme.

### Accessibility

- Comprehensive accessibility labels on 30+ interactive elements across all screens (localized EN/ES/PT)
- Maestro E2E flows updated to find elements via a11y labels — proving they work for assistive technology
- Locked achievement badge text lightened to meet WCAG AA 4.5:1 contrast ratio

### Polish

- Safe area insets on achievements and stats screens (fixes Dynamic Island/Android cutouts)
- Touch targets: hitSlop on all small tap targets — header icons, idle action buttons, close/dismiss buttons, review prompt, tracking skip, leaderboard mode tabs, theme circles, sound pack selectors
- Progress dots switch to fraction display ("12/20") when sequence exceeds 15 items
- `playPreview` now respects `soundEnabled` toggle — no more unexpected audio when muted
- HighScoreTable highlight row now uses distinct gold tint (was indistinguishable from zebra-stripe)
- `continueGame` no longer double-counts stats (gameResultRecorded ref guard)
- Empty leaderboard shows encouraging message instead of 10 placeholder rows
- KeyboardAvoidingView on InitialEntryModal (iOS padding, Android height)
- Game Over overlay shows "Statistics" and "Achievements" navigation links
- GameOverOverlay and ReviewPrompt now adapt to active game theme (no more dark-only overlays on Pastel theme)
- Restore Purchases uses inline themed feedback instead of native Alert.alert
- Standardized all modal widths (85%, max 380) and border radii (16)
- Input race condition fixed — rapid taps no longer register multiple inputs
- Light haptic feedback when tapping buttons during sequence playback ("not yet")
- Rewarded ad continue now waits for EARNED_REWARD event before granting — fixes AdMob policy risk
- Buttons no longer stay lit during fast sequence playback at level 16+ (80ms minimum off-gap)
- Audio context recovery after backgrounding — auto-recreates context if dead, all playback functions wrapped with try/catch fallback
- Status text, progress dots, restore/sound hints all use theme colors now — visible on Pastel theme
- `GameThemeContext` + `ThemedView`/`ThemedText` base components for scalable theming
- Stats and Achievements screens now fully themed (adapt to Classic, Neon, Retro, Pastel)
- AchievementToast respects active theme colors

### Test

- 103 unit tests — added 35 Phase C tests: usePostPBPrompt (cooldown, delay, dismiss), useNotifications (permission gating, schedule logic), GameOverOverlay (PB delta, near-miss, conditional UI), StreakBanner (visibility conditions)
- 9 Maestro E2E flows: app-launches, happy-path, game-over, game-over-home, navigation, settings, mode-switch, leaderboard, tracking-screen — all passing
- Accessibility labels on back buttons (stats, achievements) — Maestro finds via a11y, doubles as VoiceOver support

### Feat

- `82368ac` — Gate themes and sound packs behind IAP with live preview UX. Classic free, others require purchase. Preview behind settings overlay, revert on dismiss, unlock buttons with RevenueCat purchase flow.

### Chore

- Remove unused deps: `@react-navigation/native-stack`, `react-native-drawer-layout`, `react-native-keyboard-controller` (Ignite boilerplate leftovers)
- Install and configure `expo-updates` with OTA update channels (development, preview, production) in `eas.json`
- Install and configure `expo-eas-observe` for production performance monitoring

### Feat

- `7adeb98` — Arcade-style local high score leaderboard: top 10 in MMKV, three-initial entry modal (retro CRT aesthetic), high score table with pulsing highlight, trophy button on idle screen
- `9997f61` — Sentry crash reporting (conditional on DSN env var), app-ads.txt placeholder
- `6255f7c` — GDPR/UMP consent flow before loading AdMob ads
- `8c81047` — Environment property (development/production) on all PostHog events
- `7aee920` — Smooth neon title crossfade with glow effect, game mode indicator under title
- `f5740fd` — Settings toggle animations, haptics on mode/settings, neon title, idle jingle
- `af8cb12` — Header action bar with mode selector (pulse animation), settings modal, game over home button

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

### Animation Polish

- `0dea72f` — Chaos mode shell game shuffle animations. 6 sequences chaining by level, smooth translateX/Y via EaseView, timing compresses at higher levels.
- `e327fdf` — Animated countdown number for timed mode. Spring-based scale/fade transition on each tick via AnimatedCountdown component.
- `1ff5497` — Circular progress ring with green→yellow→red color interpolation for timed mode. SVG ring depletes clockwise using theme button colors.

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
