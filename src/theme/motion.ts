import type { SingleTransition } from "react-native-ease"

/**
 * Named motion presets — the shared motion language for the app.
 *
 * Usage (in EaseView `transition` prop):
 *
 *     <EaseView transition={{ default: motion.snap }} animate={{ scale }} />
 *     <EaseView transition={{ transform: motion.snap, opacity: motion.exit }} />
 *
 * Prefer a preset over inlining a config. If a one-off tuning is genuinely
 * required, add it here as a new preset rather than an inline object —
 * consistency of motion across the app is the whole point.
 *
 * Springs describe one-shot interactions (no loop); timing curves describe
 * dismissals, ambient loops, and short numeric ticks. `breathe` is the only
 * preset with `loop: "reverse"` built in — react-native-ease only supports
 * loops on timing transitions, so ambient looping idle animations live here.
 */
export const motion = {
  /** Taps, pops, pressed-state acks — personality without overshoot. */
  snap: { type: "spring", stiffness: 400, damping: 22, mass: 0.7 },
  /** Standard one-shot transitions — settles with a hint of bounce. */
  smooth: { type: "spring", stiffness: 220, damping: 20, mass: 0.9 },
  /** Hero moments (score land, CTA rise, title on game-over) — slow, weighty. */
  grand: { type: "spring", stiffness: 120, damping: 14, mass: 1.0 },
  /** Dismissals and transient hints — tight easeIn fadeout. */
  exit: { type: "timing", duration: 200, easing: "easeIn" },
  /** Numeric tick swaps (countdown, etc.) — fast enough to feel synchronous. */
  countdown: { type: "timing", duration: 80, easing: "easeOut" },
  /** Ambient idle loops — slow, symmetric, reversing. */
  breathe: { type: "timing", duration: 1500, easing: "easeInOut", loop: "reverse" },
} as const satisfies Record<string, SingleTransition>

export type MotionPreset = keyof typeof motion
