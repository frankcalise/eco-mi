import { View, StyleSheet } from "react-native"
import { EaseView } from "react-native-ease"

import { colorMap, type Color } from "@/hooks/useGameEngine"
import { UI_COLORS } from "@/theme/uiColors"

type Position = "topLeft" | "topRight" | "bottomLeft" | "bottomRight"

const POSITIONS: Position[] = ["topLeft", "topRight", "bottomLeft", "bottomRight"]

type GameButtonProps = {
  color: Color
  isActive: boolean
  disabled: boolean
  buttonSize: number
  gameSize: number
  slotInset: number
  index: number
  isShuffling?: boolean
  onPressIn: () => void
  onPressOut: () => void
  themeColor?: string
  themeActiveColor?: string
}

function getSlotCoords(
  position: Position,
  buttonSize: number,
  gameSize: number,
  slotInset: number,
): { top: number; left: number } {
  const far = gameSize - buttonSize - slotInset

  switch (position) {
    case "topLeft":
      return { top: slotInset, left: slotInset }
    case "topRight":
      return { top: slotInset, left: far }
    case "bottomLeft":
      return { top: far, left: slotInset }
    case "bottomRight":
      return { top: far, left: far }
  }
}

function getBorderRadius(position: Position, buttonSize: number) {
  switch (position) {
    case "topLeft":
      return { borderTopLeftRadius: buttonSize / 2 }
    case "topRight":
      return { borderTopRightRadius: buttonSize / 2 }
    case "bottomLeft":
      return { borderBottomLeftRadius: buttonSize / 2 }
    case "bottomRight":
      return { borderBottomRightRadius: buttonSize / 2 }
  }
}

export function GameButton({
  color,
  isActive,
  disabled,
  buttonSize,
  gameSize,
  slotInset,
  index,
  isShuffling,
  onPressIn,
  onPressOut,
  themeColor,
  themeActiveColor,
}: GameButtonProps) {
  const info = colorMap[color]
  const position = POSITIONS[index]

  const displayColor = themeColor ?? info.color
  const displayActiveColor = themeActiveColor ?? info.activeColor

  const buttonStyle = {
    backgroundColor: isActive ? displayActiveColor : displayColor,
    width: buttonSize,
    height: buttonSize,
  }

  // Use topLeft as the base position for all buttons, then translate to target slot
  const baseCoords = getSlotCoords("topLeft", buttonSize, gameSize, slotInset)
  const targetCoords = getSlotCoords(position, buttonSize, gameSize, slotInset)
  const translateX = targetCoords.left - baseCoords.left
  const translateY = targetCoords.top - baseCoords.top
  const borderRadius = getBorderRadius(position, buttonSize)

  return (
    <EaseView
      animate={{
        scale: isActive ? 1.08 : 1,
        opacity: isActive ? 1 : 0.85,
        translateX,
        translateY,
      }}
      transition={{
        default: { type: "spring", stiffness: 300, damping: 20, mass: 0.8 },
        opacity: { type: "timing", duration: 150, easing: "easeOut" },
        transform: isShuffling
          ? { type: "timing", duration: 550, easing: "easeInOut" }
          : { type: "spring", stiffness: 300, damping: 20, mass: 0.8 },
      }}
      style={[
        styles.button,
        { top: baseCoords.top, left: baseCoords.left, width: buttonSize, height: buttonSize },
      ]}
    >
      <View
        testID={`btn-${color}${isActive ? "-active" : ""}`}
        style={[styles.pressable, buttonStyle, borderRadius]}
        accessible
        accessibilityLabel={color}
        accessibilityRole="button"
        onTouchStart={disabled ? undefined : () => onPressIn()}
        onTouchEnd={disabled ? undefined : () => onPressOut()}
        onTouchCancel={disabled ? undefined : () => onPressOut()}
      />
    </EaseView>
  )
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
  },
  pressable: {
    borderRadius: 20,
    elevation: 8,
    flex: 1,
    shadowColor: UI_COLORS.shadowBlack,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
})
