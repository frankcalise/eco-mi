import { Platform, StyleSheet } from "react-native"
import { EaseView } from "react-native-ease"
import Svg, { RadialGradient, Rect, Stop } from "react-native-svg"

// Extends the glow 12% past the pad edge so the Android halo roughly matches
// iOS's shadowRadius 22 output at current buttonSize ranges. Any larger and
// the halo spills past the gameContainer ring on the outer cardinal points
// and into adjacent pads on the inner diagonals. Pad edge ends up at
// 50/62 ≈ 81% along the radial gradient, which is where the brightest
// visible stop lands.
const GLOW_INFLATE_RATIO = 0.12

type PadGlowProps = {
  color: string
  isActive: boolean
  buttonSize: number
  /** Needed to namespace the SVG gradient id per pad instance. */
  padId: string
}

/**
 * Soft colored halo for a game pad on Android.
 *
 * On iOS the pad's native `shadowColor` already emits a perfectly
 * shape-matched colored glow for free. Android ignores shadowColor and falls
 * back to a grey elevation-only shadow, so we render a react-native-svg
 * radial gradient behind the pad as a cross-platform substitute. Only
 * mounted on Android; returns null on iOS.
 *
 * The gradient is circular by construction; the pad's quadrant shape sits
 * on top of it, so what the user sees is the outer ring of the gradient
 * that extends past the pad edge — a soft feathered aura. Stops place the
 * peak brightness right at the pad boundary and fade to zero at the
 * gradient edge, so no sharp corners bleed into the cross-gap.
 */
export function PadGlow({ color, isActive, buttonSize, padId }: PadGlowProps) {
  if (Platform.OS !== "android") return null

  const inflate = buttonSize * GLOW_INFLATE_RATIO
  const glowSize = buttonSize + inflate * 2
  const gradientId = `pad-glow-${padId}`

  return (
    <EaseView
      animate={{ opacity: isActive ? 1 : 0 }}
      transition={{ default: { type: "timing", duration: 150, easing: "easeOut" } }}
      style={[
        styles.container,
        { top: -inflate, left: -inflate, width: glowSize, height: glowSize },
      ]}
    >
      <Svg width={glowSize} height={glowSize}>
        {/* Defs would be semantically correct here but its react-native-svg
          typings don't declare `children`. `id` + url(#id) referencing still
          works when the gradient is a direct Svg child. */}
        <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          <Stop offset="60%" stopColor={color} stopOpacity="0.55" />
          <Stop offset="81%" stopColor={color} stopOpacity="0.45" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </RadialGradient>
        <Rect width={glowSize} height={glowSize} fill={`url(#${gradientId})`} />
      </Svg>
    </EaseView>
  )
}

const styles = StyleSheet.create({
  container: {
    pointerEvents: "none",
    position: "absolute",
  },
})
