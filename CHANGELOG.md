# Changelog

All notable changes to Eco Mi are documented here. Entries are appended automatically after each commit during development.

---

## [Unreleased]

### Feat (monetization)

- **Banner ad on `/leaderboard`** — first non-intrusive banner placement. New [`src/components/AnchoredBanner.tsx`](src/components/AnchoredBanner.tsx) renders `BannerAdSize.ANCHORED_ADAPTIVE_BANNER` with a reserved 60dp slot height (prevents layout shift / accidental-tap policy risk), `useSafeAreaInsets` bottom inset (sits above iOS home indicator), 16dp gap from the score table. Gated by `!removeAds`. Mounted in [`src/app/leaderboard.tsx`](src/app/leaderboard.tsx). Consumes the previously-unused `EXPO_PUBLIC_ADMOB_BANNER_{IOS,ANDROID}` env slots. Emits `ad_shown` PostHog event with `{ type: "banner", placement: "leaderboard" }`. AdMob's server-side 60s refresh default preserved (no client-side refresh).

- **"Tired of ads?" conversion modal after lifetime interstitial #3** — highest-ROI conversion lever per VISION.md §194. New [`src/hooks/useTiredOfAdsPrompt.ts`](src/hooks/useTiredOfAdsPrompt.ts) gates on `ADS_LIFETIME_INTERSTITIALS_SHOWN >= 3` AND `IAP_TIRED_OF_ADS_PROMPT_SHOWN !== "true"` AND `!removeAds`. Lifetime counter increments in `useAds.showInterstitial` after `.show()` succeeds. New [`src/components/TiredOfAdsPrompt.tsx`](src/components/TiredOfAdsPrompt.tsx) reuses `PostPBPrompt`'s `ModalOverlay` + `PressableScale` chrome; sparkles icon, accent-colored CTA. Copy: "Enjoying Eco Mi? Play ad-free." / "One-time purchase. No subscriptions." / "Remove Ads" (en/es/pt). Triggered from `/game-over` mount effect (mutually exclusive with PostPB — PB has priority on new-high-score games; tired-of-ads fires only on non-PB game-overs). One-shot for v1; persistent flag set on dismiss/convert (network failure does NOT mark shown so user can retry). Analytics: `tired_of_ads_prompt_{shown,dismissed,converted}`.

- **Rewarded-continue → IAP behavioral CTA swap on `/game-over`** — "I keep needing this" converts materially better than the passive Remove Ads link. New [`src/stores/sessionAdStore.ts`](src/stores/sessionAdStore.ts) (Zustand, session-scoped — resets on cold launch) tracks `rewardedWatchedThisSession` (incremented in `useAds` on `EARNED_REWARD`), `tiredOfAdsShownThisSession`, `swappedCtaGameOversThisSession`. `shouldSwapRemoveAdsCta` returns `true` when watched ≥ 2, tired-of-ads has not fired this session, and the swap has appeared on fewer than 4 game-overs (cap prevents prompt fatigue plateau). When active, the passive "Remove Ads" text link in `/game-over` becomes a filled `PressableScale` button using `theme.accentColor` + `primaryForegroundColor` with copy "Skip the ads" (en/es/pt) and direct `purchaseRemoveAds()` (bypasses the indirection through `/settings`). Analytics: `remove_ads_cta_swapped` (one-time per session), `remove_ads_cta_tap` `{ variant: "passive" | "swapped" }`.

### Chore (backlog cleanup)

- **Closed two stale ads backlog items.** "Ad serving dies on single ERROR" — verified retry already exists at `useAds.ts:156-165` (interstitial) and `:195-205` (rewarded), 30s `setTimeout` reload with cancel-on-LOADED and cancel-on-unmount via `interstitialRetryRef` / `rewardedRetryRef`. "consentReady is exported but nothing consumes it" — verified `consentReady` is not actually exported from `useAds.UseAdsReturn`; no code smell to fix.

### Fix (audio)

