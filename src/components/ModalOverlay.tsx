import { type PropsWithChildren } from "react"
import { Pressable, StyleSheet, type ViewStyle } from "react-native"
import { EaseView } from "react-native-ease"

import type { GameTheme } from "@/config/themes"

type ModalOverlayProps = PropsWithChildren<{
  visible: boolean
  theme: GameTheme
  onDismiss?: () => void
  cardStyle?: ViewStyle
}>

export function ModalOverlay({
  visible,
  theme,
  onDismiss,
  cardStyle,
  children,
}: ModalOverlayProps) {
  if (!visible) return null

  return (
    <EaseView
      style={styles.backdrop}
      initialAnimate={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ default: { type: "timing", duration: 200 } }}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      <EaseView
        style={[
          styles.card,
          { backgroundColor: theme.backgroundColor, borderColor: theme.borderColor },
          cardStyle,
        ]}
        initialAnimate={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ default: { type: "spring", stiffness: 300, damping: 20 } }}
      >
        {children}
      </EaseView>
    </EaseView>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    padding: 24,
    zIndex: 100,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    maxWidth: 380,
    padding: 20,
    width: "85%",
  },
})
