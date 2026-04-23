import { useEffect, useState } from "react"
import { StyleSheet } from "react-native"
import { EaseView } from "react-native-ease"

import type { GameTheme } from "@/config/themes"

// Four clockwise waypoints matching the canonical pad positions:
// red (TL) → blue (TR) → yellow (BR) → green (BL) → red (TL).
// Order matters for both the positions array below and the colors that
// correspond to each phase — the traveler's color tracks the pad it
// currently occupies, not the one it just left.
type Phase = 0 | 1 | 2 | 3
const PHASES: Phase[] = [0, 1, 2, 3]
const PHASE_INTERVAL_MS = 1100
const TRAVEL_DURATION_MS = 800
const DOT_SIZE = 10

type IdleSparkleTravelerProps = {
  gameSize: number
  buttonSize: number
  slotInset: number
  theme: GameTheme
  active: boolean
}

/**
 * An ambient traveler that hops between the four pad centers while the game
 * is idle, pulsing each pad's color on arrival. Gives the main menu a
 * "game breathing while you're away" feel that pairs with the neon title
 * color cycle. Pauses immediately when the game starts, so there's no
 * overlap with sequence playback.
 *
 * Kept intentionally simple (position keyframes, no curved path) so it
 * reads as deliberate rhythm rather than a loose wandering. Render inside
 * the game container as the last child so it layers above the pads; the
 * pointerEvents:none style block keeps it from intercepting pad taps.
 */
export function IdleSparkleTraveler({
  gameSize,
  buttonSize,
  slotInset,
  theme,
  active,
}: IdleSparkleTravelerProps) {
  const [phase, setPhase] = useState<Phase>(0)

  useEffect(() => {
    if (!active) {
      setPhase(0)
      return
    }
    const id = setInterval(() => {
      setPhase((prev) => ((prev + 1) % PHASES.length) as Phase)
    }, PHASE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [active])

  if (!active) return null

  // Pad centers in gameContainer-local coordinates. Matches the slot geometry
  // in GameButton.getSlotCoords but reads the *center* of each pad, not the
  // outer corner, so the dot visually lands on the pad face.
  const near = slotInset + buttonSize / 2
  const far = gameSize - slotInset - buttonSize / 2
  const centers = [
    { x: near, y: near }, // red, TL
    { x: far, y: near }, // blue, TR
    { x: far, y: far }, // yellow, BR
    { x: near, y: far }, // green, BL
  ]
  const colors = [
    theme.buttonColors.red.color,
    theme.buttonColors.blue.color,
    theme.buttonColors.yellow.color,
    theme.buttonColors.green.color,
  ]

  const target = centers[phase]
  const color = colors[phase]

  return (
    <EaseView
      animate={{
        translateX: target.x - DOT_SIZE / 2,
        translateY: target.y - DOT_SIZE / 2,
        scale: 1,
      }}
      transition={{
        default: { type: "timing", duration: TRAVEL_DURATION_MS, easing: "easeInOut" },
        transform: { type: "timing", duration: TRAVEL_DURATION_MS, easing: "easeInOut" },
      }}
      style={[
        styles.traveler,
        {
          backgroundColor: color,
          // iOS colored shadow gives the traveler a soft halo that matches
          // the pad it's visiting. Android falls back to the elevation-only
          // grey shadow; harmless, just less bloomy.
          shadowColor: color,
        },
      ]}
    />
  )
}

const styles = StyleSheet.create({
  traveler: {
    borderRadius: DOT_SIZE / 2,
    elevation: 6,
    height: DOT_SIZE,
    left: 0,
    pointerEvents: "none",
    position: "absolute",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    top: 0,
    width: DOT_SIZE,
    zIndex: 5,
  },
})
