# Multiplayer Vision — Eco Mi Duel

> **Status:** Draft — brainstorming document, not yet scheduled for implementation.

## Design Philosophy

In Tetris Attack, clearing panels is both your gameplay and your weapon — offense and defense use the same verb. For Eco Mi, the equivalent is: **remembering sequences is both how you survive and how you attack.** Every clean completion fuels your offense; every mistake leaves you exposed.

The goal is to preserve the zen simplicity of single-player Simon while layering on competitive tension that makes you want to play "one more round."

---

## Attack System

Attacks are the multiplayer core — the "garbage blocks" of Simon. Instead of cluttering a board, attacks **corrupt your opponent's memory challenge.**

### Attack Types

| Attack | Trigger | Effect on Opponent |
|--------|---------|-------------------|
| **Sequence Extension** | Complete a level cleanly | +2 random steps appended to their current sequence |
| **Speed Burst** | Complete 2 levels in a row | Next sequence playback runs at 2x speed (harder to memorize) |
| **Phantom Pad** | Complete 3+ levels in a row (chain) | One pad flashes a wrong color during playback — a "lie" they must detect |
| **Color Swap** | Perfect round (zero hesitation) | Two pad colors swap positions after the sequence is shown |
| **Blackout** | Charged power-up from streaks | One pad goes dark during next playback |

### Chain Mechanic

Consecutive clean completions amplify attacks, mirroring Tetris Attack's chain escalation:

- 1 clean round = small attack (Sequence Extension)
- 2 in a row = medium (Speed Burst)
- 3+ in a row = devastating (Phantom Pad / Color Swap)

Breaking a chain (mistake or slow completion) resets the multiplier. This creates the Tetris Attack tension: do you play safe and fast, or take your time to avoid mistakes and build a chain?

### Counter / Reflect

When an attack lands, you can **reflect** it back by completing your current sequence (or breakthrough challenge) within a tight time window. This mirrors Tetris Attack's garbage-cancel mechanic — skilled players turn defense into offense, creating momentum swings that keep matches dynamic.

---

## Game Modes

### Mode 1: Time War

The simplest competitive mode. Build this first.

**Rules:**
- Both players start with 60 seconds
- Same starting sequence (shared seed)
- Completing a sequence: +3s to yours, -2s from opponent
- Making a mistake: -3s from yours
- Chain bonus amplifies the time drain:
  - Chain x2 = -3s opponent
  - Chain x3 = -5s opponent
  - Chain x4 = -8s opponent
- First to 0 loses, or highest score when a shared 3-minute outer timer expires

**Why it works:** The existing timed mode already has scoring infrastructure for this. Time drain creates pressure without complex visual disruptions — you literally watch your clock shrink while your opponent's grows. Simple to understand, deep to master.

**Display:** Split view — your pads on one side, opponent's pads on the other (smaller/greyed out). You can see them tapping. A shared "attack feed" between the two sides shows time being stolen.

### Mode 2: Breakthrough

The "garbage block clearing" mode — foreign sequences injected into your flow.

**Rules:**
- Both players play normal classic mode independently
- Completing a level charges an attack meter
- When the meter fills, a **Breakthrough Sequence** (3-4 random steps, distinct color scheme) is injected into the opponent's game
- Opponent must complete the breakthrough before resuming their normal game
- Failing the breakthrough = lose a life or score penalty
- Completing the breakthrough in under 2 seconds = **reflect** it back to the sender

**Why it works:** The breakthrough is a foreign interruption — exactly like garbage blocks dropping onto your board. You're in a flow state memorizing your sequence, and suddenly you have to context-switch to a short urgent challenge. The reflect mechanic rewards composure under pressure, creating reversal potential that keeps losing players engaged.

### Mode 3: Chaos Duel

The hardcore mode for advanced players.

**Rules:**
- Both players receive the SAME sequence
- Attacks from the table above corrupt how the opponent *perceives* the sequence
- Speed Bursts, Phantom Pads, Color Swaps, and Blackouts alter the playback
- You must memorize the "true" sequence while filtering out the lies your opponent inflicts

**Why it works:** Highest skill ceiling — combines memory with deception detection. The shared sequence means you know exactly what your opponent is dealing with (minus your attacks), creating a mind-game layer.

