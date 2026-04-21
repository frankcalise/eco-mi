import { useWindowDimensions } from "react-native"

export function useBreakpoints() {
  const { width, height } = useWindowDimensions()
  const shortestSide = Math.min(width, height)

  return {
    isCompact: shortestSide < 600,
    isTablet: shortestSide >= 600,
  }
}
