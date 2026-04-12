import { useState } from "react"
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native"
import { EaseView } from "react-native-ease"

type PressableScaleProps = PressableProps & {
  scaleDown?: number
  opacityDown?: number
  wrapperStyle?: StyleProp<ViewStyle>
}

export function PressableScale({
  scaleDown = 0.96,
  opacityDown = 0.85,
  wrapperStyle,
  children,
  disabled,
  testID,
  accessibilityLabel,
  accessibilityRole,
  accessibilityHint,
  ...rest
}: PressableScaleProps) {
  const [pressed, setPressed] = useState(false)

  return (
    <EaseView
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityHint={accessibilityHint}
      animate={{
        scale: pressed && !disabled ? scaleDown : 1,
        opacity: pressed && !disabled ? opacityDown : 1,
      }}
      transition={{
        default: { type: "spring", stiffness: 400, damping: 20, mass: 0.8 },
        opacity: { type: "timing", duration: 100, easing: "easeOut" },
      }}
      style={wrapperStyle}
    >
      <Pressable
        disabled={disabled}
        onPressIn={(e) => {
          setPressed(true)
          rest.onPressIn?.(e)
        }}
        onPressOut={(e) => {
          setPressed(false)
          rest.onPressOut?.(e)
        }}
        {...rest}
      >
        {children}
      </Pressable>
    </EaseView>
  )
}
