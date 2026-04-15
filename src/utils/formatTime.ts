/**
 * Formats a duration in seconds to a compact display string.
 * <60s → "Ns" (e.g., "42s")
 * ≥60s → "M:SS" (e.g., "1:05")
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, "0")}`
}
