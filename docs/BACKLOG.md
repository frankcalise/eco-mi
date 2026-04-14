# Eco Mi — Backlog

> Actionable tasks derived from [VISION.md](./VISION.md) and [ACCOUNTS.md](./ACCOUNTS.md). Each task is scoped to be completable in a single session.

---

## How to Use This File

- Tasks are grouped by phase and ordered by dependency (do them top-to-bottom within a phase)
- `[x]` = done, `[ ]` = todo, `[~]` = in progress
- **Blocked by** notes indicate hard dependencies on other tasks or external actions
- **Ref** links point to the relevant VISION.md section for context

---

## Bugs

- [x] **Audio pops/clicks when tapping game buttons**
      Audible pop artifact on button press, especially on quick taps. Likely related to the oscillator start/stop envelope in `src/hooks/useAudioTones.tsx`. The attack ramp (`ATTACK_S = 0.01`) may be too short on some devices, or the continuous sound start/stop cycle creates a discontinuity when rapidly re-triggering. Investigate:
  - Whether the gain node value is non-zero when a new oscillator starts (creating a click)
  - Whether the single oscillator ref causes a race when tapping a new button before the previous fade-out completes
  - Whether `expo-haptics` vibration timing interferes with audio playback
  - Test with longer attack/release ramps and see if the pop goes away

- [x] **Layout shift when status text toggles between "Watch" and "Repeat"**
      The progress indicator dots below "Repeat the sequence!" cause the status area to grow, pushing content down. When it switches back to "Watch the sequence..." (no dots), content shifts up. Fix by reserving consistent vertical space for the status + dots area regardless of state — either always render the dots row (invisible when not in `waiting` state) or use a fixed-height container.

- [x] **Game over overlay: no way to return to idle/home without playing again**
      After game over, tapping Play Again starts a new game. But if the player wants to switch modes, themes, or sounds, they have to play again and then hit Reset. Add a "Home" or "X" button on the overlay that returns to idle state without starting a game.

- [x] **Status bar content color doesn't adapt to pastel theme**

- [x] **Buttons stay lit during fast sequence playback at high levels (~14-15+)**
      At higher levels where tone duration and sequence interval are very short, consecutive same-color notes (e.g., 3 blues in a row) play the audio correctly but the button never visually returns to its unpressed state between notes. The active/lit state persists across all 3 tones, making it impossible to visually count repeated colors. Likely cause: the deactivation delay in `showSequence` is longer than or equal to the interval between notes, so the button never flashes off before the next activation. Fix by ensuring a minimum gap between the active state turning off and the next note turning it on — even at the fastest speeds, there should be a brief visible "off" frame. Need to verify the timing math in `src/config/difficulty.ts` (`getToneDuration`, `getSequenceInterval`) and the flash logic in `useGameEngine`. Add a Maestro or manual test scenario that reaches level 15+ with a seeded sequence containing consecutive same-color notes to verify the fix.

- [x] **Rewarded ad grants continue before ad completes (AdMob policy risk)**
      `showRewarded()` in `useAds.ts` returns `true` immediately after calling `.show()` without waiting for the `EARNED_REWARD` event. Player gets the continue even if they dismiss the ad early. This violates AdMob policy (reward only after callback). Fix by awaiting the reward event listener before resolving the promise. Also creates a jarring transition — game replays sequence while ad overlay may still be visible.

- [x] **Dual high score system causes incorrect "New High Score!" celebrations**
      `useGameEngine.ts` stores a single cross-mode `highScore` via `"simon-high-score"` key, while `useHighScores.ts` stores per-mode top-10 leaderboards via `"ecomi:highScores:{mode}"`. The single-value high score is not mode-aware — beating your classic score in timed mode triggers the celebration incorrectly, and setting a new mode-specific record may not trigger it at all. Consolidate to use the per-mode leaderboard as the source of truth for `isNewHighScore`.

- [x] **Race condition: rapid button taps register multiple inputs**
      In `useGameEngine.ts`, touching button B before releasing button A processes both as inputs. At higher levels, fast players accidentally register extra inputs, and the visual state (which button is lit) disagrees with what was processed. Add input debouncing or lock out new touches until the current touch is released.

- [x] **Audio context silently dies after backgrounding with no recovery**
      `ctx.resume()` failures in `useAudioTones.tsx` are swallowed by empty catch blocks. If the AudioContext enters an unrecoverable state after prolonged backgrounding (common on iOS), all audio dies with no indicator or recovery mechanism. The game becomes visual-only without the player understanding why. Add a health check and context recreation fallback.

- [x] **`playPreview` ignores `soundEnabled` flag**
      `useAudioTones.tsx` `playPreview()` only checks `contextReadyRef.current` but not `soundEnabled`. Sound pack previews play audio even when the player has explicitly muted. Compare with `playSound` and `playJingle` which both respect the flag.

- [x] **`continueGame` double-counts stats**
      When a player uses a rewarded ad to continue and then fails again, `recordGameResult(score)` is called a second time. This inflates `gamesPlayed` and deflates `averageScore` in stats. Guard against recording a game result if the previous game-over already recorded it, or flag continued games distinctly.

- [x] **`continueGame` doesn't reset `isNewHighScore` flag**
      If a player gets a new high score, sees the celebration, continues via rewarded ad, then fails again, the game-over screen shows the high score celebration a second time for the same score.

- [x] **Daily streak counter leaks into non-daily mode stats**
      `recordGameResult()` in `useStats.ts` copies the daily streak to `longestStreak` on every game-over, including non-daily modes. Playing a classic game after a daily streak snapshots the daily streak as `longestStreak` even though classic has nothing to do with streaks.

- [x] **Reset button mid-game should be "End Game" with game-over flow**
      The Reset button during active gameplay destroys the current run with zero confirmation — score is lost, no game-over overlay, no stats recorded, no high score entry. During active gameplay, replace "Reset" with "End Game" that triggers the normal game-over flow (score recorded, overlay shown, high score entry if qualified). "Reset" is fine on the idle screen.

- [x] **ReviewPrompt has no dismiss option**
      `ReviewPrompt.tsx` forces users into a binary choice ("Love it" / "Not really") with no close button, no backdrop dismiss, no "Maybe Later." Tapping "Not Really" immediately opens a Google Form in the browser with no warning. Add a dismiss/skip option and a confirmation before opening the external URL.

- [x] **No splash screen management — blank frame on cold start**
      No `SplashScreen.preventAutoHideAsync()` call anywhere. The native splash auto-hides immediately, then users see a blank/black screen while i18n and fonts load. Add splash screen hold in `_layout.tsx` and hide it once `loaded` is true.

- [x] **Manually test review pre-prompt flow on device**
      The review prompt requires 5+ games played, no ad shown this session, and 30-day cooldown. Temporarily lower `MIN_GAMES_FOR_REVIEW` to 1 and bypass the `adShownThisSession` check to verify the "Love it!" and "Not really" paths work correctly. Verify the "Not really" path opens the feedback channel. Revert thresholds after testing.

