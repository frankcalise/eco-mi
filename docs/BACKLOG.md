# Eco Mi — Backlog

> Actionable tasks derived from [VISION.md](./VISION.md) and [ACCOUNTS.md](./ACCOUNTS.md). Each task is scoped to be completable in a single session.

---

## How to Use This File

- Tasks are grouped by phase and ordered by dependency (do them top-to-bottom within a phase)
- `[x]` = done, `[ ]` = todo, `[~]` = in progress
- **Blocked by** notes indicate hard dependencies on other tasks or external actions
- **Ref** links point to the relevant VISION.md section for context

---

## Phase 0 — Tech Debt & Foundation

> Do these first. The SDK upgrade and React Compiler change how we write all new code — no manual memoization needed.

### 0.1 Expo SDK Upgrade

- [x] **Upgrade from Expo SDK 53 → SDK 55**
  SDK 55 ships RN 0.84, React 19.2, and `babel-preset-expo` with React Compiler built in. This is a 2-version jump (53 → 54 → 55). Recommended approach:
  - Read the SDK 54 and SDK 55 changelogs for breaking changes
  - Bump `expo` version: `npx expo install expo@latest`
  - Fix dependencies: `npx expo install --fix`
  - Check for breaking changes in navigation (`expo-router`, `@react-navigation/*`), audio (`react-native-audio-api`), and storage (`react-native-mmkv`)
  - Rebuild native projects: `npx expo prebuild --clean`
  - Run the app on iOS and Android simulators, verify gameplay works end-to-end
  - Run `bun run test` to verify existing tests pass
  - Potential friction: `react-native-reanimated` Babel plugin ordering with React Compiler — compiler must run first. Since we're not using reanimated for game code, this should be low risk, but verify navigation transitions still work.

