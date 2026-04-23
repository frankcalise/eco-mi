# Changelog

All notable changes to Eco Mi are documented here. Entries are appended automatically after each commit during development.

---

## [Unreleased]

### Fix

- **`handleButtonRelease` left transient press state stuck when the machine exited `waiting` mid-press** — if the app backgrounded or `INPUT_TIMEOUT` autofired between `handleButtonTouch` and `handleButtonRelease`, the early-return branch bailed without clearing `inputLocked`, `activeButton`, `buttonPressStartTime`, or closing the open `noteOn`. Result: pad stays lit, tone keeps sounding, and all future pad input is blocked until the next `startGame`/`resetGame`. The early-return branch now calls `noteOff` and clears the four transient press fields before bailing so the engine recovers cleanly regardless of what caused the transition. `src/hooks/useGameEngine.ts`.
- **`showRewarded` could hang forever on Android** — some OEMs dismiss the ad without firing `CLOSED` or `ERROR` (memory pressure, activity restart mid-ad). That left `continueInFlight` stuck in GameScreen and the user's game permanently frozen in gameover with no input surface. Added a 60s `settle(earned)` fallback inside the show Promise so the hook always resolves and the guard always clears. `src/hooks/useAds.ts`.
- **Ad consent outcome was ignored** — `AdsConsent.requestInfoUpdate` + `loadAndShowConsentFormIfRequired` ran on mount but the result was never threaded into ad requests, so EEA/UK/CH users got personalized ads regardless of consent status. `useAds` now reads `getConsentInfo()` + `getPurposeConsents()` (TCF purpose 3 + 4 required for personalization) after consent settles, and passes `requestNonPersonalizedAdsOnly` into `InterstitialAd.createForAdRequest` / `RewardedAd.createForAdRequest`. Defaults to NPA = true on any failure so we err toward policy safety. `src/hooks/useAds.ts`.
- **Ad event listeners were never torn down** — `loadInterstitial`/`loadRewarded` attached three listeners per cycle with no unsubscribe tracking. In practice the current code creates a fresh instance each cycle so the old listeners are orphaned with the old instance — but on hook unmount the live instance still held listeners that could fire `setRewardedReady` / `setAdShownThisSession` on an unmounted component. Mirrored the `showRewarded` pattern: store unsubscribe handles in refs, tear down before creating a new instance and on hook unmount. `src/hooks/useAds.ts`.
- **PostPB Remove Ads button was a no-op** — `handleRemoveAds` on `/game-over` was declared `async` but only fired an analytics event; the `purchaseRemoveAds` import was unused. Tapping "Remove Ads" from the post-personal-best prompt tracked intent and did nothing — user saw a dead button. Now awaits `purchaseRemoveAds()`, fires `trackIapCompleted` on success, and dismisses the prompt so the game-over flow isn't blocked behind a stale modal. `src/app/game-over.tsx`.
- **Theme lock icons failed WCAG contrast on two themes** — the lock icon over unowned-theme swatches was hardcoded to `rgba(255, 255, 255, 0.7)` regardless of which theme the swatch previewed. Since each swatch renders the theme's own red-pad color as background, contrast swung wildly: neon cyan (`#00fff5`) at ~1.1:1 made the icon effectively invisible, pastel pink (`#f8a5c2`) at ~1.6:1 unreadable, classic (~2.4:1) and retro (~2.6:1) both failing WCAG AA non-text (3:1). New `src/utils/color.ts` exposes a `getReadableForeground(bg)` util that computes the background's relative luminance and returns `#000000` or `#ffffff`, whichever yields higher contrast. The lock icon now passes AA on every theme, bumped from 12px → 14px for legibility, and the redundant `opacity: 0.7` style was dropped. `src/app/settings.tsx`, `src/utils/color.ts` (new).
- **Transient `setTimeout` call sites leaked across unmount** — three screens scheduled setTimeouts for UI affordances (popping scale, hint text, restore message, review prompt delay, post-PB prompt delay) without storing ids or clearing them on unmount. Fast navigation back from Settings, or successive game-overs, could fire `setState` on an unmounted component. `settings.tsx` now routes its four inline `setTimeout` call sites through a `scheduleTransient` helper that tracks ids in a ref-backed Set and clears them in the existing `useEffect` cleanup. `useStoreReview.ts` and `usePostPBPrompt.ts` gained `useEffect` cleanups that clear their delay timers on unmount (explicit dismiss handlers already cleared them; this covers the implicit-unmount path). `src/app/settings.tsx`, `src/hooks/useStoreReview.ts`, `src/hooks/usePostPBPrompt.ts`.

