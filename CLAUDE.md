# Eco Mi — Claude Code Project Instructions

## Project Overview

Simon memory game for iOS and Android. Built with Expo / React Native.
See `docs/VISION.md` for product vision and architecture. See `docs/BACKLOG.md` for the task list.

## Key Decisions (do not deviate)

- **CNG (Continuous Native Generation)**: `ios/` and `android/` are gitignored. Native projects are generated via `npx expo prebuild`. Never commit native directories. Never modify native code directly — use config plugins in `app.config.ts` instead.
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
bun run compile

# Unit tests (must pass — 9 tests currently)
bun run test

# Lint + format (see note below)
bun run lint
```

**Lint baseline:** The existing `GameScreen.tsx` has ~27 pre-existing lint errors (color literals, unused vars, default React import). These will be resolved as part of the Phase 0/1 refactors. For new files you create, lint must pass with zero errors. Do not introduce new lint violations. Do not fix pre-existing lint errors in files you aren't otherwise modifying — keep diffs focused.

## Branching Strategy

- **`develop`** — default branch. All feature work and backlog tasks commit here.
- **`main`** — release branch. Only updated via PR from `develop` when shipping a version to the stores.
- Feature branches are optional for larger tasks but not required for single-task commits on `develop`.

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

## Parallel Subagent Work

When dispatching parallel subagents with `isolation: "worktree"` (e.g. multiple independent bug-fix tracks), use the template at `docs/subagent-brief-template.md` — it includes the orchestrator pre-flight checklist, the parameterized brief body, and the merge-orchestration playbook. Rules the template codifies:

- **Agents must branch off develop's tip, not the worktree HEAD.** Worktrees are often initialized on a stale commit; every brief must include "run `git checkout -b <branch> develop` before editing." Skipping this silently diverges the fix from current code.
- **Agents never push, never merge.** They commit on their branch and return: branch name, commit SHAs, files touched, and any surprises. The orchestrator owns integration.
- **Re-verify `tsc` + `test` after each merge in the main repo.** Agent-side verification is necessary but not sufficient — some errors only surface post-merge in the main repo's dependency tree (e.g. dual-package type mismatches where one copy of a package lives inside `node_modules/expo-router/node_modules/` with a nominally-distinct type from the top-level install).
- **File independence is the parallelism constraint.** Map each track's file footprint before dispatching; zero cross-track overlap = safe parallel. Cross-cutting fixes (same file touched by multiple tracks) run *after* the parallel wave, sequentially.
- **Use `it.failing()` for red→green test handoffs across tracks.** A failing test codifies the bug the next track will fix; `it.failing(...)` keeps CI green while the red→green transition is pending. The agent fixing the bug flips `.failing` → `it` as part of their commit — Jest will auto-flag the mismatch if they forget.
- **Jest ignores `.claude/worktrees/`** (see `jest.config.js`). Without this, jest discovers test files in every worktree and multiplies counts by `worktree_count + 1`.

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
