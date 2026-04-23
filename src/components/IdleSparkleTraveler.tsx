import { useEffect, useRef, useState } from "react"
import { Animated, Easing, StyleSheet } from "react-native"

import type { GameTheme } from "@/config/themes"

const ROTATION_DURATION_MS = 6000
const QUADRANT_MS = ROTATION_DURATION_MS / 4
const DOT_SIZE = 10

type IdleSparkleTravelerProps = {
  gameSize: number
  slotInset: number
  theme: GameTheme
  active: boolean
}

/**
 * An ambient spark that traces the outer ring of the pad quadrant while the
 * game is idle, smoothly orbiting around the pads. Pairs with GameHeader's
 * neon title color cycle so the idle screen reads as "alive" rather than
 * static.
 *
 * Uses a rotating parent View to get a continuous circular path for free:
 * the dot is pinned at the top (12 o'clock) of a `gameSize`-wide wrapper,
 * and `Animated.loop` spins the wrapper around its center. Stops the
 * instant `active` flips false so there's no overlap with real sequence
 * playback.
 *
 * Dot color follows the quadrant the dot is currently in — red (TL, 12→3),
 * blue (TR, 3→6), yellow (BR, 6→9), green (BL, 9→12) — via a parallel
 * setInterval that advances every quarter-revolution. Color transitions
 * are instant; the visual continuity comes from the smooth orbit.
 */
export function IdleSparkleTraveler({
  gameSize,
  slotInset,
  theme,
  active,
}: IdleSparkleTravelerProps) {
  const rotation = useRef(new Animated.Value(0)).current
  const [quadrant, setQuadrant] = useState<0 | 1 | 2 | 3>(0)

  useEffect(() => {
    if (!active) {
      rotation.stopAnimation()
      rotation.setValue(0)
      setQuadrant(0)
      return
    }
    const spin = Animated.loop(
      Animated.timing(rotation, {
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
      rotation.setValue(0)
    }
  }, [active, rotation])

  if (!active) return null

  // Colors are positional to match which pad the spark is currently orbiting
  // through: red TL, blue TR, yellow BR, green BL. Order mirrors the pad
  // layout in GameButton.getSlotCoords.
  const colors = [
    theme.buttonColors.red.color,
    theme.buttonColors.blue.color,
    theme.buttonColors.yellow.color,
    theme.buttonColors.green.color,
  ]
  const color = colors[quadrant]

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  })

  // Radius: just inside the container's outer edge, so the spark reads as
  // hugging the pads' outer rounded corners rather than floating in space
  // or sitting on top of the pad faces. `slotInset` is the gap between the
  // pad and the container edge; pulling the spark ~40% into that gap puts
  // it on the outer curve of each pad.
  const radius = gameSize / 2 - slotInset * 0.4

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          width: gameSize,
          height: gameSize,
          transform: [{ rotate: spin }],
        },
      ]}
      pointerEvents="none"
    >
      <Animated.View
        style={[
          styles.dot,
          {
            backgroundColor: color,
            shadowColor: color,
            top: gameSize / 2 - radius - DOT_SIZE / 2,
            left: gameSize / 2 - DOT_SIZE / 2,
          },
        ]}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  dot: {
    borderRadius: DOT_SIZE / 2,
    elevation: 6,
    height: DOT_SIZE,
    position: "absolute",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    width: DOT_SIZE,
  },
  wrapper: {
    left: 0,
    pointerEvents: "none",
    position: "absolute",
    top: 0,
    zIndex: 5,
  },
})