- **iOS pad rattle — restored v1.1.0 oscillator-pool design** — Per-`noteOn` `OscillatorNode` creation (introduced during the post-v1.1.0 anti-click spike) developed audible "rattle" on iOS after `react-native-audio-api` was bumped 0.11.7 → 0.12.0: cold-start transients on per-note oscillators combined with a sub-quantum scheduling lookahead (2 ms `PAD_IOS_SUSTAIN_LOOKAHEAD_S`) snapped the 0→peak attack ramp onto k-rate boundaries unevenly, and the freshly-added master biquad lowpass at 6.8 kHz sat in front of those transients amplifying the artifact. **iOS pads** now use a 4-voice always-running oscillator pool (`iosPadPoolRef`, one per `POOL_FREQS` entry) gated by per-frequency gain nodes held at 0 between presses — `noteOn` is `linearRampToValueAtTime(peak, now + ONE_SHOT_ATTACK_S)` on the gate, `noteOff` is `scheduleLinearPadRelease` on the gate, no node creation/teardown on the hot path. Wave-type changes set `osc.type` in place (phase-continuous). The **master biquad lowpass is now Android-only** (`master → destination` direct on iOS); on Android it still smooths buffer-loop boundary transitions for sine/square/triangle pads. Sequence/jingle/preview paths unchanged (already comfortable on the 50 ms `SEQUENCE_LOOKAHEAD_S`). Removed now-dead `PAD_IOS_SUSTAIN_LOOKAHEAD_S` and `PAD_ATTACK_LOOKAHEAD_IOS_S` constants; `getPadBufferAttackParams` simplified to Android-only since iOS short-circuits before reaching it. `src/hooks/useAudioTones.tsx`, `src/utils/audio/padBufferVoice.ts`, `docs/AUDIO-ARCHITECTURE.md`.

### Feat (a11y)

- **Accessibility sweep — perception, screen reader, contrast, dynamic type, i18n leak** — bundled WCAG-AA pass landing 11+ items on a single feature branch (`feat/a11y-sweep`). Phased commits so each layer is independently revertable: (Phase 0) shared infra — `useReducedMotion()` hook subscribing to `AccessibilityInfo.reduceMotionChanged`, `colorblindPatternsEnabled` preference (MMKV-backed via the existing zustand `preferencesStore`), `getPadLabel(t, color, position)` util, and a11y i18n keys (pad/position labels, picker hints, sequence + game-over announcement templates, `common:dismiss`) in en/es/pt. (Phase 1a — reduced motion, WCAG 2.3.3) gated the looping animations that fire unconditionally today: `GameHeader` neon title color cycle (interval) and the 1500ms scale-breathe; `BreathingStartButton` `Animated.loop` + EaseView scale; `GameButton` shuffle 550ms timing collapses to duration:0; `PressableScale` press-pop bypassed; `game-over.tsx` Lottie trophy renders frozen on `progress={1}` with `autoPlay` disabled. (Phase 1b — colorblind, WCAG 1.4.1) new `PadGlyph` SVG component renders position-keyed shapes (○ □ △ ◇) at ~32% pad size in WCAG-readable foreground (black/white per `getReadableForeground`); `GameButton` accepts `showPattern`; `GameScreen` reads `colorblindPatternsEnabled`; new "Accessibility" section in Settings between Haptics and Notifications with toggle + hint copy. (Phase 1c — timer ring) `TimerRing` thickness +1px at ≤10s and EaseView scale pulse (1↔1.06, 500ms easeInOut reverse loop) at ≤5s, gated on Reduce Motion. (Phase 2 — screen reader) `GameButton` accessibilityLabel now reads "{color} pad, {position}" via `getPadLabel`; accessibilityState marks pad disabled when not in `waiting`/`idle`; `GameStatusBar` container gains `accessibilityLiveRegion="polite"`; `GameScreen` fires `AccessibilityInfo.announceForAccessibility` once per `showing` transition with the localized full sequence and once per `gameover` with score+level; Settings sound-pack and theme picker rows get role="button", localized labels, hint distinguishing apply vs preview, and `accessibilityState={{ selected }}`; `ModalOverlay` card wrapped in a View carrying `accessibilityViewIsModal` (iOS) + `importantForAccessibility="yes"` (Android) so VoiceOver focus can't escape behind the scrim. (Phase 3 — contrast/dynamic type/i18n leak) verified onboarding tooltip already uses `theme.primaryForegroundColor` (resolved via `getReadableForeground()`) and retro/pastel `secondaryTextColor` already match the BACKLOG-suggested AA-passing values (`#b0a089`, `#6a6a8a`); `game-over.tsx` initials boxes converted from fixed `64×52` to `minHeight: 64, minWidth: 52, paddingHorizontal: 8, paddingVertical: 6` so the box grows with content, and the `<TextInput>` clamps `maxFontSizeMultiplier={1.4}` so 310% accessibility text doesn't blow past the 32pt design; `mode-select.tsx` scrim accessibilityLabel "Dismiss" → `t("common:dismiss")` (es: "Descartar", pt: "Dispensar"). 130 tests green throughout, zero new tsc errors, zero new lint violations on touched files. (Post-merge fixes from device testing) `PadGlyph` was rendered before the pressable in `GameButton` so the pad fill painted over all four glyphs on Android — only the topLeft glyph showed a faint partial; reordered so the glyph paints on top of the pressable, then re-centered the glyph in the pad bbox via `StyleSheet.absoluteFillObject` + alignItems/justifyContent center, and bumped the diamond's bbox by ~18% to compensate for inscribed-diamond visual mass reading smaller than circle/square/triangle at equal bbox size. `ShareScoreCard` is an offscreen capture target (positioned at `-9999, -9999`) but TalkBack still descended into it and read the four logo dots, score, level, and watermark as raw color/dimension fragments; marked the card View with `accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`. Each `StatPill` on `/game-over` exposed three separate fragments (label Text, Ionicons icon, value Text) which TalkBack read as detached pieces; grouped into one accessible element with `accessibilityLabel="{label}, {value}"` and hid the children. Lottie trophy wrapped in a View carrying the same hide-descendants treatment (LottieView typings don't accept a11y props directly). Hero score count-up rAF loop snapped to final value when Reduce Motion is on. `src/hooks/useReducedMotion.ts` (new), `src/utils/a11y.ts` (new), `src/components/PadGlyph.tsx` (new), `src/components/{GameButton,GameHeader,GameStatusBar,ModalOverlay,PressableScale,ShareScoreCard,TimerRing}.tsx`, `src/screens/GameScreen.tsx`, `src/app/{game-over,mode-select,settings}.tsx`, `src/stores/preferencesStore.ts`, `src/config/storageKeys.ts`, `src/i18n/{en,es,pt}.ts`.

