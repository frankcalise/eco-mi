import { View, StyleSheet } from "react-native"
import { useTranslation } from "react-i18next"
import { EaseView } from "react-native-ease"

import { PadGlow } from "@/components/PadGlow"
import { PadGlyph } from "@/components/PadGlyph"
import { colorMap, type Color } from "@/hooks/useGameEngine"
import { useReducedMotion } from "@/hooks/useReducedMotion"
import { UI_COLORS } from "@/theme/uiColors"
import { getPadLabel } from "@/utils/a11y"
import { getReadableForeground } from "@/utils/color"

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
  themeGlowColor?: string
  showPattern?: boolean
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
  themeGlowColor,
  showPattern,
}: GameButtonProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const info = colorMap[color]
  const position = POSITIONS[index]

  const displayColor = themeColor ?? info.color
  const displayActiveColor = themeActiveColor ?? info.activeColor
  const displayGlowColor = themeGlowColor ?? displayActiveColor

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
        default: reducedMotion
          ? { type: "timing", duration: 0 }
          : { type: "spring", stiffness: 300, damping: 20, mass: 0.8 },
        opacity: reducedMotion
          ? { type: "timing", duration: 0 }
          : { type: "timing", duration: 150, easing: "easeOut" },
        transform: reducedMotion
          ? { type: "timing", duration: 0 }
          : isShuffling
            ? { type: "timing", duration: 550, easing: "easeInOut" }
            : { type: "spring", stiffness: 300, damping: 20, mass: 0.8 },
      }}
      style={[
        styles.button,
        { top: baseCoords.top, left: baseCoords.left, width: buttonSize, height: buttonSize },
      ]}
    >
      <PadGlow color={displayGlowColor} isActive={isActive} buttonSize={buttonSize} padId={color} />
      {showPattern && (
        <PadGlyph
          position={position}
          buttonSize={buttonSize}
          color={getReadableForeground(displayColor)}
        />
      )}
      <View
        testID={`btn-${color}${isActive ? "-active" : ""}`}
        style={[
          styles.pressable,
          buttonStyle,
          borderRadius,
          // iOS: colored shadow radiating from the pad's exact quadrant shape
          // gives a soft feathered glow on all sides — no sharp edges, no
          // separate halo layer needed. Android ignores shadowColor and falls
          // back to the grey elevation; accepted tradeoff vs. the visual cost
          // of a solid overlay's right-angle corners into the cross-gap.
          { shadowColor: isActive ? displayGlowColor : UI_COLORS.shadowBlack },
          isActive && styles.pressableActive,
        ]}
        accessible
        accessibilityLabel={getPadLabel(t, color, position)}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  pressableActive: {
    // Reset offset to {0,0} so the glow radiates evenly on all sides rather
    // than biasing downward from the default {0,4}. Opacity + radius cranked
    // to make the bloom actually visible — the pad's own activeColor is a
    // lighter/pastel variant of its base (vivid red → pastel red etc.), so
    // without a strong shadow the active state just reads as "dimmed" not
    // "lit up."
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 22,
  },
})
