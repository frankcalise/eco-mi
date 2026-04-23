# Subagent Brief Template

Reusable scaffold for dispatching parallel subagents on isolated git worktrees. Use this when orchestrating multiple independent fixes, refactors, or polish passes that can run in parallel. For single-task work that wouldn't benefit from parallelism, just edit directly — this overhead isn't worth it.

Pairs with the **Parallel Subagent Work** section of `CLAUDE.md` (the rules the orchestrator and every agent must follow).

---

## Orchestrator pre-flight checklist

Before spawning any agents, the orchestrator runs through this:

- [ ] **File-footprint map.** For each planned track, list the exact files it will touch. Build a matrix: tracks × files. Any cell with overlap across tracks means those tracks cannot run in parallel — either bundle them into one track or serialize.
- [ ] **Cross-cutting work identified.** If a change touches 3+ files across track boundaries (e.g. "void-wrap every async `onPress` in the repo"), it is NOT a parallel track. Schedule it sequentially after the parallel wave merges.
- [ ] **Test scaffolding landed.** Any failing/regression test that a track needs to flip green should be committed to `develop` first, wrapped in `it.failing()` where appropriate, so the track has a concrete red→green signal to work against. See the `test: add prep coverage for parallel bug-fix tracks` commit pattern.
- [ ] **`develop` is at the commit you want agents to branch from.** Worktrees initialize on whatever commit the runtime picks, which is often stale. The brief explicitly tells agents to branch off `develop`, but the orchestrator should confirm `develop` itself is the intended base.
- [ ] **`jest.config.js` ignores `.claude/worktrees/`.** Without this, `bun run test` in the main repo discovers test files in every spawned worktree and multiplies counts. One-time setup; verify on new repos.
- [ ] **Brief length.** Each brief should fit in ~500 words. If it's longer, the scope is too big — split the track.

## Merge orchestration (post-agent)

After agents return:

- [ ] **Diff-audit each branch.** `git log --oneline develop..<branch>` + `git diff --name-only develop..<branch>`. Confirm file footprint matches what the brief authorized. Reject silently-expanded scope.
- [ ] **Merge order: smallest first.** Start with the track that touches the fewest files — catches infra issues (e.g. jest config side effects) before bigger merges compound.
- [ ] **Run `bun run test` + `npx tsc --noEmit` after EACH merge.** Some errors only surface in the main repo's dependency tree (a track passing its own worktree `tsc` is not sufficient). If a merge introduces regressions vs baseline, commit a targeted fix-forward on `develop` rather than reverting — preserves the track's authored work and keeps history linear.
- [ ] **Prune worktrees after integration.** `git worktree remove --force <path>` once the branch is merged and no further agent messages are expected.

---

## The brief (copy, fill, paste)

Replace every `{{FIELD}}`. Delete inline `<!-- ... -->` guidance comments before sending.

