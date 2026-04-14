import { View, Text, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"

import { ModalOverlay } from "@/components/ModalOverlay"
import { PressableScale } from "@/components/PressableScale"
import type { GameTheme } from "@/config/themes"

type PostPBPromptProps = {
  visible: boolean
  theme: GameTheme
  onRemoveAds: () => void
  onDismiss: () => void
}

export function PostPBPrompt({ visible, theme, onRemoveAds, onDismiss }: PostPBPromptProps) {
  const { t } = useTranslation()

  return (
    <ModalOverlay visible={visible} theme={theme} onDismiss={onDismiss} cardStyle={styles.card}>
      <Ionicons name="trophy" size={36} color={theme.warningColor} />
      <Text style={[styles.title, { color: theme.textColor }]}>{t("iap:postPBTitle")}</Text>
      <Text style={[styles.body, { color: theme.secondaryTextColor }]}>{t("iap:postPBBody")}</Text>
      <View style={styles.actions}>
        <PressableScale
          style={[styles.removeAdsButton, { backgroundColor: theme.accentColor }]}
          onPress={onRemoveAds}
        >
          <Ionicons name="shield-checkmark" size={18} color="white" />
          <Text style={styles.removeAdsText}>{t("game:removeAds")}</Text>
        </PressableScale>
        <PressableScale
          style={styles.dismissButton}
          onPress={onDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.dismissText, { color: theme.secondaryTextColor }]}>
            {t("iap:maybeLater")}
          </Text>
        </PressableScale>
      </View>
    </ModalOverlay>
  )
}

const styles = StyleSheet.create({
  actions: {
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    width: "100%",
  },
  body: {
    fontFamily: "Oxanium-Regular",
    fontSize: 14,
    marginTop: 6,
    textAlign: "center",
  },
  card: {
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  dismissButton: {
    paddingVertical: 8,
  },
  dismissText: {
    fontFamily: "Oxanium-Regular",
    fontSize: 14,
  },
  removeAdsButton: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 10,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  removeAdsText: {
    color: "white",
    fontFamily: "Oxanium-SemiBold",
    fontSize: 16,
  },
  title: {
    fontFamily: "Oxanium-Bold",
    fontSize: 20,
    marginTop: 12,
  },
})