### Feat

- **Signature haptic patterns via Pulsar migration** — Swapped `expo-haptics` for `react-native-pulsar` 1.3.0 (Software Mansion) to unlock authored amplitude + frequency patterns synced to the audio jingles. New `src/config/hapticPatterns.ts` holds two signature `Pattern` objects wired through `usePatternComposer` in `useHaptics`:
  - **`VICTORY_PATTERN`** (newHighScore) — four-tap ascending staircase (amplitude 0.3 → 1.0, frequency 0.3 → 1.0) landing on the 1st/3rd/5th/6th notes of the 720ms rising jingle. Continuous envelope adds a Duolingo-style sparkle lift that sustains 180ms past the jingle end so the celebration tails off instead of cutting dead.
  - **`SPIRAL_PATTERN`** (gameOver) — four descending spiral taps, hard thud at 600ms aligned to the final 440Hz note, then two decaying bounces. Continuous frequency drops 1.0 → 0.1 under the spiral for a Looney-Tunes falling-whistle feel.
  - Other events (`buttonPress`, `menuTap`, `sequenceFlash`, `countdownTick`, `wrongButton`) map to Pulsar's `Presets.System.*` primitives for parity with pre-migration feel. Pulsar's `notificationError` is a native multi-tap, so the old 150ms setTimeout double-pulse for `wrongButton` was dropped.
  - `expo-haptics` removed from `package.json`. Native dirs regenerated via `expo prebuild --clean`; stay gitignored per CNG.
- **Dev-only Haptics Lab** — New `/haptics-lab` route exposed via the Expo dev menu ("Haptics Lab", next to "Seed Screenshot Data"). Edit pattern JSON in-place, toggle "+ audio" to fire the jingle alongside for sync validation, tap "Parse & play" to iterate without rebuilding. Also includes a preset grid (`impactLight/Medium/Heavy`, `notification*`, `selection`) for calibrating intensity against the authored patterns. Behind `__DEV__`, so the dev menu registration + everything it reaches tree-shakes out of production bundles.
- **Tablet-optimized layout** — `supportsTablet: true` enabled. `src/utils/layoutBreakpoints.ts` helper (`isCompact`/`isTablet`) based on shortest screen side. `OrientationLockProvider` enforces portrait on phones, unlocks on tablets. `useGameBoardMetrics` hook computes board sizing from measured available space and freezes values during active play to prevent mid-round layout shifts. GameScreen refactored with distinct compact/tablet-portrait/tablet-landscape compositions. Secondary screens (achievements, stats, leaderboard, game-over, settings, AchievementToast, HighScoreTable) gained max-width centering and density tuning for tablet. Added `expo-screen-orientation` dependency.
- **Mode selector migrated to `/mode-select` route** — platform-specific `CompactModePickerSheet` (iOS ActionSheet, Android dialog-style, web fallback). `pendingModeStore` Zustand store carries selection back to GameScreen. `GameModePickerContent` shared component for mode list. Extracted `gameModes.ts`, `modePickerTiming.ts`, `modePickerPulse.ts` config files. Mode picker content and `ModeItem` scale up on tablet.

### Fix

