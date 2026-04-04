# Agent Prompts

> Copy-paste prompts for kicking off autonomous Claude Code sessions.

---

## Overnight Backlog Run

Use this to let the agent work through backlog tasks autonomously:

```
Work through the backlog in docs/BACKLOG.md. For each task:

1. Read the task and its Ref link in docs/VISION.md for context
2. Skip tasks with unmet "Blocked by" dependencies
3. Implement the change
4. Run verification: `npx tsc --noEmit` and `bun run test`
5. If both pass, commit with a descriptive message (feat:/fix:/refactor:/etc.)
6. Mark the task [x] in docs/BACKLOG.md
7. Append a changelog entry to CHANGELOG.md
8. Move to the next task

Stop if:
- You hit a task blocked by external action (account setup, secrets, assets)
- A verification command fails and you can't fix it in 2 attempts
- You've completed all unblocked tasks in the current phase

Do not start the next phase without stopping to report what was completed.
```

## Single Task

For running a specific backlog item:

```
Complete backlog task "[TASK NAME]" from docs/BACKLOG.md.
Read the Ref link for full context. Run verification after, commit, and update the backlog + changelog.
```

## SDK Upgrade (Phase 0)

The SDK upgrade is complex enough to warrant its own prompt:

```
Upgrade this Expo project from SDK 53 to SDK 55. Follow the backlog task in docs/BACKLOG.md Phase 0.

Steps:
1. Read the current package.json and app.json for baseline
2. Run `npx expo install expo@latest` then `npx expo install --fix`
3. Check for breaking changes in key deps: expo-router, react-native-audio-api, react-native-mmkv, react-native-reanimated
4. Update any imports or APIs that changed
5. Run `npx tsc --noEmit` and fix type errors
6. Run `bun run test` and fix failing tests
7. Enable React Compiler (check SDK 55 docs for the config flag)
8. Verify the app builds: `npx expo export --platform web`
9. Commit, update backlog, update changelog

If a dependency doesn't support RN 0.84 yet, document it and find a workaround or pin the version.
```

## Resume After Overnight Run

Check what the agent accomplished:

```
Read CHANGELOG.md and docs/BACKLOG.md. Summarize:
1. Which tasks were completed overnight
2. Which tasks were skipped and why
3. What's next in the backlog
4. Any issues or blockers encountered
```
