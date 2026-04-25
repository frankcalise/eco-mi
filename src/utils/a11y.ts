import type { TFunction } from "i18next"

import type { Color } from "@/hooks/useGameEngine"

export type PadPosition = "topLeft" | "topRight" | "bottomLeft" | "bottomRight"

const POSITION_KEY: Record<PadPosition, string> = {
  topLeft: "a11y:padPositionTopLeft",
  topRight: "a11y:padPositionTopRight",
  bottomLeft: "a11y:padPositionBottomLeft",
  bottomRight: "a11y:padPositionBottomRight",
}

export function getPadPositionLabel(t: TFunction, position: PadPosition): string {
  return t(POSITION_KEY[position])
}

export function getPadLabel(t: TFunction, color: Color, position: PadPosition): string {
  return t("a11y:padLabel", {
    color: t(`a11y:padColor_${color}`),
    position: getPadPositionLabel(t, position),
  })
}