- **Rewarded-continue flow returned the player to main menu instead of replaying the sequence** — Watching the ad and earning the reward was supposed to re-enter the game at the same level with the sequence replaying. Instead the engine was being reset to idle mid-ad, so when `continueGame()` finally fired after the ad resolved its `state.value !== "gameover"` guard bailed and no replay was scheduled. Race cause: the pending-action `useEffect` on GameScreen runs synchronously on commit (before the nav transition completes) and clears the store. By the time `useFocusEffect` fires, the store-based `"continue"` guard failed, the engine was still in gameover, and the fallback "still in gameover → reset" branch fired — killing the continue. Fixed by adding a `continueInFlight.current` ref check to the `useFocusEffect` guard in `GameScreen.tsx` so the reset branch doesn't fire while a rewarded ad is awaiting. Two regression tests added: (1) `continueGame()` in gameover schedules a replay with the preserved sequence after 500ms; (2) `continueGame()` is a no-op if the engine has already left gameover (protects the bail guard).
- **Sequence audio could leak onto the main menu** — Separate but related: `scheduleSequence` writes gain automation directly onto the audio render thread's timeline, so `clearAllTimeouts` and `cancelVisualSequence` don't reach it. When a rewarded ad suspends the app's AudioContext mid-queue and the ad dismissal resumes it, any still-queued gain events fire — even after the engine has transitioned to idle. `resetGame` and `continueGame` now call `silenceAll()` (destroy + recreate the oscillator pool) alongside the JS-side cleanup. `endGame` already did this; bringing the other two paths in line. Regression tests assert `silenceAll` fires on both transitions.
- **newHighScore haptic was double-firing** — GameScreen fired the celebration haptic on the gameover transition, and `/game-over` fired it again on mount ~400ms later. Tolerable when it was a short `notificationAsync(Success)` buzz; catastrophic for a 720ms authored pattern. The celebration haptic now fires once on GameScreen, sync'd to the jingle start. Also added a parallel `haptics.play('gameOver')` next to `playGameOverJingle()` — previously the non-HS branch had no haptic at all.

### Fix

- **End Game unresponsive after completing a sequence** — pressing End Game in the ~1000ms window between completing a sequence and the next round starting (the `advancing` state) did nothing. The XState machine had no `END_GAME` transition for `advancing`, and `endGame()` returned early for any state outside `showing`/`waiting`. Fixed by adding the transition to the machine and expanding the guard. Regression test added covering `endGame` during `advancing`.

### Fix

- **Game board layout stability** — Reserved footer slots for status bar and streak banner so the board doesn't shift when transitioning from idle to active play. Footer slot heights tuned separately for compact vs. tablet-portrait. Sequence visual cancellation added to `useGameEngine` so pending highlights can't outlive `endGame`/`resetGame`/`continueGame` transitions. Zero-score manual end resets directly to idle instead of routing through game-over.
- **Rewarded-ad continue** — Deterministic sequence replay after rewarded-ad continue path (was relying on stale state timing). Added reentrancy guard in `useAds` so landscape continue flows can't trigger duplicate rewarded modal presentations.

### Fix

- **Game-over back gesture / Android back button** — `beforeRemove` listener in `/game-over` ensures any system-initiated back (swipe, hardware button) sets `pending_action = main_menu`, so GameScreen always returns to a valid idle state instead of freezing in gameover. GameScreen additionally calls `resetGame` on focus if it finds itself in gameover without a pending action.
- **Sound pack purchase takes effect immediately** — `useAudioTones` now rebuilds its oscillator pool when `oscillatorType` changes, so a newly unlocked sound pack is heard right away without restarting the app. Also plays a preview tone immediately after a successful IAP to confirm the purchase.
- **Theme and sound pack state sync across instances** — `useTheme` and `useSoundPack` switched from local `useState` to `useSyncExternalStore` backed by module-level state, so changes in Settings propagate immediately to GameScreen and every other mounted consumer.
- **Legacy sound-pack entitlement IDs** — `SOUND_ENTITLEMENT_MAP` now accepts both canonical IDs (`sound_square`, `sound_sawtooth`, `sound_triangle`) and original aliases (`sound_retro`, `sound_buzzy`, `sound_mellow`), keeping existing subscribers unlocked after the entitlement rename.

### Refactor

