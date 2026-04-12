import { Text, type TextProps } from "react-native"

import { useGameTheme } from "@/theme/GameThemeContext"

type ThemedTextProps = TextProps & {
  variant?: "primary" | "secondary"
}

export function ThemedText({ variant = "primary", style, ...rest }: ThemedTextProps) {
  const theme = useGameTheme()
  const color = variant === "secondary" ? theme.secondaryTextColor : theme.textColor
  return <Text style={[{ color }, style]} {...rest} />
}