### Docs

- **Audio architecture** — New [docs/AUDIO-ARCHITECTURE.md](docs/AUDIO-ARCHITECTURE.md) documents the `useAudioTones` graph (master gain → biquad lowpass → destination), buffer vs `OscillatorNode` pad paths on iOS/Android, Android warm/cold lookahead, preview/game peak alignment (`SUSTAIN_PAD_PEAK`), why production uses linear gain ramps instead of Hann `setValueCurve` on device, and multi-instance `useAudioTones` (game vs settings).

### Refactor

- **Audio pad utils split: `padBufferVoice.ts` → `padShared.ts` + `iosPadPool.ts` + `androidPadBuffer.ts`** — pure structural split, zero behavior change. After the iOS pool restoration, the single `padBufferVoice.ts` module mixed cross-platform constants, iOS-pool helpers (newly added inline in the hook), and Android-only buffer code; the hook itself carried 100+ lines of inline iOS pool code that obscured the orchestrator role. Now: (1) [`src/utils/audio/padShared.ts`](src/utils/audio/padShared.ts) holds cross-platform constants (`POOL_FREQS`, `ONE_SHOT_ATTACK_S`, `PAD_RELEASE_S`, `SUSTAIN_PAD_PEAK`, `DEFAULT_PAD_TARGET_GAIN`, `SEQUENCE_LOOKAHEAD_S`, `SEQUENCE_ATTACK_S`, `SEQ_RELEASE_S`) plus `scheduleLinearPadRelease` (used by both iOS pool noteOff and Android per-press teardown). (2) [`src/utils/audio/iosPadPool.ts`](src/utils/audio/iosPadPool.ts) exports `IosPadPool` / `IosPadPoolVoice` types and `buildIosPadPool` / `teardownIosPadPool` / `setIosPadPoolWave` / `silenceIosPadPool` / `iosPadPoolNoteOn` / `iosPadPoolNoteOff` — pure functions over an explicit pool argument, no React state. (3) [`src/utils/audio/androidPadBuffer.ts`](src/utils/audio/androidPadBuffer.ts) (renamed from `padBufferVoice.ts`) keeps only Android-specific code: `createLoopingPadBuffer`, `padBufferCacheKey`, `computeSeamlessSineLoopLength`, `getPadBufferAttackParams`, the warm/cold lookahead constants, the per-press teardown timing constants (`PAD_POST_RELEASE_DISCONNECT_MS`, `PAD_ORPHAN_SOURCE_STOP_MS`, `PAD_RETRIGGER_*`), and `MASTER_TONE_LP_HZ`. The hook ([`src/hooks/useAudioTones.tsx`](src/hooks/useAudioTones.tsx)) now reads as orchestration: each iOS branch in `noteOn` / `noteOff` / `silenceAll` / the wave-change `useEffect` is a one-liner calling into `iosPadPool` helpers, and lifecycle (`createFreshContext` / `recreateContext` / `cleanup`) calls `buildIosPadPool` / `teardownIosPadPool`. Sole external consumer (`useAudioTones.tsx`) updated; no other imports of the old `padBufferVoice` module existed in the codebase. Docs synced ([docs/AUDIO-ARCHITECTURE.md](docs/AUDIO-ARCHITECTURE.md) → key-files table now lists all four modules with roles).