- **Centralized event-based haptics** — New `useHaptics()` hook in `src/hooks/useHaptics.ts` with an event-based API (`play('buttonPress')`, `play('newHighScore')`, `play('gameOver')`, `play('wrongButton')`, `play('menuTap')`, `play('sequenceFlash')`, `play('countdownTick', { urgency })`). Callers describe intent; the hook owns the mapping to `expo-haptics` primitives, so the future Pulsar migration becomes a single-file change. Backed by a new reactive `preferencesStore` (Zustand) so the haptics settings toggle actually takes effect in-session — previously `SETTINGS_HAPTICS_ENABLED` was stored/toggled but never read, meaning every haptic fired regardless of the user's preference. All existing call sites migrated (`useGameEngine`, `GameScreen`, `settings`, `mode-select`, `GameHeader`). Added first-pass haptics to `/game-over`: one-shot `newHighScore`/`gameOver` beat on mount, `buttonPress` on Play Again/Continue/Save Initials, `menuTap` on Share/Main Menu/Skip Initials. Simulator dev aid: `[haptics] eventName` console log instead of firing, since simulator haptics don't actuate.
- **Native Stack headers** — Stats, leaderboard, achievements, and settings use the Expo Router native stack header with shared options in `src/navigation/secondaryStackHeader.ts` (Oxanium, classic baseline). Each screen updates title, theme colors, and back accessibility via `navigation.setOptions`. Settings clears theme/sound preview state on `beforeRemove` (gesture, hardware back, or header). Use `useNavigation` from **`expo-router`** (not `@react-navigation/native`) so the navigation object resolves inside Expo Router’s container.

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
- **Theme-aware navigation transition background** — `_layout.tsx` now reads the selected theme from MMKV synchronously and applies its `backgroundColor` to the root View and Stack `contentStyle`. Fixes the dark `#1a1a2e` flash during screen transitions on non-classic themes (especially Pastel).

### Refactor (v1.1.0 — Audio Architecture)

- **Oscillator pool** — replaced create-per-note architecture with 4 always-running oscillators (220/277/330/415Hz) gated by gain nodes. 9 audio nodes total, created once at init, never destroyed during gameplay. Eliminates same-frequency overlap (impossible by design), JS timer jitter (sequences pre-scheduled on audio clock), node accumulation, and the ~300ms difficulty ceiling.
- **linearRampToValueAtTime** replaces exponentialRampToValueAtTime — starts from true zero (no EPSILON hack), distributes gain change uniformly across audio quanta, avoids per-quantum normalization spikes.
- **Advance delay restored** from 200ms to 600ms (matching v1.0.1) to ensure gain ramps fully settle between sequences.
- **continueGame guard** — ref-lock prevents double-invoke during the 500ms window.
- **react-native-audio-api upgraded** 0.8.2 → 0.11.7 (zero code changes required).

### Feat (v1.1.0)

- **Difficulty curve extended beyond level 16** — levels 17+ continue scaling to 120ms interval floor and 100ms tone duration floor (human perception limit). Enabled by pool architecture removing the oscillator lifecycle bottleneck. Backward compatible — levels 1-16 unchanged.
- **Game-over 2x2 stat pill grid** — 4 pills (Score/Level/Best/Time) laid out in a 2x2 grid that mirrors the game-pad color layout (red TL, blue TR, green BL, yellow BR). Each pill has a thick colored border matching its game-board position, a colored icon (flash/trending-up/trophy/time), and a staggered spring entrance (250/350/450/550ms). Bottom CTA section delay bumped to 700ms to cascade after the pills. New Time pill uses `formatDuration(sessionTime)`. Pill content is left-aligned so growing score values (30 → 300 → 3000) stay anchored instead of shifting horizontally. Statistics/Achievements/Leaderboard nav links removed from game-over — those entry points remain on the idle screen.
- **Session time tracking in useGameEngine** — `sessionTime` (elapsed seconds) captured via `sessionStartTimeRef` on `startGame` and finalized on every `gameover` transition. Exposed through the hook return and persisted to `gameOverStore` for the /game-over screen.
- **Inline initials on game-over (replace modal)** — First qualifying game shows "What should we call you?" inline between the title and stat pills. Save persists initials to MMKV; future qualifying games auto-record silently with zero friction. Skip persists a flag so the prompt never returns. Leaderboard reduced from 10 → 5 slots (each entry feels meaningful). `InitialEntryModal.tsx` deleted (277 lines), race condition hack removed, `pendingGameOver` ref eliminated.
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

### Polish

- `8f4d28f` — Screenshot seed: fixed achievement entries from plain booleans to `{ unlocked, unlockedAt }` objects matching the shape `useAchievements` reads. All seeded achievements now render highlighted.
- `dce20a7` — GameScreen safe-area layout fix: replaced `justifyContent: "center"` with a `gameBoardFill` flex wrapper so the header stays pinned at the top and the game board centers in remaining space. StreakBanner no longer pushes the header toward the notch. Added `paddingHorizontal: 20` and `insets + 16` top/bottom buffer to match other screens.
