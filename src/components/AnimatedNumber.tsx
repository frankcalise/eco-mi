import { useEffect, useRef, useState } from "react"
import { Text, View, StyleSheet, type StyleProp, type TextStyle } from "react-native"
import { EaseView } from "react-native-ease"

const SLIDE_DISTANCE = 14
const PHASE_DURATION = 150

type Phase = "idle" | "out" | "in"

type AnimatedNumberProps = {
  value: number
  style?: StyleProp<TextStyle>
  testID?: string
  accessibilityLabel?: string
}

export function AnimatedNumber({ value, style, testID, accessibilityLabel }: AnimatedNumberProps) {
  const prevValue = useRef(value)
  const [displayValue, setDisplayValue] = useState(value)
  const [phase, setPhase] = useState<Phase>("idle")

  useEffect(() => {
    if (value === prevValue.current) {
      setDisplayValue(value)
      return
    }

    // Phase 1: slide old value up and fade out
    setPhase("out")

    const swapTimer = setTimeout(() => {
      // Swap to new value and start slide-in
      setDisplayValue(value)
      setPhase("in")
    }, PHASE_DURATION)

    const settleTimer = setTimeout(() => {
      setPhase("idle")
    }, PHASE_DURATION * 2)

    prevValue.current = value
    return () => {
      clearTimeout(swapTimer)
      clearTimeout(settleTimer)
    }
  }, [value])

  // "out" → old value slides up, fades out
  // "in"  → new value is present but EaseView transitions from out-state to idle-state
  //          since opacity was 0 during "out", the text swap is invisible
  // "idle" → resting state, fully visible at y=0
  const translateY = phase === "out" ? -SLIDE_DISTANCE : 0
  const opacity = phase === "out" ? 0 : 1

  return (
    <View style={localStyles.container}>
      <EaseView
        animate={{ translateY, opacity }}
        transition={{
          default: {
            type: "spring",
            stiffness: 300,
            damping: 20,
            mass: 0.8,
          },
        }}
      >
        <Text testID={testID} accessibilityLabel={accessibilityLabel} style={style}>
          {displayValue}
        </Text>
      </EaseView>
    </View>
  )
}

const localStyles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
})
