import type { PendingGameAction } from "@/stores/pendingActionStore"

export function shouldFallbackToMainMenuOnGameOverExit({
  explicitExit,
  pendingAction,
}: {
  explicitExit: boolean
  pendingAction: PendingGameAction | null
}): boolean {
  return !explicitExit && !pendingAction
}
