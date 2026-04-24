import { useEffect, useRef, useState } from "react"
import { Text, View, StyleSheet, type TextStyle } from "react-native"
import { EaseView } from "react-native-ease"

import { useTheme } from "@/hooks/useTheme"
import { motion } from "@/theme/motion"

type AnimatedCountdownProps = {
  value: number
  color: string
  style?: TextStyle
}

export function AnimatedCountdown({ value, color, style }: AnimatedCountdownProps) {
  const { activeTheme } = useTheme()
  const prevValue = useRef(value)
  const [displayValue, setDisplayValue] = useState(value)
  const [phase, setPhase] = useState<"idle" | "fade" | "bump">("idle")

  const delta = Math.abs(value - prevValue.current)
  const isSmallDelta = delta <= 1

  useEffect(() => {
    if (value === prevValue.current) {
      return
    }

    if (isSmallDelta) {
      setDisplayValue(value)
      setPhase("bump")
      prevValue.current = value

      const settle = setTimeout(() => setPhase("idle"), 140)
      return () => clearTimeout(settle)
    }

    setPhase("fade")
    const swap = setTimeout(() => {
      setDisplayValue(value)
      setPhase("idle")
    }, motion.countdown.duration)

    prevValue.current = value
    return () => clearTimeout(swap)
  }, [value, isSmallDelta])

  const resolvedColor =
    color === "#ef4444"
      ? activeTheme.destructiveColor
      : color === "#fbbf24"
        ? activeTheme.warningColor
        : color

  return (
    <View style={styles.container}>
      <EaseView
        animate={{
          scale: phase === "fade" ? 0.6 : phase === "bump" ? 1.1 : 1,
          opacity: phase === "fade" ? 0 : 1,
        }}
        transition={{ default: motion.countdown }}
      >
        <Text style={[styles.text, style, { color: resolvedColor }]}>{displayValue}</Text>
      </EaseView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontFamily: "Oxanium-Bold",
    fontSize: 24,
  },
})
