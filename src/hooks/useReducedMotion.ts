import { useEffect, useState } from "react"
import { AccessibilityInfo } from "react-native"

/**
 * Subscribes to the OS "Reduce Motion" preference. Use to gate looping or
 * large-transform animations per WCAG 2.3.3 / iOS UIAccessibility.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    let cancelled = false

    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (!cancelled) setReduced(value)
    })

    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced)

    return () => {
      cancelled = true
      sub.remove()
    }
  }, [])

  return reduced
}