- [x] **Enable React Compiler**
  `babel-preset-expo@55` includes `babel-plugin-react-compiler@^1.0.0`. To enable:
  - Add `experiments.reactCompiler: true` to `app.config.ts` (or the Babel config, depending on SDK 55's API — check Expo docs)
  - Verify the app builds and runs without errors
  - The compiler auto-memoizes components and hooks — no need for `useMemo`, `useCallback`, or `React.memo` in new code
  - Existing manual memoization is harmless (compiler skips already-memoized code) — remove gradually during refactors, not all at once
  - If specific files cause compiler bailouts (e.g., reanimated worklets), add `"use no memo"` directive to opt out per-file

- [x] **Remove manual memoization from `GameScreen.tsx` during refactor**
  When extracting `useGameEngine()`, do not carry over `useCallback` wrappers — write plain functions. The compiler handles it. This simplifies the hook code and eliminates the stale closure bugs caused by incorrect dependency arrays.
  - Blocked by: React Compiler enabled

### 0.2 Cleanup

- [x] **Remove unnecessary permissions from audio plugin config**
  Current `app.json` requests microphone permission and foreground service — not needed for oscillator playback. Strip `iosMicrophonePermission`, `androidForegroundService`, and `FOREGROUND_SERVICE` permissions from the `react-native-audio-api` plugin config.

- [x] **Clean up unused boilerplate dependencies**
  Remove `apisauce` from `package.json` (unused). Evaluate `react-native-keyboard-controller` — only used as `<KeyboardProvider>` in layout, unnecessary for a single-screen game. Check if SDK 55 upgrade makes any other deps obsolete.

- [x] **Add `.catch()` to `initI18n` in `_layout.tsx`**
  Currently no error handler — if i18n init fails, the app renders `null` forever (white screen). Add `.catch()` or `.finally()` to ensure the app renders even in degraded state.

---

## Phase 1 — Ship to Stores (v1.0)

### 1.1 Code Architecture

- [x] **Extract `useGameEngine()` hook from `GameScreen.tsx`**
  Move all game state (`sequence`, `playerSequence`, `gameState`, `score`, `level`, `highScore`), timer refs, and game logic (`startGame`, `showSequence`, `handleButtonTouch`, `handleButtonRelease`, `resetGame`) into `src/hooks/useGameEngine.ts`. GameScreen becomes presentational only.
  - Fix orphaned `setTimeout` refs — track all timer IDs and clear on reset/unmount
  - Fix stale closure in `handleButtonRelease` (memoized deps issue)
  - Fix `Dimensions.get("window")` at module scope — use `useWindowDimensions()` instead
  - Return a clean API: `{ gameState, score, level, highScore, sequence, activeButton, startGame, resetGame, handleButtonTouch, handleButtonRelease }`
  - Ref: VISION.md > Phase 1 #1, Technical Architecture > Target Architecture

- [x] **Create `src/config/difficulty.ts`**
  Extract timing constants and speed ramp formula:
  - `MIN_TONE_DURATION`: base 600ms, decreasing with level
  - `SEQUENCE_INTERVAL`: `Math.max(300, 800 - level * 30)`
  - `INPUT_TIMEOUT` (if adding time pressure later): `sequence.length * 2000`
  - Export as functions of level so `useGameEngine()` consumes them
  - Ref: VISION.md > Phase 1 #3

- [x] **Add `testID` props to all interactive and state-displaying elements**
  Follow the testID convention table in VISION.md > Testing Strategy. This unblocks Maestro flows.
  - Game buttons: `btn-red`, `btn-blue`, `btn-green`, `btn-yellow` (with `-active` suffix when lit)
  - Controls: `btn-start`, `btn-play-again`, `btn-sound-toggle`
  - Displays: `text-score`, `text-level`, `text-high-score`
  - Overlays: `overlay-game-over`
  - Ref: VISION.md > Testing Strategy > TestID Conventions

- [x] **Add seeded RNG for deterministic test mode**
  When `EXPO_PUBLIC_TEST_SEED` env var is set, use a seeded PRNG (e.g., mulberry32) for sequence generation instead of `Math.random()`. Zero impact on production.
  - Ref: VISION.md > Testing Strategy > Deterministic Test Mode

### 1.2 Visual Polish (v1.0 scope)

- [x] **Wire up Oxanium font across all game UI**
  Fonts are already bundled in `assets/fonts/`. Update `src/theme/typography.ts` to replace SpaceGrotesk with Oxanium as the primary font. Apply `fontFamily` to all text styles in GameScreen.
  - Ref: VISION.md > Phase 1 #2

- [x] **Build `GameOverOverlay` component**
  New `src/components/GameOverOverlay.tsx`. Modal overlay shown when `gameState === "gameover"`:
  - Score, level reached, high score comparison
  - "New High Score!" badge when applicable
  - Play Again button (`testID="btn-play-again"`)
  - Share button (placeholder — wired up in Phase 3)
  - This is the primary surface for ads and IAP prompts later
  - Ref: VISION.md > Phase 1 #4

- [x] **Extract `GameButton` component**
  New `src/components/GameButton.tsx`. Encapsulates a single game quadrant button:
  - Accepts `color`, `isActive`, `onPressIn`, `onPressOut`, `testID`
  - Static styling for now (animations added in Phase 2)
  - Centralizes the `getButtonPosition` / `getButtonStyle` logic currently inline in GameScreen
  - Ref: VISION.md > Appendix > Target Structure

### 1.3 Monetization

- [x] **Convert `app.json` to `app.config.ts`**
  Required for reading env vars at build time (AdMob App IDs, PostHog key). Move all config from static `app.json` to dynamic `app.config.ts`. Read `ADMOB_APP_ID_IOS`, `ADMOB_APP_ID_ANDROID` from `process.env`.
  - Ref: ACCOUNTS.md > Security > AdMob App IDs in `app.json`
  - Blocked by: `.env` file created with placeholder values

- [x] **Install and configure `react-native-purchases` (RevenueCat)**
  - `npx expo install react-native-purchases`
  - Add `"react-native-purchases"` to plugins in `app.config.ts`
  - Create `src/hooks/usePurchases.ts` — generic, reusable hook:
    - `configure()` on app launch with platform-specific API key from env
    - `checkEntitlement(id)` → boolean
    - `purchasePackage(packageId)` → result
    - `restorePurchases()` → entitlements
  - Initialize in `src/app/_layout.tsx`
  - Cache entitlements in MMKV (`ecomi:purchases:removeAds`, `ecomi:purchases:ownedProducts`)
  - Ref: VISION.md > Phase 1 #5, ACCOUNTS.md > RevenueCat
  - Blocked by: `app.config.ts` conversion, RevenueCat account setup (ACCOUNTS.md checklist)

- [x] **Install and configure `react-native-google-mobile-ads`**
  - `npx expo install react-native-google-mobile-ads`
  - Add plugin config to `app.config.ts` with env var App IDs
  - Install `expo-tracking-transparency` for ATT consent
  - Create `src/hooks/useAds.ts` — generic, reusable hook:
    - ATT consent request on first launch (iOS)
    - Interstitial preloading and display
    - Banner show/hide based on game state
    - Frequency cap logic (MMKV: `ecomi:ads:lastInterstitialTime`, `ecomi:ads:sessionCount`, `ecomi:ads:gamesPerSession`)
    - First 3 sessions grace period (no interstitials)
    - `__DEV__` flag → use test Ad Unit IDs automatically
  - Ref: VISION.md > Phase 1 #6, #8, Ad Placement Rules, ACCOUNTS.md > Google AdMob
  - Blocked by: `app.config.ts` conversion, AdMob account setup (ACCOUNTS.md checklist)

- [ ] **Implement Remove Ads IAP flow**
  - Add "Remove Ads" button to `GameOverOverlay`
  - Check `remove_ads` entitlement via `usePurchases` before showing any ad
  - After 3–5 interstitials shown, display one-time "Tired of ads?" conversion prompt
  - Track `iap_initiated` and `iap_completed` PostHog events
  - Ref: VISION.md > Phase 1 #7, Monetization Strategy > IAP Product Catalog

- [ ] **Wire interstitial ads into game-over flow**
  - After game over, check frequency cap → show interstitial if allowed → then show `GameOverOverlay`
  - Skip if game lasted < 3 rounds
  - Skip if Remove Ads purchased
  - Track `ad_shown` PostHog event
  - Ref: VISION.md > Phase 1 #8, Ad Placement Rules

### 1.4 Analytics

- [x] **Install and configure PostHog**
  - `npx expo install posthog-react-native`
  - Add `PostHogProvider` to `src/app/_layout.tsx` with env var API key
  - Ref: VISION.md > Analytics > PostHog Setup, ACCOUNTS.md > PostHog
  - Blocked by: PostHog account created (ACCOUNTS.md checklist)

- [x] **Instrument core analytics events**
  Add PostHog event tracking calls to `useGameEngine` and `GameOverOverlay`:
  - `game_started`, `game_completed`, `game_over`
  - `ad_shown`, `ad_rewarded_watched`
  - `iap_initiated`, `iap_completed`
  - `share_tapped`
  - `review_prompt_shown`, `review_prompt_response`
  - Ref: VISION.md > Analytics > Core Events

### 1.5 Testing (v1.0 scope)

- [x] **Write unit tests for `useGameEngine()` hook**
  Test with `@testing-library/react-hooks` (already installed via RTL):
  - State transitions: idle → showing → waiting → gameover
  - Score calculation: `sequence.length * 10` per round
  - Speed ramp: verify interval decreases with level
  - Timer cleanup: no orphaned timeouts after reset
  - Seeded RNG: deterministic sequence with `EXPO_PUBLIC_TEST_SEED`
  - Ref: VISION.md > Testing Strategy

- [ ] **Write first Maestro flow: `happy-path.yaml`**
  Scaffold `.maestro/flows/happy-path.yaml` using the example in VISION.md > Maestro Flows. Requires seeded RNG and testIDs to be in place.
  - Blocked by: testIDs added, seeded RNG implemented, dev client built

- [ ] **Write Maestro flow: `game-over.yaml`**
  Start → tap wrong button → verify `overlay-game-over` visible → tap `btn-play-again` → verify reset.
  - Blocked by: testIDs added, seeded RNG implemented

### 1.6 Build & Submit

- [ ] **Create privacy policy page**
  Required by both App Store and Google Play. Host at a URL (GitHub Pages, Vercel, or simple static page). Must disclose: AdMob ads, PostHog analytics, MMKV local storage. No PII collected.
  - Ref: VISION.md > ASO > App Store Assets Required

- [ ] **Prepare App Store assets**
  - Screenshots: 3+ per device size (6.7", 6.5", 5.5" for iOS; 16:9 for Android)
  - Feature graphic: 1024x500 PNG (Android)
  - Store listing copy (title, subtitle, description, keywords) per VISION.md > ASO > Store Listing Copy
  - Ref: VISION.md > ASO

- [ ] **Configure EAS submit profiles**
  Add `submit` section to `eas.json` for automated App Store and Play Store uploads.
  - Blocked by: Apple Developer account, Google Play Console account (ACCOUNTS.md checklist)

- [ ] **Submit v1.0 to App Store and Google Play**
  - `eas build --profile production --platform all`
  - `eas submit --platform ios` + `eas submit --platform android`
  - Blocked by: All Phase 1 tasks complete, store accounts set up, ASO assets ready

---

## Phase 2 — Visual Polish (v1.1)

- [ ] **Install `react-native-ease` and animate game buttons**
  - `npx expo install react-native-ease`
  - Update `GameButton.tsx` with glow, scale, and pulse animations on press and during computer sequence playback
  - Replace static `transform: [{ scale: 1.05 }]`
  - Ref: VISION.md > Phase 2 #1

- [ ] **Install `lottie-react-native` and add high score celebration**
  - `npx expo install lottie-react-native`
  - Download a trophy/confetti animation from LottieFiles → `assets/animations/`
  - Trigger in `GameOverOverlay` when `isHighScore === true`
  - Ref: VISION.md > Phase 2 #2

- [ ] **Install `expo-haptics` and replace `Vibration` API**
  - `npx expo install expo-haptics`
  - Different impact styles per color button (light/medium/heavy)
  - Success notification on round completion
  - Error notification on game over
  - Ref: VISION.md > Phase 2 #3

- [ ] **Add sequence progress indicator**
  Show dots or a progress bar during the `waiting` state indicating how many steps the player has completed vs total sequence length.
  - Ref: VISION.md > Phase 2 #4

- [ ] **Implement rewarded video "Continue" mechanic**
  After game over, offer "Watch ad to continue" (one per game). On watch completion, replay the failed sequence and let the player retry.
  - Track `ad_rewarded_watched` PostHog event
  - Ref: VISION.md > Phase 2 #5

- [ ] **Implement store review pre-prompt**
  - Create `src/components/ReviewPrompt.tsx` (sentiment filter modal)
  - Create `src/hooks/useStoreReview.ts` (guard logic)
  - Install `expo-store-review`
  - Trigger from `GameOverOverlay` at positive moments (new high score, first game completion)
  - Guard: 5+ games played, no ad shown this session
  - Track `review_prompt_shown` and `review_prompt_response` events
  - Ref: VISION.md > Phase 2 #6, Review Prompt Rules, Pre-Prompt Pattern

- [ ] **Submit v1.1 to stores**
  - Blocked by: All Phase 2 tasks complete

---

## Phase 3 — Engagement (v1.2)

- [ ] **Implement seeded daily challenges**
  Date-based seed (`parseInt(format(new Date(), 'yyyyMMdd'))`) for deterministic sequence. Store daily best and streak in MMKV (`ecomi:daily:*` keys). Add mode selector to distinguish daily vs classic.
  - Ref: VISION.md > Phase 3 #1

- [ ] **Build stats dashboard screen**
  New `src/app/stats.tsx`. Display: games played, best score, average level, current/longest streak. All from MMKV. Add navigation from game screen.
  - Ref: VISION.md > Phase 3 #2

- [ ] **Implement achievement system**
  - Create `src/config/achievements.ts` with achievement definitions and conditions
  - Store in MMKV (`ecomi:achievements` key)
  - Check conditions on game events (round complete, game over)
  - Toast notification on unlock
  - New `src/app/achievements.tsx` screen with badge grid
  - Track `achievement_unlocked` PostHog event
  - Ref: VISION.md > Phase 3 #3

- [ ] **Implement score sharing**
  - `npx expo install expo-sharing`
  - Generate branded score card (image or text) from game-over overlay
  - "I reached Level {{level}} with a score of {{score}} on Eco Mi!"
  - Track `share_tapped` PostHog event
  - Ref: VISION.md > Phase 3 #4

- [ ] **Add Timed game mode**
  60-second countdown. Each completed sequence earns points. Wrong input replays same sequence (no game over). Score = total sequences completed.
  - Ref: VISION.md > Phase 3 #5

- [ ] **Add Reverse game mode**
  Player repeats the sequence in reverse order. Single index reversal in input validation.
  - Ref: VISION.md > Phase 3 #5

- [ ] **Add Chaos game mode**
  Button positions shuffle between rounds. Promote `colorMap` to state, shuffle after each successful round.
  - Ref: VISION.md > Phase 3 #5

- [ ] **Extract game strings into i18n**
  Replace all hardcoded English strings in game UI with `useTranslation()` calls. Update `src/i18n/en.ts` with game-specific keys per the string table in VISION.md > Localization.
  - Ref: VISION.md > Phase 3 #6, Localization > What Needs to Happen

- [ ] **Add Spanish and Portuguese translations**
  Create `src/i18n/es.ts` and `src/i18n/pt.ts`. ~30 strings each. Register in `src/i18n/index.ts` resources.
  - Blocked by: Strings extracted into i18n
  - Ref: VISION.md > Localization > Priority Languages

- [ ] **Localize App Store listings (ES, PT)**
  Translate subtitle, description, and keywords for Spanish and Portuguese in App Store Connect and Google Play Console.
  - Ref: VISION.md > ASO > Store Listing Copy, Localization > App Store Localization

---

## Phase 4 — Cosmetics & IAP Expansion (v1.3)

- [ ] **Wire GameScreen to theme system**
  Replace all hardcoded colors (`#1a1a2e`, `#ef4444`, etc.) with tokens from `useAppTheme()`. Add game-specific tokens to `src/theme/colors.ts` and `colorsDark.ts`.
  - Ref: VISION.md > Phase 4 #1

- [ ] **Implement theme packs (Neon, Retro, Pastel) as IAP**
  Define additional theme palettes. Gate behind RevenueCat entitlements (`theme_neon`, `theme_retro`, `theme_pastel`). Persist selection in MMKV (`ecomi:settings:selectedTheme`).
  - Track `theme_applied` PostHog event
  - Ref: VISION.md > Phase 4 #2

- [ ] **Implement sound packs as IAP**
  Parameterize `oscillator.type` in `useAudioTones.tsx` (currently hardcoded `"sine"`). Add square, sawtooth, triangle options. Gate behind RevenueCat entitlements. Persist in MMKV (`ecomi:settings:selectedSoundPack`).
  - Track `sound_pack_applied` PostHog event
  - Ref: VISION.md > Phase 4 #3

- [ ] **Implement XP / progression system**
  Award XP per game with bonuses for speed and streaks. Player level gates free cosmetic unlocks. Ranks: Beginner → Apprentice → Adept → Master → Grandmaster. Display in game UI.
  - Ref: VISION.md > Phase 4 #4

- [ ] **Add remaining priority language translations**
  French, German, Japanese, Korean, Chinese, Arabic, Hindi (~30 strings each). Register all in `src/i18n/index.ts`.
  - Ref: VISION.md > Localization > Priority Languages

---

## Phase 5 — Backend (Future, deferred)

> Do not start these until analytics data from Phases 1–4 justifies the investment. See VISION.md > Backend Deferral Rationale.

- [ ] **Set up Supabase project**
  Postgres + Auth + Realtime. Schema: users, scores, achievements tables.
  - Ref: VISION.md > Phase 5, Backend Deferral Rationale

- [ ] **Implement anonymous auth with optional sign-in upgrade**
  Supabase anonymous auth. Optional Apple/Google sign-in via `expo-auth-session`.
  - Ref: VISION.md > Phase 5 #1

- [ ] **Implement global leaderboards**
  Daily and all-time. Server-validated scores.
  - Ref: VISION.md > Phase 5 #2

- [ ] **Implement cross-device sync**
  Stats, achievements, settings. RevenueCat already handles purchase restoration.
  - Ref: VISION.md > Phase 5 #3

- [ ] **Implement friend challenges via deep links**
  Share a challenge link (`ecomi://challenge/{seed}`) that opens the app with a specific daily seed.
  - Ref: VISION.md > Phase 5 #4

---

## External / Non-Code Tasks

These are account setup and asset creation tasks. Track alongside code work.

### Accounts (ref: ACCOUNTS.md checklist)

- [ ] Apple Developer Program — enroll, verify
- [ ] App Store Connect — create app, register Bundle ID
- [ ] App Store Connect — create 7 IAP products (Remove Ads + 6 packs)
- [ ] App Store Connect — generate App-Specific Shared Secret (for RevenueCat)
- [ ] Google Play Console — register, verify identity
- [ ] Google Play Console — create app, complete store listing
- [ ] Google Play Console — create 7 IAP products (matching iOS product IDs)
- [ ] Google Play Console — create Service Account JSON (for RevenueCat)
- [ ] RevenueCat — create account, create "Eco Mi" project
- [ ] RevenueCat — configure iOS app with shared secret, note API key
- [ ] RevenueCat — configure Android app with service account JSON, note API key
- [ ] RevenueCat — create 7 entitlements, map products, create Default offering
- [ ] AdMob — create account, verify
- [ ] AdMob — register iOS app, note App ID
- [ ] AdMob — register Android app, note App ID
- [ ] AdMob — create 3 ad units per platform (banner, interstitial, rewarded)
- [ ] AdMob — configure GDPR consent message (Privacy & messaging)
- [ ] PostHog — create account, create "Eco Mi" project, note API key
- [ ] Host `app-ads.txt` at developer website

### Secrets & Config

- [ ] Create `.env` file from `.env.example` with real keys
- [ ] Configure EAS Secrets for all env vars (`eas secret:create` for each)
- [ ] Run `eas credentials` to set up iOS signing
- [ ] Verify Android keystore is backed up securely

### ASO Assets

- [ ] Design App Store screenshots (3+ per device size)
- [ ] Design Google Play feature graphic (1024x500)
- [ ] Write store listing copy (title, subtitle, description, keywords)
- [ ] Record 15–30s preview video
- [ ] Create privacy policy page and host at a public URL
- [ ] Set up Google Form or email for user feedback channel (review pre-prompt "Not really" path)
