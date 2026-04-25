import { View } from "react-native"
import { EaseView } from "react-native-ease"
import Svg, { Circle } from "react-native-svg"

import type { GameTheme } from "@/config/themes"
import { useReducedMotion } from "@/hooks/useReducedMotion"

interface TimerRingProps {
  progress: number
  size: number
  strokeWidth: number
  theme: GameTheme
}

// Thresholds expressed as fractions of the 60s timed budget.
// 10s remaining = 0.1666… → ring thickens
// 5s remaining = 0.0833… → ring also pulses
const URGENCY_THICKEN_THRESHOLD = 10 / 60
const URGENCY_PULSE_THRESHOLD = 5 / 60

function getRingColor(progress: number, theme: GameTheme): string {
  if (progress > 0.67) return theme.buttonColors.green.color
  if (progress > 0.33) return theme.buttonColors.yellow.color
  return theme.buttonColors.red.color
}

export function TimerRing({ progress, size, strokeWidth, theme }: TimerRingProps) {
  const reducedMotion = useReducedMotion()
  const shouldThicken = progress <= URGENCY_THICKEN_THRESHOLD
  const shouldPulse = progress <= URGENCY_PULSE_THRESHOLD && !reducedMotion

  const effectiveStrokeWidth = shouldThicken ? strokeWidth + 1 : strokeWidth
  const radius = (size - effectiveStrokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progress)
  const center = size / 2

  return (
    <EaseView
      animate={{ scale: shouldPulse ? 1.06 : 1 }}
      transition={{
        default: shouldPulse
          ? { type: "timing", duration: 500, easing: "easeInOut", loop: "reverse" }
          : { type: "timing", duration: 200, easing: "easeOut" },
      }}
    >
      <View>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={theme.borderColor}
            strokeWidth={effectiveStrokeWidth}
            fill="none"
          />
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={getRingColor(progress, theme)}
            strokeWidth={effectiveStrokeWidth}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation={-90}
            origin={`${center}, ${center}`}
          />
        </Svg>
      </View>
    </EaseView>
  )
}
