import { View, Pressable, StyleSheet } from "react-native"

import { colorMap, type Color } from "@/hooks/useGameEngine"

type GameButtonProps = {
  color: Color
  isActive: boolean
  disabled: boolean
  buttonSize: number
  gameSize: number
  onPressIn: () => void
  onPressOut: () => void
}

const positionMap = {
  topLeft: "topLeft",
  topRight: "topRight",
  bottomLeft: "bottomLeft",
  bottomRight: "bottomRight",
} as const

export function GameButton({
  color,
  isActive,
  disabled,
  buttonSize,
  gameSize,
  onPressIn,
  onPressOut,
}: GameButtonProps) {
  const info = colorMap[color]
  const position = info.position

  const buttonStyle = {
    backgroundColor: isActive ? info.activeColor : info.color,
    width: buttonSize,
    height: buttonSize,
    ...(isActive ? { transform: [{ scale: 1.05 as const }] } : {}),
  }

  const positionStyle = getPositionStyle(position, buttonSize, gameSize)

  return (
    <Pressable
      testID={`btn-${color}${isActive ? "-active" : ""}`}
      style={[styles.button, buttonStyle, positionStyle]}
      disabled={disabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      {isActive && <View style={styles.activeIndicator} />}
    </Pressable>
  )
}

function getPositionStyle(
  position: keyof typeof positionMap,
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
  activeIndicator: {
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 8,
    height: 16,
    left: "50%",
    position: "absolute",
    top: "50%",
    transform: [{ translateX: -8 }, { translateY: -8 }],
    width: 16,
  },
  button: {
    borderRadius: 20,
    elevation: 8,
    position: "absolute",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
})
