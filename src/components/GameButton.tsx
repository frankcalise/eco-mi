import { Pressable, StyleSheet } from "react-native"

import { EaseView } from "react-native-ease"

import { colorMap, type Color } from "@/hooks/useGameEngine"

type Position = "topLeft" | "topRight" | "bottomLeft" | "bottomRight"

const POSITIONS: Position[] = ["topLeft", "topRight", "bottomLeft", "bottomRight"]

type GameButtonProps = {
  color: Color
  isActive: boolean
  disabled: boolean
  buttonSize: number
  gameSize: number
  index: number
  onPressIn: () => void
  onPressOut: () => void
  themeColor?: string
  themeActiveColor?: string
}

export function GameButton({
  color,
  isActive,
  disabled,
  buttonSize,
  gameSize,
  index,
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

  const positionStyle = getPositionStyle(position, buttonSize, gameSize)

  return (
    <EaseView
      animate={{
        scale: isActive ? 1.08 : 1,
        opacity: isActive ? 1 : 0.85,
      }}
      transition={{
        default: { type: "spring", stiffness: 300, damping: 20, mass: 0.8 },
        opacity: { type: "timing", duration: 150, easing: "easeOut" },
      }}
      style={[styles.button, positionStyle, { width: buttonSize, height: buttonSize }]}
    >
      <Pressable
        testID={`btn-${color}${isActive ? "-active" : ""}`}
        style={[styles.pressable, buttonStyle]}
        disabled={disabled}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      />
    </EaseView>
  )
}

function getPositionStyle(
  position: Position,
  buttonSize: number,
  gameSize: number,
) {
  const offset = gameSize * 0.05
  switch (position) {
    case "topLeft":
      return { top: offset, left: offset, borderTopLeftRadius: buttonSize / 2 }
    case "topRight":
      return { top: offset, right: offset, borderTopRightRadius: buttonSize / 2 }
    case "bottomLeft":
      return { bottom: offset, left: offset, borderBottomLeftRadius: buttonSize / 2 }
    case "bottomRight":
      return { bottom: offset, right: offset, borderBottomRightRadius: buttonSize / 2 }
  }
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
  },
  pressable: {
    borderRadius: 20,
    elevation: 8,
    flex: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
})
