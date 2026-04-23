import { View, Text, Linking, StyleSheet } from "react-native"
import * as StoreReview from "expo-store-review"
import { useTranslation } from "react-i18next"

import { ModalOverlay } from "@/components/ModalOverlay"
import { PressableScale } from "@/components/PressableScale"
import type { GameTheme } from "@/config/themes"

type ReviewPromptProps = {
  visible: boolean
  theme: GameTheme
  onDismiss: () => void
  onResponse?: (response: "love_it" | "not_really") => void
}

export function ReviewPrompt({ visible, theme, onDismiss, onResponse }: ReviewPromptProps) {
  const { t } = useTranslation()

  async function handleLoveIt() {
    onResponse?.("love_it")
    onDismiss()
    const isAvailable = await StoreReview.isAvailableAsync()
    if (isAvailable) {
      await StoreReview.requestReview()
    }
  }

  function handleNotReally() {
    onResponse?.("not_really")
    onDismiss()
    Linking.openURL("https://forms.gle/WoVhLCTTqaDTRa4v5")
  }

  return (
    <ModalOverlay visible={visible} theme={theme} onDismiss={onDismiss} cardStyle={styles.card}>
      <Text style={[styles.title, { color: theme.textColor }]}>{t("review:title")}</Text>
      <Text style={[styles.subtitle, { color: theme.secondaryTextColor }]}>
        {t("review:subtitle")}
      </Text>
      <View style={styles.buttons}>
        <PressableScale
          testID="review-love-it"
          style={[styles.loveItButton, { backgroundColor: theme.accentColor }]}
          onPress={handleLoveIt}
        >
          <Text style={[styles.loveItText, { color: theme.primaryForegroundColor }]}>
            {t("review:loveIt")}
          </Text>
        </PressableScale>
        <PressableScale
          testID="review-not-really"
          style={[
            styles.notReallyButton,
            { backgroundColor: theme.surfaceColor, borderColor: theme.borderColor },
          ]}
          onPress={handleNotReally}
        >
          <Text style={[styles.notReallyText, { color: theme.textColor }]}>
            {t("review:notReally")}
          </Text>
        </PressableScale>
      </View>
      <PressableScale
        testID="review-maybe-later"
        style={styles.maybeLaterButton}
        onPress={onDismiss}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[styles.maybeLaterText, { color: theme.secondaryTextColor }]}>
          {t("review:maybeLater")}
        </Text>
      </PressableScale>
    </ModalOverlay>
  )
}

const styles = StyleSheet.create({
  buttons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  card: {
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  loveItButton: {
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  loveItText: {
    fontFamily: "Oxanium-SemiBold",
    fontSize: 16,
  },
  maybeLaterButton: {
    marginTop: 12,
    paddingVertical: 8,
  },
  maybeLaterText: {
    fontFamily: "Oxanium-Regular",
    fontSize: 14,
  },
  notReallyButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  notReallyText: {
    fontFamily: "Oxanium-SemiBold",
    fontSize: 16,
  },
  subtitle: {
    fontFamily: "Oxanium-Regular",
    fontSize: 14,
    marginTop: 8,
  },
  title: {
    fontFamily: "Oxanium-Bold",
    fontSize: 22,
  },
})
