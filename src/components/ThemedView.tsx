import { View, type ViewProps } from "react-native"

import { useGameTheme } from "@/theme/GameThemeContext"

type ThemedViewProps = ViewProps & {
  variant?: "background" | "surface"
}

export function ThemedView({ variant = "background", style, ...rest }: ThemedViewProps) {
  const theme = useGameTheme()
  const bg = variant === "surface" ? theme.surfaceColor : theme.backgroundColor
  return <View style={[{ backgroundColor: bg }, style]} {...rest} />
}
