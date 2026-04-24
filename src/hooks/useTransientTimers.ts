import { useEffect, useRef } from "react"

/**
 * Tracks fire-and-forget `setTimeout` calls and clears any still-pending on
 * unmount, avoiding act warnings in tests and stale setState on unmounted
 * screens after ack-scale / hint / preview-pop handoffs.
 */
export function useTransientTimers() {
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const id of timers) clearTimeout(id)
      timers.clear()
    }
  }, [])

  function scheduleTransient(fn: () => void, ms: number) {
    const id = setTimeout(() => {
      timersRef.current.delete(id)
      fn()
    }, ms)
    timersRef.current.add(id)
  }

  return scheduleTransient
}
