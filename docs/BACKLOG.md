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

- [ ] **Leaderboard mode tab label wraps in Spanish ("CONTRARRELOJ")**
      The timed mode label in Spanish is "Contrarreloj" — too long to fit on one line in the mode tab button on the leaderboard screen, causing it to wrap across two lines ("CONTRARRE / LOJ"). Fix options: shorten the Spanish translation to an abbreviation ("C.RELOJ" or "TIEMPO"), reduce the tab font size for long labels, or allow the tab row to scroll horizontally. Check PT for the same issue ("CRONOMETRADO"). Ref: leaderboard mode tabs in `src/app/leaderboard.tsx`.

- [x] **Watch-ad-to-continue returned player to main menu instead of replaying the sequence**
      Two overlapping bugs — both fixed. **Primary (functional):** earning the rewarded reward still dumped the user on main menu with no replay. Race in `GameScreen.tsx`: the pending-action `useEffect` ran synchronously on commit, cleared the store, and started `handleContinue` (which awaits `showRewarded`). By the time `useFocusEffect` fired later, the store-based `"continue"` guard failed, the engine was still in gameover, and the fallback reset branch moved the engine to idle mid-ad. When `continueGame()` finally ran after the ad resolved, its `state.value !== "gameover"` guard bailed and no replay was scheduled. Fixed by adding a `continueInFlight.current` ref check to the `useFocusEffect` guard so the reset branch doesn't fire while a rewarded ad is awaiting. **Secondary (audio cleanup):** `scheduleSequence` writes gain automation directly onto the audio render thread's timeline, so JS-side cleanup doesn't reach it. When the ad suspended the AudioContext mid-queue and dismissal resumed it, still-queued events could fire after the engine transitioned to idle — most visible in daily because seeded RNG made the leaked sequence recognizable. `resetGame()` and `continueGame()` now call `silenceAll()` alongside JS-side cleanup, matching what `endGame()` already did. Regression tests in `useGameEngine.bugs.test.ts` cover: (a) `silenceAll` fires on reset + continue transitions, (b) `continueGame` in gameover actually schedules a replay with the preserved sequence after the 500ms delay, (c) `continueGame` is a no-op if the engine already left gameover.

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

- [x] **Intermittent audio pops/static at tone onset (post-XState refactor)**
      After the B6 XState migration, audio pops reappear intermittently at the start of tones during both sequence playback (`playSound` in `flashButton`) and player input (`startContinuousSound`). Jingles are unaffected (separate audio path). The pops are color-specific — once a frequency channel (e.g., red=220Hz, blue=277Hz) starts popping, it persists for that color while others remain clean. Observed on Pixel 9 Pro (not simulator). `useAudioTones` was not modified in the refactor, but the timing of when `playSound` fires relative to state transitions shifted — the machine transitions first, then the wrapper calls `showSequence` imperatively, vs the old code where `setGameState("showing")` and `showSequence` ran in the same synchronous block. Investigate whether the slight async gap between state transition and first `playSound` call leaves a previous oscillator node undisposed, causing gain discontinuity when the new one starts on the same frequency.

- [x] **Continue via ad logs duplicate leaderboard entry**
      When a player gets game over with a high score, the score is added to the leaderboard (`useHighScores.addHighScore` called from `GameScreen.tsx` game-over effect). If they continue via rewarded ad and then lose again, a second entry is logged — potentially the same or a different score. Stats are already guarded against double-counting by `gameResultRecorded`, but the leaderboard path in GameScreen fires on every gameover transition. Fix: only log to the leaderboard on the final gameover (skip if `continuedThisGame` is false on the first game-over, or defer logging until the game truly ends). Alternatively, if the continued score is higher, replace the first entry rather than adding a second.

- [ ] **State machine: `startTimer` interval reads stale `ctx` via JS closure**
      In `useGameEngine.ts` (~line 292–315), `handleGameOverSideEffects` called from inside the `setInterval` tick captures `state.context` from the render in which `startTimer` was invoked. If timed-mode expiry fires later in the game, `ctx.highScore` and `ctx.gameResultRecorded` reflect the snapshot at timer start, not the live machine context — meaning double-calls to `saveHighScore`/`recordGameResult` can silently misfire. Mirror the existing `scoreRef` pattern: keep a ref that tracks the fields `handleGameOverSideEffects` reads and deref inside the interval callback. Low observed impact today because the machine moves quickly to gameover, but this is a latent bug that would surface the first time we add anything that mutates those fields mid-game.

- [ ] **State machine: `continueGame` captures `ctx.sequence` / `ctx.level` via closure before `addTimeout`**
      `useGameEngine.ts:511–521` snapshots `sequenceToReplay` and `levelToReplay` synchronously, sends `CONTINUE`, then schedules replay in an `addTimeout(..., 500)`. Safe today because `setupContinue` preserves the sequence, but any future `setupContinue` action that mutates `sequence` (or if a `RESET` fires between the two `addTimeout` callbacks) would play back the wrong data silently. Fix: read the latest machine snapshot inside the timeout callback via a `contextRef` that mirrors `state.context`.

- [ ] **`handleGameOverSideEffects` can double-fire `saveHighScore` / `saveDailyResult`**
      `useGameEngine.ts:312–317` is called from both `endGame` and the non-timed wrong-input branch of `handleButtonRelease`. `gameResultRecorded` guards the inner `recordGameResult` call, but `saveHighScore` and `saveDailyResult` have no such guard. If the machine ever reaches `gameover` through a new path (e.g., `INPUT_TIMEOUT` autofires while `handleButtonRelease` is also processing), both write paths execute. Guard both on `ctx.gameResultRecorded`, or consolidate all game-over side effects into a single `useEffect` that watches the `state.value` transition into `gameover` (see related architectural task in Tech Debt).

- [ ] **Ad serving dies for rest of session on single ERROR event**
      `useAds.ts` flips `loadedRef.current = false` on `AdEventType.ERROR` for both interstitial and rewarded but never retries. A single network blip during ad load kills monetization for the rest of the session — the next `showInterstitial`/`showRewarded` call bails immediately because `loadedRef.current` is false and no reload is scheduled. Add a debounced retry (~30s) on ERROR so transient failures recover.

- [ ] **`consentReady` is exported from `useAds` but nothing consumes it**
      The hook exposes `consentReady` in its return but every caller ignores it; ad init fires `loadInterstitial`/`loadRewarded` immediately regardless of whether consent has resolved. Since both load methods tolerate the pre-consent state (they just use `npaRef` default = true), this is harmless today but the unused flag is a code smell. Either drop it from the return type, or gate initial ad load behind it so we don't fire requests before consent settles.

- [ ] **`handleShare` on `/game-over` swallows all errors silently**
      `src/app/game-over.tsx:256–269` wraps `Sharing.shareAsync` / `Share.share` in `catch {}`, so a missing share target on Android (or any other failure) gives the user no feedback — the button just looks broken. Surface a themed toast or `Alert` on failure; at minimum log the error to Sentry so we have visibility into how often this fails.

- [ ] **`useAchievements` runs initial load twice on mount**
      `src/hooks/useAchievements.ts:50–52` uses `useState(loadAchievements)` as a lazy initializer (correct), then has a follow-up `useEffect(() => { setAchievements(loadAchievements()) }, [])` that re-reads the same MMKV values and triggers an extra render on every mount of `GameOverScreen`. Delete the `useEffect` — the lazy initializer is sufficient.

- [ ] **`inputRefs` array recreated every render in `/game-over`**
      `src/app/game-over.tsx:130` builds `const inputRefs = [inputRef0, inputRef1, inputRef2]` on every render. The consumers happen to read the ref objects (which are stable) so the current code works, but the array identity thrashes — the React Compiler can't stabilize it, and any future consumer taking `inputRefs` as a prop or dep would re-fire. Either `useRef([inputRef0, inputRef1, inputRef2]).current` at mount, or index the named refs directly in the handlers.

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