- **`padBufferVoice` Hann cleanup** — Removed unused `scheduleHannPadAttack` / `scheduleHannPadRelease`, `PAD_ENVELOPE_CURVE_POINTS`, and attack-duration constants that only served Hann; `getPadBufferAttackParams` now returns `{ attackLookaheadS }` only (see [src/utils/audio/padBufferVoice.ts](src/utils/audio/padBufferVoice.ts)).

### Feat

- **Feel & micro-polish wave: motion tokens + start-button breathe + game-over hero landing + countdown tightening + title ghost + splash crossfade + play-again ack** — seven bundled polish items shipped as one parallel subagent wave against a shared foundation. (L254) New `src/theme/motion.ts` module introduces named motion presets — `snap` (spring 400/22, taps/pops), `smooth` (spring 220/20, standard transitions), `grand` (spring 120/14, hero moments), `exit` (timing 200ms easeIn, dismissals), `countdown` (timing 80ms easeOut, numeric ticks), and `breathe` (timing 1500ms easeInOut + `loop: "reverse"`, ambient idle loops — react-native-ease springs can't loop so timing owns this case). Six consumers landed on top: (L236) `src/screens/GameScreen.tsx` Start button's scale-only idle breathe was flat because shadow didn't participate; paired the existing `scale: 1 → 1.02` with an Animated-layer-driven `shadowRadius: 8 → 16` + `shadowOpacity: 0.3 → 0.5` on iOS and `elevation: 6 → 10` on Android, both synced at 1500ms via `motion.breathe`. Lifted duplicate inline 1200ms breathe configs (phone + tablet layouts) into a shared `BreathingStartButton` local helper so both render sites stay locked. (L239) `src/app/game-over.tsx` hero landing re-choreographed — stat-pill stagger compressed from 250/350/450/550ms (100ms) to 0/60/120/180ms (60ms); CTA block dropped from `delay: 700ms` timing fade to `delay: 350ms` `motion.grand` spring with `translateY: 16 → 0` + `scale: 0.98 → 1`; score value now animates 0 → final over 450ms via `useEffect` + rAF ease-out-quadratic interpolation (rAF over EaseView because pill value is a `<Text>` child and ease only animates transform/opacity); title swapped from `timing: 300ms` fade to `motion.grand` spring so "GAME OVER" / "NEW HIGH SCORE!" lands with weight. (L266) Play Again button gets a pre-nav `scale: 1 → 1.05 → 1` ack over ~200ms via `motion.snap` before `setPendingAction` + `router.back()` fire, so the commit lands rather than the screen disappearing instantly. (L269) `src/components/GameHeader.tsx` title renders as 2-layer stack — primary with `textShadowRadius: 8` (was 12, muddy on iOS) plus a ghost layer at `opacity: 0.4`, `textShadowOffset: {1, 1}`, `textShadowRadius: 0` that sharpens the glyph edge. Ghost suppressed on Pastel (light theme — `theme.statusBarStyle === "dark"`) via `titleGhostHidden` style since a 1px offset reads too loud on light bg; ghost stays rendered (not conditionally skipped) so it continues to size the absolute-positioned neon cross-fade siblings. (L251) `src/components/AnimatedCountdown.tsx` tightened — 150ms cross-fade stutter replaced with `motion.countdown` (80ms easeOut) for large deltas; added smart-swap heuristic for `|delta| ≤ 1` (normal per-second tick) that skips the fade entirely and does a quick `scale: 1 → 1.1 → 1` bump instead; hardcoded `#ef4444` / `#fbbf24` urgency colors replaced with `activeTheme.destructiveColor` / `activeTheme.warningColor` (hex-sentinel rewrite — caller still passes hex since urgency threshold lives in `GameScreen.tsx`, noted as future cleanup). (L248) `src/app/_layout.tsx` wraps the JS root in an EaseView with `initialAnimate: { opacity: 0 }` + `animate: { opacity: 1 }` over 240ms easeOut (deliberately not `motion.exit` — that preset is 200ms easeIn, wrong feel for a first-frame fade-in), so the native splash→JS handoff is a crossfade rather than a blink. Shipped via 5 parallel worktree agents with disjoint file footprints; 127/127 tests green throughout, 3-error tsc baseline unchanged after each merge. `src/theme/motion.ts` (new), `src/screens/GameScreen.tsx`, `src/app/game-over.tsx`, `src/components/GameHeader.tsx`, `src/components/AnimatedCountdown.tsx`, `src/app/_layout.tsx`.

- **Settings picker polish: sound-pack preview affordance + HIG-compliant touch targets** — two bundled UX polish items on the Settings pickers (`src/app/settings.tsx`). (1) **Sound-pack preview affordance**: pills now carry an explicit volume-icon cue so users know they'll speak on tap — owned-non-selected pills show `volume-medium` static; selected + unowned-being-previewed pills show `volume-high` with a gentle 700ms `loop: "reverse"` opacity 1↔0.55 pulse that reads as "this is the voice"; unowned-non-preview pills keep `lock-closed`. Paired with a one-shot "Tap a pack to preview" inline hint below the row on first Settings visit, dismissed persistently (new `SETTINGS_SOUND_PREVIEW_HINT_SEEN` MMKV key + new `soundPreviewHint` i18n in en/es/pt). New `SoundPackIcon` subcomponent encapsulates the state → icon mapping so the pill body stays flat. (2) **Pill touch target**: bumped `selectorButton` `paddingVertical` 6 → 8 and `paddingHorizontal` 10 → 12, and widened hitSlop from `{top:6,bottom:6,left:4,right:4}` to `{top:10,bottom:10,left:8,right:8}` — effective target is now ≥48×60pt, clearing iOS HIG 44pt. `src/app/settings.tsx`, `src/i18n/{en,es,pt}.ts`, `src/config/storageKeys.ts`.

- **Theme picker: active theme name + 2×2 pad-preview swatches + selected check badge** — Settings `THEME` row was a band of 4 red-pad circles with a 2px green border on the active one; selection was easy to miss (on Classic the green border visually blends with the pad-red, and owned-but-inactive themes had no label of any kind). (1) Section header now reads `THEME — CLASSIC` etc., with the active (or currently-previewed) theme name rendered in `activeTheme.textColor` next to the secondary-text section label — same identity cue the Sound Pack row above gets by showing each pack's name in its pill. New `themes` i18n namespace (`themes.classic/neon/retro/pastel`) in en/es/pt; resolved via `t(\`themes:${activeTheme.id}\`)` so names localize (Clásico / Néon / Retrô / Pastel). (2) Each swatch moved from a 40×40 single-color circle to a 48×48 rounded-square showing all four pad colors as a 2×2 grid — every swatch now communicates its full palette at a glance instead of inheriting one pad's identity. Selected state lifts border to 2.5px in `activeTheme.accentColor` and adds a small check badge at bottom-right (accent bg, readable foreground via `getReadableForeground`, border in background color so it reads cleanly over the pad grid). Preview state keeps the 2.5px warning-color border. Locked themes get a single dark-scrim overlay with a white lock icon (`UI_COLORS.backdropSoft`) replacing the per-pad contrast-matched icon — readable against every palette without needing per-pad logic. `src/app/settings.tsx`, `src/i18n/{en,es,pt}.ts`.

- **Pad-palette polish: active-pad glow, 2-beat wrong-flash, share-card logo mark, main-menu free-play tapping** — bundled visual-identity pass across the pads, the share card, and the main menu. (1) Active pad now emits a soft colored halo on both platforms: iOS uses the pad's native `shadowColor` + `shadowRadius` (22, offset 0,0) so the glow is shape-matched to the quadrant; Android picks up a parallel effect via a new `PadGlow` component rendering a `react-native-svg` `RadialGradient` behind the pad (stops tuned to land peak brightness at the pad edge and fade to zero just outside, so no sharp corners spill into the cross-gap between pads). Platform-gated so iOS doesn't double-layer native shadow + SVG. Existing EaseView wrapper drives opacity fade-in so the glow pops with the same timing as the pad body. (2) `wrongFlash` upgraded from a single fade to opacity 0.25 over 100ms to a 4-phase keyframe (0 → 0.45 → 0.1 → 0.45 → 0) over 280ms — mistakes now "sting" instead of politely blinking. (3) `ShareScoreCard` gained a small 2×2 pad-dot mark next to the "ECO MI" wordmark so the card is recognizable as Eco Mi at feed-thumbnail scale even when the text letterforms aren't legible; a per-digit pad-color score split was prototyped and reverted because it diluted the hero-score dominance. (4) Main menu pads are now interactive while in `idle` state: new `previewPadTouch` / `previewPadRelease` methods on `useGameEngine` play the pad tone + flash the pad + fire a haptic without touching any machine state, score, or sequence. Replaces an earlier ambient sparkle-traveler orbit that read as too busy on device. `src/components/{GameButton,PadGlow,ShareScoreCard}.tsx`, `src/hooks/useGameEngine.ts`, `src/screens/GameScreen.tsx`.

### Fix

- **Non-Classic theme chrome audit: Pastel/Neon/Retro now use semantic surfaces, readable accent CTAs, safer title colors, and clearer secondary actions** — completed the planned non-Classic theme pass across gameplay chrome and the main secondary surfaces. `src/config/themes.ts` gained semantic tokens for panel surfaces/borders, primary CTA foregrounds, per-pad glow colors, and title-cycle colors; `src/utils/color.ts` now picks black/white foregrounds by actual WCAG contrast instead of a luminance shortcut. `GameScreen` moved the board shell, score boxes, start CTA, pad glow treatment, streak banner surroundings, and idle secondary-page buttons onto the new tokens, including themed tint cards for leaderboard/stats/achievements and a Retro-specific stats-button contrast lift. `GameHeader` now uses title-safe cycle colors plus base/ghost layers so Retro blue and soft Pastel colors stay legible without a heavy outline. The same chrome cleanup reached `/game-over`, `ReviewPrompt`, `PostPBPrompt`, `OnboardingTooltip`, `/stats`, `/tracking`, `/notifications`, and Settings picker states so Pastel no longer inherits dark-only outlines, Neon no longer ships white-on-bright-green CTA text, and Retro/Pastel secondary surfaces maintain clearer separation. `src/{config/themes.ts,utils/color.ts,screens/GameScreen.tsx,components/{GameButton,GameHeader,OnboardingTooltip,PostPBPrompt,ReviewPrompt,StreakBanner}.tsx,app/{game-over,notifications,settings,stats,tracking}.tsx}`.

- **Engine: `startTimer` interval + `continueGame` timeout + `handleGameOverSideEffects` all read stale `ctx` via JS-closure snapshots** — three latent stale-closure bugs bundled into one pass. Introduced a `contextRef` that mirrors `state.context` (synced via `useEffect`) so deferred callbacks read live machine state at fire time instead of render-time snapshots. (1) `startTimer`'s `setInterval` tick invokes `handleGameOverSideEffects` which now reads `highScore` / `gameResultRecorded` / `mode` from the ref. (2) `continueGame`'s 500ms `addTimeout` now reads the sequence + level from the ref inside the callback, so a future machine mutation between send-CONTINUE and the replay can't silently replay the wrong data. (3) `handleGameOverSideEffects` gained a `sideEffectsFiredRef` once-per-transition guard (reset on `startGame`/`resetGame`/`continueGame`) so `saveHighScore` and `saveDailyResult` fire at most once per game — the existing `gameResultRecorded` guard covered the inner `recordGameResult` only. `src/hooks/useGameEngine.ts`.
- **Ads: ad serving dies for rest of session on single `ERROR` event** — `loadInterstitial` / `loadRewarded` flipped `loadedRef.current = false` on ERROR but never retried. A single network blip killed ad revenue for the rest of the session. Added a 30s debounced retry via a tracked `setTimeout` cleared alongside listener teardown on unmount / reload. `src/hooks/useAds.ts`.
- **Ads: `consentReady` exported from `useAds` but no caller consumed it** — the unused flag was noise that would silently mislead future consumers into thinking ad init was gated on consent (it isn't; NPA default covers the pre-consent window). Dropped from the `UseAdsReturn` type + the returned object + the internal `useState`. First test file for `useAds` added (`src/hooks/__tests__/useAds.test.ts`, 4 tests) covering interstitial retry, rewarded retry, retry-clear-on-unmount, and the absence of `consentReady`.
- **GameScreen: two long-lived `useEffect`s captured stale identities from hook returns** — the pending-action handler (~line 126) and the `gameState` transition effect (~line 235) both use bare `[]` deps by design (mount-once semantics) but closed over ~13 mutable identities between them: `analytics`, `haptics`, `router`, `checkIsHighScore`, `addHighScore`, `getRank`, `rescheduleAfterGameOver`, `playHighScoreJingle`, `playGameOverJingle`, `navigateToGameOver`, `incrementGamesPlayed`, `handleContinue`, `clearPendingAction`. Most are stable in practice but `analytics` in particular re-initializes after PostHog hydrates async. Ref-wrapped all captured identities (matching the existing `resetGameRef` pattern) so the effects preserve mount-once timing while reading live values at call time. `src/screens/GameScreen.tsx`.
- **`/game-over`: `inputRefs` array identity thrashed every render** — `const inputRefs = [inputRef0, inputRef1, inputRef2]` was reconstructed per render. Individual refs were stable so current consumers worked, but the React Compiler couldn't stabilize the array, and any future consumer taking `inputRefs` as a prop/dep would thrash. Wrapped in `useRef([...]).current` at mount. `src/app/game-over.tsx`.
- **`/game-over`: `useGameOverStore()` whole-store subscription** — the destructure `const { score, level, ... } = useGameOverStore()` used no selector, so the screen re-rendered on any store write (even from unrelated code paths that might mutate the store). Split into 10 per-field selectors returning primitives. Also dropped the `leaderboardRank: _leaderboardRank` dead destructure left over from an earlier refactor. `src/app/game-over.tsx`.
- **Share sheet failures on `/game-over` were swallowed silently** — the share handler's `try/catch {}` ate all errors including genuine Android failures (no installed share target, FileProvider issues) so users saw nothing after tapping Share. Now shows a themed `Alert.alert` with localized "Sharing failed" copy (en/es/pt `share.errorTitle` + `share.errorBody`). User-cancellation (`Share.dismissedAction`) stays silent as intended. `src/app/game-over.tsx`, `src/i18n/{en,es,pt}.ts`. Needs device verification — can't be jest-covered.
- **`useAchievements` read MMKV twice on mount** — `useState(loadAchievements)` correctly used a lazy initializer, but a follow-up `useEffect(() => setAchievements(loadAchievements()), [])` re-read the same key and replaced state with an equivalent value, triggering a gratuitous extra render every time `/game-over` mounted. Deleted the redundant effect. The `it.failing` single-load test added as a red→green handoff flipped to a passing `it` as part of the fix. `src/hooks/useAchievements.ts`, `src/hooks/__tests__/useAchievements.test.ts`.
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
