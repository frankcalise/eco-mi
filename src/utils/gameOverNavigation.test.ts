import { shouldFallbackToMainMenuOnGameOverExit } from "./gameOverNavigation"

describe("shouldFallbackToMainMenuOnGameOverExit", () => {
  it("falls back to main menu on an implicit exit with no pending action", () => {
    expect(
      shouldFallbackToMainMenuOnGameOverExit({
        explicitExit: false,
        pendingAction: null,
      }),
    ).toBe(true)
  })

  it("does not fall back after an explicit continue/play-again/main-menu action", () => {
    expect(
      shouldFallbackToMainMenuOnGameOverExit({
        explicitExit: true,
        pendingAction: null,
      }),
    ).toBe(false)
  })

  it("does not override an already-selected pending action", () => {
    expect(
      shouldFallbackToMainMenuOnGameOverExit({
        explicitExit: false,
        pendingAction: "continue",
      }),
    ).toBe(false)
  })
})
