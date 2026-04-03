# Eco Mi — Product Vision & Technical Architecture

> A Simon memory game for iOS, Android, and web — built with React Native and Expo.

---

## Table of Contents

1. [Product Vision](#product-vision)
2. [Target Audience](#target-audience)
3. [Core Gameplay Loop](#core-gameplay-loop)
4. [Feature Roadmap](#feature-roadmap)
5. [Monetization Strategy](#monetization-strategy)
6. [Technical Architecture](#technical-architecture)
7. [Data Model](#data-model-mmkv)
8. [Backend Deferral Rationale](#backend-deferral-rationale)
9. [Appendix: File Map](#appendix-file-map)

---

## Product Vision

Eco Mi is a polished, fast-loading Simon memory game that respects the player's time and attention. The game is free to play with ads, offers a one-time purchase to remove ads, and sells cosmetic theme and sound packs. There is no mandatory sign-up, no energy system, and no pay-to-win mechanics.

The product succeeds if players open it daily for short sessions, share scores with friends, and a meaningful percentage convert on the Remove Ads IAP.

**Design principles:**

- **Instant gratification** — tap Start and you're playing. No loading screens, no tutorials forced on returning players.
- **Respect the player** — ads are frequency-capped and never interrupt active gameplay. All purchases are cosmetic or convenience.
- **Feel premium** — smooth animations, rich haptics, and quality audio make the free experience feel like a paid app.

---

## Target Audience

| Segment | Description |
|---|---|
| **Primary** | Casual mobile gamers (ages 12–45) who play in short bursts — commutes, waiting rooms, before bed. |
| **Secondary** | Parents looking for screen-time-friendly games for kids; the Simon format is simple and non-violent. |
| **Tertiary** | Retro/nostalgia gamers who grew up with the original Simon hardware toy. |

Key traits: low patience for onboarding, high sensitivity to intrusive ads, willingness to pay $2–5 to remove annoyances.

---

## Core Gameplay Loop

```
Start Game → Watch Sequence → Repeat Sequence ──→ Correct → Score + Next Round
                                        │                     (speed increases)
                                        ↓ Wrong
                                   Game Over → Score Summary → Play Again / Share
```

1. Player taps **Start Game**.
2. The game plays a sequence of colored button flashes with corresponding tones (sine wave oscillators at 220/277/330/415 Hz).
3. Player repeats the sequence by tapping the colored buttons. Each tap provides audio, visual, and haptic feedback.
4. If correct, the sequence grows by one and playback speed increases with level.
5. If incorrect, the game ends. Player sees their score, level reached, and whether they set a new high score.
6. Player can play again immediately, share their score, or watch an ad to continue.

**Session length:** 30 seconds to 3 minutes per game. Multiple games per session.

---

## Feature Roadmap

### Phase 1 — Core Polish (v1.0)

The minimum viable product: a game that feels good to play.

| # | Feature | Notes |
|---|---|---|
| 1 | Extract `useSimonGame()` hook | Move all game state and logic out of `GameScreen.tsx`. Fix timer bugs (orphaned `setTimeout` refs, stale closures). |
| 2 | Wire up Oxanium font | Already bundled in `assets/fonts/`. Apply to all game text for a cohesive sci-fi/gaming identity. |
| 3 | Button animations via `react-native-ease` | Glow, scale, and pulse effects on the four game buttons. Replaces the current static `transform: [{ scale: 1.05 }]`. |
| 4 | Speed ramp | `interval = max(300, 800 - level * 30)`. Sequences play faster as level increases. |
| 5 | Game-over overlay | Modal with score summary, high score badge, Play Again and Share buttons. This becomes the primary monetization touchpoint. |
| 6 | `expo-haptics` integration | Replace `Vibration.vibrate()` with `expo-haptics` for distinct impact styles per color and richer game-over feedback. |
| 7 | Progress indicator | Show how many steps the player has completed in the current sequence (e.g., dot indicators or a progress bar). |

### Phase 2 — Monetization (v1.1)

| # | Feature | Notes |
|---|---|---|
| 1 | RevenueCat integration | `react-native-purchases` with Expo config plugin. Configure offerings in RevenueCat dashboard. |
| 2 | Google Mobile Ads | `react-native-google-mobile-ads` with `expo-tracking-transparency` for ATT compliance. |
| 3 | Remove Ads IAP | Non-consumable, ~$2.99. Gates all banner and interstitial ads. |
| 4 | Rewarded video "Continue" | After game over, offer one continue per game via rewarded ad. Player retries the failed sequence. |
| 5 | Frequency-capped interstitials | Show after game over. Skip if game lasted < 3 rounds. Max once per 2–3 games. See [Ad Placement Rules](#ad-placement-rules). |

### Phase 3 — Engagement (v1.2)

| # | Feature | Notes |
|---|---|---|
| 1 | Daily challenges | Date-seeded deterministic RNG. Same sequence for all players on a given day. Streak tracking. |
| 2 | Stats dashboard | Games played, best score, average level, current/longest streak. New screen via Expo Router. |
| 3 | Achievement system | Local achievements stored in MMKV (e.g., "Reach level 10", "7-day streak", "Score 1000+"). |
| 4 | Score sharing | `expo-sharing` generates a branded score card. Zero-cost organic acquisition. |
| 5 | Additional game modes | **Timed** (max sequences in 60s), **Reverse** (repeat backwards), **Chaos** (buttons shuffle positions). |

### Phase 4 — Cosmetics & IAP Expansion (v1.3)

| # | Feature | Notes |
|---|---|---|
| 1 | Theme system | Wire up existing Ignite `ThemeProvider` infrastructure. Add game-specific color tokens. |
| 2 | Theme packs (IAP) | Neon, Retro, Pastel — non-consumable purchases via RevenueCat. |
| 3 | Sound packs (IAP) | Square wave, Sawtooth, Triangle oscillator types — non-consumable. |
| 4 | XP / progression | Earn XP per game. Level-up unlocks free cosmetics. Ranks: Beginner → Apprentice → Adept → Master → Grandmaster. |

### Phase 5 — Backend Features (Future, deferred)

| # | Feature | Notes |
|---|---|---|
| 1 | Anonymous auth | Supabase Auth. Anonymous-first with optional Apple/Google sign-in upgrade. |
| 2 | Global leaderboards | Daily and all-time. Server-validated scores to prevent cheating. |
| 3 | Cross-device sync | Stats, achievements, and settings. RevenueCat already handles purchase restoration. |
| 4 | Friend challenges | Deep links to challenge a friend to beat your daily score. |

---

## Monetization Strategy

### Revenue Streams

| Stream | Type | Price | Priority |
|---|---|---|---|
| Remove Ads | Non-consumable IAP | ~$2.99 | Primary |
| Theme Packs | Non-consumable IAP | $0.99–1.99 each | Secondary |
| Sound Packs | Non-consumable IAP | $0.99 each | Secondary |
| Interstitial Ads | AdMob interstitial | — | Baseline |
| Rewarded Ads | AdMob rewarded video | — | Baseline |
| Banner Ads | AdMob banner | — | Supplementary |

### IAP Product Catalog (RevenueCat)

| Product ID | Type | Description |
|---|---|---|
| `ecomi_remove_ads` | Non-consumable | Permanently removes all banner and interstitial ads. Rewarded ads remain available (opt-in). |
| `ecomi_theme_neon` | Non-consumable | Neon color theme (cyan/magenta/lime on black). |
| `ecomi_theme_retro` | Non-consumable | Retro 80s color theme. |
| `ecomi_theme_pastel` | Non-consumable | Soft pastel color theme. |
| `ecomi_sound_square` | Non-consumable | Square wave oscillator sound pack. |
| `ecomi_sound_sawtooth` | Non-consumable | Sawtooth wave oscillator sound pack. |
| `ecomi_sound_triangle` | Non-consumable | Triangle wave oscillator sound pack. |

All IAP is managed through RevenueCat. The app never validates receipts directly — RevenueCat handles server-side receipt validation. Entitlement checks use `customerInfo.entitlements.active`.

### Ad Placement Rules

**Show ads when:**

- **Banner**: Bottom of screen during idle and game-over states only. Hidden during active gameplay.
- **Interstitial**: After game over, before the score overlay. Frequency-capped — max once per 2–3 games. Skip if the game lasted fewer than 3 rounds.
- **Rewarded**: Player-initiated only. "Watch to continue" after game over, limited to one continue per game.

**Never show ads:**

- During active gameplay (`showing` or `waiting` game states)
- During the player's first 3 sessions after install (grace period — let them fall in love first)
- If the user has purchased Remove Ads (except opt-in rewarded)
- While any modal, overlay, or animation is actively displaying
- Back-to-back (enforce minimum 3-minute gap between interstitials)

**Conversion prompt**: After a player has seen 3–5 interstitials, show a one-time "Tired of ads?" prompt with a direct Remove Ads purchase button. This is the highest-converting moment.

---

## Technical Architecture

### Current State

Single-screen Expo Router app scaffolded from Ignite v11.1.3. All game logic lives in `GameScreen.tsx` (~600 lines) with local `useState`, imperative timer refs, and inline styling.

| Layer | Current | Status |
|---|---|---|
| Framework | Expo SDK 53, RN 0.79, New Architecture, Hermes | Solid |
| Navigation | Expo Router (file-based, `src/app/`) | Solid |
| Storage | `react-native-mmkv` via `src/utils/storage.ts` | Solid |
| Audio | `react-native-audio-api` (Web Audio oscillators) via `src/hooks/useAudioTones.tsx` | Good, needs sound pack extension |
| Theme | Ignite theme system (`src/theme/`) — full light/dark infrastructure | Exists but unused by game |
| Fonts | SpaceGrotesk loaded at runtime. Oxanium bundled but not wired up. | Needs swap |
| Haptics | `Vibration` API (basic patterns) | Replace with `expo-haptics` |
| Animations | `react-native-reanimated` installed but unused | Replace with `react-native-ease` |
| i18n | `i18next` scaffolded, English only | Low priority |
| Builds | EAS configured (dev, preview, production profiles) | Solid |

### Target Architecture (Post-Phase 2)

```
┌──────────────────────────────────────────────┐
│                  App Shell                    │
│  Expo Router · ThemeProvider · AdProvider     │
│  RevenueCat Provider                         │
├──────────────────────────────────────────────┤
│               Screens                         │
│  ┌────────────┐ ┌──────────┐ ┌────────────┐ │
│  │   Game     │ │  Stats   │ │ Achievements│ │
│  │  Screen    │ │  Screen  │ │   Screen    │ │
│  └────────────┘ └──────────┘ └────────────┘ │
├──────────────────────────────────────────────┤
│              Game Logic                       │
│  ┌────────────────────────────────────────┐  │
│  │         useSimonGame(config)           │  │
│  │  State machine · Timer management      │  │
│  │  Sequence generation · Score tracking  │  │
│  └────────────────────────────────────────┘  │
├──────────────────────────────────────────────┤
│               Services                        │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │  Audio   │ │  Storage │ │   Haptics   │  │
│  │ rn-audio │ │   MMKV   │ │ expo-haptics│  │
│  │   -api   │ │          │ │             │  │
│  └──────────┘ └──────────┘ └─────────────┘  │
├──────────────────────────────────────────────┤
│            Monetization                       │
│  ┌─────────────────┐ ┌────────────────────┐  │
│  │   RevenueCat    │ │  Google Mobile Ads │  │
│  │ rn-purchases    │ │  Banners/Interst.  │  │
│  └─────────────────┘ └────────────────────┘  │
├──────────────────────────────────────────────┤
│            Animations                         │
│  ┌─────────────────────────────────────────┐ │
│  │         react-native-ease               │ │
│  │  Button glow · Scale · Pulse · Fade     │ │
│  └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### Key Libraries

| Library | Purpose | Phase |
|---|---|---|
| `react-native-ease` | Button animations (glow, scale, pulse) | 1 |
| `expo-haptics` | Rich haptic feedback per color/event | 1 |
| `react-native-purchases` | RevenueCat IAP (Remove Ads, themes, sounds) | 2 |
| `react-native-google-mobile-ads` | AdMob banners, interstitials, rewarded | 2 |
| `expo-tracking-transparency` | ATT consent (required before ad init on iOS) | 2 |
| `expo-sharing` | Score card sharing | 3 |

### Why `react-native-ease` Over Reanimated

- `react-native-reanimated` is already installed (Ignite dependency) but game animations will use `react-native-ease` instead.
- Reanimated's worklet compilation and native module setup cause recurring errors on New Architecture + Hermes, especially with rapid start/stop animations on game buttons.
- `react-native-ease` (by Janic Duplessis / AppAndFlow, v0.4.0) is 223KB with zero dependencies, no Babel plugin, and delegates to platform-native animation APIs.
- Trade-off: it's newer and less battle-tested, but covers the animation patterns we need (scale, opacity, glow) without the complexity overhead.
- Reanimated stays in `package.json` for navigation dependencies but game code won't use it.

---

## Data Model (MMKV)

All data is stored locally via `src/utils/storage.ts`. Keys use a namespaced prefix.

### Storage Keys

```
# Existing
simon-high-score                       string (number as string)

# Player Stats (Phase 3)
ecomi:stats:gamesPlayed                number
ecomi:stats:totalScore                 number
ecomi:stats:bestScore                  number
ecomi:stats:currentStreak              number
ecomi:stats:longestStreak              number
ecomi:stats:lastPlayedDate             string (ISO date)

# Daily Challenge (Phase 3)
ecomi:daily:{yyyy-MM-dd}:bestScore     number
ecomi:daily:{yyyy-MM-dd}:completed     boolean
ecomi:daily:currentStreak              number

# Achievements (Phase 3)
ecomi:achievements                     JSON: Record<string, { unlocked: boolean, unlockedAt?: string }>

# Settings
ecomi:settings:soundEnabled            boolean (default: true)
ecomi:settings:hapticsEnabled          boolean (default: true)
ecomi:settings:selectedTheme           string (theme ID)
ecomi:settings:selectedSoundPack       string (sound pack ID)

# Ad State
ecomi:ads:lastInterstitialTime         number (timestamp ms)
ecomi:ads:sessionCount                 number (for first-session grace period)
ecomi:ads:gamesPerSession              number (for frequency cap)

# Purchase Cache (RevenueCat is source of truth)
ecomi:purchases:removeAds              boolean
ecomi:purchases:ownedProducts          JSON: string[]
```

### Data Flow

```
App Launch
  → Read MMKV → hydrate settings, stats, cached purchases
  → Check RevenueCat → refresh entitlements → update MMKV cache

Player Action
  → useSimonGame() → update React state
                   → persist to MMKV (scores, stats)
                   → check achievement conditions

Game Over
  → Save score/stats to MMKV
  → Check ad frequency cap
  → Show game-over overlay (score, share, continue, play again)
```

Purchase state uses a **cache-locally, verify-remotely** pattern. MMKV stores entitlements so the app renders immediately without waiting for RevenueCat network calls. On each launch, entitlements are refreshed and the cache is updated.

---

## Backend Deferral Rationale

V1 ships with **zero backend dependencies**.

| Concern | V1 Solution | Why It Works |
|---|---|---|
| Purchases | RevenueCat (hosted) | Receipt validation, entitlement management, cross-device restore — all handled. |
| Daily challenges | Date-seeded RNG | `seed = parseInt(format(new Date(), 'yyyyMMdd'))` produces the same sequence for all players. No coordination needed. |
| High scores | MMKV (local) | Personal bests are local-only. Good enough until global leaderboards are requested. |
| Stats & achievements | MMKV (local) | All tracking is per-device. |
| Score sharing | `expo-sharing` | Generates a local image/text. No server needed. |

**When to add a backend** (any of these become true):

- Players request global leaderboards
- Cross-device sync becomes a top complaint
- Friend challenges need server-mediated state
- Leaderboard cheating requires server-side score validation

**Planned stack when the time comes:** Supabase (Postgres + Auth + Realtime). Anonymous-first — no mandatory registration. Optional Apple/Google sign-in to enable sync. Estimated schema: ~3 tables (users, scores, achievements).

---

## Appendix: File Map

### Current Structure

```
src/
├── app/
│   ├── _layout.tsx            Root layout (SafeArea, Theme, Keyboard providers)
│   └── index.tsx              Routes to GameScreen
├── hooks/
│   ├── useAudioTones.tsx      Web Audio API oscillator hook (220/277/330/415 Hz)
│   ├── useWebFonts.tsx        Native font loading stub
│   └── useWebFonts.web.tsx    Web font loading (Oxanium + SpaceGrotesk)
├── screens/
│   └── GameScreen.tsx         All game logic + UI (~600 lines, to be refactored)
├── theme/
│   ├── colors.ts              Light theme color tokens
│   ├── colorsDark.ts          Dark theme color tokens
│   ├── context.tsx            ThemeProvider + useAppTheme
│   ├── theme.ts               Theme type definitions
│   ├── typography.ts          Font definitions (SpaceGrotesk → Oxanium swap pending)
│   └── spacing.ts             Spacing scale
├── utils/
│   ├── storage.ts             MMKV wrapper (loadString, saveString, load, save, remove, clear)
│   └── storage.test.ts        Storage unit tests
└── i18n/                      i18next setup (English only, low priority)
```

### Target Structure (additions)

```
src/
├── app/
│   ├── _layout.tsx            + AdProvider, RevenueCat configure
│   ├── index.tsx              Game screen (unchanged)
│   ├── stats.tsx              Stats dashboard (Phase 3)
│   └── achievements.tsx       Achievement badges (Phase 3)
├── hooks/
│   ├── useSimonGame.ts        Extracted game state machine + logic (Phase 1)
│   ├── useAudioTones.tsx      + sound pack support (Phase 4)
│   ├── useAds.ts              Ad loading, frequency cap, display (Phase 2)
│   └── usePurchases.ts        RevenueCat entitlement checks (Phase 2)
├── screens/
│   └── GameScreen.tsx         Presentational only — delegates to useSimonGame()
├── config/
│   ├── achievements.ts        Achievement definitions and conditions (Phase 3)
│   └── difficulty.ts          Speed ramp curves, mode configs (Phase 1)
└── components/
    ├── GameOverOverlay.tsx     Score summary, share, continue (Phase 1)
    └── GameButton.tsx          Animated button with react-native-ease (Phase 1)
```
