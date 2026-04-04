# Eco Mi — Product Vision & Technical Architecture

> A Simon memory game for iOS and Android — built with React Native and Expo.

---

## Table of Contents

1. [Product Vision](#product-vision)
2. [Target Audience](#target-audience)
3. [Core Gameplay Loop](#core-gameplay-loop)
4. [Ship Target](#ship-target)
5. [Feature Roadmap](#feature-roadmap)
6. [Monetization Strategy](#monetization-strategy)
7. [Analytics](#analytics)
8. [Technical Architecture](#technical-architecture)
9. [Testing Strategy](#testing-strategy)
10. [Localization](#localization)
11. [App Store Optimization (ASO)](#app-store-optimization-aso)
12. [Data Model](#data-model-mmkv)
13. [Backend Deferral Rationale](#backend-deferral-rationale)
14. [Appendix: File Map](#appendix-file-map)

---

## Product Vision

Eco Mi is a polished, fast-loading Simon memory game that respects the player's time and attention. The game is free to play with ads, offers a one-time purchase to remove ads, and sells cosmetic theme and sound packs. There is no mandatory sign-up, no energy system, and no pay-to-win mechanics.

The product succeeds if players open it daily for short sessions, share scores with friends, and a meaningful percentage convert on the Remove Ads IAP.

**This project is open source.** All API keys, tokens, and credentials are managed via environment variables and EAS Secrets — never committed to the repository. See [ACCOUNTS.md](./ACCOUNTS.md#security--open-source-considerations) for the full security model.

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

## Ship Target

The goal is to get into the stores fast, start collecting real ASO data and user feedback, then polish in rapid updates. The roadmap below reflects this — v1.0 ships with critical polish + monetization, not a fully loaded feature set.

**v1.0 — Store submission (Phase 1):**
Ship the core polish items that make the game feel intentional (not a prototype) plus monetization so revenue starts from day one. Animations, Lottie celebrations, and haptics come in a fast-follow v1.1 — they improve the experience but don't block the store listing.

**v1.1 — Fast follow (Phase 2):**
Visual polish and remaining monetization features. Should ship within 1–2 weeks of v1.0.

**v1.2+ — Engagement & growth:**
Features that drive retention and expand IAP surface. Informed by real analytics data from v1.0/v1.1.

---

## Feature Roadmap

### Phase 1 — Ship to Stores (v1.0)

Critical polish + monetization. The minimum bar for a store-worthy game that generates revenue.

| # | Feature | Notes |
|---|---|---|
| 1 | Extract `useSimonGame()` hook | Move all game state and logic out of `GameScreen.tsx`. Fix timer bugs (orphaned `setTimeout` refs, stale closures). |
| 2 | Wire up Oxanium font | Already bundled in `assets/fonts/`. Apply to all game text for a cohesive sci-fi/gaming identity. |
| 3 | Speed ramp | `interval = max(300, 800 - level * 30)`. Sequences play faster as level increases. |
| 4 | Game-over overlay | Modal with score summary, high score badge, Play Again and Share buttons. Primary monetization touchpoint. |
| 5 | RevenueCat integration | `react-native-purchases` with Expo config plugin. Configure offerings in RevenueCat dashboard. |
| 6 | Google Mobile Ads | `react-native-google-mobile-ads` with `expo-tracking-transparency` for ATT compliance. |
| 7 | Remove Ads IAP | Non-consumable, ~$2.99. Gates all banner and interstitial ads. |
| 8 | Frequency-capped interstitials | Show after game over. Skip if game lasted < 3 rounds. Max once per 2–3 games. See [Ad Placement Rules](#ad-placement-rules). |
| 9 | PostHog analytics | Core event tracking from launch. See [Analytics](#analytics). |

### Phase 2 — Visual Polish (v1.1)

Fast follow — ship within 1–2 weeks of v1.0. Makes the game feel premium.

| # | Feature | Notes |
|---|---|---|
| 1 | Button animations via `react-native-ease` | Glow, scale, and pulse effects on the four game buttons. Replaces the current static `transform: [{ scale: 1.05 }]`. |
| 2 | New high score celebration | Lottie animation (trophy/confetti from [LottieFiles](https://lottiefiles.com)) triggered when the player beats their high score. |
| 3 | `expo-haptics` integration | Replace `Vibration.vibrate()` with `expo-haptics` for distinct impact styles per color and richer game-over feedback. |
| 4 | Progress indicator | Show how many steps the player has completed in the current sequence (e.g., dot indicators or a progress bar). |
| 5 | Rewarded video "Continue" | After game over, offer one continue per game via rewarded ad. Player retries the failed sequence. |
| 6 | Store review prompts | `expo-store-review` with pre-prompt sentiment filter. See [Review Prompt Rules](#review-prompt-rules). |

### Phase 3 — Engagement (v1.2)

| # | Feature | Notes |
|---|---|---|
| 1 | Daily challenges | Date-seeded deterministic RNG. Same sequence for all players on a given day. Streak tracking. |
| 2 | Stats dashboard | Games played, best score, average level, current/longest streak. New screen via Expo Router. |
| 3 | Achievement system | Local achievements stored in MMKV (e.g., "Reach level 10", "7-day streak", "Score 1000+"). |
| 4 | Score sharing | `expo-sharing` generates a branded score card. Zero-cost organic acquisition. |
| 5 | Additional game modes | **Timed** (max sequences in 60s), **Reverse** (repeat backwards), **Chaos** (buttons shuffle positions). |
| 6 | Localization | Translate all UI strings into priority languages. Infrastructure already exists (`i18next` + `expo-localization` + RTL support). See [Localization](#localization). |

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

> For account setup details, API keys, and configuration for all third-party services, see [ACCOUNTS.md](./ACCOUNTS.md).

### Review Prompt Rules

`expo-store-review` uses the native `SKStoreReviewController` (iOS) and in-app review API (Android). The OS controls the actual display — calling `requestReview()` is a *request*, not a guarantee. Apple and Google both rate-limit to ~3 prompts per year per user, so every trigger must count.

**Trigger moments (positive emotional peaks only):**

| Trigger | When | Why It Works |
|---|---|---|
| First game completion | Player finishes their very first game (win or lose, they completed a full round) | The "I get it!" moment — highest engagement point for new users |
| New high score | Player beats their previous best | Peak positive emotion — they just achieved something |
| Achievement unlocked | Any achievement is earned for the first time | Dopamine hit from the unlock pairs well with a review ask |
| Streak milestone | Player hits a 3-day or 7-day daily challenge streak | Invested users who play daily are most likely to leave a positive review |
| Level milestone | Player reaches level 10, 15, or 20 for the first time | Sense of accomplishment at a personal milestone |

**How the OS and our code split responsibility:**

The native APIs (`SKStoreReviewController` on iOS, In-App Review API on Android) are the ultimate gatekeepers — they silently no-op the request if they've shown the prompt too recently (~3 times per year per user). We can't force the prompt and Apple doesn't publish exact throttling rules.

Our job is **moment selection**, not rate limiting. We control *when* we ask, the OS controls *whether* it actually shows. This means:

- Call `requestReview()` only at positive emotional peaks so that when the OS *does* show it, the user is happy
- Don't waste silent requests at bad moments — the OS may count them against future prompts even when suppressed
- Don't stack with ads — if we just showed an interstitial, skip the review request

**Guard conditions (our responsibility):**

```
1. Player has completed at least 5 total games (invested enough to have an opinion)
2. No ad was shown in this game session (don't stack interruptions)
3. The current moment matches a trigger from the table above
```

**Never request a review:**
- After a game over where the player didn't beat their high score
- Immediately after an ad
- During active gameplay

**Implementation:**

```typescript
// src/hooks/useStoreReview.ts
import * as StoreReview from "expo-store-review"
import { load } from "@/utils/storage"

export async function maybeRequestReview(adShownThisSession: boolean) {
  const isAvailable = await StoreReview.isAvailableAsync()
  if (!isAvailable) return

  const totalGames = load("ecomi:stats:gamesPlayed") ?? 0
  if (totalGames < 5) return
  if (adShownThisSession) return

  // The OS decides whether to actually show the prompt.
  // We just ensure we only ask at the right moment.
  await StoreReview.requestReview()
}
```

Call `maybeRequestReview(adShownThisSession)` from the game-over overlay after a new high score, achievement unlock, or streak milestone. Keep the call site narrow — only positive moments.

### Pre-Prompt Pattern (Ask Before You Ask)

Rather than calling the native review API directly, use a custom modal to filter sentiment first. This prevents unhappy users from reaching the App Store — redirect them to private feedback instead.

```
Custom Modal (our UI)                         Native API
┌──────────────────────────────┐
│                              │
│     Enjoying Eco Mi?         │
│                              │
│  [Love it!]    [Not really]  │
│                              │
└──────────────────────────────┘
        │                │
        ▼                ▼
  requestReview()    Feedback channel
  (native prompt)    (private, off-store)
```

**"Love it!"** — calls `StoreReview.requestReview()`. The user was already primed positively, so if the OS shows the prompt, it's likely a 4–5 star review.

**"Not really"** — routes to a private feedback channel. This user was going to leave a low rating — capture their feedback without it hitting the store.

### Feedback Channel (Zero Backend)

For v1, no backend is needed for the feedback path:

| Option | Setup | Notes |
|---|---|---|
| **Email link** | `Linking.openURL("mailto:feedback@ecomi.app?subject=Eco Mi Feedback")` | Simplest. Opens the user's mail app. |
| **Google Form** | Link to a Google Form via `Linking.openURL()` | Free. Responses collect in a spreadsheet. |
| **GitHub Discussions** | Link to the repo's Discussions tab | Community-friendly since the project is open source. |

Start with email or a Google Form. Upgrade to an in-app form (Typeform, Tally, or Formspree webhook) later if volume justifies it.

### Pre-Prompt Implementation

```typescript
// src/components/ReviewPrompt.tsx
import { Modal, View, Text, Pressable, Linking } from "react-native"
import * as StoreReview from "expo-store-review"

type Props = {
  visible: boolean
  onDismiss: () => void
}

export function ReviewPrompt({ visible, onDismiss }: Props) {
  const handleLoveIt = async () => {
    onDismiss()
    const isAvailable = await StoreReview.isAvailableAsync()
    if (isAvailable) await StoreReview.requestReview()
  }

  const handleNotReally = () => {
    onDismiss()
    Linking.openURL("mailto:feedback@ecomi.app?subject=Eco Mi Feedback")
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Enjoying Eco Mi?</Text>
          <View style={styles.buttons}>
            <Pressable onPress={handleLoveIt} testID="review-love-it">
              <Text>Love it!</Text>
            </Pressable>
            <Pressable onPress={handleNotReally} testID="review-not-really">
              <Text>Not really</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}
```

Show `<ReviewPrompt>` from the game-over overlay when guard conditions pass (5+ games, no ad this session, positive trigger moment). The pre-prompt is our UI — fully controlled, localizable, and styled to match the app.

---

## Analytics

### Strategy: RevenueCat + PostHog

Two data sources, zero custom backend:

- **RevenueCat** (already integrated for IAP) — gives purchase analytics, revenue per user, conversion funnels, and subscriber status out of the box. No extra work.
- **PostHog** — open-source product analytics with a generous free tier (1M events/month). Privacy-friendly (EU hosting available, no cookie banner needed for analytics-only use). Self-hostable later if needed.

This combo answers the key questions across all future apps: what do users do, where do they drop off, and what converts to revenue.

### PostHog Setup

```bash
npx expo install posthog-react-native
```

Initialize in the app root:

```typescript
// src/app/_layout.tsx
import { PostHogProvider } from "posthog-react-native"

<PostHogProvider
  apiKey={process.env.EXPO_PUBLIC_POSTHOG_KEY}
  options={{ host: "https://us.i.posthog.com" }}
>
  {children}
</PostHogProvider>
```

PostHog key goes in `.env` (gitignored) and EAS Secrets for builds. Add to `.env.example`:

```
EXPO_PUBLIC_POSTHOG_KEY=phc_XXXXXXXXXXXXXXXXXXXXXXXX
```

### Core Events (ship in v1.0)

Track the minimum set of events that answer "is the game working and are people engaged":

| Event | Properties | When |
|---|---|---|
| `game_started` | `{ mode }` | Player taps Start Game |
| `game_completed` | `{ score, level, isHighScore, mode }` | Round ends (win or lose) |
| `game_over` | `{ score, level, reason }` | Player fails a sequence |
| `ad_shown` | `{ type, placement }` | Interstitial or banner displayed |
| `ad_rewarded_watched` | `{ placement }` | Player completes a rewarded video |
| `iap_initiated` | `{ productId }` | Player taps a purchase button |
| `iap_completed` | `{ productId, revenue }` | Purchase succeeds (RevenueCat also tracks this) |
| `share_tapped` | `{ score, level }` | Player taps Share on game-over overlay |
| `review_prompt_shown` | `{ trigger }` | Pre-prompt modal displayed |
| `review_prompt_response` | `{ response }` | "Love it!" or "Not really" |

### Events Added in Later Phases

| Event | Phase | Notes |
|---|---|---|
| `mode_selected` | 3 | Which game mode (timed, reverse, chaos) |
| `daily_challenge_completed` | 3 | Daily challenge score and streak |
| `achievement_unlocked` | 3 | Which achievement |
| `theme_applied` | 4 | Which theme |
| `sound_pack_applied` | 4 | Which sound pack |

### Key Dashboards to Build in PostHog

1. **Retention** — Day 1 / Day 7 / Day 30 retention curves. The north star metric.
2. **Funnel: Install → First Game → 5th Game → Purchase** — where do users drop off?
3. **Ad Revenue per Session** — correlate with session length and games played.
4. **Mode Popularity** (Phase 3+) — which game modes drive the most sessions?
5. **IAP Conversion by Trigger** — which moments convert to Remove Ads purchases?

### Privacy

- PostHog uses anonymous user IDs by default — no PII collected.
- No additional privacy policy changes needed beyond what ads already require.
- GDPR: PostHog supports EU data residency. Analytics-only (no marketing/profiling) typically falls under legitimate interest, but include it in the privacy policy disclosure.

---

## Technical Architecture

### Current State

Single-screen Expo Router app scaffolded from Ignite v11.1.3. All game logic lives in `GameScreen.tsx` (~600 lines) with local `useState`, imperative timer refs, and inline styling.

| Layer | Current | Target |
|---|---|---|
| Framework | Expo SDK 53, RN 0.79, New Architecture, Hermes | Expo SDK 55, RN 0.84, React 19.2 |
| Navigation | Expo Router (file-based, `src/app/`) | Solid |
| Storage | `react-native-mmkv` via `src/utils/storage.ts` | Solid |
| Audio | `react-native-audio-api` (Web Audio oscillators) via `src/hooks/useAudioTones.tsx` | Good, needs sound pack extension |
| Theme | Ignite theme system (`src/theme/`) — full light/dark infrastructure | Exists but unused by game |
| Fonts | SpaceGrotesk loaded at runtime. Oxanium bundled but not wired up. | Needs swap |
| Haptics | `Vibration` API (basic patterns) | Replace with `expo-haptics` |
| Animations | `react-native-reanimated` installed but unused | Replace with `react-native-ease` |
| Compiler | N/A | React Compiler via `babel-preset-expo@55` — auto-memoization, no manual `useMemo`/`useCallback` |
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
| `react-native-ease` | Button animations (glow, scale, pulse) | 2 |
| `lottie-react-native` | Celebration animations (trophy, confetti) on new high scores | 2 |
| `expo-haptics` | Rich haptic feedback per color/event | 2 |
| `posthog-react-native` | Product analytics (events, funnels, retention) | 1 |
| `react-native-purchases` | RevenueCat IAP (Remove Ads, themes, sounds) | 1 |
| `react-native-google-mobile-ads` | AdMob banners, interstitials, rewarded | 1 |
| `expo-tracking-transparency` | ATT consent (required before ad init on iOS) | 1 |
| `expo-store-review` | Native store review prompt at positive moments | 2 |
| `expo-sharing` | Score card sharing | 3 |

### Why `react-native-ease` Over Reanimated

- `react-native-reanimated` is already installed (Ignite dependency) but game animations will use `react-native-ease` instead.
- Reanimated's worklet compilation and native module setup cause recurring errors on New Architecture + Hermes, especially with rapid start/stop animations on game buttons.
- `react-native-ease` (by Janic Duplessis / AppAndFlow, v0.4.0) is 223KB with zero dependencies, no Babel plugin, and delegates to platform-native animation APIs.
- Trade-off: it's newer and less battle-tested, but covers the animation patterns we need (scale, opacity, glow) without the complexity overhead.
- Reanimated stays in `package.json` for navigation dependencies but game code won't use it.

### Reusability Across Future Apps

Hooks and components for ads, IAP, review prompts, and analytics are written as **generic, app-agnostic modules** within this repo. They aren't a separate package yet, but they're clean enough to copy into the next app with minimal changes:

- `src/hooks/useAds.ts` — ad loading, frequency cap, display logic
- `src/hooks/usePurchases.ts` — RevenueCat entitlement checks, purchase flow
- `src/hooks/useStoreReview.ts` — review prompt guard logic
- `src/components/ReviewPrompt.tsx` — pre-prompt sentiment filter modal
- PostHog provider setup in `_layout.tsx`

Keep game-specific logic (Simon state machine, audio frequencies, color maps) separate from these reusable modules. After shipping 2–3 apps, extract the common hooks into a shared package if the pattern holds.

---

## Testing Strategy

### Testing Layers

| Layer | Tool | What It Covers | CI Cost |
|---|---|---|---|
| **Unit** | Jest + `jest-expo` | `useSimonGame()` hook — state transitions, scoring, speed ramp, sequence validation, timer cleanup | Fast, no device |
| **Component** | Jest + React Testing Library | Screen rendering, button props, overlay visibility, testID presence | Fast, no device |
| **E2E (native)** | Maestro | Full game flows on simulator — tap interactions, audio/haptic triggers, real touch targets | macOS runner or Maestro Cloud |
| **E2E (web)** | Playwright | Fast logic flow coverage — can inspect DOM state directly, cheaper CI than simulators | Any CI runner |

Maestro is the primary confidence layer for a game. Playwright on the Expo web build supplements it for faster iteration on game logic without spinning up simulators.

### Deterministic Test Mode

The game sequence is random, which makes E2E tests impossible unless we control it. A seeded RNG mode solves this:

```typescript
// In useSimonGame()
const seed = process.env.EXPO_PUBLIC_TEST_SEED
const nextColor = seed
  ? colors[seededRandom(seed, sequence.length) % colors.length]
  : colors[Math.floor(Math.random() * colors.length)]
```

When `EXPO_PUBLIC_TEST_SEED` is set, the sequence is deterministic. Test flows know exactly which buttons to tap and in what order. The seed is only read from an environment variable — it has zero impact on production builds.

### TestID Conventions

Maestro is a black-box tool — it cannot detect visual state changes (color, opacity). Game state must be encoded into `testID` props:

```tsx
<Pressable testID={`btn-red${isActive ? "-active" : ""}`} />
```

Standard testID patterns:

| Element | testID | Active State |
|---|---|---|
| Red button | `btn-red` | `btn-red-active` |
| Blue button | `btn-blue` | `btn-blue-active` |
| Green button | `btn-green` | `btn-green-active` |
| Yellow button | `btn-yellow` | `btn-yellow-active` |
| Start button | `btn-start` | — |
| Play Again button | `btn-play-again` | — |
| Score display | `text-score` | — |
| Level display | `text-level` | — |
| High score display | `text-high-score` | — |
| Game over overlay | `overlay-game-over` | — |
| Sound toggle | `btn-sound-toggle` | — |

### Maestro Flows

Existing scaffold: `.maestro/shared/_OnFlowStart.yaml` handles app launch and Expo dev screen dismissal.

Flows to implement in `.maestro/flows/`:

| Flow | Description | Seed |
|---|---|---|
| `happy-path.yaml` | Start → play 3 correct rounds → verify score increments each round | Fixed seed where round 1 = red, round 2 = red-blue, round 3 = red-blue-green |
| `game-over.yaml` | Start → tap wrong button → verify game over overlay → tap Play Again → verify reset to idle | Any fixed seed |
| `high-score.yaml` | Play past stored high score → verify celebration animation triggers | Fixed seed, pre-set low high score in MMKV |
| `sound-toggle.yaml` | Toggle sound off → play a round → verify no crash, game completes | Any fixed seed |
| `ads-flow.yaml` (Phase 2) | Play 3+ games → verify interstitial appears → verify rewarded "Continue" offer | Any fixed seed |

Example Maestro flow:

```yaml
# .maestro/flows/happy-path.yaml
appId: ${MAESTRO_APP_ID}
env:
  MAESTRO_APP_ID: com.ecomi
---
- runFlow: ../shared/_OnFlowStart.yaml

# Start the game
- tapOn:
    id: "btn-start"

# Round 1: sequence is [red] (from seeded RNG)
- waitForAnimationToEnd
- assertVisible:
    id: "btn-red-active"
- extendedWaitUntil:
    notVisible:
      id: "btn-red-active"
    timeout: 3000

# Player repeats: tap red
- tapOn:
    id: "btn-red"

# Verify score updated
- assertVisible:
    id: "text-score"
    text: "10"

# Round 2: sequence is [red, blue]
- waitForAnimationToEnd
- assertVisible:
    id: "btn-red-active"
- extendedWaitUntil:
    notVisible:
      id: "btn-red-active"
    timeout: 3000
- assertVisible:
    id: "btn-blue-active"
- extendedWaitUntil:
    notVisible:
      id: "btn-blue-active"
    timeout: 3000

# Player repeats: tap red, then blue
- tapOn:
    id: "btn-red"
- tapOn:
    id: "btn-blue"

# Verify score updated
- assertVisible:
    id: "text-score"
    text: "20"
```

### Playwright (Web Complement)

Playwright tests run against the Expo web build (`expo start --web`) for fast iteration:

```bash
npx playwright test
```

Advantages over Maestro for certain scenarios:
- Direct DOM access — can read component state, check CSS properties, verify audio context
- No simulator boot time — tests start in seconds
- Cheaper CI — runs on any Linux runner

Limitations:
- Tests the web renderer, not native — won't catch iOS/Android-specific touch, audio, or haptic issues
- Not a replacement for Maestro, but covers game logic flows faster

### CI Integration

**Maestro:**
- GitHub Actions with `mobile-dev-inc/action-maestro-cloud@v1` for Maestro Cloud (managed simulators)
- Or self-hosted macOS runner with `maestro test` against a local simulator
- Build the dev client with `eas build --profile development`, download artifact, run Maestro against it

**Playwright:**
- Any GitHub Actions runner (ubuntu-latest)
- `expo start --web` in background, then `npx playwright test`

**Jest:**
- Runs on any CI runner, no device needed
- Already configured: `bun run test`

---

## Localization

### Current State

The i18n infrastructure is fully wired up from the Ignite boilerplate:

- **`i18next`** + **`react-i18next`** — translation framework with typed key paths (`TxKeyPath`)
- **`expo-localization`** — detects device language and region
- **RTL support** — already configured in `src/i18n/index.ts` (checks `textDirection`, sets `I18nManager.allowRTL`)
- **Fallback** — defaults to `en-US` if device locale isn't supported

However, the game currently uses **zero translated strings**. All UI text in `GameScreen.tsx` is hardcoded English (`"Start Game"`, `"Game Over!"`, `"Score"`, etc.). The existing `src/i18n/en.ts` only contains Ignite boilerplate strings.

### What Needs to Happen

**Step 1 — Extract strings from game UI into `en.ts`:**

```typescript
// src/i18n/en.ts
const en = {
  game: {
    startGame: "Start Game",
    playAgain: "Play Again",
    gameOver: "Game Over!",
    newHighScore: "New High Score!",
    score: "Score",
    level: "Level",
    highScore: "High Score",
    watchSequence: "Watch the sequence...",
    repeatSequence: "Repeat the sequence!",
    pressStart: "Press Start Game to begin!",
    sound: "Sound",
    continue: "Continue",
  },
  stats: {
    title: "Statistics",
    gamesPlayed: "Games Played",
    bestScore: "Best Score",
    averageLevel: "Average Level",
    currentStreak: "Current Streak",
    longestStreak: "Longest Streak",
  },
  achievements: {
    title: "Achievements",
    unlocked: "Unlocked!",
  },
  settings: {
    sound: "Sound",
    haptics: "Haptics",
    theme: "Theme",
    removeAds: "Remove Ads",
  },
  share: {
    scoreMessage: "I reached Level {{level}} with a score of {{score}} on Eco Mi! Can you beat me?",
  },
  common: {
    ok: "OK",
    cancel: "Cancel",
    back: "Back",
  },
}
```

**Step 2 — Replace hardcoded strings in components** with `useTranslation()` or the `translate()` helper from `src/i18n/translate.ts`.

**Step 3 — Add translation files** for each target language.

### Priority Languages

A Simon game has minimal text, which makes translation cheap. Target the top mobile gaming markets first:

| Priority | Language | Code | Notes |
|---|---|---|---|
| 1 | English | `en` | Default, already done |
| 2 | Spanish | `es` | ~550M speakers, huge mobile gaming market (Latin America + Spain) |
| 3 | Portuguese | `pt` | ~260M speakers, Brazil is a top mobile gaming market |
| 4 | French | `fr` | ~280M speakers, strong in West Africa + Europe |
| 5 | German | `de` | High App Store spend per capita |
| 6 | Japanese | `ja` | Top mobile gaming market by revenue |
| 7 | Korean | `ko` | High mobile gaming engagement |
| 8 | Chinese (Simplified) | `zh` | Largest mobile market (if distributing outside Play/App Store) |
| 9 | Arabic | `ar` | RTL — infrastructure already supports it |
| 10 | Hindi | `hi` | Massive growing mobile market (India) |

The game has roughly **~30 translatable strings**. This is a small enough set that AI-assisted translation with native speaker review is practical and cost-effective.

### App Store Localization

Translation isn't just in-app — the store listings matter more for discoverability:

- **App name**: "Eco Mi" stays the same globally (brand name)
- **Subtitle / short description**: Translate for each locale (e.g., "Memory game inspired by Simon")
- **Description**: Full localized description for each language
- **Keywords**: Localized keywords per market (e.g., "memory game", "Simon", "brain training" in each language)
- **Screenshots**: Text overlays on screenshots should be localized for top markets

App Store Connect and Google Play Console both support per-locale metadata. This is handled during submission, not in code.

### File Structure

```
src/i18n/
├── index.ts          # i18next init, locale detection, RTL (already exists)
├── translate.ts      # translate() helper (already exists)
├── en.ts             # English (update with game strings)
├── es.ts             # Spanish
├── pt.ts             # Portuguese
├── fr.ts             # French
├── de.ts             # German
├── ja.ts             # Japanese
├── ko.ts             # Korean
├── zh.ts             # Chinese (Simplified)
├── ar.ts             # Arabic
└── hi.ts             # Hindi
```

Each file exports the same shape as `en.ts` (typed via `Translations`). Add new languages to the `resources` object in `index.ts`:

```typescript
import en from "./en"
import es from "./es"
import pt from "./pt"
// ...

const resources = { en, es, pt, fr, de, ja, ko, zh, ar, hi }
```

### RTL Considerations

Arabic (and potentially Hebrew if added later) require RTL layout. The i18n setup already handles `I18nManager.allowRTL`. Additional considerations:

- Game button positions (topLeft, topRight, etc.) should mirror in RTL — this is automatic with flexbox `row-reverse` when RTL is active
- Score/level text alignment should respect `I18nManager.isRTL`
- The game board itself is symmetric so most layout works without changes

---

## App Store Optimization (ASO)

ASO is how the app gets discovered organically. For a casual game, store listing quality directly impacts downloads — most users find apps by searching or browsing, not from links.

### App Store Assets Required

| Asset | iOS (App Store Connect) | Android (Google Play Console) |
|---|---|---|
| **App Icon** | 1024x1024 PNG (already in `assets/images/`) | 512x512 PNG (already in `assets/images/`) |
| **Screenshots** | 6.7" (1290x2796), 6.5" (1284x2778), 5.5" (1242x2208). Min 3, max 10. | Phone (16:9 or 9:16). Min 2, max 8. |
| **iPad Screenshots** | 12.9" (2048x2732). Required if `supportsTablet: true`. | Tablet (16:9). Optional but recommended. |
| **Preview Video** | Up to 30s, same resolution as screenshots. Optional but high-impact. | Up to 30s. Optional. |
| **Feature Graphic** | N/A | 1024x500 PNG. Required. Shown at top of listing. |
| **Short Description** | Subtitle, max 30 chars | Max 80 chars |
| **Full Description** | Max 4000 chars | Max 4000 chars |
| **Keywords** | Max 100 chars, comma-separated (iOS only) | Extracted from description (Google indexes the full text) |
| **Category** | Games → Puzzle (or Board) | Games → Puzzle |
| **Content Rating** | Via App Store questionnaire | Via Google Play questionnaire |
| **Privacy Policy URL** | Required | Required |

### Keyword Strategy

Target keywords that players actually search for. Focus on intent + low competition:

**Primary keywords** (high intent, include in title/subtitle):
- "simon game"
- "memory game"
- "pattern game"

**Secondary keywords** (include in description/keyword field):
- "brain training"
- "memory test"
- "color sequence"
- "simon says"
- "puzzle game"
- "brain game"
- "recall game"
- "cognitive training"

**Localized keywords**: Translate the above for each priority language. Keyword search behavior varies by market — "jeu de mémoire" (French), "記憶ゲーム" (Japanese), etc.

### Screenshot Strategy

Screenshots are the highest-impact ASO asset after the icon. For a game, they should show gameplay, not marketing fluff.

**Recommended screenshot set (5–6 screens):**

1. **Gameplay in action** — the four-button board mid-sequence with a button lit up. Overlay text: "Watch. Remember. Repeat."
2. **Score/level display** — showing a high-level game in progress. Overlay text: "How far can you go?"
3. **Game over / high score celebration** — Lottie trophy animation visible. Overlay text: "Beat your high score!"
4. **Daily challenge** (Phase 3) — the daily challenge screen with streak counter. Overlay text: "New challenge every day."
5. **Multiple game modes** (Phase 3) — mode selection showing Timed, Reverse, Chaos. Overlay text: "5 ways to play."
6. **Theme variety** (Phase 4) — side-by-side of Neon, Retro, Pastel themes. Overlay text: "Make it yours."

**Screenshot design guidelines:**
- Use device frames (iPhone 15 Pro / Pixel 8 style)
- Large, readable overlay text (not just raw screenshots)
- Consistent color scheme matching the app's branding
- First 2–3 screenshots matter most — they show in search results without tapping

**Localize screenshots** for top markets. At minimum, translate the overlay text for Spanish, Portuguese, French, German, and Japanese. The gameplay itself is visual and needs no translation.

### Preview Video

A 15–30 second preview video significantly increases conversion. For a Simon game, show:

1. (0–5s) App icon + name
2. (5–15s) A full game round — watch the sequence, repeat it, score goes up
3. (15–25s) Speed ramp at higher levels — show it getting intense
4. (25–30s) High score celebration + call to action

Record from a real device using Xcode's screen recording (iOS) or `adb screenrecord` (Android). Keep it snappy — no slow intros.

### Store Listing Copy

**Title**: "Eco Mi — Simon Memory Game" (30 chars, includes primary keyword)

**Subtitle (iOS)** / **Short description (Android)**:
- EN: "Classic pattern memory challenge" (31 chars)
- ES: "Desafío de memoria de patrones" (30 chars)

**Description template** (localize per market):

```
Test your memory with Eco Mi — a modern take on the classic Simon game!

Watch the color sequence, then repeat it back. Each round adds one more
step. How far can you go?

FEATURES:
- Classic Simon gameplay with smooth animations and satisfying audio
- Speed ramp — sequences get faster as you level up
- Daily challenges — same sequence for everyone, compete globally
- Multiple game modes — Timed, Reverse, Chaos, and more
- Rich haptic feedback on every tap
- Achievements and stats to track your progress
- Beautiful themes to customize your experience

Free to play. No account required. Just tap and play!
```

### Rating & Reviews Strategy

- **In-app review prompt**: Use `expo-store-review` to request a rating after a positive moment (e.g., new high score, achievement unlocked). Never prompt after a loss or ad. Limit to once per 30 days.
- **Respond to reviews**: Both stores reward developers who respond to reviews with better ranking signals.

### ASO Iteration

After launch, monitor:
- **Keyword rankings** — tools like AppFollow, Sensor Tower, or AppTweak
- **Conversion rate** — impressions → installs (available in App Store Connect / Play Console analytics)
- **A/B testing** — Google Play supports native A/B tests for listings. Test different screenshots, descriptions, and feature graphics.

Update store metadata monthly for the first 3 months, then quarterly. Each app update is an opportunity to refresh screenshots and keywords.

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
