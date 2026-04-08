import Svg, { Circle } from "react-native-svg"

import type { GameTheme } from "@/config/themes"

interface TimerRingProps {
  progress: number
  size: number
  strokeWidth: number
  theme: GameTheme
}

function getRingColor(progress: number, theme: GameTheme): string {
  if (progress > 0.67) return theme.buttonColors.green.color
  if (progress > 0.33) return theme.buttonColors.yellow.color
  return theme.buttonColors.red.color
}

export function TimerRing({ progress, size, strokeWidth, theme }: TimerRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progress)
  const center = size / 2

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={center}
        cy={center}
        r={radius}
        stroke={theme.borderColor}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={center}
        cy={center}
        r={radius}
        stroke={getRingColor(progress, theme)}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        rotation={-90}
        origin={`${center}, ${center}`}
      />
    </Svg>
  )
}