- [x] **Upgrade high score celebration with premium Lottie animation**
      The current high score celebration is basic. Browse [LottieFiles](https://lottiefiles.com/) for a higher-quality trophy/confetti animation that better matches the game's aesthetic. Look for animations with:
  - Gold trophy or medal with particle confetti burst
  - Dark background compatibility (transparent or dark-themed)
  - Smooth looping or a clean one-shot with a satisfying ending
  - Compact file size (< 100KB JSON)
    Replace the existing animation in `assets/animations/` and verify it renders well across the different game themes (Classic dark, Neon dark, Retro dark, Pastel light).

- [x] **Escalating haptic feedback for timed mode countdown**
      Under 10s: light tick each second. Under 5s: medium. Under 3s: heavy double-pulse (heartbeat). Current `expo-haptics` is limited to basic impact/notification styles. Evaluate richer haptic libraries for finer control:
  - **[Pulsar](https://github.com/software-mansion/pulsar)** (Software Mansion) — cross-platform haptic SDK with pattern composer, realtime composer, and Reanimated worklet support. Built-in presets (earthquake, success, fail, tap) plus custom amplitude/frequency envelopes. Best option for game feel.
  - **react-native-nitro-haptics** — lighter alternative with more granularity than expo-haptics
    Ensure countdown haptics don't conflict with existing button tap and sequence playback haptics — may need to suppress timer haptics during active input.

- [ ] **Daily streak-extended celebration beat on /game-over**
      When the player finishes a daily-mode game that extended their current streak, slot a brief celebratory "streak extended" beat at the top of `/game-over` _before_ revealing the trophy/summary view. Flow: daily game ends → land on `/game-over` → first paint shows only a large flame icon + "Day N streak!" headline + short sub-label (e.g. "You're on fire — keep it going!") + a single Continue CTA → Continue dismisses the celebration layer and reveals the existing trophy/stat-pills/initials layout (animated in as it does today). The celebration should _not_ be a separate route — keep it as a stacked layer inside `src/app/game-over.tsx` so there's no extra navigation state and back-button behavior is unchanged.
  - Only show when `mode === "daily"` AND the streak was extended this game (i.e. `currentStreak > previousStreak`, not just any daily win). Streak broken → no celebration. Streak same (already played today) → no celebration.
  - Milestone streaks (3, 7, 30, 100) get upgraded visuals — bigger flame, confetti Lottie, milestone-specific headline ("One week streak!"). Non-milestone extensions get the lighter treatment.
  - Pair with a distinct haptic pattern (once Pulsar lands): rising double-pulse that feels like a match strike + flame whoosh, separate from both the new-high-score "victory" and regular game-over patterns. Non-milestone extensions use the base pattern; milestones layer a sustained flourish on top.
  - Pair with a short flame/whoosh audio cue (existing `react-native-audio-api` oscillator engine, respecting sound pack + soundEnabled).
  - Continue should also be auto-dismissed after ~2.5–3s if the player doesn't tap, so it never blocks the game-over flow. Analytics: emit `streak_extended_celebration_shown` with streak count + whether it was milestone.
  - Open question: does this stack awkwardly with the achievement toast if a streak milestone _also_ unlocks an achievement? Likely suppress the toast during the celebration layer and let it appear on the summary view after Continue.

- [x] **Centralized event-based haptics hook + wire settings toggle + game-over haptics**
      Introduced `useHaptics()` in `src/hooks/useHaptics.ts` with an event-based API (`play('buttonPress')`, `play('newHighScore')`, `play('gameOver')`, `play('wrongButton')`, `play('menuTap')`, `play('sequenceFlash')`, `play('countdownTick', { urgency })`). Callers describe intent; the hook owns the mapping to `expo-haptics` primitives — makes the future Pulsar swap a one-file change. Backed by a reactive `preferencesStore` (Zustand) so the haptics settings toggle actually takes effect in-session (previously `SETTINGS_HAPTICS_ENABLED` was stored but never read — every haptic fired regardless). All existing call sites migrated: `useGameEngine`, `GameScreen`, `settings`, `mode-select`, `GameHeader`. Added first-pass haptics to `/game-over` (mount beat + button handlers). Simulator dev aid: logs `[haptics] eventName` instead of firing, since simulator haptics don't actuate.

- [x] **Migrate `soundEnabled` to reactive preferences store**
      Folded `soundEnabled` into `src/stores/preferencesStore.ts` alongside `hapticsEnabled`. `useGameEngine` and `settings.tsx` now read via `usePreferencesStore` selector — in-session mute takes effect immediately without app restart. Deleted the `toggleSound` and `syncSoundState` workarounds on `useGameEngine` (the first had no production caller; the second collapsed to `syncVolume()` since only the volume sync is still needed — volume itself has the same latent bug but is deferred to its own task). GameScreen focus effect renamed accordingly.

- [x] **Migrate `volume` to reactive preferences store**
      Completed the prefs-store migration. `volume` now lives in `preferencesStore` with a clamped `setVolume` setter. `useAudioTones` subscribes via selector and applies gain to the live master node reactively (single `useEffect` on volume change), replacing the old `syncVolume()` pull pattern. Dropped `syncVolume` from the `AudioTonesHook` interface, from `useGameEngine`'s return, and from the `useFocusEffect` on `GameScreen`. Settings reads volume from the store instead of local `useState` — cross-screen consistency holds even if a second entry point for volume is ever added.

- [x] **Settle all Settings prefs into the store**
      Final sweep to make the entire Settings screen state-reactive: `notifyDaily`, `notifyStreak`, `notifyWinback` joined `hapticsEnabled` / `soundEnabled` / `volume` in `preferencesStore`. Internalized `soundEnabled` inside `useAudioTones` (read via selector, not passed as a positional arg) — removes the asymmetry where `volume` was internal but `soundEnabled` flowed through as a prop. `useAudioTones` signature collapsed from `(colorMap, soundEnabled, oscillatorType, onRecycle)` to `(colorMap, oscillatorType, onRecycle)`. `useGameEngine` no longer exposes `soundEnabled` in its return (no production consumer; redundant store test deleted). `useNotifications` continues reading notify flags directly from MMKV at scheduling time — store writes through to MMKV, so source of truth is consistent.

- [x] **Haptics overhaul: migrate from expo-haptics to Pulsar**
      Swapped `expo-haptics` for `react-native-pulsar` 1.3.0. `useHaptics.ts`'s `fireEvent` now dispatches to `Presets.System.*` primitives (`impactLight/Medium/Heavy`, `notificationSuccess/Error`) for event parity. Pulsar's `notificationError` is a native multi-tap, so the manual 150ms setTimeout double-pulse in `wrongButton` was dropped. `expo-haptics` removed from `package.json`. Worklets peer-dep resolved cleanly (Pulsar accepts `*`, our tree's 0.8.1 from audio-api 0.12.0 was fine). Android API 24+ confirmed OK — Pulsar inherits the app's minSdk and no-ops gracefully on pre-Core-Haptics iPhones and single-motor Android devices. Native dirs regenerated via `expo prebuild --clean`; stay gitignored per CNG.

- [x] **Signature haptic patterns: New High Score + Game Over**
      Two authored `Pattern` objects live in `src/config/hapticPatterns.ts`, wired through `usePatternComposer` inside `useHaptics`:
  - **`VICTORY_PATTERN`** (newHighScore) — four-tap staircase at 0/240/480/600ms climbing amplitude 0.3 → 1.0 and frequency 0.3 → 1.0, landing on the 1st/3rd/5th/6th notes of the 720ms ascending jingle. Continuous amplitude envelope adds a Duolingo-style sparkle lift that sustains 180ms past the jingle end.
  - **`SPIRAL_PATTERN`** (gameOver) — four rapid descending taps (spiral), hard thud at 600ms aligned to the final 440Hz note, then two decaying bounces at 720/820ms. Continuous frequency envelope drops 1.0 → 0.1 under the spiral; amplitude silences right after the thud so bounces feel crisp.
  - Patterns fire from `GameScreen` next to the jingle call so they ride the audio envelope. The redundant `/game-over` mount-effect haptic that used to double-fire was removed as part of the migration.
  - Dev-only `/haptics-lab` route (gated behind `__DEV__`, accessible via the Expo dev menu) lets you hand-edit the pattern JSON + fire the jingle alongside to validate sync without rebuilding.

- [ ] **Extend signature Pulsar patterns beyond newHighScore / gameOver**
      Follow-up to the Pulsar migration. The high-emotion moments got custom patterns; the remaining events (`buttonPress`, `menuTap`, `sequenceFlash`, `countdownTick`, `wrongButton`) still use `Presets.System.*` for parity with the pre-migration feel. Candidates for bespoke patterns:
  - **`wrongButton`** — an authored "error thud" with more weight than the stock `notificationError` (two sharp beats + low rumble underneath, ~300ms total).
  - **`countdownTick`** with rising urgency — at 10s remaining a light fade-in, at 5s a steady medium, under 3s a heavy tap with rising frequency each tick (heart-racing crescendo into the final second).
  - **`buttonPress`** per-color texture — different frequency/amplitude profile for red/blue/green/yellow so each button has a subtle tactile signature. Optional; might cross into "overdone" territory since button presses are high-frequency events during gameplay.
  - Keep using the `/haptics-lab` dev route for authoring; same workflow as Victory/Spiral.

- [x] **Theme-aware navigation transition background**
      `_layout.tsx` currently hardcodes the stack `contentStyle.backgroundColor` and the root wrapper View to `#1a1a2e` (Classic theme). Users on other themes (Neon, Retro, Pastel) see a momentary flash to that classic dark color during slide transitions. To fix: lift the theme context up to `_layout.tsx` so the root View and stack contentStyle use `activeTheme.backgroundColor` dynamically. Particularly noticeable on Pastel (light theme) where the flash goes from light → dark → light.

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

- [x] **Pad active state: shadow + glow pulse (depth layer)**
      Today the `GameButton` active state animates `scale: 1.08` and `opacity: 0.85 → 1` but the shadow is static. Premium Simon-likes "lift" the pressed pad. Add a second `EaseView` overlay beneath the pad that animates a blurred colored glow (radial gradient via `expo-linear-gradient` or a blurred colored `View` at ~40% opacity inflated 15% beyond pad bounds) in + out with the active state. Use a snappier spring than the pad body (`stiffness: 500, damping: 22`) so the glow reads as a sharp "pop" while the pad settles more gently. Pair with a subtle inner-shadow on inactive pads so "off" reads as depth, not just dimness. Also intensify `wrongFlash` from 0.25 opacity / 100ms to a 2-beat `0 → 0.45 → 0.1 → 0` over ~280ms so mistakes sting.

- [x] **Idle main-menu: sparkle traveler tracing the pad ring** — built then removed after device testing. Prototyped a continuous orbit (rotating-wrapper variant first, then explicit sin/cos waypoints) but on device it read as "too busy" — the constant motion competed with the neon title color cycle and added visual noise without adding delight. Swapped for **free-play pad tapping** instead: pads are now interactive on the main menu so the player can tap them to play tones, providing the "alive" feeling via user action rather than ambient animation. The traveler component was deleted (in git history under `feat/pad-palette-polish` commits `2d996aa`, `c3a83e1`, `c80781d` if we ever want to revive it for a whack-a-mole mini-game — see Exploration).

- [x] **Start button breathe: pair scale loop with shadow/rim-glow**
      `GameScreen.tsx:647-674` currently loops `scale: 1.0 → 1.02` every 1200ms with a static shadow. Premium apps pair idle breathing with a corresponding "lift" so the button appears to inhale. Two options: (a) animate `shadowRadius: 8 → 16` and `shadowOpacity: 0.3 → 0.5` in sync with the scale loop, or (b) swap the scale for an accent-colored rim glow (`borderWidth: 0 → 2`, `borderColor: activeTheme.accentColor + "80"`) for a more Stripe-like effect without the bouncy quality. Whichever direction, keep the 1200ms period so the rhythm stays meditative.

- [x] **Game-over hero landing: accelerate CTA + animate score value**
      `/game-over` currently cascades stat pills at 250/350/450/550ms and delays the CTA block to `+700ms` — the Play Again button appears ~1.1s after mount, which makes the primary action feel late for non-PB games. Also, the score value itself never animates: it's baked into the pill so the "hero number" never lands. Tighten: compress pill stagger to ~60ms each, drop CTA delay from 700 → 350ms with a `translateY: 16 → 0, scale: 0.98 → 1` spring, and wrap the score value in a count-up (spring from 0 → final over ~450ms, `stiffness: 90, damping: 14`). Replace the title's `timing 300ms` with a spring `stiffness: 160, damping: 14` so "GAME OVER" lands with weight rather than fading in.

- [ ] **Theme swap: animated surface transition (replace hard snap)**
      Tapping a theme circle in `/settings` calls `setTheme(id)` synchronously — background, header, pads, and all surfaces re-render instantly. Premium apps sweep the transition. Attempted twice: (a) in-screen `EaseView` scrim over the body only — native stack header snapped visibly ahead of the body fade because it's rendered by `UINavigationController`, outside the screen's JSX. (b) root-level scrim wrapped in `FullWindowOverlay` from `react-native-screens` so it covers the nav bar on iOS — confirmed working but *still felt the same* on device because only the bg color crossfades while pad colors, text, and borders still snap underneath, so the eye catches the discontinuity. Real fix likely requires either (1) a full-window native snapshot of the prior frame (`react-native-theme-switch-animation` — adds a native dep; the library takes a `UIView` snapshot including nav bar and crossfades it against the live new state, which is the "unistyles-like" effect the user expected), or (2) `headerShown: false` + custom JS header everywhere, so the whole screen including chrome lives under a single JS-animatable opacity surface. Both are bigger than the polish budget this item was scoped to; revisit when there's appetite. The 2×2 swatch preview and sliding-indicator ideas mentioned in the original scope are tracked under the "Theme picker: show selected theme name + strengthen selected-state visual" entry (the 2×2 preview shipped; sliding indicator deferred).

- [x] **Sound-pack pill: explicit preview affordance**
      `settings.tsx:231-278` pills auto-play a preview tone on tap but there's no visual cue signaling "tap to preview" — first-time users don't know. Add an `Ionicons name="volume-medium"` inside each owned pill (keep the `lock-closed` icon for unowned) and swap to `"volume-high"` with a gentle `opacity 0.6 → 1` loop while the pack is previewing, so users see *which* pack is speaking. Reuse the existing `soundDisabledHint` pattern to show a one-shot tooltip "Tap to preview" the first time Settings opens.

- [x] **Splash → index cross-fade (kill the blink)**
      `_layout.tsx:85` calls `SplashScreen.hideAsync()` with no crossfade, so the native splash snaps off to the idle screen. Wrap the first render in a 240ms `EaseView` opacity fade so the logo dissolves into the game. Zero functional change; just removes the blink.

- [x] **AnimatedCountdown: quicker cross-fade or smart swap**
      `src/components/AnimatedCountdown.tsx:23-27` drops the number for 150ms of its 1s life, which reads as a stutter. Options: (a) drop fade to ~80ms so the number is present for most of the tick, or (b) do a straight swap + scale bump for small deltas (±1) and only animate for large jumps (≥2). Also replace hardcoded `#ef4444` / `#fbbf24` with `activeTheme.destructiveColor` / `warningColor` so the countdown doesn't go red-on-red on the classic theme.

- [x] **Global motion token file (`src/theme/motion.ts`)**
      Animation timings and springs are scattered across ~20 components with varied stiffness values (300 / 400 / 200 / 220) and a mix of `easeOut` / `easeInOut` / `linear`. Premium products have one motion language. Create a `motion.ts` with named presets — `snap` (spring 400/22/0.7, for taps/pops), `smooth` (spring 220/20/0.9, for standard transitions), `grand` (spring 120/14/1.0, for hero moments), `exit` (timing 200 easeIn, for dismissal). Migrate components incrementally to consume these. Pure refactor: no user-visible change on day 1, but every subsequent animation edit gets more consistent.

- [ ] **Leaderboard rank tiers: gold / silver / bronze**
      `HighScoreTable` today shows 5 visually identical rows with just a number column. Give ranks 1/2/3 distinct accent treatments — gold (`#fbbf24`), silver (`#cbd5e1`), bronze (`#b45309`) — applied to the rank number + a subtle left border or medal icon. Keeps the table readable but gives the top slots the visual weight they deserve. Pair with `fontVariant: ["tabular-nums"]` on score columns to kill the space-padded number hack.

- [ ] **Streak banner: gentle prompt for 0-streak users**
      `StreakBanner` today only renders when `streak > 0`. New players and lapsed players see nothing, so the daily-streak loop has no visible hook. After a user has ≥3 sessions with `streak === 0`, show a low-key banner ("Play today to start a streak") with the flame icon dimmed. Disappears the moment they play a daily game.

- [ ] **Locked achievement: progress subtitle**
      `achievements.tsx` locked rows show only the title + description. Give players something to chase: for quantitative achievements (games played, level reached, high score), render a small `2/5 games` or `Level 12 / 15` subtitle under the description so progress is visible. Requires wiring `useStats` into the achievements screen and computing the progress per achievement based on its unlock condition.

- [x] **Play Again: pre-navigation ack-scale**
      On press of Play Again in `/game-over`, the button scales down (via `PressableScale`) but there's no success beat before `router.back()` fires. Add a quick `scale 1 → 1.05 → 1` ack over ~200ms before calling `setPendingAction("play_again")` so the user feels the commitment land rather than the screen just disappearing.

- [x] **Title text-shadow: layered ghost for crisper neon**
      `GameHeader` applies `textShadowRadius: 12` with no offset, which can render muddy on iOS. Test a 2-layer approach: primary text with `textShadowRadius: 8`, plus a ghost layer at `opacity: 0.4` offset by 1px — sharper neon feel, no perf cost. Visual review on device before shipping.

- [~] **Share card: pad-colored score + pad-dot logo mark** — logo mark shipped; per-digit colored score prototyped and reverted (diluted hero-score dominance per device review). See CHANGELOG `[Unreleased]` → `Feat` → "Pad-palette polish" entry.
      The current `ShareScoreCard` (`src/components/ShareScoreCard.tsx`) is functional but visually flat — clean dark card, big white score number, amber-accented "New High Score!" badge, nothing that reads as "Eco Mi" at thumbnail size. The share image is the most viral surface in the app; every share in a feed is a micro-ad, so it should carry the game's brand mark (the 4-pad quadrant) without relying on text being legible. Two bundled changes that preserve the hero-score dominance:
  - **Pad-colored score number.** Apply a 4-corner color treatment to the score value using `theme.buttonColors.{red,blue,green,yellow}.color` — options to prototype: a conic/linear gradient across the number, per-digit color split, or a colored drop-shadow/glow behind the text. Goal: the score reads as Eco Mi on its own, not just a big number. Make sure it remains readable across all four themes (classic's vivid palette is easy; pastel is lighter and needs more contrast between the number and the light bg; retro's desaturated palette needs stronger accent).
  - **2×2 pad-dot logo mark.** Replace or pair the "ECO MI" text at the top of the card with a small 2×2 grid of colored dots in the active theme's pad colors. Size so it reads at feed-thumbnail scale (maybe ~24×24 total). Consider pairing with the text rather than replacing it for v1 — belt and suspenders until we have signal on whether the mark alone carries the identity.
  - Keep the current layout; do NOT convert the score/level/mode metadata block into a 2×2 stat-pill grid — that dilutes the hero-score dominance and risks looking like a screenshot of `/game-over` rather than a curated share asset. Explicitly *not* Option C from the design discussion.
  - Verification: capture the card across all 4 themes (classic, neon, retro, pastel) for both normal and new-high-score variants. Ensure legibility at 320w rendered size and at half scale (feed thumbnail).

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

- [x] **Theme picker: show selected theme name + strengthen selected-state visual**
      The Settings theme row renders 4 colored circles — red, cyan, brick, pink — with no text labels. The only way a user knows what theme they're on is:
  - the 2px green border on the active circle (easy to miss, especially on Classic whose pad-red matches the highlight direction visually), and
  - the `lock-closed` icon that only appears on *unowned* themes, so owned + inactive themes are completely unlabeled.

      By contrast the Sound Pack row immediately above shows each pack's name ("Classic", "Retro", "Buzzy", "Mellow") which makes selection and identity obvious at a glance. The theme row should match that clarity.

      Two changes to prototype (pick one or combine):
  1. **Show the active theme name**, either as a subtitle under the `THEME` section header (e.g. `THEME — PASTEL`) or as a label that appears under the currently-selected circle. Localize via the existing `t("themes.{id}")` pattern in `src/i18n/`.
  2. **Strengthen the selected-state visual** beyond the current `borderColor: UI_COLORS.green500, borderWidth: 2`. Options: (a) grow the selected circle slightly (scale 1.15 via EaseView), (b) add a theme-colored outer glow ring, (c) render a small check-mark badge at the bottom-right of the selected swatch, (d) swap the flat circle for a mini 2×2 pad preview at 48×48 (same idea as the share-card logo mark) so each swatch shows all 4 pad colors in context.

      Pair with the broader theme-chrome audit below — fixes to pastel/neon chrome will affect how the THEME section itself looks.

      Files: `src/app/settings.tsx` (theme row render, ~line 325–365), `src/config/themes.ts` (already has `name` field on each theme — reuse it). New i18n keys under a `themes` namespace if localizing.

- [x] **Full theme-chrome audit across Pastel + Neon + Retro (non-Classic themes)**
      The game was visually designed around Classic (dark navy bg) and several surfaces/borders/CTAs were hardcoded with `rgba(0, 0, 0, X)` / `rgba(255, 255, 255, X)` values that assume a dark backdrop. On Pastel (light bg) and Neon (black bg with vivid accents) those assumptions break in specific, painful ways:

  **Pastel observations (2026-04-23 device review, Pixel 9 Pro):**
  - `gameContainerStyle.backgroundColor: "rgba(0, 0, 0, 0.5)"` (`GameScreen.tsx:459`) renders as a dark grey disc on the pale pastel background — jarring visual clash, reads as "the pad quadrant is on a separate dark surface." Should pull from `activeTheme.surfaceColor` so the container fades into the theme.
  - Score box borders (`rgba(255, 255, 255, 0.2)`-style) disappear against light pastel bg — boxes look like floating text with no container.
  - Stat pill borders on `/game-over` are barely visible against pastel (hard to distinguish the 4 colored pills).
  - "Watch Ad to Continue" outlined button uses a dark theme border/text on light pastel — discordant.
  - Bottom idle icon buttons (trophy / stats / achievements) use dark-theme outlines that fight the pastel bg.
  - **Pad active glow is doubly washed out on pastel**: the glow uses the pad's own pastel color (e.g. `#f8a5c2` red-pad) as shadow color on an already-light bg. On iOS shadow it's invisible; on Android the SVG radial gradient barely reads. Either boost glow opacity theme-specifically, or use a darker "glow accent" color derived from the pad per-theme, or use `theme.destructiveColor` / etc. as the glow source for light themes.

  **Neon observations (2026-04-23 device review, iOS sim):**
  - `.playAgainButton` and `.startGame` CTAs: white text on `theme.accentColor = "#39ff14"` (Neon's vivid green) measures ~2.5:1 contrast — fails WCAG AA for normal text (needs 4.5:1). Same pattern on any other primary CTA that uses `activeTheme.accentColor` as a background with white text. Fix: compute foreground via the existing `getReadableForeground(bg)` util in `src/utils/color.ts` so the text color picks black when the accent is bright.
  - Likely affects other CTAs across Settings ("Remove Ads" using `UI_COLORS.brandPurple` is fine, but anything using `activeTheme.accentColor` as bg needs the same fix).

  **Retro: needs spot-check** — retro's palette is desaturated brick/forest/mustard, so likely has the opposite problem (buttons too dim against dark retro bg, contrast marginal on secondary text).

  **Approach**:
  1. Grep `src/` for hardcoded `rgba(` and `#[0-9a-f]{3,8}` literals in StyleSheet blocks. For each, decide: use `activeTheme.surfaceColor` / `borderColor` / `textColor` / `secondaryTextColor` / `destructiveColor` / `warningColor` / `accentColor`, or keep as raw token if truly theme-agnostic (e.g. `UI_COLORS.shadowBlack`).
  2. For every primary CTA using `activeTheme.accentColor` as background, replace hardcoded `color: "white"` with `color: getReadableForeground(activeTheme.accentColor)`.
  3. Capture screenshots on all 4 themes × all major screens (idle, gameplay, /game-over, /settings, /leaderboard, /stats, /achievements) and diff visually against Classic as the reference.
  4. For the pad glow specifically, consider a per-theme "glow intensity" or "glow color" override in `src/config/themes.ts` so Pastel can boost + Neon can stay punchy without global tuning.

  Completed as its own session. Added semantic theme-chrome tokens (`panelColor`, `panelBorderColor`, `primaryForegroundColor`, per-pad `glowColor`, `titleCycleColors`) and moved the main gameplay chrome, game-over CTAs, prompts, tracking/notification screens, stats cards, title treatment, streak banner, and idle secondary-page buttons onto those tokens. Verified visually across Neon, Retro, and Pastel on idle + secondary screens.

- [ ] **Colorblind mode: shape/glyph overlay on pads**
      Simon-style play depends entirely on distinguishing 4 colors + position. ~4–8% of males have red-green color deficiency, and on the retro theme both red (`#c0392b`) and green (`#27ae60`) desaturate to near-identical mid-greys for deuteranopes/protanopes. Add a user-toggleable "Colorblind patterns" setting that renders a unique glyph on each pad — circle / square / triangle / diamond, or numerals 1-4 — at ~24% opacity in the pad's contrast color. Also serves players in bright sunlight or on cheap displays. WCAG 1.4.1 (Use of Color). New setting in `settings.tsx` under "Accessibility" section, plumbed through theme context to `GameButton`.

- [ ] **Reduced motion: `useReducedMotion` hook + gate loops / Lottie / shuffles**
      Grepping `src/` for `AccessibilityInfo` / `isReduceMotionEnabled` returns zero results. The neon title color cycle (`GameHeader.tsx:71-95`), Start button scale breathe (`GameScreen.tsx:655,742`), shuffle animations, Lottie trophy (`game-over.tsx:331`), streak banner, and the `EaseView` pop on every `PressableScale` all fire unconditionally. Violates WCAG 2.3.3 and iOS `UIAccessibility.isReduceMotionEnabled`. Add a shared `useReducedMotion()` hook that subscribes to `AccessibilityInfo.reduceMotionChanged`; wrap each looping/large-transform animation with a guard (`reduced ? nothing : the animation`). For Lottie, swap to a static trophy PNG under reduced motion. For the shuffle mode, skip animations entirely and snap to final positions.

- [ ] **Screen-reader sequence announcements + live region**
      Game-state transitions ("Watch sequence" / "Repeat sequence"), individual pad flashes during playback, `wrongFlash`, and game-over are all visual-only. `GameStatusBar` has no `accessibilityLiveRegion`, and there is no `AccessibilityInfo.announceForAccessibility` call anywhere. Blind players cannot track the sequence even with audio — they hear only the tone frequency, not which pad played. WCAG 4.1.3 (Status Messages). Add `accessibilityLiveRegion="polite"` to the status text, and during `gameState === "showing"` announce each pad ("red, top left") at the start of its flash. Announce correct/wrong on each player tap, and "Game over, score 47" on transition.

- [ ] **Game pad `accessibilityLabel` includes position**
      `src/components/GameButton.tsx:116` uses `accessibilityLabel={color}` — a VoiceOver user hears "red / red / red / red" for four unlabeled pads. Switch to `"red pad, top left"` etc. via an i18n key like `a11y:pad` with `{ color, position }` interpolation. Also add `accessibilityState={{ disabled: !isActive }}` where appropriate so VO reads "red pad, top left, dimmed" during the showing phase.

- [ ] **Theme / sound-pack picker: `accessibilityLabel` + `accessibilityState={{ selected }}`**
      `src/app/settings.tsx:325-364` (themes) and `:232-278` (sound packs) render `Pressable` circles/pills with zero a11y props — a VO user hears generic "button" and has no idea what Classic, Neon, Retro, Pastel even are. Add `accessibilityRole="button"`, `accessibilityLabel={theme.name}`, `accessibilityHint={isOwned ? t("a11y:applyTheme") : t("a11y:previewLocked")}`, `accessibilityState={{ selected: isSelected, disabled: !isOwned && !canPreview }}`. WCAG 4.1.2.

- [ ] **Onboarding tooltip contrast fix (white-on-green fails AA in classic)**
      `src/components/OnboardingTooltip.tsx:25` renders white text on `activeTheme.accentColor`. On classic (`#22c55e`) the ratio is ~2.3:1 at 15px — fails AA. On pastel (`#6c5ce7`) it's ~7.4:1 (fine). Either pick the foreground dynamically via the `getReadableForeground()` util already added in `src/utils/color.ts`, or darken the classic accent so white-on-accent works globally.

- [ ] **Retro + pastel secondary text marginal contrast**
      Retro's `secondaryTextColor #998877` on background `#2c2c2c` is ~4.1:1 — fails AA for 12–14px body copy (needs 4.5:1). Pastel's `#7a7a9a` on `#f5f0ff` sits exactly at 4.5:1, which fails once sub-pixel anti-aliasing reduces effective contrast. Nudge retro secondary to ~`#b0a089`, pastel secondary to ~`#6a6a8a`.

- [ ] **Timer ring: non-color urgency cue**
      The `TimerRing` turns red at ≤10s remaining but there's no size change and no haptic outside of the existing `countdownTick`. Adds color reliance (WCAG 1.4.1). Add a subtle scale pulse at ≤5s that matches the haptic cadence, and consider a ring thickness bump from 5s onward so the urgency is readable regardless of color perception.

- [ ] **Lottie trophy: reduced-motion fallback**
      `game-over.tsx:331` renders `LottieView autoPlay loop={false}` for new-high-score celebrations unconditionally. Under reduced motion this should swap to a static trophy PNG (or freeze on the final frame). Gated by the `useReducedMotion` task above.

- [ ] **Initials boxes clip at large dynamic text sizes**
      `game-over.tsx:653-660` hardcodes `64×52` dimensions around a 32pt `Oxanium-Bold` character. iOS accessibility text sizes scale up to 310%, which clips the character inside the box. Let the container grow with content (`minWidth` + `alignItems: "center"` + intrinsic height) or clamp the inner `Text` size separately from the system text scale.

- [ ] **`ModalOverlay`: `accessibilityViewIsModal` on iOS + focus trap**
      `src/components/ModalOverlay.tsx` backdrop is tap-to-dismiss but there's no `accessibilityViewIsModal={true}` — VoiceOver can swipe past the modal to content beneath. Add the prop on iOS and an equivalent `importantForAccessibility` gate on Android.

- [ ] **Mode-select "Dismiss" hardcoded English literal**
      `src/app/mode-select.tsx:73` uses the string `"Dismiss"` directly instead of an i18n key. ES/PT users see English. Move to `t("common:dismiss")` or equivalent.

- [x] **Sound-pack pill: touch target below 44pt**
      `settings.tsx:235` pills use `paddingVertical: 6` + `hitSlop: { top: 6, bottom: 6, left: 4, right: 4 }` with 10px font — effective target is ~28–30pt tall, under iOS HIG 44pt. Bump vertical padding to 10 or hitSlop to `{ top: 10, bottom: 10, left: 8, right: 8 }`.

---

## i18n Quality

- [x] **Fix missing diacritical marks in Spanish and Portuguese**
      Systematic missing accents: ES "Estadisticas" → "Estadísticas", "Puntuacion" → "Puntuación", "dia" → "día", etc. PT "Configuracoes" → "Configurações", "Pontuacao" → "Pontuação", "comecar" → "começar", etc. Looks machine-translated to native speakers and undermines trust.

- [x] **Translate hardcoded English strings in settings modal**
      `GameScreen.tsx` "On"/"Off" toggle text, "Unlock Sound ({name})", "Unlock Theme ({name})" are literal English, not i18n keys. Also "SCORE"/"LVL" in `HighScoreTable.tsx` and "PTS - LVL" in `InitialEntryModal.tsx`. Add translation keys for all.

- [x] **Localize achievement titles and descriptions**
      All 15 achievement titles ("First Steps", "Triple Digits", etc.) and descriptions in `achievements.ts` are hardcoded English strings, bypassing the i18n system. Move to translation keys so ES/PT users see localized achievements.

- [x] **Add notification permission pre-prompt screen**
      Same pattern as the ATT tracking screen — a branded pre-prompt that explains the value before the system dialog fires. Currently `useNotifications` calls `requestPermissionsAsync()` directly after 3 games. Replace with an intermediate screen/modal that explains: "We can remind you to keep your streak alive and never miss your daily challenge." Two buttons: "Enable Reminders" (fires the system prompt) and "Not Now" (skips, marks as asked). Localize for en/es/pt. This increases opt-in rates by setting expectations before the system dialog appears.

- [x] **Localize iOS permission purpose strings (ATT + microphone)**
      Two native iOS permission dialogs currently show English-only purpose strings regardless of device language: `NSUserTrackingUsageDescription` (set via `expo-tracking-transparency` in `app.config.ts`) and the `iosMicrophonePermission` passed to `react-native-audio-api`. Not required for App Store approval, but a quality gap since the rest of the app is localized in ES and PT. Apple localizes permission strings via per-locale `InfoPlist.strings` files (e.g., `ios/EcoMi/es.lproj/InfoPlist.strings`), which aren't generated by Expo out of the box. Implementation options:
  - Write a small custom config plugin that, during prebuild, creates `es.lproj/` and `pt.lproj/` directories under the iOS project and writes `InfoPlist.strings` with `NSUserTrackingUsageDescription` and `NSMicrophoneUsageDescription` for each locale
  - Or evaluate community plugins (e.g., `expo-localized-permissions`) if one covers both strings cleanly
  - Verify on a physical device set to Spanish/Portuguese that both prompts show translated copy
  - Batch with any other native strings that need localization so the plugin is written once

---

## Game Design

- [x] **Add input timeout to "waiting" state**
      `getInputTimeout()` is defined in `difficulty.ts` but never called. Players can idle forever mid-sequence with no timer or penalty. This eliminates the memory challenge (could write down the sequence). Add a generous but firm timeout that triggers game-over, with a visual countdown indicator in the last few seconds.

- [x] **Extend difficulty curve beyond level 16**
      Tone duration and sequence interval both hit their floor (~300ms) at level 16-17. Game stops escalating and becomes monotonous. Consider secondary challenge escalation: reducing input timeout, adding visual distractions, shortening the replay window, or introducing partial sequence hints that fade at higher levels.

- [x] **Reconsider interstitial ad placement**
      Resolved by the full-screen game-over redesign below — ad fires on Play Again but the full-screen context makes the transition to a full-screen ad feel natural rather than jarring.

- [~] **Full-screen game-over experience (Duolingo-style)** — core shipped in feat/game-over-ux, remaining items below
  Replaced `GameOverOverlay` modal with full-screen `/game-over` Expo Router route. All major screens (game-over, leaderboard, settings, stats, achievements) are now consistent dedicated routes. Only the mode selector remains as an overlay.

  **Shipped:**
  - [x] Create `/game-over` route as full-screen component (replaces GameOverOverlay modal)
  - [x] Pass game state via Zustand `gameOverStore` (replaced string route params)
  - [x] 3 stat pills — Score, Level, Best
  - [x] Platform-specific share button (iOS share-outline, Android share-social-outline)
  - [x] "Play Again" full-width primary CTA (accentColor)
  - [x] "Watch Ad to Continue" conditional secondary button (outlined)
  - [x] New high score variant — warningColor title + Lottie trophy + PB delta text under title
  - [x] Theme-aware via GameThemeProvider (lifted to game-over screen)
  - [x] Entry animation: staggered fade/translate (title → stats → links → CTAs)
  - [x] Preserve existing game-over/high-score jingles and haptics
  - [x] Remove GameOverOverlay component (deleted)
  - [x] Update Maestro E2E flows for new game-over screen (game-over.yaml + game-over-home.yaml + new game-over-zero-score.yaml)
  - [x] ReviewPrompt, PostPBPrompt, AchievementToast moved onto game-over screen
  - [x] Race condition fix — InitialEntryModal renders before navigation when score qualifies
  - [x] Skip game-over entirely on score 0 (bounce to idle)

  **Still TODO:**
  - [x] Track session play time in useGameEngine (start on startGame, stop on gameover, expose as `sessionTime`)
  - [x] Add Time stat pill alongside Score/Level/Best (4-pill 2x2 grid mirrors game-pad color layout)
  - [x] Browse LottieFiles for a premium game-over animation — upgraded trophy.json, sized to 160x160
  - [x] Colored accent borders on stat pills (Duolingo-style) — borders mirror game-pad red/blue/green/yellow
  - [x] Inline initials entry on game-over screen (replace InitialEntryModal) — shipped with persist + 5-slot reduction

- [x] **Add time penalty for wrong input in timed mode**
      Wrong input replays the current sequence with no score or time penalty — effectively a free hint. Add a small time penalty (e.g., -3 seconds) so wrong inputs feel like a genuine setback rather than a free replay.

- [x] **Fill achievement pacing gap between levels 10-15**
      Level achievements jump 5→10→15→20 with no intermediate milestones. The 5-level gap during the hardest progression creates a feedback drought. Add a level 12 or 13 achievement to maintain motivation.

---

## Navigation & Features

- [x] **Wire up achievements and stats screen navigation**
      Routes exist at `/achievements` and `/stats` but zero navigation points to them from anywhere in the app. Add entry points from the idle game screen header (trophy icon already exists for leaderboard — add stats/achievements icons) and from the game-over overlay ("View Stats" link). These are entire features that users cannot currently access.

- [x] **Invoke achievement unlock logic during gameplay**
      `checkAchievements()` exists in `useAchievements.ts` but is never called. Import and call it from `GameScreen.tsx` on relevant game events (game over, round complete). Without this, achievements never unlock even if navigation is added.

- [x] **Add achievements/stats links to Game Over overlay**
      The game-over moment is the highest-engagement point for showing progress. Add a "View Stats" or "Achievements" link to the overlay so players who just beat their high score can see their overall progress.

- [x] **Migrate leaderboard from modal to dedicated screen**
      Shipped `/leaderboard` route. Mode tabs redesigned to match idle-action button sizing with green-accent selected state. Empty state uses trophy-outline icon + title. Gesture swipe removed (bigger tap targets make it unnecessary). i18n `game:leaderboard` key added to fix lowercase title fallback.

- [x] **Migrate settings from modal to dedicated screen**
      Shipped `/settings` route. Added haptics toggle, per-notification-type toggles (daily/streak/win-back), all persisted to MMKV. Sound state now persisted via new `SETTINGS_SOUND_ENABLED` key with `syncSoundState` on focus. Restore Purchases uses outlined hollow style consistent with Continue button. useNotifications respects per-type keys.

---

## Monetization & Ads

- [ ] **Banner ad on `/leaderboard` (first non-intrusive banner placement)**
      All three review agents converged on `/leaderboard` as the highest-value, lowest-risk banner placement. Dwell time is high (users scan scores), the screen is read-only so the banner doesn't compete with primary CTAs, and the bottom-pinned `BannerAdSize.ANCHORED_ADAPTIVE_BANNER` stays out of the way. Gate with `!removeAds` — IAP users never see it. Do NOT add banners to the idle/home screen (hurts first-impression and the Play button's dominance), GameScreen (accidental-tap policy risk near the pads), game-over (interstitial already fires there), or settings (cognitively dissonant with the Remove Ads CTA sitting inches away). `/stats` and `/achievements` are secondary candidates with similar characteristics if the leaderboard banner performs. Env slots `EXPO_PUBLIC_ADMOB_BANNER_{IOS,ANDROID}` are already defined in `.env.example` but unused. Ref: VISION.md §178–194.

- [ ] **"Tired of ads?" conversion prompt after Nth interstitial**
      VISION.md §194 specifies this and it remains unimplemented. Track `interstitials_shown` in MMKV; after count === 3, fire a one-time modal with direct `purchaseRemoveAds()` call, persist a `tired_of_ads_shown` flag so it never re-fires. Highest-ROI conversion lever in the codebase today — the user has just seen three interstitials, so the pitch is behaviorally timed, not speculative. Pair with the existing `PostPBPrompt` component for visual consistency (same modal frame, different copy + icon).

- [ ] **Rewarded-continue → IAP handoff after multiple watches in a session**
      When a player has watched 2+ rewarded-continue ads in a single session, surface a themed "Skip the wait — Remove Ads" CTA on the next game-over alongside the usual continue offer. Behavioral trigger ("I keep needing this") converts materially better than the passive `showRemoveAds` link that renders today. Track `rewardedAdsThisSession` in the ads hook; on the second+ game-over of the session, swap the `showRemoveAds` link text for a stronger CTA with a direct purchase call.

---

## Tech Debt

- [ ] **Migrate from expo-eas-observe to expo-observe**
      `expo-eas-observe` was the early-access package name. The public release is `expo-observe`. Swap the dependency, update imports in `_layout.tsx` (`AppMetrics.markFirstRender`, `AppMetrics.markInteractive`), and verify TTI / frame-drop tracking still reports in the Expo dashboard.

- [ ] **Lift `useAds` state into shared store (singleton + Zustand)**
      Currently `useAds` is called once in GameScreen, so `/game-over` can't directly invoke `showRewarded()` — it has to signal GameScreen via the pending-action store, which then shows the ad. If the ad fails, user bounces back to `/game-over` (handled gracefully now, but still awkward). Fix: split `useAds` — keep AdMob refs + event listeners in a module-level singleton (`src/services/adsService.ts`), expose reactive state (`rewardedReady`, `adShownThisSession`, `consentReady`) via a Zustand store. Any screen can then read store state and call `adsService.showRewarded()` directly. Non-blocking since the current fallback works; pick up when we touch ads for another reason.

- [ ] **Animated floating timer delta for timed mode**
      Currently the timed-mode +Ns / -Ns feedback renders as static text under the sequence dots ("Great job! +2s" / "Oops, try again! -1s"). Nice clear messaging but lacks the celebratory feel of a floating score popup (like arcade games / Duolingo XP). Redesign: emit a time-delta event (or use Zustand store) rendered at the screen root level, animate it on a randomized arc/path across the board area — start large at the game board center, scale down, drift up-and-outward with a slight random horizontal offset, fade out over ~1.2s. Keep the status-bar version as a fallback/secondary indicator, or replace entirely if the float is clear enough on its own. Blocked before: the EaseView animated transform was conflicting with style-level centering transforms, and the wrapper element was clipping. Solving that requires rendering outside the gameContainer hierarchy.

- [x] **Inline initials entry on /game-over screen (replace modal)**
      Replaced InitialEntryModal with inline 3-letter input on the game-over screen. First qualifying game shows "What should we call you?" between title and stat pills. Save persists initials to MMKV; future games auto-record silently. Skip persists a flag so we don't re-prompt. Leaderboard reduced from 10 → 5 slots. InitialEntryModal.tsx deleted (277 lines).

- [ ] **Shared Button component with variants + fullWidth preset**
      We have ~8 bespoke button styles across screens (Play Again, Continue, Share, Remove Ads, Restore Purchases, Sound toggle, Enable Reminders, etc.) each with near-identical padding/radius/flex rules. Every time a button is full width, centering icon+text in a flex row has to be remembered manually — missed it on Remove Ads and Sound toggle until a visual review. Create `<Button variant="primary|secondary|outlined|ghost" fullWidth size="sm|md|lg">` with centering baked into `fullWidth`, consistent padding/radius tokens, and theme-aware colors. Migrate existing buttons incrementally. Prevents future inconsistency drift and kills ~100 lines of duplicated StyleSheet rules.

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

- [ ] **Fix Android edge-to-edge deprecated APIs (Play Console vitals)**
      Android vitals flagged on 1.0.1: "Your app uses deprecated APIs or parameters for edge-to-edge." Android 15 (API 35) enforces edge-to-edge by default and deprecates `window.setStatusBarColor`, `setNavigationBarColor`, and `setNavigationBarDividerColor`. Audit app for any direct usage (unlikely in our RN code, but check native deps / plugins). Confirm `edgeToEdgeEnabled: true` is set in `app.config.ts` (already the SDK 55 default via `expo-build-properties`) and that we draw content behind system bars correctly using `react-native-safe-area-context`. Expand the Play Console action to see the exact deprecated API and affected lib. Likely just needs a dep bump or a config-plugin tweak.
      - Ref: Play Console → Android vitals → actions recommended
      - Surface: User experience / Release 1.0.1

- [ ] **Remove Android resizability / orientation restrictions for large screens (Play Console vitals)**
      Android vitals flagged on 1.0.1: "Remove resizability and orientation restrictions in your game to support large screen devices." Play Store ranks apps lower on tablets/foldables/ChromeOS when they lock orientation or declare non-resizable. We currently set `orientation: "portrait"` in `app.config.ts`. Options: (1) allow `orientation: "default"` on Android tablets only via config plugin, or (2) add `android:resizeableActivity="true"` + `android:supportsPictureInPicture="false"` and declare tablet support while keeping phone portrait-lock. Simon-style gameplay works fine in landscape — main work is making the board layout responsive. Lower priority than the edge-to-edge fix, but both affect the same 1.0.1 vitals surface.
      - Ref: Play Console → Android vitals → actions recommended
      - Surface: User experience / Release 1.0.1

- [ ] **Collapse game-engine side effects into a single state-watching effect (architectural)**
      `useGameEngine.ts` mixes side effects (audio playback, haptics, persistence, analytics) with machine wiring through a combination of JS `setTimeout` callbacks, `useEffect` watchers, and imperative calls inside action handlers. Every one of those code paths can observe stale closure state — which explains why the last ~5 bugfix commits have all been race/closure-class fixes (rewarded-continue race, reset/silence race, audio BT suspend/resume, input timeout cleanup). The cleanest long-term fix: make `useGameEngine` a thin adapter over XState and route *all* side effects through one `useEffect` that pattern-matches on `(prev, next)` of `state.value`. Collapses the stale-closure surface from 10+ sites to 1, makes every trigger auditable, and stops the pattern of "fix one race, find another next week." Non-trivial refactor — pair with a reverse-mode integration test first so we don't regress the current behavior.

- [ ] **Stale closures in `GameScreen.tsx` long-lived effects**
      Two effects on `GameScreen.tsx` close over mutable identities with bare dep arrays: the pending-action handler (~line 126-134) captures `resetGame` / `handleContinue` at mount, and the `gameState` transition effect (~line 235-290) captures `analytics`, `haptics`, `checkIsHighScore`, `addHighScore`, `getRank`, `rescheduleAfterGameOver`, `playHighScoreJingle`, `playGameOverJingle`, `navigateToGameOver`, and `router` at mount. If any of those change identity (most are stable today, but `analytics` in particular can re-init after PostHog hydrates), the stale version is what actually runs. Adopt a consistent pattern: either `useRef`-wrap all values referenced from fire-once effects (matching the existing `resetGameRef` pattern), or read from Zustand `getState()` at call-time instead of closing over reactive values.

- [ ] **`useGameOverStore()` whole-store subscription**
      `src/app/game-over.tsx:121` calls `useGameOverStore()` with no selector, so the component subscribes to every field and re-renders on *any* store write — even from unrelated callers. Split into per-field selectors (`const score = useGameOverStore((s) => s.score)`) or use a combined selector with `shallow` equality.

- [ ] **Async `onPress` handlers without `void` wrapping**
      React Native's `onPress` expects `() => void`. Passing an `async` function returns a `Promise` that's silently dropped — any rejection propagates nowhere. Sites to fix: `handleStartGame` in `GameScreen.tsx:668,752`; `handleShare` in `game-over.tsx:525`; the IAP handlers in `settings.tsx:284,370`. Pattern: `onPress={() => { void handleStartGame() }}`.

- [ ] **`_layout.tsx`: `secondaryStackScreenOptions as any` casts**
      Four `Stack.Screen` options props use `as any` to paper over a type mismatch between the Expo Router `NativeStackNavigationOptions` shape and the local helper's return type. Type `secondaryStackScreenOptions` with `NativeStackNavigationOptions` from `@react-navigation/native-stack` so the casts can be removed.

- [ ] **Reverse-mode integration test (index math untested)**
      `useGameEngine.ts:562` does the reverse-mode correctness check via `sequence.length - 1 - (newPlayerLen - 1)`. No existing test exercises this path end-to-end, so a single off-by-one error would silently break the entire mode. Add an integration test in `__tests__/useGameEngine.test.ts` that plays two full reverse-mode rounds and asserts the expected color at each tap.

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

- [x] **Migrate modals to Expo Router modal routes**
  Shipped as standard routes: `/settings`, `/leaderboard`, `/game-over`. Mode selector migrated to `/mode-select` route with platform-specific `CompactModePickerSheet` (iOS ActionSheet, Android dialog-style, web fallback). `pendingModeStore` Zustand store carries selection back to GameScreen.

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

- [x] **Adopt XState for `useGameEngine` state machine**
      `src/hooks/__tests__/useGameEngine.bugs.test.ts` already documents 3 bugs caused by invalid state combinations (stale `isNewHighScore` after continue, input timeout only gated in timed mode, button presses during `showing` trigger haptics but no effect). XState scoped to the game engine would enforce transitions and eliminate this class of bug. Keep hooks for ads/stats/theme — don't globalize. States: `idle → showing → waiting → {gameOver, continuing}`. Entry/exit handlers own timer cleanup and sound/haptic side effects. Est. 2-3 days.

- [x] **Consolidate storage keys into `src/config/storageKeys.ts`**
      MMKV keys are scattered across `useAds.ts`, `usePurchases.ts`, `useGameEngine.ts`, `useStats.ts`, and the tracking screen. Centralize all `"ecomi:*"` keys as exported constants so schema changes are atomic and tests reference the same source of truth.

- [x] **Extract shared `ModalOverlay` component**
      `ReviewPrompt.tsx`, `GameOverOverlay.tsx`, and the Settings/Mode/Leaderboard modals in `GameScreen.tsx` repeat the backdrop + card + dismiss-on-outer pattern. Consolidate into `<ModalOverlay onDismiss>` with consistent entrance animation (scale 0.95→1 + fade), matching the springy feel already in `GameOverOverlay`. Applies the Phase C "modal animation consistency" fix as a side effect.

- [x] **Drop redundant manual memoization in `theme/context.tsx`**
      React Compiler is enabled via SDK 55, but `src/theme/context.tsx` still has 4 `useCallback`/`useMemo` instances (lines ~69, 81, 86, 95, 108). Safe to delete. Quick win that reinforces the "no manual memo" project rule.

#### Phase C — Retention & Polish

These are where v1.1 earns its keep. Ship on top of Phase B foundation.

- [x] **First-launch trainer sequence (minimal onboarding)**
      Shipped: OnboardingTooltip component renders during first `waiting` state with `t("onboarding:tapHint")`, gated by `ONBOARDING_COMPLETED` MMKV key. Auto-dismisses after first input (correct or wrong — fixes timed-mode loop). Wrapped in fixed-height slot to prevent layout shift.

- [x] **Wrong-input juice: red flash overlay + warning haptic**
      Shipped: 300ms red EaseView opacity flash in GameScreen + error haptic on wrong input across all modes.

- [x] **Game-over emotional arc: stagger + PB delta + near-miss**
      Shipped on `/game-over` route — staggered fade/translate (title → stats → links → CTAs), PB delta under title on new PB, near-miss text below stats when within 5 points of high score, title uses warningColor for PB / destructiveColor for game over.

- [x] **Visual score card sharing via `react-native-view-shot`**
      Shipped: `<ShareScoreCard>` component captured via ViewShot, shared via `expo-sharing.shareAsync` (works on both iOS and Android — original `Share.share({ url })` was iOS-only).

- [x] **Local notifications via `expo-notifications`**
      Shipped: 3 schedules (daily reminder 19:00, streak-save 10:00 next day, win-back 3 days out). Pre-prompt screen at `/notifications` explains value before OS dialog. Per-type opt-in toggles in settings screen. Reschedules on every game-over.

- [x] **Streak loss-aversion idle banner**
      Shipped: `<StreakBanner>` renders on idle when `streak > 0 && !playedToday`, uses `game:streakAtRisk` translation with warning-color background.

- [x] **Empty states for stats and leaderboard**
      Shipped: stats.tsx uses game-controller-outline icon + "No games yet" title/body + "Play Now" CTA. Leaderboard uses trophy-outline icon + "No scores yet" title + `game:emptyLeaderboard` body.

- [x] **Play button visual dominance on idle screen**
      Shipped: full-width primary Start button with accent background, pulse animation loop (scale 1.0→1.02), secondary action icons (leaderboard/stats/achievements) in separate row below.

- [x] **Post-PB soft IAP prompt**
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

- [x] **Tablet-optimized layout (iPad / Android tablets)**
      `supportsTablet: true` enabled in `app.config.ts`. `layoutBreakpoints.ts` helper exposes `isCompact`/`isTablet` based on shortest screen side. `OrientationLockProvider` enforces portrait on phones, unlocks on tablets. `useGameBoardMetrics` hook computes board sizing from measured available space and freezes it during active play to prevent mid-round shifts. GameScreen refactored with distinct compact/tablet-portrait/tablet-landscape compositions. Secondary screens (achievements, stats, leaderboard, game-over, settings, AchievementToast, HighScoreTable) gained max-width centering and density tuning for tablet.
  - Remaining non-code: Test on iPad Mini, iPad Air, iPad Pro, and common Android tablet sizes; add iPad screenshots to App Store listing

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
      The 4-button Simon grid maps naturally to the Watch form factor and the Taptic Engine is uniquely suited to a haptic-first game. Halo/differentiator play, not a revenue driver — Watch users overlap heavily with iPhone users, Watch IAP conversion is lower, no AdMob on watchOS. **Approach:** Use [EvanBacon/expo-apple-targets](https://github.com/EvanBacon/expo-apple-targets) to add a watchOS target inside this Expo project (no separate repo, no ejecting). React Native still doesn't run on watchOS, so the Watch app is SwiftUI — but prebuild generates the target, EAS handles the build, and the code lives alongside the RN app. Share high scores, streaks, and theme selection with the iPhone app via App Groups (MMKV on RN side ↔ UserDefaults on Swift side). Scope: core classic mode only for v1, no modes/achievements/IAP on Watch. Rough effort: ~2 weeks of SwiftUI work for a solo dev new to it, most of which is learning SwiftUI + watchOS idioms, not plugin setup. **Key angle:** Eco Mi's haptics-first design is a genuine strength on Watch, not just a port — the Taptic Engine can deliver richer per-button haptics than iPhone, and escalating intensity at higher levels could make a watchOS version feel _better_ than the phone app. That's the press/launch story ("the Simon game built for Apple Watch") if we invest. Revisit when iPhone retention data justifies the investment, or sooner if a "first Simon on Watch" launch moment is strategically attractive.

- [ ] **Multiplayer — "Eco Mi Duel" (1v1 competitive modes)**
      Explore adding Tetris Attack–style competitive play where completing sequences "attacks" the opponent (time drain, sequence extensions, phantom pads, speed bursts, color swaps). Modes under consideration: **Time War** (shared timer, completions drain opponent's clock), **Breakthrough** (foreign sequences injected into opponent's flow with a reflect/counter mechanic), **Chaos Duel** (shared sequence with opponent-inflicted corruptions). Platform strategy: same-device split screen (iPad/tablet in landscape) as the zero-infrastructure starting point, then online 1v1 via Firebase Realtime DB / Supabase with ghost replays for async play. Foldable phones (Fold/Pixel Fold) as a natural divided-screen form factor. BLE / Multipeer Connectivity for offline local play (airplane mode scenarios). NFC not viable as a transport. Full design doc: `docs/MULTIPLAYER_VISION.md`. Revisit after v1.x retention signal justifies the investment.

- [ ] **Committed visual material system (expo-blur glass surfaces OR neumorphic elevation)**
      The app currently mixes translucent `rgba` surfaces, flat solid pads, outlined Ionicons, and dropped shadows — a grab-bag of "dark gaming" conventions that ceilings out at "polished indie." Premium products commit to a single material direction. Two paths worth prototyping before picking:
  - **Glass (via `expo-blur`):** wrap the score boxes, mode-sheet card, game container, and `ModalOverlay` surfaces with `<BlurView intensity={40} tint="dark">` (or `tint="light"` under pastel). Replace `rgba(0,0,0,0.3)` backgrounds with blur layers over a subtly animated gradient background driven by `activeTheme.accentColor`. Gives the app an Arc/Apple-Music/iOS-Settings feel where every surface breathes with the content behind it. Works especially well on dark themes; pastel needs careful tinting to avoid washout. Perf: `expo-blur` is a native view so it's cheap, but heavy use over animated content (e.g. the active pad glow) can still hit fill-rate on older Android. Test on Pixel 5 / iPhone SE 2 before broadly applying.
  - **Elevated neumorphism:** each card uses paired light + dark shadows (outer drop + inner highlight) to look carved out of the background, with theme-accent rim lights on the active element. More tactile, pairs well with the pad glow/shadow task. Denser visual vocabulary but risks feeling dated if overdone.

      Deliverables when scoped: a shared `<Surface variant="glass|elevated|flat">` primitive that every card / pill / modal consumes, plus audit + migration of existing hardcoded `rgba` surfaces. This is the single highest-leverage visual change if we want reviewers to say "this feels like a flagship app." Pairs naturally with the motion-token file (committed materials + committed motion = house style).

- [ ] **Scripted first-run onboarding demo sequence**
      Today `OnboardingTooltip` shows one static sentence when `gameState === "waiting"`. A premium first-run: on cold start with `ONBOARDING_COMPLETED !== "true"`, auto-play a 6-second demo sequence — highlight two pads in order ("watch the pattern") → invite the user to repeat → congratulate + haptic + accent flash → drop into level 1. No new engine capability needed (we already have `activeButton`, `sequence`, haptics, jingle) — pure choreography around the existing state machine. Single highest-leverage change for App Store conversion and first-session retention. Localize the captions for en/es/pt.

- [ ] **Unified `useMoment(name)` choreography layer**
      Today each component fires its own haptic / audio / animation inline for named events. Build a `useMoment()` hook that composes visual + haptic + audio + timing into a single named choreographed unit: `moment.play("level-up")` triggers a dot-fill on `GameStatusBar`, an `AnimatedNumber` bump, a chord on the accent color, and a `selection` haptic — all as one aligned beat. Stripe / Linear / Arc all have something like this. It's what makes interactions feel *composed* rather than *coincident*. Depends on the motion-token file existing first. Moments worth authoring: `level-up`, `new-pb`, `streak-extended`, `mode-switch`, `theme-swap`, `unlock`.

- [ ] **Whack-a-mole mini-mode using a sparkle traveler**
      Revisit the idle sparkle-traveler (deleted in the pad-palette-polish branch, recoverable from git) as a gameplay element rather than ambient decoration. A "Whack-a-Mole" mode: a glowing dot appears on a random pad, player taps it before it moves to the next pad. Speed escalates with score. Differentiates from the core sequence-memory loop by testing reaction time + hand-eye rather than memory. Could be a premium/unlock mode or a fun diversion. Implementation base is already authored — the `IdleSparkleTraveler` component used explicit sin/cos orbit math (commit `c80781d`) with per-quadrant color cycling, and the "random landing per cycle" variant we discussed earlier would fit naturally here. When scoped, consider: scoring curve, fail condition (miss = life lost? or timer?), how it integrates with the existing mode picker + gameOverStore, whether it shares haptics/audio with the core game or gets its own personality.

- [ ] **Share card: sequence visualization (every share is unique)**
      Follow-on to the pad-colored score + 2×2 logo work in Animation Polish. Once the share card carries the pad palette, the next level of polish is showing the *actual* sequence the player completed — a row of ~8 colored dots along the bottom of the card representing the last N pads they got right before game-over. Each share is literally different, which invites "can you memorize this?" from whoever sees it in a feed. Highest virality potential of any share-card treatment, but requires: (a) `useGameEngine` to expose the final `sequence` at game-over (already lives on `ctx.sequence`), (b) plumbing through `gameOverStore` into `ShareScoreCard` props, (c) a decision on last-N vs full sequence (full gets visually noisy past ~12 pads; last-N is easier to read but loses the "look how long they memorized" brag). Prototype both. Consider an in-app-only micro-animation where the sequence plays back at slow tempo when the user views the card pre-share — feels premium, but only exists for the player since the exported PNG is static.

- [ ] **Dynamic splash screen + app icon theming (user theme carries through full app lifecycle)**
      Let the user's selected pad theme (pastel, dark, neon, etc.) show through from app launch into gameplay — the first thing they see matches the aesthetic they chose. **Splash screen approach:** Use the "extended splash" pattern — native splash stays minimal/neutral (logo on dark bg), JS reads theme from MMKV on mount, renders a themed full-screen view matching the chosen theme, then hides the native splash and transitions into the app. Works cross-platform with unlimited theme variants, zero native complexity. True native splash can't be runtime-swapped (iOS has one storyboard per binary; Android's activity-alias trick is fragile). **App icon approach:** Use [`expo-dynamic-app-icon`](https://github.com/outsung/expo-dynamic-app-icon) — wraps `setAlternateIconName` (iOS) and activity-alias (Android). All icon variants must be declared at build time, user picks via settings. Icons tied to theme names so switching theme also offers an icon swap. **Bonus polish:** Transition animation from themed splash into game — four pads fly into position, subtle pulse in theme colors. **Open questions:** Should icon change be automatic with theme switch or opt-in? How many icon variants before we hit store review friction? Revisit when theme system is expanded beyond the current set.

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
- [ ] **Move app-ads.txt to frankcalise.dev + update store Marketing URLs**
      `app-ads.txt` currently lives in the eco-mi repo docs/ but AdMob needs it at the domain root of the developer website. Move to the `frankcalise.github.io` repo (served as `frankcalise.dev`) at `/app-ads.txt`. Then update:
  - [ ] Host `app-ads.txt` at `https://frankcalise.dev/app-ads.txt`
  - [ ] App Store Connect: set Marketing URL to `https://frankcalise.dev`
  - [ ] Play Console: set Developer website to `https://frankcalise.dev` (account-level, Settings → Developer page)
  - [ ] Verify AdMob app-ads.txt verification passes after DNS propagates
  - [ ] Remove `docs/app-ads.txt` from eco-mi repo (no longer needed here)
- [x] Design Google Play feature graphic (1024x500)
- [x] Write store listing copy (title, subtitle, description, keywords)
- [ ] **Record 15–30s App Store preview video**
      Auto-plays muted in search results — must be visually compelling without sound.
  - [ ] Seed screenshot data (dev menu → Seed Screenshot Data) for polished stats
  - [ ] Record on physical device (smoother animations than simulator)
  - [ ] **Hook (0-3s):** Idle screen with neon title cycling → press Start
  - [ ] **Gameplay (3-10s):** Level 5-6 sequence playback + player repeating correctly, progress dots filling, level advancing
  - [ ] **Payoff (10-15s):** Wrong input red flash → Game Over with 2x2 pills cascading in, OR New High Score → trophy Lottie
  - [ ] **Variety (15-20s, optional):** Flash mode selector (5 modes), Chaos shuffle, Timed countdown
  - [ ] **Close (20-25s):** Back to idle with Play button pulsing
  - [ ] Trim and edit in iMovie/CapCut — no bezels needed for video
  - [ ] Export specs: 886x1920 (iPhone 6.7") or 1080x1920 (Android), H.264, 30fps
  - [ ] Upload to App Store Connect + Play Console
- [x] Create privacy policy page and host at a public URL
- [x] Set up Google Form or email for user feedback channel (review pre-prompt "Not really" path)
- [x] **Build `download.html` smart-link page at `frankcalise.github.io/eco-mi/download.html`**
      A single shareable URL that routes users to the correct store listing based on their device. Useful for social posts, QR codes, email signatures, the game-over share sheet, and anywhere else we can't maintain two separate links. Behavior:
  - **iOS** (detect `iPad|iPhone|iPod` in UA, excluding iPadOS-masquerading-as-Mac): `window.location.replace(APP_STORE_URL)`
  - **Android** (detect `Android` in UA): `window.location.replace(PLAY_STORE_URL)`
  - **Desktop / other**: render a simple landing page with the app icon, tagline, and side-by-side "Download on the App Store" + "Get it on Google Play" badges linking to each listing
  - Add a `<noscript>` fallback that also shows both badges, since redirect relies on JS
  - Keep it as a single static HTML file under `docs/` (same folder as `privacy-policy.html`) so GitHub Pages serves it automatically
  - Use Apple's and Google's official store badge SVGs (check their marketing guidelines for sizing/color rules before using)
  - Once live, update the Google Form + any social bios to point at this URL instead of the raw store links
