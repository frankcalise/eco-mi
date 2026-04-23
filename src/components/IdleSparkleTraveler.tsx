import { useEffect, useMemo, useRef, useState } from "react"
import { Animated, Easing, StyleSheet } from "react-native"

import type { GameTheme } from "@/config/themes"

const ROTATION_DURATION_MS = 6000
const QUADRANT_MS = ROTATION_DURATION_MS / 4
const DOT_SIZE = 10
// Number of waypoints used to approximate the circular orbit via piecewise
// linear interpolation. 48 samples gives a visibly-smooth circle (each step
// is 7.5° of arc) while keeping the interpolation ranges compact.
const WAYPOINTS = 48

type IdleSparkleTravelerProps = {
  gameSize: number
  slotInset: number
  theme: GameTheme
  active: boolean
}

/**
 * Ambient spark that orbits the outer ring of the pad quadrant while the
 * game is idle, paired with GameHeader's neon title color cycle to give
 * the idle screen a "breathing" feel. Stops the instant active flips
 * false so it never overlaps sequence playback.
 *
 * Positioning uses explicit sin/cos waypoints interpolated on a single
 * Animated.Value rather than a rotating parent wrapper — the earlier
 * rotate-transform approach produced a subtly off-center orbit on iPad,
 * likely because the wrapper's extent overlapped the gameContainer's
 * border in a way that shifted the rotation pivot. With direct translate
 * positioning the orbit center is whatever `gameSize/2` says it is, no
 * layout indirection.
 */
export function IdleSparkleTraveler({
  gameSize,
  slotInset,
  theme,
  active,
}: IdleSparkleTravelerProps) {
  const progress = useRef(new Animated.Value(0)).current
  const [quadrant, setQuadrant] = useState<0 | 1 | 2 | 3>(0)

  useEffect(() => {
    if (!active) {
      progress.stopAnimation()
      progress.setValue(0)
      setQuadrant(0)
      return
    }
    const spin = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: ROTATION_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    )
    spin.start()
    const colorTick = setInterval(() => {
      setQuadrant((q) => ((q + 1) % 4) as 0 | 1 | 2 | 3)
    }, QUADRANT_MS)
    return () => {
      spin.stop()
      clearInterval(colorTick)
      progress.setValue(0)
    }
  }, [active, progress])

  // Radius hugs the outer edge of the pad quadrant — 40% into the slotInset
  // gap between pad edge and container border puts the spark in the dark
  // space outside the pads but still inside the ring at every angle.
  const radius = gameSize / 2 - slotInset * 0.4

  // Pre-compute the 48 waypoints around the circle so Animated.interpolate
  // doesn't have to rebuild them each render. Start at 12 o'clock (angle 0)
  // and progress clockwise. Input domain is [0, 1] mapped to [0, 2π].
  const { translateX, translateY } = useMemo(() => {
    const inputs: number[] = []
    const xs: number[] = []
    const ys: number[] = []
    for (let i = 0; i <= WAYPOINTS; i++) {
      const t = i / WAYPOINTS
      const angle = t * 2 * Math.PI
      inputs.push(t)
      // Angle 0 = 12 o'clock (dot sits at (0, -radius) from center).
      // sin for X (east is positive), -cos for Y (north is negative).
      xs.push(radius * Math.sin(angle))
      ys.push(-radius * Math.cos(angle))
    }
    return {
      translateX: progress.interpolate({ inputRange: inputs, outputRange: xs }),
      translateY: progress.interpolate({ inputRange: inputs, outputRange: ys }),
    }
  }, [progress, radius])

  if (!active) return null

  // Colors follow the pad the spark is currently passing — red TL, blue TR,
  // yellow BR, green BL. Order matches the clockwise orbit from 12 o'clock.
  const colors = [
    theme.buttonColors.red.color,
    theme.buttonColors.blue.color,
    theme.buttonColors.yellow.color,
    theme.buttonColors.green.color,
  ]
  const color = colors[quadrant]

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          backgroundColor: color,
          shadowColor: color,
          // Base position: centered horizontally, centered vertically. The
          // translate interpolations offset the dot along a circle from here.
          top: gameSize / 2 - DOT_SIZE / 2,
          left: gameSize / 2 - DOT_SIZE / 2,
          transform: [{ translateX }, { translateY }],
        },
      ]}
    />
  )
}

const styles = StyleSheet.create({
  dot: {
    borderRadius: DOT_SIZE / 2,
    elevation: 6,
    height: DOT_SIZE,
    pointerEvents: "none",
    position: "absolute",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    width: DOT_SIZE,
    zIndex: 5,
  },
})