---

## Display & Platform Strategy

### Same-Device Split Screen (iPad / Tablet / Landscape Phone)

- Two game pads side by side, each occupying half the screen
- Player 2's side rotated 180 degrees for face-to-face play across a table
- No networking required — ships as a pure local feature
- Lowest implementation cost, highest "wow" factor

### Foldable Phones (Galaxy Fold, Pixel Fold)

- Each player gets one half of the fold — the hinge is a natural divider
- Detect fold state via a config plugin wrapping Android's Jetpack WindowManager
- Niche audience but a compelling demo for the form factor

### Offline Local Multiplayer (Airplane Mode)

For scenarios without internet (airplanes, camping, poor signal):

- **Bluetooth LE** — persistent low-energy connection between two phones. Tiny payloads (a sequence is `[0,2,1,3,0]` + tap timestamps) fit BLE perfectly. Works without internet. Tradeoff: pairing UX is clunky and platform differences are painful in React Native (`react-native-ble-plx`). Developer cost is high relative to the use case.
- **Multipeer Connectivity (iOS)** — Apple's framework combining BLE + WiFi Direct (same tech as AirDrop). No internet needed. iOS-only, would require a native module / config plugin.
- **WiFi Direct (Android)** — peer-to-peer WiFi without a router. Android-only equivalent.
- **Same-device split screen** remains the simplest offline option — two people sharing a tablet on an airplane tray table, zero pairing friction.

### Online 1v1

- **Transport:** Firebase Realtime DB or Supabase Realtime — only need to sync move timestamps, attack events, and game-over state. Payloads are tiny (a sequence is `[0,2,1,3,0]` + timing).
- **Ghost/replay opponents:** Record player inputs + timing, replay them as a "live" opponent when no real player is available. Player experiences competitive tension without requiring simultaneous online players.
- **Matchmaking:** Room codes for friend matches. Simple FIFO queue for strangers. No complex infrastructure needed at indie scale.

### NFC

Not viable as a game transport — NFC is designed for single-moment tap-and-go exchanges, not persistent connections. Android Beam (the only phone-to-phone NFC mode) was removed in Android 10, and iOS never supported app-to-app NFC peer communication. Could theoretically be used to exchange a room code via tag tap, but adds complexity for minimal benefit when a simple numeric code or QR scan achieves the same thing.

---

## Progression & Meta Game

### Ranked Play
- ELO-based rating with visual tiers (Bronze / Silver / Gold / Diamond pads)
- Seasonal resets to keep the ladder fresh

### Daily Duel Challenge
- Everyone plays the same seeded sequence
- Attack ghosts of top players from the leaderboard
- No real-time connection needed — async competitive

### Revenge Replays
- When someone beats your ghost, push notification to reclaim your spot
- Creates a back-and-forth rivalry loop without requiring simultaneous play

### Cosmetic Stakes
- Winner "steals" one of the loser's pad themes for 24 hours
- Low-stakes but emotionally engaging — you want your theme back

---

## Implementation Phases

| Phase | Scope | Infrastructure |
|-------|-------|---------------|
| **0** | Daily Challenge leaderboard (shared seed, global scores) | Firebase/Supabase, no real-time |
| **1** | Same-device split screen Time War | No networking, works on any iPad/tablet |
| **2** | Online Time War with ghost replays | Firebase Realtime DB |
| **3** | Breakthrough mode + full attack system | Extends Phase 2 transport |
| **4** | Ranked matchmaking, ELO, cosmetic rewards | Lightweight backend additions |

Each phase is independently shippable and valuable. Phase 0 and 1 require no backend and could land without deviating from the current "no backend for v1" decision.

---

## Open Questions

- Should attacks be visible before they land (like Tetris Attack's garbage warning indicator), giving the opponent a chance to brace/counter? Or should they be surprises?
- How does "continue" (ad-based revival) work in multiplayer? Probably disabled to keep matches fair.
- Should there be a spectator mode for watching top-ranked matches?
- What's the right match length? Tetris Attack matches run 2-3 minutes — that feels right for mobile.
- Does the attack system need balancing via a "shield" consumable (earned through clean play)?