## Animation Polish

- [x] **Chaos mode: animated shuffle sequences (shell game style)**
      Instead of a single shuffle animation, build a pool of shuffle sequences that are randomly selected each round. At higher levels, chain multiple sequences together for harder visual tracking. Sequences:
  - **Clockwise orbit** — all 4 buttons rotate one position around the circle
  - **Counter-clockwise orbit** — reverse direction
  - **Diagonal swap** — top-left ↔ bottom-right, top-right ↔ bottom-left (X pattern)
  - **Horizontal swap** — left pair swaps with right pair
  - **Vertical swap** — top pair swaps with bottom pair
  - **Shell shuffle** — 2-3 rapid sequential pair swaps (cup game: A↔B, C↔D, A↔C)
  - **Scatter & return** — all buttons fly to center, pause, then fly out to new positions
  - **Cascade** — each button moves one at a time in quick succession (domino effect)

  Use `react-native-ease` for smooth position transitions. At level 1-3, pick one sequence. At 4-6, chain two. At 7+, chain three with faster timing. The animation duration should compress at higher levels too — more chaos, less time to track.

- [x] **Timed mode: animated countdown number**
      Use `react-native-ease` to smoothly transition the countdown number in the center circle. Each tick should scale down the current number (shrink + fade) and scale up the new number (grow + appear). Gives the timer a fluid, non-jarring feel instead of a hard digit swap every second.

- [x] **Timed mode: circular progress ring around center circle**
      Replace the plain center circle border with a circular progress ring that depletes as time runs out. The ring should animate smoothly from full (green) to empty (red) over 60 seconds. Could use `react-native-svg` (already installed) with an animated `strokeDashoffset` on a `Circle` element, driven by `react-native-ease` or a simple interpolation from `timeRemaining / 60`.

- [x] **Animated score/level counters in stat pill boxes**
      The Level, Score, and Best pill boxes currently hard-swap numbers. Animate the transition so values smoothly increment (rolling counter / odometer effect) when they change during gameplay. Use `react-native-ease` to tween from old value to new value over ~300ms. Gives a polished, juicy feel to scoring without adding visual noise.

- [x] **Add press feedback to all Pressable elements**
      Every `Pressable` outside game buttons uses static styles with no press state. No opacity change, scale, or color shift on tap. This is the single most obvious "indie app" tell. Create a shared `style={({ pressed }) => [...]}` pattern or wrapper component that adds subtle opacity/scale feedback. Apply to: start button, play again, share, reset, settings items, mode items, sound toggles, theme selectors, unlock buttons, restore purchases, header icons.

- [x] **Game Over: full sensory treatment (animation + sound + haptics)**
      The game-over moment lacks punch. Currently: overlay snaps on instantly (no animation), a basic `notificationAsync(Error)` haptic fires, and there's no game-over sound. This is the most emotionally charged moment in the game and needs a full sensory treatment:
  - **Animation**: Staggered overlay reveal — backdrop fade → card scale-up → stats cascade in. Use `react-native-ease`. Differentiate between regular game-over and new-high-score game-over (the latter should feel celebratory, not punishing).
  - **Sound**: Compose a short (~1-2s) game-over jingle using the existing `react-native-audio-api` oscillator engine, similar to the idle jingle but descending/minor key. For new high score, play a triumphant ascending jingle instead. Respect `soundEnabled` toggle and use the active sound pack's `oscillatorType`.
  - **Haptics**: Escalate beyond the single error notification — consider a double-pulse "thud" for regular game-over and a success notification pattern for new high score. Evaluate Pulsar (once migrated) for richer patterns.

- [x] **Screen transition animations**
      Root layout uses bare `<Slot />` with no `<Stack>` navigator. Navigation between screens (game → achievements, game → stats, index → tracking) is an instant hard cut. Convert to `<Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>` or similar.

- [x] **Score box layout jitter on digit changes**
      Score/Level/Best pill boxes use `minWidth: 80` but no fixed width. When values jump from 9→10 or 99→100, the box width changes and the row reflows. Use tabular-number font features or fixed-width containers to prevent layout shifts during gameplay.

- [x] **HighScoreTable highlight row indistinguishable from zebra-stripe**
      The highlighted "your new score" row gets `backgroundColor: theme.surfaceColor`, which is identical to even-row zebra-stripe coloring. The pulsing opacity partially compensates but the background should be distinctly different (e.g., a tinted accent color).

- [x] **Achievement unlock notification/toast**
      `useAchievements.ts` tracks `newlyUnlocked` state but nothing reads it. No toast, banner, or animation when earning an achievement. The entire point of achievements is the moment of recognition — without visible feedback they have zero motivational value. Add a brief celebration toast that appears over gameplay.

