# Accessibility Sweep — Phased Plan

## Context

The remaining `UX Polish & Accessibility` items in `docs/BACKLOG.md` are now almost entirely a11y. We're bundling them into a single feature branch with phased commits so each layer ships verifiable progress: perception-first (color/motion), then screen-reader semantics, then contrast/dynamic-type/i18n cleanup. The end goal is WCAG-AA-aligned coverage of the gameplay loop and supporting screens, plus VoiceOver/TalkBack usability for blind players who today can only hear pad tones with no positional/state context.

Two unchecked BACKLOG items are *already implemented* in code (onboarding tooltip uses `theme.primaryForegroundColor` via `getReadableForeground()`; retro/pastel `secondaryTextColor` already match the suggested values `#b0a089` / `#6a6a8a`). Plan treats them as verify-and-tick rather than re-implement.

User decisions captured up front:
- **Colorblind glyph style:** shapes (○ □ △ ◇), one per pad position
- **Screen-reader sequence strategy:** upfront full-sequence announcement during `showing`, then visual flashes proceed silently. Per-tap correct/wrong feedback skipped to keep scope tight (revisit if requested).

Branch: `feat/a11y-sweep` off `develop`. One commit per phase (split if any phase grows beyond a clean diff).

---

## Phase 0 — Foundation (shared infrastructure)

Single commit. Lays the groundwork that phases 1–3 consume.

**Files:**
- `src/hooks/useReducedMotion.ts` (new) — subscribe to `AccessibilityInfo.isReduceMotionEnabled()` + `reduceMotionChanged` event. Returns boolean. Mirrors RN's standard pattern; no existing AccessibilityInfo usage in repo.
- `src/stores/preferencesStore.ts` — add `colorblindPatternsEnabled: boolean` + `setColorblindPatternsEnabled` following the exact `setHapticsEnabled` pattern (`src/stores/preferencesStore.ts:53-56`). Persist via MMKV.
- `src/config/storageKeys.ts` — add `SETTINGS_COLORBLIND_PATTERNS_ENABLED = "ecomi:settings:colorblindPatternsEnabled"`.
- `src/i18n/{en,es,pt}.ts` — add namespace keys:
  - `a11y:padLabel` → `"{{color}} pad, {{position}}"` (interpolated)
  - `a11y:padPositionTopLeft` / `topRight` / `bottomLeft` / `bottomRight`
  - `a11y:applyTheme`, `a11y:previewLocked`
  - `a11y:applySoundPack`, `a11y:previewLockedSoundPack`
  - `a11y:watchSequence` → `"Watch sequence: {{pads}}"`
  - `a11y:repeatSequence` → `"Repeat sequence"`
  - `a11y:gameOver` → `"Game over. Score {{score}}, level {{level}}."`
  - `settings:accessibility` (section header), `settings:colorblindPatterns` + description
  - `common:dismiss`
- `src/utils/a11y.ts` (new) — `getPadLabel(t, color, position)` helper that composes localized pad label. Keeps GameButton lean and gives one canonical place to extend.

**Verification:** tsc clean, tests still pass (no behavioral change yet).

---

## Phase 1 — Perception (visual non-color cues)

Two sub-commits to keep diffs reviewable.

### 1a. Reduced motion gates + Lottie fallback

