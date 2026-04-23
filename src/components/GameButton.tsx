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

  // Glow halo — a colored bloom layered behind the pad that pops in when active.
  // Sized 20% beyond the pad so it reads as an aura, not an outline. Uses a
  // snappier spring than the pad body so the glow feels like a sharp pop while
  // the pad itself settles more softly. When inactive it scales down + fades so
  // it doesn't bleed into neighbors during the ~1s between rounds.
  const glowInflate = buttonSize * 0.2
  const glowSize = buttonSize + glowInflate * 2
  const glowRadius = buttonSize / 2 + glowInflate

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
      <EaseView
        animate={{
          opacity: isActive ? 0.65 : 0,
          scale: isActive ? 1 : 0.9,
        }}
        transition={{
          default: { type: "spring", stiffness: 500, damping: 22, mass: 0.5 },
          opacity: { type: "timing", duration: 120, easing: "easeOut" },
        }}
        style={[
          styles.glow,
          getGlowBorderRadius(position, glowRadius),
          {
            backgroundColor: displayActiveColor,
            width: glowSize,
            height: glowSize,
            top: -glowInflate,
            left: -glowInflate,
          },
        ]}
      />
      <View
        testID={`btn-${color}${isActive ? "-active" : ""}`}
        style={[
          styles.pressable,
          buttonStyle,
          borderRadius,
          // iOS: colored shadow adds depth on the active pad. Android's elevation
          // shadow is always grey so this only visibly affects iOS — harmless on
          // Android (shadowColor is a no-op when elevation is set).
          { shadowColor: isActive ? displayActiveColor : UI_COLORS.shadowBlack },
          isActive && styles.pressableActive,
        ]}
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

function getGlowBorderRadius(position: Position, radius: number) {
  // Match the pad's outer corner curvature so the glow traces the pad's outer
  // edge rather than extending a square halo into the center.
  switch (position) {
    case "topLeft":
      return { borderTopLeftRadius: radius }
    case "topRight":
      return { borderTopRightRadius: radius }
    case "bottomLeft":
      return { borderBottomLeftRadius: radius }
    case "bottomRight":
      return { borderBottomRightRadius: radius }
  }
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
  },
  glow: {
    pointerEvents: "none",
    position: "absolute",
  },
  pressable: {
    borderRadius: 20,
    elevation: 8,
    flex: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  pressableActive: {
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
})
