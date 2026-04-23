/** @type {import('@jest/types').Config.ProjectConfig} */
module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/test/setup.ts"],
  // Agent worktrees under .claude/worktrees are full repo copies — jest would
  // discover their duplicated __tests__ folders without this guard.
  testPathIgnorePatterns: ["/node_modules/", "/.claude/worktrees/"],
}