**Hook into `useReducedMotion()` and gate looping/large-transform animations:**
- `src/components/GameHeader.tsx:73-116` — neon title color cycle: skip `EaseView` opacity loop when reduced; render static color (first `titleCycleColors` entry).
- `src/screens/GameScreen.tsx:104-147` — Start button breathe (`Animated.loop` 1500ms): skip the loop when reduced; leave the button at static scale/opacity.
- `src/components/GameButton.tsx:107-110` — shuffle transform 550ms: when reduced, replace with `{ type: "timing", duration: 0 }` so pads snap to final positions.
- `src/components/PressableScale.tsx` — make the spring-pop a no-op under reduced motion (return plain `Pressable`-equivalent View). 77 call sites inherit automatically.
- `src/app/game-over.tsx:67-96` — staggered stat-pill spring: when reduced, skip the spring and render at final state.
- `src/components/AnimatedCountdown.tsx:47-58` — keep tick animation (it's <100ms, not a "loop or large transform" per WCAG 2.3.3 carve-out). Only flag if user disagrees during review.

### 1b. Lottie trophy reduced-motion fallback

- `src/app/game-over.tsx:388-393` — when reduced, swap `<LottieView autoPlay loop={false}>` for a still `<LottieView progress={1}>` (freeze on final frame; no new asset needed). Same component, single conditional prop.

### 1c. Colorblind glyph overlay + Settings toggle

- `src/components/GameButton.tsx` — new `showPattern: boolean` prop + `position: Position` prop (already computed internally; expose for testability). When `showPattern`, render an absolutely-positioned overlay `<View>` after `<PadGlow>` (line 116, *inside* the EaseView so it inherits scale) containing a shape SVG sized to ~38% of `buttonSize`, opacity ~0.24, color `getReadableForeground(displayColor)`. Shape mapping:
  - `topLeft` → circle (○)
  - `topRight` → square (□)
  - `bottomLeft` → triangle (△)
  - `bottomRight` → diamond (◇)
- `src/components/PadGlyph.tsx` (new) — small SVG component for the 4 shapes; uses `react-native-svg` (already in deps).
- `src/screens/GameScreen.tsx:657-682` — read `colorblindPatternsEnabled` from `usePreferencesStore` and pass `showPattern` into each `GameButton`.
- `src/app/settings.tsx` — new "Accessibility" section between Haptics (line 512) and Notifications (line 514). Single `switchRow` matching existing pattern, label `t("settings:colorblindPatterns")`, description below the switch.

### 1d. Timer ring non-color urgency cue

- `src/components/TimerRing.tsx:18-48` — at `progress <= 0.15` (≤5s tier), apply a subtle scale pulse (1.0 → 1.06 → 1.0, ~500ms) keyed to the `countdownTick` cadence already firing. Bump `strokeWidth` from 5 → 6 starting at `progress <= 0.33` so urgency is readable independent of color. Skip the pulse under reduced motion.

**Verification:** Toggle iOS "Reduce Motion" + colorblind setting in-app → confirm title cycle, breathe, shuffle, Lottie, glyphs, timer pulse all behave per spec. tsc + tests pass.

---

## Phase 2 — Screen reader semantics

Single commit (logical unit; touches ~6 files).

### 2a. Pad labels with position + state

- `src/components/GameButton.tsx:131-133` — replace `accessibilityLabel={color}` with `accessibilityLabel={getPadLabel(t, color, position)}` and add `accessibilityState={{ disabled }}`. Position is already computed at line 77.

### 2b. Live-region status + upfront sequence announcement

- `src/components/GameStatusBar.tsx` — wrap the status `<Text>` with `accessibilityLiveRegion="polite"` (Android) and `accessibilityRole="text"` + ensure it's `accessible`.
- `src/hooks/useGameEngine.ts:356-398` (`showSequence`) — at the start of the showing phase, build a localized `pads` string from the sequence (`"red, top left, green, top right, …"`) and call `AccessibilityInfo.announceForAccessibility(t("a11y:watchSequence", { pads }))`. Visual flashes proceed silently after.
- `src/hooks/useGameEngine.ts` game-over transition (~line 444) — `announceForAccessibility(t("a11y:gameOver", { score, level }))`.
- Skip per-tap correct/wrong announcements per user decision.

### 2c. Theme + sound-pack picker labels and state

- `src/app/settings.tsx:264-328` (sound packs): add `accessibilityRole="button"`, `accessibilityLabel={pack.name}`, `accessibilityHint={isOwned ? t("a11y:applySoundPack") : t("a11y:previewLockedSoundPack")}`, `accessibilityState={{ selected: isSelected, disabled: !isOwned && !canPreview }}`.
- `src/app/settings.tsx:377-471` (themes): same treatment using `t("themes:" + theme.id)` for the label (themes namespace already exists at `src/i18n/en.ts:209-214`).

### 2d. ModalOverlay focus trap

- `src/components/ModalOverlay.tsx` — on the card content View add `accessibilityViewIsModal` (iOS) and conditionally `importantForAccessibility="yes"` for the modal + parent container handling on Android. Affects all current call sites (`PostPBPrompt.tsx`, `ReviewPrompt.tsx`).

**Verification:** Enable VoiceOver (iOS sim) → swipe through gameplay screen, confirm pads read "red pad, top left", showing-phase announces full sequence once, modals trap focus to scrim. tsc + tests pass.

---

## Phase 3 — Contrast, dynamic type, i18n leak

Single commit. Mostly small surgical fixes + the two verify-and-tick items.

### 3a. Verify already-fixed items, tick BACKLOG
- Onboarding tooltip (`src/components/OnboardingTooltip.tsx:24-25`) — already uses `theme.primaryForegroundColor`. Visually verify across all 4 themes and tick.
- Retro/pastel secondary text — already at suggested values (`src/config/themes.ts:95, 120`). Compute contrast (`#b0a089` on `#2c2c2c` ≈ 5.0:1 ✓; `#6a6a8a` on `#f5f0ff` ≈ 4.9:1 ✓). Tick BACKLOG.

### 3b. Initials boxes dynamic type

- `src/app/game-over.tsx:747-754` (`initialsBox`) — replace `width: 52, height: 64` with `minWidth: 52, minHeight: 64, paddingHorizontal: 8, paddingVertical: 6` so the box can grow vertically.
- `src/app/game-over.tsx:768-771` (`initialsText`) — add `maxFontSizeMultiplier={1.5}` on the `<Text>` so 310% accessibility text doesn't blow past the 32pt design while still allowing reasonable scaling.

### 3c. Mode-select i18n leak

- `src/app/mode-select.tsx:73` — replace `"Dismiss"` literal with `t("common:dismiss")` (key added in Phase 0).

**Verification:** iOS Settings → Larger Text → 310% → return to game-over initials entry, confirm character no longer clips. ES + PT locale verify on mode-select scrim. tsc + tests pass.

---

## Cross-cutting verification (run after each phase)

```bash
npx tsc --noEmit          # zero errors
bun run test              # 9+ tests must pass (no new tests required this branch)
bun run lint              # only on files touched
```

Manual:
- Phase 1: iOS Reduce Motion ON → loops/breathe/Lottie respect setting; colorblind toggle ON → glyphs render legibly across all 4 themes
- Phase 2: VoiceOver swipe-through gameplay + settings; sequence announcement audible at level 5+
- Phase 3: Larger Text 310% → initials box grows; ES/PT locale → "Dismiss" localized

## BACKLOG bookkeeping

After each phase commit, tick the matching items in `docs/BACKLOG.md` and append a one-line entry to `CHANGELOG.md` per project convention. Items covered (all under "UX Polish & Accessibility"):
- Colorblind mode (Phase 1c)
- Reduced motion hook + gates (Phase 1a, 1b)
- Screen-reader sequence announcements + live region (Phase 2b)
- Game pad accessibilityLabel includes position (Phase 2a)
- Theme / sound-pack picker labels + selected state (Phase 2c)
- Onboarding tooltip contrast (Phase 3a — verify-only)
- Retro + pastel secondary text marginal contrast (Phase 3a — verify-only)
- Timer ring non-color urgency cue (Phase 1d)
- Lottie trophy reduced-motion fallback (Phase 1b)
- Initials boxes dynamic type (Phase 3b)
- ModalOverlay accessibilityViewIsModal + focus trap (Phase 2d)
- Mode-select "Dismiss" hardcoded English (Phase 3c)

12 items closed across 4 commits.