```
You're {{ONE_LINE_TASK_SUMMARY}} in Eco Mi. You'll work on a git worktree (isolated from main), commit your work on a branch `{{BRANCH_NAME}}`, and report back — do NOT push, do NOT merge.

<!-- First instruction MUST be the branch-off-develop-tip rule. Worktrees often
     initialize on stale commits; without this, agents silently build on ancient
     code. This was the #1 failure mode across the first parallel wave. -->
**Before editing anything:** run `git checkout -b {{BRANCH_NAME}} develop` so your branch is cut from develop's current tip, not the worktree's starting HEAD. Also run `bun install` in the worktree if `node_modules` is absent.

**Repo context:** /Users/fcalise/code/EcoMi — Expo SDK 55 Simon-style memory game. React Compiler enabled (do NOT use `useMemo`/`useCallback`/`React.memo` per `CLAUDE.md`). Read `CLAUDE.md` before editing — pay attention to the lint baseline policy and the Parallel Subagent Work section.

**Task(s) to fix (all in `{{FILE_OR_FILES}}`):**

<!-- For each bug/task: a short heading, file:line, the failure mode in one
     sentence, the fix approach in one sentence. Cite any existing patterns in
     the file the agent should mirror (e.g. "there's already a `fooRef` at line
     X — follow that pattern for `bar`"). -->

**{{TASK_ID}} — {{TASK_TITLE}}** at `{{FILE}}:{{LINE_RANGE}}`. {{FAILURE_MODE_IN_ONE_SENTENCE}}. Fix: {{APPROACH_IN_ONE_SENTENCE}}. {{EXISTING_PATTERN_TO_MIRROR_IF_ANY}}.

{{REPEAT_FOR_EACH_TASK}}

**Tests you MUST keep green:** all {{N}} tests currently passing on develop. Run `bun run test` before and after your changes to confirm.
{{LIST_SPECIFIC_TESTS_CLOSEST_TO_YOUR_CHANGES}}

**New tests you SHOULD add:** {{OR_OMIT_IF_NONE}}
- {{TEST_1_DESCRIPTION}}
- {{TEST_2_DESCRIPTION}}

<!-- If there's an existing `it.failing()` test that will flip to `it` as part
     of your fix, CALL IT OUT EXPLICITLY — agents have missed this handoff
     before. Include the test name, the file, and the exact line to flip. -->
**Test handoff (if applicable):** The test `{{TEST_NAME}}` in `{{TEST_FILE}}` is marked `it.failing` because it codifies the *fixed* behavior of this bug. When your fix lands, the test will start passing and Jest will flag `.failing` as wrong. You must flip `.failing` to `it` in the same commit as your fix.

**Verification contract:**
1. `npx tsc --noEmit` — baseline is {{N}} pre-existing errors ({{LIST_THEM}}). After your fix, still exactly {{N}} errors, same files. No new ones.
2. `bun run test` — all passing, plus any you add.
3. Lint on changed files: no new errors. Pre-existing warnings on the files you touch are baseline per `CLAUDE.md`; don't fix them unless your change naturally resolves them.

<!-- The tsc baseline MUST be stated numerically. Agents that are told "2
     pre-existing errors" but see 3 in their environment will assume the
     difference is their fault. Be explicit about what's expected. -->

**Commit & branch:**
- Branch `{{BRANCH_NAME}}` off develop (see first instruction).
- {{N_COMMITS}} commits ideal (one per concern if they cleanly separate, or bundled if the fix is naturally atomic). Prefix: `{{COMMIT_PREFIX}}` (e.g. `fix(game-engine):`).
- Commit bodies must explain the *why* — what user-facing failure does this prevent, or what future regression does it guard against? Not just what changed.
- Include `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` as the final line of every commit message.
- **DO NOT push to remote. DO NOT merge to develop.** The orchestrator handles integration.

**Scope discipline:** Only {{AUTHORIZED_FILES}}. Do NOT touch {{EXPLICITLY_OUT_OF_SCOPE_FILES_IF_RISK}}. Do NOT fix pre-existing lint errors in files you aren't otherwise modifying (per CLAUDE.md). Do NOT refactor beyond the task scope.

**Report back** with exactly these fields:
- **Branch:** {{BRANCH_NAME}}
- **Commits** (oldest to newest): SHA + subject for each
- **Files changed:** full paths
- **Verification results:** `tsc` error count, `test` pass count (e.g. "127/127 passing"), lint summary
- **Approach / strategy:** 2-3 sentences on what you chose and why
- **Surprises or gotchas:** anything that didn't match the brief's assumptions, e.g. the worktree started on a stale commit, a pattern that didn't apply, an unexpected test failure you had to investigate
- **What you deliberately skipped and why** (if anything — the brief's escape hatches like "don't force a test if mocks are too heavy" should be explicitly noted)
```

---

## Worked example

The five briefs from the 2026-04-23 parallel wave live in the commit history — see commits that merged `fix/engine-stale-closures`, `fix/ads-error-retry-and-cleanup`, `fix/game-over-renders-and-share`, `fix/game-screen-stale-closures`, `fix/misc-correctness`. Read them as reference when filling this template.

## Known failure modes (add as they're observed)

- **Worktree initializes on a stale commit.** All five agents in the 2026-04-23 wave had to self-correct this by branching off `develop` explicitly. The first instruction of every brief must address it. (Codified in `CLAUDE.md` → Parallel Subagent Work.)
- **Agent's local `tsc` passes but post-merge `tsc` fails.** The dual-package `@react-navigation/native-stack` issue that bit Track 4's `as any` removal only surfaced once the work merged into the main repo's dependency tree. The orchestrator must re-verify after every merge — agent-side verification is necessary but not sufficient.
- **Agents silently expand scope.** Watch for files touched outside the brief's authorized set. The post-merge `git diff --name-only develop..<branch>` check catches this.
- **Forgetting the `it.failing` → `it` flip.** Agents have skipped this handoff because it wasn't stated prominently enough. Always call it out in a dedicated "Test handoff" section, not buried in the test list.
- **Generic commit messages.** Agents sometimes write "fix: update X" without the *why*. The brief must say "explain the user-facing failure this prevents" not just "good commit message."
