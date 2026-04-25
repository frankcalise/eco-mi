import { StyleSheet, View } from "react-native"
import Svg, { Circle, Polygon, Rect } from "react-native-svg"

import type { PadPosition } from "@/utils/a11y"

type PadGlyphProps = {
  position: PadPosition
  buttonSize: number
  color: string
}

const GLYPH_SIZE_RATIO = 0.32
const GLYPH_OPACITY = 0.55
const STROKE_WIDTH_RATIO = 0.12

/**
 * Position-keyed shape overlay for colorblind play. Each pad gets a unique
 * silhouette so a player who cannot distinguish the four pad colors can still
 * read which pad just lit up. Hidden by default; gated by the
 * `colorblindPatternsEnabled` preference. WCAG 1.4.1 (Use of Color).
 */
export function PadGlyph({ position, buttonSize, color }: PadGlyphProps) {
  const size = Math.round(buttonSize * GLYPH_SIZE_RATIO)
  const stroke = Math.max(2, Math.round(size * STROKE_WIDTH_RATIO))
  const half = size / 2
  const inset = stroke / 2

  return (
    <View
      pointerEvents="none"
      style={[
        styles.container,
        {
          width: size,
          height: size,
          opacity: GLYPH_OPACITY,
        },
      ]}
    >
      <Svg width={size} height={size}>
        {position === "topLeft" && (
          <Circle
            cx={half}
            cy={half}
            r={half - inset}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
          />
        )}
        {position === "topRight" && (
          <Rect
            x={inset}
            y={inset}
            width={size - stroke}
            height={size - stroke}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
          />
        )}
        {position === "bottomLeft" && (
          <Polygon
            points={`${half},${inset} ${size - inset},${size - inset} ${inset},${size - inset}`}
            stroke={color}
            strokeWidth={stroke}
            strokeLinejoin="round"
            fill="none"
          />
        )}
        {position === "bottomRight" && (
          <Polygon
            points={`${half},${inset} ${size - inset},${half} ${half},${size - inset} ${inset},${half}`}
            stroke={color}
            strokeWidth={stroke}
            strokeLinejoin="round"
            fill="none"
          />
        )}
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
  },
})
