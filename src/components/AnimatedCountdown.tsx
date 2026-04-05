import { useEffect, useRef, useState } from "react"
import { Text, View, StyleSheet, type TextStyle } from "react-native"

import { EaseView } from "react-native-ease"

type AnimatedCountdownProps = {
  value: number
  color: string
  style?: TextStyle
}

export function AnimatedCountdown({ value, color, style }: AnimatedCountdownProps) {
  const prevValue = useRef(value)
  const [displayValue, setDisplayValue] = useState(value)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    if (value === prevValue.current) {
      return
    }

    setAnimating(true)

    const timer = setTimeout(() => {
      setDisplayValue(value)
      setAnimating(false)
    }, 150)

    prevValue.current = value
    return () => clearTimeout(timer)
  }, [value])

  return (
    <View style={styles.container}>
      <EaseView
        animate={{
          scale: animating ? 0.6 : 1,
          opacity: animating ? 0 : 1,
        }}
        transition={{
          default: { type: "spring", stiffness: 400, damping: 15, mass: 0.6 },
        }}
      >
        <Text style={[styles.text, style, { color }]}>{displayValue}</Text>
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