- [ ] **Upgrade high score celebration with premium Lottie animation**
      The current high score celebration is basic. Browse [LottieFiles](https://lottiefiles.com/) for a higher-quality trophy/confetti animation that better matches the game's aesthetic. Look for animations with:
  - Gold trophy or medal with particle confetti burst
  - Dark background compatibility (transparent or dark-themed)
  - Smooth looping or a clean one-shot with a satisfying ending
  - Compact file size (< 100KB JSON)
  Replace the existing animation in `assets/animations/` and verify it renders well across the different game themes (Classic dark, Neon dark, Retro dark, Pastel light).

- [ ] **Escalating haptic feedback for timed mode countdown**
      Under 10s: light tick each second. Under 5s: medium. Under 3s: heavy double-pulse (heartbeat). Current `expo-haptics` is limited to basic impact/notification styles. Evaluate richer haptic libraries for finer control:
  - **[Pulsar](https://github.com/software-mansion/pulsar)** (Software Mansion) — cross-platform haptic SDK with pattern composer, realtime composer, and Reanimated worklet support. Built-in presets (earthquake, success, fail, tap) plus custom amplitude/frequency envelopes. Best option for game feel.
  - **react-native-nitro-haptics** — lighter alternative with more granularity than expo-haptics
  Ensure countdown haptics don't conflict with existing button tap and sequence playback haptics — may need to suppress timer haptics during active input.

- [ ] **Haptics overhaul: migrate from expo-haptics to Pulsar**
      Replace `expo-haptics` across the app with [Pulsar](https://github.com/software-mansion/pulsar) for richer, more nuanced haptic feedback. Pulsar's pattern composer enables custom haptic sequences per game event (button press, round complete, game over, high score) and its realtime composer could drive gesture-driven feedback. Evaluate:
  - Custom patterns for each game button color (different amplitude/frequency per color)
  - Escalating intensity patterns for streak combos
  - Distinct game-over vs high-score celebration haptics
  - Whether worklet integration improves responsiveness during animations
  - Backward compatibility — ensure Android API 24+ coverage is acceptable

- [ ] **Explore Expo UI adaptive/dynamic colors as a theme option**
      Investigate `expo-ui` adaptive colors (iOS dynamic colors, Android Material You). Could be a "System" theme that pulls the device's accent colors for the game buttons and UI chrome. Evaluate whether this works as the default theme (free, adapts to every user's device) or as a separate purchasable theme. Research: does `@expo/ui` expose adaptive color primitives that work cross-platform? What does it look like on Android Material You vs iOS?
      When the pastel theme is selected (light background), the status bar text/icons remain light — invisible against the light background. Use `expo-status-bar` to set `style="dark"` for pastel and `style="light"` for the other 3 themes. The theme config in `src/config/themes.ts` should include a `statusBarStyle` field (`"light" | "dark"`) per theme.

- [x] **Add game mode selector for demoing modes**
      The game engine supports classic, daily, timed, reverse, and chaos modes but there's no UI to switch between them. Add a mode selector in the idle state (similar to the theme/sound pack selectors) so all modes can be demoed. Show the mode name and a brief description. Daily mode should show the current streak if available.

- [x] **Settings modal: animate button toggles on value change**
      When toggling values in the settings modal (sound on/off, selecting a sound pack, selecting a theme), wrap the interactive elements in `EaseView` with a quick scale pulse + opacity fade on the outgoing selection and a pop-in on the incoming one. Same retro-confirm pattern as the mode selector pulse animation. Keep it subtle — 100–150ms timing transitions.

- [x] **Haptic feedback on mode select and settings interactions**
      Add `expo-haptics` calls to the header action buttons and modal interactions:
  - Light impact when opening mode selector or settings modals
  - Medium impact when selecting a game mode (fires with the pulse animation)
  - Light impact when toggling sound, changing sound pack, or changing theme in settings
    Use `Haptics.impactAsync()` with the appropriate `ImpactFeedbackStyle`.

- [x] **Idle screen: neon sign title animation**
      While in idle state, animate the "Eco Mi" title text to cycle through the active theme's 4 button colors (red → blue → green → yellow) with a smooth transition, simulating a glowing neon sign. Add a subtle scale breathe (1.0 → 1.02 → 1.0) using `EaseView` with a looping timing animation. The color cycle should use the current theme's `buttonColors` so it stays consistent across Classic, Neon, Retro, and Pastel themes. Stop the animation when the game starts (gameState !== "idle").

- [x] **Idle screen: one-shot retro chiptune jingle**
      Compose a short (3–5 second) retro chiptune jingle using the existing `react-native-audio-api` oscillator engine. Play it once when the game returns to idle state (app launch, after game over → home, after reset). The jingle should use the currently selected sound pack's `oscillatorType` (sine, square, sawtooth, triangle) so it changes character with the player's choice. Respect the existing `soundEnabled` toggle — no sound when muted. Keep the melody simple: 6–10 notes in a major key, ascending pattern, classic arcade "ready!" feel.

---

## UX Polish & Accessibility

- [x] **Add accessibility labels and roles to all interactive elements**
      Zero `accessibilityLabel`, `accessibilityRole`, or `accessibilityHint` props on any interactive element app-wide (except 2 instances in GameOverOverlay). VoiceOver/TalkBack users cannot use the app. Systematically annotate every Pressable, button, display, and modal. Prioritize game buttons, header actions, settings controls, and navigation.

- [x] **Fix touch targets below 44pt minimum (Apple HIG)**
      Theme circles are 32x32pt, sound pack selector buttons ~30pt, back buttons on achievements/stats ~32pt. Add `hitSlop` or increase padding to meet the 44x44pt minimum. These are IAP purchase entry points — missed taps directly cost revenue.

- [x] **Make GameOverOverlay and ReviewPrompt theme-aware**
      Both components hardcode dark colors (`#1a1a2e`, `#ef4444`, etc.) and don't accept a theme prop. When playing on the Pastel theme (light background), overlays still render dark. Pass the active game theme and adapt colors to maintain visual consistency.

- [x] **Make settings modal scrollable**
      Settings modal content (sound toggle, sound packs, themes, remove ads, restore purchases) is in a non-scrollable container. On iPhone SE or with larger dynamic type, content overflows and the Restore Purchases button (legally required) gets clipped. Wrap in a `ScrollView`.

- [x] **Replace `Alert.alert` for Restore Purchases with themed feedback**
      Restore purchases success/failure uses native `Alert.alert()`, which breaks the dark-themed experience. Replace with an inline toast or themed dialog matching the rest of the UI.

- [x] **Standardize modal dimensions and border radii**
      Three different modal width strategies (80%, 85%, maxWidth 360) and two border radii (12, 16) across overlays. Create a shared modal base component with consistent sizing for a unified visual language.

- [x] **Use safe area insets on achievements and stats screens**
      Both screens hardcode `paddingTop: 60` instead of using `useSafeAreaInsets().top`. Breaks on Dynamic Island iPhones and varies across Android devices.

- [x] **Add keyboard avoidance to InitialEntryModal**
      No `KeyboardAvoidingView` wrapping the modal content. On iPhone SE or with larger keyboards, the "Done" button may be obscured behind the keyboard.

- [x] **Add encouraging empty state for leaderboard**
      Brand new users see 10 identical placeholder rows ("---" / "----"). Replace with an illustration or motivational message ("Play your first game to see your scores here!") when no scores exist.

- [x] **Fix progress dots overflow at high levels**
      One 10px dot per sequence item in a non-wrapping horizontal row. At level 20+, dots overflow on narrow screens. Switch to a fraction display (e.g., "12/20") or cap visible dots with a "+N" indicator at higher levels.

- [x] **Add "not yet" feedback when tapping during sequence playback**
      During the "showing" phase, eager player taps are silently ignored. Add a brief haptic buzz or subtle visual pulse to communicate "input received but not ready yet" instead of dead silence.

- [x] **Locked achievement text fails WCAG AA contrast ratio**
      `#6b6b7b` text on effective `#121222` background is ~3.8:1 contrast. WCAG AA requires 4.5:1 for normal text (13px/11px). Lighten the locked text color or darken less aggressively.

- [x] **Tracking screen "Share Statistics" copy is misleading**
      "Share Statistics" implies game stats but actually triggers ATT ad tracking consent. Apple has rejected apps for misleading pre-permission language. Revise to something like "Allow Tracking" or "Support with Ads" that accurately describes the IDFA consent being requested.

---

## i18n Quality

- [x] **Fix missing diacritical marks in Spanish and Portuguese**
      Systematic missing accents: ES "Estadisticas" → "Estadísticas", "Puntuacion" → "Puntuación", "dia" → "día", etc. PT "Configuracoes" → "Configurações", "Pontuacao" → "Pontuação", "comecar" → "começar", etc. Looks machine-translated to native speakers and undermines trust.

- [x] **Translate hardcoded English strings in settings modal**
      `GameScreen.tsx` "On"/"Off" toggle text, "Unlock Sound ({name})", "Unlock Theme ({name})" are literal English, not i18n keys. Also "SCORE"/"LVL" in `HighScoreTable.tsx` and "PTS - LVL" in `InitialEntryModal.tsx`. Add translation keys for all.

- [x] **Localize achievement titles and descriptions**
      All 15 achievement titles ("First Steps", "Triple Digits", etc.) and descriptions in `achievements.ts` are hardcoded English strings, bypassing the i18n system. Move to translation keys so ES/PT users see localized achievements.

- [ ] **Localize iOS permission purpose strings (ATT + microphone)**
      Two native iOS permission dialogs currently show English-only purpose strings regardless of device language: `NSUserTrackingUsageDescription` (set via `expo-tracking-transparency` in `app.config.ts`) and the `iosMicrophonePermission` passed to `react-native-audio-api`. Not required for App Store approval, but a quality gap since the rest of the app is localized in ES and PT. Apple localizes permission strings via per-locale `InfoPlist.strings` files (e.g., `ios/EcoMi/es.lproj/InfoPlist.strings`), which aren't generated by Expo out of the box. Implementation options:
  - Write a small custom config plugin that, during prebuild, creates `es.lproj/` and `pt.lproj/` directories under the iOS project and writes `InfoPlist.strings` with `NSUserTrackingUsageDescription` and `NSMicrophoneUsageDescription` for each locale
  - Or evaluate community plugins (e.g., `expo-localized-permissions`) if one covers both strings cleanly
  - Verify on a physical device set to Spanish/Portuguese that both prompts show translated copy
  - Batch with any other native strings that need localization so the plugin is written once

---

## Game Design

- [x] **Add input timeout to "waiting" state**
      `getInputTimeout()` is defined in `difficulty.ts` but never called. Players can idle forever mid-sequence with no timer or penalty. This eliminates the memory challenge (could write down the sequence). Add a generous but firm timeout that triggers game-over, with a visual countdown indicator in the last few seconds.

- [ ] **Extend difficulty curve beyond level 16**
      Tone duration and sequence interval both hit their floor (~300ms) at level 16-17. Game stops escalating and becomes monotonous. Consider secondary challenge escalation: reducing input timeout, adding visual distractions, shortening the replay window, or introducing partial sequence hints that fade at higher levels.

- [x] **Reconsider interstitial ad placement**
      Resolved by the full-screen game-over redesign below — ad fires on Play Again but the full-screen context makes the transition to a full-screen ad feel natural rather than jarring.

- [ ] **Full-screen game-over experience (Duolingo-style)**
      Replace the small overlay card with a full-screen game-over screen. Reference: Duolingo's "Perfect lesson!" end screen — big centered animation, title/subtitle, colored stat pills, share + CTA pinned to bottom. Single screen, no streak interstitial.

  **Layout (top to bottom):**
  - Lottie animation centered (game-over animation, or celebration for new high score)
  - Title: "Game Over!" or "New High Score!" with subtitle
  - 3 colored stat pill boxes in a row (reuse/adapt existing score box style): Score, Level, Time Played
  - Stats/Achievements navigation links (subtle, secondary text)
  - Bottom bar: platform-specific share icon (left) + "Play Again" primary CTA (full width)
  - "Watch Ad to Continue" above the CTA (conditional, rewarded ad)

  **Implementation tasks:**
  - [ ] Track session play time in useGameEngine (start on startGame, stop on gameover, expose as `sessionTime`)
  - [ ] Create full-screen GameOverScreen component (replaces GameOverOverlay)
  - [ ] 3 stat pills with icons: Score (⚡), Level (🎯), Time (⏱) — colored borders like Duo's XP/Amazing/Speedy
  - [ ] Platform-specific share button: `Platform.select({ ios: "share-outline", android: "share-social" })` Ionicons
  - [ ] "Play Again" as wide primary button (green, matches Start Game style)
  - [ ] "Watch Ad to Continue" conditional secondary button
  - [ ] New high score variant: different Lottie animation, gold accent, celebration title
  - [ ] Theme-aware via GameThemeContext
  - [ ] Entry animation: staggered reveal (bg → animation → title → pills cascade → buttons slide up)
  - [ ] Preserve existing game-over/high-score jingles and haptics
  - [ ] Browse LottieFiles for game-over and celebration animations
  - [ ] Update Maestro E2E flows for new game-over screen

- [ ] **Add time penalty for wrong input in timed mode**
      Wrong input replays the current sequence with no score or time penalty — effectively a free hint. Add a small time penalty (e.g., -3 seconds) so wrong inputs feel like a genuine setback rather than a free replay.

- [ ] **Fill achievement pacing gap between levels 10-15**
      Level achievements jump 5→10→15→20 with no intermediate milestones. The 5-level gap during the hardest progression creates a feedback drought. Add a level 12 or 13 achievement to maintain motivation.

---

## Navigation & Features

- [x] **Wire up achievements and stats screen navigation**
      Routes exist at `/achievements` and `/stats` but zero navigation points to them from anywhere in the app. Add entry points from the idle game screen header (trophy icon already exists for leaderboard — add stats/achievements icons) and from the game-over overlay ("View Stats" link). These are entire features that users cannot currently access.

- [x] **Invoke achievement unlock logic during gameplay**
      `checkAchievements()` exists in `useAchievements.ts` but is never called. Import and call it from `GameScreen.tsx` on relevant game events (game over, round complete). Without this, achievements never unlock even if navigation is added.

- [x] **Add achievements/stats links to Game Over overlay**
      The game-over moment is the highest-engagement point for showing progress. Add a "View Stats" or "Achievements" link to the overlay so players who just beat their high score can see their overall progress.

---

## Tech Debt

- [x] **Remove unused navigation dependencies**
      Remove `@react-navigation/native-stack` and `react-native-drawer-layout` from `package.json`. Expo Router brings in its own navigation stack — these are unused Ignite boilerplate leftovers.

- [x] **Install and configure Sentry for crash reporting**
      `npx expo install @sentry/react-native` and add the config plugin to `app.config.ts`. Initialize in `_layout.tsx` with DSN from env var (`EXPO_PUBLIC_SENTRY_DSN`). Gives stack traces with source maps, JS error capture, and breadcrumbs. Add DSN to `.env.example` and EAS Secrets. Do this before public release — TestFlight/Play Console crash reports are sufficient for internal testing.
  - Blocked by: Sentry account created, project DSN noted

- [x] **Enrich PostHog events with device + app context**
      Today, analytics events only carry custom properties + `environment` ("development"/"production") + `$locale`/`$timezone` (auto-captured because `expo-localization` is installed). Missing critical context: app version, app build, OS name/version, device model, device manufacturer. This made the v1.0.0 launch crash hard to attribute — we couldn't see which version users were on. PostHog's RN SDK auto-captures these when the relevant optional peer deps are installed — no code changes needed beyond the installs.
  - `npx expo install expo-application` → adds `$app_version`, `$app_build`, `$app_namespace`
  - `npx expo install expo-device` → adds `$os_name`, `$os_version`, `$device_model`, `$device_manufacturer`
  - `npx expo install expo-file-system` → enables persisted anonymous distinct_id across launches (currently distinct_id regenerates on each install)
  - Verify in PostHog dashboard that events include the new `$`-prefixed props after a release build
  - Consider adding a super-property for `appVariant` (development vs production) via `posthog.register()` so dev events are trivially filterable

- [x] **Add PostHog identify() + person properties**
      Currently all events are anonymous per-install device ID with no person properties. Without `identify()`, we can't track retention cohorts, link sessions across reinstalls, or attribute revenue. Add a stable anonymous ID stored in MMKV (not tied to any PII) and call `posthog.identify(id, properties)` on app launch. Person properties to set: `firstSeenAt`, `preferredLocale`, `themeContextMode`, `hasPurchasedPremium`. Keep fully anonymous — no email, no external IDs — to match our privacy-first posture.

- [x] **Install expo-insights for update + adoption telemetry**
      `npx expo install expo-insights` adds first-class visibility into OTA update adoption, launch success/failure rates, and version distribution across the install base — visible in the Expo dashboard without needing to wire anything into PostHog/Sentry. Especially useful once we start shipping EAS Updates: we'll be able to see how quickly users pick up a new JS bundle and whether a bad update is causing launch failures. No runtime config required beyond the install; data flows automatically on production builds.

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

- [x] **Implement Remove Ads IAP flow**
  - Add "Remove Ads" button to `GameOverOverlay`
  - Check `remove_ads` entitlement via `usePurchases` before showing any ad
  - After 3–5 interstitials shown, display one-time "Tired of ads?" conversion prompt
  - Track `iap_initiated` and `iap_completed` PostHog events
  - Ref: VISION.md > Phase 1 #7, Monetization Strategy > IAP Product Catalog

- [x] **Wire interstitial ads into game-over flow**
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

- [x] **Write first Maestro flow: `happy-path.yaml`**
      Scaffold `.maestro/flows/happy-path.yaml` using the example in VISION.md > Maestro Flows. Requires seeded RNG and testIDs to be in place.
  - Blocked by: testIDs added, seeded RNG implemented, dev client built

- [x] **Write Maestro flow: `game-over.yaml`**
      Start → tap wrong button → verify `overlay-game-over` visible → tap `btn-play-again` → verify reset.
  - Blocked by: testIDs added, seeded RNG implemented

- [x] **Write Maestro flow: `navigation.yaml`**
      Verify achievements and stats screens are reachable from idle screen. Tap `btn-achievements` → verify achievements screen renders → back → tap `btn-stats` → verify stats screen → back. Also verify leaderboard modal opens/closes.

- [x] **Write Maestro flow: `settings-scroll.yaml`**
      Open settings modal. Interact and dismiss. NOTE: RN Modal content is invisible to Maestro — uses coordinate taps. Will improve after migrating to Expo Router modals.

- [ ] **Write Maestro flow: `review-prompt-dismiss.yaml`**
      Trigger review prompt conditions (5+ games, no ad). Verify the "Maybe Later" button is visible and dismisses the prompt without opening a browser. Also verify backdrop tap dismisses.

- [x] **Write Maestro flow: `tracking-screen.yaml`**
      iOS only. On first launch (clearState), verify tracking screen appears with "Allow Tracking" button text. Tap "Maybe Later" → verify game screen loads.

- [ ] **Write Maestro flow: `splash-no-flash.yaml`**
      Cold launch the app and verify no blank/white frame appears between native splash and game screen. Hard to assert in Maestro — may need visual comparison.

- [x] **Add missing testIDs for Maestro flows**
      Added `testID="btn-settings"`, `testID="btn-mode-selector"`, `testID="btn-reset"`. Also added accessibility labels on back buttons (stats, achievements).

- [ ] **Migrate modals to Expo Router modal routes**
      React Native `<Modal>` is invisible to Maestro's accessibility tree on iOS. Settings, leaderboard, and mode selector should become Expo Router modal routes (`presentation: "modal"`) for proper E2E testability, native sheet presentation (drag to dismiss), and deep linking. This also gives a more premium native feel.

### 1.6 Build & Submit

- [x] **Create privacy policy page**
      Required by both App Store and Google Play. Host at a URL (GitHub Pages, Vercel, or simple static page). Must disclose: AdMob ads, PostHog analytics, MMKV local storage. No PII collected.
  - Ref: VISION.md > ASO > App Store Assets Required

- [x] **Prepare App Store assets**
  - Screenshots: 3+ per device size (6.7", 6.5", 5.5" for iOS; 16:9 for Android)
  - Feature graphic: 1024x500 PNG (Android)
  - Store listing copy (title, subtitle, description, keywords) per VISION.md > ASO > Store Listing Copy
  - Ref: VISION.md > ASO

- [x] **Configure EAS submit profiles**
      Add `submit` section to `eas.json` for automated App Store and Play Store uploads. Configure `eas submit --platform ios` for TestFlight/App Store and `eas submit --platform android` for Play Store internal/production tracks. Set up App Store Connect API key and Google Play service account JSON in EAS credentials.

- [x] **Set up expo-updates for OTA updates**
      `npx expo install expo-updates` and configure in `app.config.ts`. Enables pushing JS bundle updates without going through store review. Configure update channel per environment (development, preview, production). Set up `eas update` workflow for quick bug fixes and content changes post-launch.

- [x] **Integrate expo-observe for performance monitoring**
      `npx expo install expo-eas-observe` — currently in technical preview / early access. Tracks session performance (TTI, frame drops, device breakdown), before/after release comparisons, and outlier detection. Minimal setup. **Note:** User has early access with Notion notes containing setup details — prompt for those when executing this task.

- [x] **Submit v1.0 to App Store and Google Play**
  - `eas build --profile production --platform all`
  - `eas submit --platform ios` + `eas submit --platform android`
  - Blocked by: All Phase 1 tasks complete, store accounts set up, ASO assets ready

---

## Phase 2 — Visual Polish (v1.1)

- [x] **Install `react-native-ease` and animate game buttons**
  - `npx expo install react-native-ease`
  - Update `GameButton.tsx` with glow, scale, and pulse animations on press and during computer sequence playback
  - Replace static `transform: [{ scale: 1.05 }]`
  - Ref: VISION.md > Phase 2 #1

- [x] **Install `lottie-react-native` and add high score celebration**
  - `npx expo install lottie-react-native`
  - Download a trophy/confetti animation from LottieFiles → `assets/animations/`
  - Trigger in `GameOverOverlay` when `isHighScore === true`
  - Ref: VISION.md > Phase 2 #2

- [x] **Install `expo-haptics` and replace `Vibration` API**
  - `npx expo install expo-haptics`
  - Different impact styles per color button (light/medium/heavy)
  - Success notification on round completion
  - Error notification on game over
  - Ref: VISION.md > Phase 2 #3

- [x] **Add sequence progress indicator**
      Show dots or a progress bar during the `waiting` state indicating how many steps the player has completed vs total sequence length.
  - Ref: VISION.md > Phase 2 #4

- [x] **Implement rewarded video "Continue" mechanic**
      After game over, offer "Watch ad to continue" (one per game). On watch completion, replay the failed sequence and let the player retry.
  - Track `ad_rewarded_watched` PostHog event
  - Ref: VISION.md > Phase 2 #5

- [x] **Implement store review pre-prompt**
  - Create `src/components/ReviewPrompt.tsx` (sentiment filter modal)
  - Create `src/hooks/useStoreReview.ts` (guard logic)
  - Install `expo-store-review`
  - Trigger from `GameOverOverlay` at positive moments (new high score, first game completion)
  - Guard: 5+ games played, no ad shown this session
  - Track `review_prompt_shown` and `review_prompt_response` events
  - Ref: VISION.md > Phase 2 #6, Review Prompt Rules, Pre-Prompt Pattern

### v1.1.0 Retention & Polish — Post-Launch Scope

Informed by the 1.0.0 crash + ATT review cycle and a deep-trace code/UX audit. Structured as three phases that should be shipped in order — Phase A unblocks measuring everything that follows.

#### Phase A — Signal & Telemetry (this week)

Unblock learning from the 1.0.1 launch. All three items live in **Tech Debt** above — link, don't duplicate:
- **Enrich PostHog events with device + app context** (already in Tech Debt)
- **Add PostHog identify() + person properties** (already in Tech Debt)
- **Install expo-insights for update + adoption telemetry** (already in Tech Debt)

#### Phase B — Code Foundation

These compound: do them before the retention work so the Phase C additions slot into a clean house instead of adding to the sprawl.

- [x] **Split `GameScreen.tsx` (~1500 lines) into focused components**
      Clean extraction seams already exist in the file. Extract `GameModeSelector` (ModeItem + Mode modal ~58-115, ~746-803), `GameSettingsPanel` (~787-1077), `GameHeader` + Status row (~446-713), leaving the screen as composition + state wiring (~800 lines). Required before xstate migration — passing 13 props into `GameOverOverlay` is a smell that gets worse as we add retention features.

- [x] **Add semantic color tokens to `GameTheme` and migrate hardcoded literals**
      32 hex literals across 7 files (e.g., `#22c55e`, `#ef4444`, `#fbbf24`) bypass the theme. `ReviewPrompt.tsx` is actually broken on the Pastel theme because `rgba(255,255,255,0.5)` becomes white-on-lavender. Add `accentColor`, `destructiveColor`, `successColor`, `warningColor` to `src/config/themes.ts` and replace literals in `GameOverOverlay.tsx`, `ReviewPrompt.tsx`, and `GameScreen.tsx`. Priority files first: the two overlays users see most.

- [ ] **Adopt XState for `useGameEngine` state machine**
      `src/hooks/__tests__/useGameEngine.bugs.test.ts` already documents 3 bugs caused by invalid state combinations (stale `isNewHighScore` after continue, input timeout only gated in timed mode, button presses during `showing` trigger haptics but no effect). XState scoped to the game engine would enforce transitions and eliminate this class of bug. Keep hooks for ads/stats/theme — don't globalize. States: `idle → showing → waiting → {gameOver, continuing}`. Entry/exit handlers own timer cleanup and sound/haptic side effects. Est. 2-3 days.

- [x] **Consolidate storage keys into `src/config/storageKeys.ts`**
      MMKV keys are scattered across `useAds.ts`, `usePurchases.ts`, `useGameEngine.ts`, `useStats.ts`, and the tracking screen. Centralize all `"ecomi:*"` keys as exported constants so schema changes are atomic and tests reference the same source of truth.

- [x] **Extract shared `ModalOverlay` component**
      `ReviewPrompt.tsx`, `GameOverOverlay.tsx`, and the Settings/Mode/Leaderboard modals in `GameScreen.tsx` repeat the backdrop + card + dismiss-on-outer pattern. Consolidate into `<ModalOverlay onDismiss>` with consistent entrance animation (scale 0.95→1 + fade), matching the springy feel already in `GameOverOverlay`. Applies the Phase C "modal animation consistency" fix as a side effect.

- [x] **Drop redundant manual memoization in `theme/context.tsx`**
      React Compiler is enabled via SDK 55, but `src/theme/context.tsx` still has 4 `useCallback`/`useMemo` instances (lines ~69, 81, 86, 95, 108). Safe to delete. Quick win that reinforces the "no manual memo" project rule.

#### Phase C — Retention & Polish

These are where v1.1 earns its keep. Ship on top of Phase B foundation.

- [ ] **First-launch trainer sequence (minimal onboarding)**
      One-time deterministic 1-color sequence on a fresh install, gated by `ecomi:onboarding:done` MMKV flag. User taps Play, watches a single green pulse, taps green, gets a satisfying chime + haptic, then level 2 ramps normally. A tiny tooltip appears only during their turn: *"Tap the button that lit up"* — auto-dismisses on first tap. **No modals, no Next buttons, no skip logic needed.** The game itself is the tutorial. Progressive disclosure for modes/streaks happens contextually later (after game 3, after first daily win). Targets D1 retention.

- [ ] **Wrong-input juice: red flash overlay + warning haptic**
      Currently wrong input only fires `Haptics.notificationAsync(Error)` from `useGameEngine.ts:590`. Add a 200ms red-tinted `EaseView` opacity flash in `GameScreen.tsx` and ensure the warning haptic also fires on timer expiry / end-game paths — not just wrong button. Cheap change, huge perceived-quality bump.

- [ ] **Game-over emotional arc: stagger + PB delta + near-miss**
      Three small additions in `GameOverOverlay.tsx` that compound: (1) stagger card children with `EaseView` delays (title 0ms → stats 150ms → actions 300ms) instead of all-at-once; (2) if `isNewHighScore`, show `+X over your previous best` below the trophy; (3) if `score >= highScore * 0.8 && !isNewHighScore`, show `So close — X from your best`. Source the title color from theme (`secondaryTextColor` for normal losses, `accentColor` for PB) instead of hardcoded red. Targets replay rate.

- [ ] **Visual score card sharing via `react-native-view-shot`**
      `handleShare` in `GameScreen.tsx:403` shares plain text today. Text shares get near-zero engagement on Instagram/TikTok/iMessage. Add a `<ScoreCard>` component (score + level + mode + app branding + themed background), capture with `captureRef`, share via `Share.share({ url })`. Single highest-leverage virality feature.

- [ ] **Local notifications via `expo-notifications`**
      Three schedules, all 100% local (no backend, no APNs/FCM). (1) **Daily challenge reminder** — one per day at user-preferred time (default 7pm). (2) **Streak-save warning** — if user has ≥3-day daily streak and hasn't played by 8pm, fire one nudge. (3) **Lapsed-user nudge** — if no launch in 3 days, one "Your best score is waiting" message. Ask permission with a pre-prompt *after* game 3 or first streak built (not on first launch). Consider iOS provisional notifications for no-permission silent delivery. Add opt-in/out toggle in settings modal.

- [ ] **Streak loss-aversion idle banner**
      If user has an active daily streak and hasn't played today's daily, render a banner on the idle screen: `🔥 Day {n} streak — play Daily to keep it!` tinted with accent color for urgency. Complements the notification push. Optional stretch: rewarded-ad streak save on first open after missing a day (restores yesterday's daily) — monetization + retention combo.

- [ ] **Empty states for stats and leaderboard**
      When `stats.gamesPlayed === 0`, `src/app/stats.tsx` renders a wall of zeros with no guidance. When `scores.length === 0`, `HighScoreTable.tsx` renders one line of centered text. Replace both with illustrated empty states: icon + localized message + CTA back to Play. Turns dead-ends into re-engagement moments.

- [ ] **Play button visual dominance on idle screen**
      Today the Start button is a modest pill in a row with trophy/stats/achievements icons (`GameScreen.tsx:1441-1449`) — it competes with 4 peer buttons. For F2P, the Play button is the single most important conversion surface. Make it ~70% width, `paddingVertical: 16`, add subtle accent-colored shadow, optional idle pulse (scale 1.0→1.02 loop). Move secondary icons to a less-prominent row below with more spacing.

- [ ] **Post-PB soft IAP prompt**
      Highest-converting IAP moment in casual games is right after a personal best, when emotional investment peaks. Today the game-over overlay shows only Play Again / Share there. Add a dismissible "Go ad-free to stay in the zone" row beneath the celebration Lottie in `GameOverOverlay.tsx`. Cap at once per 7 days per user. Independent of `adShownThisSession` guard (the current remove-ads CTA).

#### Store Submission Prep

- **Re-capture ES and PT store screenshots in-locale** — must ship with v1.1 so translated store copy is backed by translated in-game UI. See the full task under **External / Non-Code Tasks → ASO Assets**.

- [ ] **Submit v1.1 to stores**
  - Blocked by: All v1.1.0 Phase A/B/C scope complete + ES/PT screenshots recaptured

---

## Phase 3 — Engagement (v1.2)

- [x] **Implement seeded daily challenges**
      Date-based seed (`parseInt(format(new Date(), 'yyyyMMdd'))`) for deterministic sequence. Store daily best and streak in MMKV (`ecomi:daily:*` keys). Add mode selector to distinguish daily vs classic.
  - Ref: VISION.md > Phase 3 #1

- [x] **Build stats dashboard screen**
      New `src/app/stats.tsx`. Display: games played, best score, average level, current/longest streak. All from MMKV. Add navigation from game screen.
  - Ref: VISION.md > Phase 3 #2

- [x] **Implement achievement system**
  - Create `src/config/achievements.ts` with achievement definitions and conditions
  - Store in MMKV (`ecomi:achievements` key)
  - Check conditions on game events (round complete, game over)
  - Toast notification on unlock
  - New `src/app/achievements.tsx` screen with badge grid
  - Track `achievement_unlocked` PostHog event
  - Ref: VISION.md > Phase 3 #3

- [x] **Implement score sharing**
  - `npx expo install expo-sharing`
  - Generate branded score card (image or text) from game-over overlay
  - "I reached Level {{level}} with a score of {{score}} on Eco Mi!"
  - Track `share_tapped` PostHog event
  - Ref: VISION.md > Phase 3 #4

- [x] **Add Timed game mode**
      60-second countdown. Each completed sequence earns points. Wrong input replays same sequence (no game over). Score = total sequences completed.
  - Ref: VISION.md > Phase 3 #5

- [x] **Add Reverse game mode**
      Player repeats the sequence in reverse order. Single index reversal in input validation.
  - Ref: VISION.md > Phase 3 #5

- [x] **Add Chaos game mode**
      Button positions shuffle between rounds. Promote `colorMap` to state, shuffle after each successful round.
  - Ref: VISION.md > Phase 3 #5

- [x] **Extract game strings into i18n**
      Replace all hardcoded English strings in game UI with `useTranslation()` calls. Update `src/i18n/en.ts` with game-specific keys per the string table in VISION.md > Localization.
  - Ref: VISION.md > Phase 3 #6, Localization > What Needs to Happen

- [x] **Add Spanish and Portuguese translations**
      Create `src/i18n/es.ts` and `src/i18n/pt.ts`. ~30 strings each. Register in `src/i18n/index.ts` resources.
  - Blocked by: Strings extracted into i18n
  - Ref: VISION.md > Localization > Priority Languages

- [x] **Arcade high score table with three-initial entry**
      Top 10 local leaderboard stored in MMKV (`ecomi:highScores` key) as `{ initials: string, score: number, level: number, date: string, mode: GameMode }[]` sorted by score descending, capped at 10. When a player's score qualifies for the top 10, show a three-letter initial input modal (standard keyboard input for v1). Display the leaderboard on the idle screen or as a dedicated view accessible from the header. Retro arcade cabinet aesthetic — monospaced, numbered rows, blinking cursor on entry. Coexists cleanly with future global leaderboards (Phase 5) as a "This Device" tab.

- [ ] **Enhanced initial input: gesture/drawing recognition**
      Phase 2 of the high score table. Replace the keyboard-based three-initial entry with a draw-to-letter input using `@shopify/react-native-skia`. Player draws each letter on a canvas, app converts the Skia path to a recognized character. Gives a unique, tactile arcade feel. Investigate ML-based handwriting recognition (on-device, lightweight) or a simpler template-matching approach for A-Z recognition. Could also explore gesture-based input (swipe patterns mapped to letters) as an alternative.

- [ ] **Tablet-optimized layout (iPad / Android tablets)**
      Current layout uses `useWindowDimensions()` and scales the game board relative to screen size, but the UI is phone-optimized. On tablets the game board floats in the center with excessive empty space, text is undersized, and modals feel small. Adapt for larger screens:
  - Scale the game board to fill more of the available space while keeping it centered
  - Increase font sizes and touch targets proportionally
  - Widen modals (settings, mode selector, game over overlay, initial entry) — consider max-width constraints rather than full-width
  - Leaderboard table: use wider columns, larger text, more comfortable row spacing
  - Consider landscape support — the Simon board is square so it works naturally in both orientations
  - Stats and achievements screens: multi-column grid layout on wider screens
  - Test on iPad Mini, iPad Air, iPad Pro, and common Android tablet sizes
  - Enable `supportsTablet: true` in `app.config.ts` once layout is ready
  - Add iPad screenshots to App Store listing (required for iPad-supported apps)

- [x] **Localize App Store listings (ES, PT)**
      Translate subtitle, description, and keywords for Spanish and Portuguese in App Store Connect and Google Play Console.
  - Ref: VISION.md > ASO > Store Listing Copy, Localization > App Store Localization

---

## Phase 4 — Cosmetics & IAP Expansion (v1.3)

- [x] **Wire GameScreen to theme system**
      Replace all hardcoded colors (`#1a1a2e`, `#ef4444`, etc.) with tokens from `useAppTheme()`. Add game-specific tokens to `src/theme/colors.ts` and `colorsDark.ts`. (Implemented via custom `gameThemes` config + `useTheme` hook with `activeTheme` pattern instead of Ignite theme system.)
  - Ref: VISION.md > Phase 4 #1

- [x] **Implement theme packs (Neon, Retro, Pastel) as IAP**
      Define additional theme palettes. Gate behind RevenueCat entitlements (`theme_neon`, `theme_retro`, `theme_pastel`). Persist selection in MMKV (`ecomi:settings:selectedTheme`).
  - Track `theme_applied` PostHog event
  - Ref: VISION.md > Phase 4 #2

- [x] **Implement sound packs as IAP**
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

## Exploration — Not Scoped Yet

Ideas worth tracking but not committed to any phase. Revisit after 6+ months of iPhone app signal.

- [ ] **Apple Watch companion app via `expo-apple-targets`**
      The 4-button Simon grid maps naturally to the Watch form factor and the Taptic Engine is uniquely suited to a haptic-first game. Halo/differentiator play, not a revenue driver — Watch users overlap heavily with iPhone users, Watch IAP conversion is lower, no AdMob on watchOS. **Approach:** Use [EvanBacon/expo-apple-targets](https://github.com/EvanBacon/expo-apple-targets) to add a watchOS target inside this Expo project (no separate repo, no ejecting). React Native still doesn't run on watchOS, so the Watch app is SwiftUI — but prebuild generates the target, EAS handles the build, and the code lives alongside the RN app. Share high scores, streaks, and theme selection with the iPhone app via App Groups (MMKV on RN side ↔ UserDefaults on Swift side). Scope: core classic mode only for v1, no modes/achievements/IAP on Watch. Rough effort: ~2 weeks of SwiftUI work for a solo dev new to it, most of which is learning SwiftUI + watchOS idioms, not plugin setup. **Key angle:** Eco Mi's haptics-first design is a genuine strength on Watch, not just a port — the Taptic Engine can deliver richer per-button haptics than iPhone, and escalating intensity at higher levels could make a watchOS version feel *better* than the phone app. That's the press/launch story ("the Simon game built for Apple Watch") if we invest. Revisit when iPhone retention data justifies the investment, or sooner if a "first Simon on Watch" launch moment is strategically attractive.

---

## External / Non-Code Tasks

These are account setup and asset creation tasks. Track alongside code work.

### Accounts (ref: ACCOUNTS.md checklist)

- [x] Apple Developer Program — enroll, verify
- [x] App Store Connect — create app, register Bundle ID
- [x] App Store Connect — create 7 IAP products (Remove Ads + 6 packs)
- [x] App Store Connect — generate App-Specific Shared Secret (for RevenueCat)
- [x] Google Play Console — register, verify identity
- [x] Google Play Console — create app, complete store listing
- [x] Google Play Console — create 7 IAP products (matching iOS product IDs)
- [x] Google Play Console — create Service Account JSON (for RevenueCat)
- [x] RevenueCat — create account, create "Eco Mi" project
- [x] RevenueCat — configure iOS app with shared secret, note API key
- [x] RevenueCat — configure Android app with service account JSON, note API key
- [x] RevenueCat — create 7 entitlements, map products, create Default offering
- [x] AdMob — create account, verify
- [x] AdMob — register iOS app, note App ID
- [x] AdMob — register Android app, note App ID
- [x] AdMob — create 3 ad units per platform (banner, interstitial, rewarded)
- [x] AdMob — configure GDPR consent message (Privacy & messaging)
- [x] PostHog — create account, create "Eco Mi" project, note API key
- [x] Host `app-ads.txt` at developer website

### Secrets & Config

- [x] Create `.env` file from `.env.example` with real keys
- [x] Configure EAS Secrets for all env vars (`eas env:create` for each)
- [x] Run `eas credentials` to set up iOS signing
- [x] Verify Android keystore is backed up securely (EAS-managed)

### ASO Assets

- [x] Design App Store screenshots (3+ per device size)
- [ ] **Re-capture ES and PT screenshots with simulator language set to the target locale**
      Current Spanish and Portuguese store listings use screenshots captured with the simulator in English, so the in-app UI strings (buttons, labels, stats, achievements) are still in English even though the surrounding store copy is translated. This dilutes the localization signal and hurts conversion in those markets. Workflow: set the simulator/device language to `es` (and then `pt-BR`), launch the app so `initI18n()` picks up the new locale, re-capture all screenshots (home, play, stats, achievements), run them through the existing compose script, and replace the ES + PT entries in App Store Connect and Play Console. Verify the in-game copy (level text, scores, game-over overlay) is visibly translated in each frame before uploading.
- [x] Design Google Play feature graphic (1024x500)
- [x] Write store listing copy (title, subtitle, description, keywords)
- [ ] Record 15–30s preview video
- [x] Create privacy policy page and host at a public URL
- [x] Set up Google Form or email for user feedback channel (review pre-prompt "Not really" path)
- [ ] **Build `download.html` smart-link page at `frankcalise.github.io/eco-mi/download.html`**
      A single shareable URL that routes users to the correct store listing based on their device. Useful for social posts, QR codes, email signatures, the game-over share sheet, and anywhere else we can't maintain two separate links. Behavior:
  - **iOS** (detect `iPad|iPhone|iPod` in UA, excluding iPadOS-masquerading-as-Mac): `window.location.replace(APP_STORE_URL)`
  - **Android** (detect `Android` in UA): `window.location.replace(PLAY_STORE_URL)`
  - **Desktop / other**: render a simple landing page with the app icon, tagline, and side-by-side "Download on the App Store" + "Get it on Google Play" badges linking to each listing
  - Add a `<noscript>` fallback that also shows both badges, since redirect relies on JS
  - Keep it as a single static HTML file under `docs/` (same folder as `privacy-policy.html`) so GitHub Pages serves it automatically
  - Use Apple's and Google's official store badge SVGs (check their marketing guidelines for sizing/color rules before using)
  - Once live, update the Google Form + any social bios to point at this URL instead of the raw store links
