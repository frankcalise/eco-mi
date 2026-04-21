import { useEffect, useState } from "react"

type UseGameBoardMetricsParams = {
  availableWidth: number
  availableHeight: number
  freeze: boolean
}

type GameBoardMetrics = {
  gameSize: number
  buttonSize: number
  centerDiameter: number
  centerDiameterNoRing: number
  ringSize: number
  borderWidth: number
  centerTranslateOffset: number
  slotInset: number
}

const DEFAULT_METRICS: GameBoardMetrics = {
  gameSize: 240,
  buttonSize: 96,
  centerDiameter: 62,
  centerDiameterNoRing: 56,
  ringSize: 62,
  borderWidth: 4,
  centerTranslateOffset: 31,
  slotInset: 12,
}

function roundToEven(value: number) {
  return Math.round(value / 2) * 2
}

function computeMetrics(availableWidth: number, availableHeight: number): GameBoardMetrics {
  const safeWidth = Math.max(availableWidth, DEFAULT_METRICS.gameSize)
  const safeHeight = Math.max(availableHeight, DEFAULT_METRICS.gameSize)
  const shortestSide = Math.min(safeWidth, safeHeight)
  const gameSize = roundToEven(Math.max(240, shortestSide * 0.96))
  const buttonSize = roundToEven(gameSize * 0.4)
  const centerDiameter = roundToEven(Math.max(72, gameSize * 0.3))
  const centerDiameterNoRing = roundToEven(centerDiameter * 0.9)
  const borderWidth = Math.max(4, Math.round(gameSize * 0.02))
  const slotInset = roundToEven(gameSize * 0.05)

  return {
    gameSize,
    buttonSize,
    centerDiameter,
    centerDiameterNoRing,
    ringSize: centerDiameter,
    borderWidth,
    centerTranslateOffset: centerDiameter / 2,
    slotInset,
  }
}

export function useGameBoardMetrics({
  availableWidth,
  availableHeight,
  freeze,
}: UseGameBoardMetricsParams) {
  const [metrics, setMetrics] = useState(DEFAULT_METRICS)

  useEffect(() => {
    const nextMetrics = computeMetrics(availableWidth, availableHeight)
    setMetrics((current) => {
      if (freeze && current !== DEFAULT_METRICS) {
        return current
      }

      const unchanged =
        current.gameSize === nextMetrics.gameSize &&
        current.buttonSize === nextMetrics.buttonSize &&
        current.centerDiameter === nextMetrics.centerDiameter &&
        current.centerDiameterNoRing === nextMetrics.centerDiameterNoRing &&
        current.ringSize === nextMetrics.ringSize &&
        current.borderWidth === nextMetrics.borderWidth &&
        current.centerTranslateOffset === nextMetrics.centerTranslateOffset &&
        current.slotInset === nextMetrics.slotInset

      return unchanged ? current : nextMetrics
    })
  }, [availableHeight, availableWidth, freeze])

  return metrics
}
