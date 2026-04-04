# Eco Mi — Claude Code Project Instructions

## Project Overview

Simon memory game for iOS and Android. Built with Expo / React Native.
See `docs/VISION.md` for product vision and architecture. See `docs/BACKLOG.md` for the task list.

## Key Decisions (do not deviate)

- **Payments**: RevenueCat via `react-native-purchases` (not expo-iap)
- **Animations**: `react-native-ease` (not reanimated — avoid worklet errors)
- **Analytics**: PostHog (`posthog-react-native`)
- **Celebrations**: Lottie (`lottie-react-native`) for high score animations
- **Backend**: None for v1. Everything local (MMKV).
- **React Compiler**: Enabled via SDK 55. Do NOT use `useMemo`, `useCallback`, or `React.memo` in new code — the compiler handles it. Write plain functions.
- **Open source repo**: Never hardcode API keys, tokens, or secrets. Always read from env vars.

## Verification Commands

Run these to verify changes before committing:

```bash
# Type check (must pass — zero errors currently)
npx tsc --noEmit

# Unit tests (must pass — 9 tests currently)
bun run test

# Lint + format (see note below)
bun run lint
```

**Lint baseline:** The existing `GameScreen.tsx` has ~27 pre-existing lint errors (color literals, unused vars, default React import). These will be resolved as part of the Phase 0/1 refactors. For new files you create, lint must pass with zero errors. Do not introduce new lint violations. Do not fix pre-existing lint errors in files you aren't otherwise modifying — keep diffs focused.

## Commit Conventions

- Prefix: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`
- Keep commits atomic — one backlog task per commit
- After committing, append to `CHANGELOG.md` and mark the backlog task `[x]` in `docs/BACKLOG.md`

## Working with the Backlog

When asked to work through the backlog autonomously:

1. Read `docs/BACKLOG.md` and find the next unchecked `[ ]` task (top to bottom)
2. Skip tasks marked **Blocked by** if the dependency isn't met
3. Read `docs/VISION.md` for context on the task (follow the **Ref** link)
4. Implement the task
5. Run all verification commands
6. Commit with a descriptive message
7. Mark the task `[x]` in `docs/BACKLOG.md`
8. Append the commit to `CHANGELOG.md`
9. Move to the next task

Stop and leave a note in `CHANGELOG.md` if:
- A task requires external action (account setup, secrets, asset creation)
- A verification command fails and you can't resolve it in 2 attempts
- You hit a task marked **Blocked by** an incomplete dependency

## File Structure

```
docs/VISION.md       — Product vision, architecture, roadmap (read-only reference)
docs/ACCOUNTS.md     — Account setup guide (read-only reference)
docs/BACKLOG.md      — Task list (update checkboxes as you complete work)
CHANGELOG.md         — Append after each commit
CLAUDE.md            — This file (project instructions)
.env.example         — Env var template (committed, safe)
.env                 — Real keys (gitignored, never commit)
```

## Code Style

- Follow existing ESLint + Prettier config (runs via `bun run lint`)
- Import order is enforced: react → react-native → expo → @/ aliases → relative
- No `React.default` import — use named imports (`import { useState } from "react"`)
- No raw `<SafeAreaView>` from react-native — use `react-native-safe-area-context`
- Prefer `Pressable` over `TouchableOpacity` for new components
- Write reusable hooks/components for ads, IAP, review prompts (see VISION.md > Reusability)
