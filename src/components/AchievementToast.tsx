import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { EaseView } from "react-native-ease"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { useGameTheme } from "@/theme/GameThemeContext"
import { UI_COLORS } from "@/theme/uiColors"

type AchievementToastProps = {
  title: string
  description: string
  icon?: string
  visible: boolean
  onHide: () => void
}

export function AchievementToast({
  title,
  description,
  icon,
  visible,
  onHide,
}: AchievementToastProps) {
  const insets = useSafeAreaInsets()
  const theme = useGameTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (!visible) return
    setMounted(true)
    const timer = setTimeout(() => {
      setMounted(false)
      setTimeout(onHide, 400)
    }, 3000)
    return () => clearTimeout(timer)
  }, [visible])

  if (!visible && !mounted) return null

  return (
    <EaseView
      animate={{
        translateY: mounted ? 0 : -80,
        opacity: mounted ? 1 : 0,
      }}
      transition={{
        default: { type: "spring", stiffness: 300, damping: 25, mass: 0.8 },
      }}
      style={[styles.container, { top: insets.top + 8 }]}
    >
      <View
        style={[
          styles.toast,
          { backgroundColor: theme.surfaceColor, borderColor: theme.borderColor },
        ]}
      >
        {icon && (
          <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color="#fbbf24" />
        )}
        <View style={styles.text}>
          <Text style={styles.title}>{title}</Text>
          <Text style={[styles.description, { color: theme.secondaryTextColor }]}>
            {description}
          </Text>
        </View>
      </View>
    </EaseView>
  )
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    left: 0,
    maxWidth: 500,
    position: "absolute",
    right: 0,
    zIndex: 999,
  },
  description: {
    fontFamily: "Oxanium-Regular",
    fontSize: 12,
  },
  text: {
    flex: 1,
  },
  title: {
    color: UI_COLORS.amber400,
    fontFamily: "Oxanium-SemiBold",
    fontSize: 14,
  },
  toast: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
})
