import { View, Text, Pressable, Linking, StyleSheet } from "react-native"
import * as StoreReview from "expo-store-review"
import { useTranslation } from "react-i18next"

type ReviewPromptProps = {
  visible: boolean
  onDismiss: () => void
  onResponse?: (response: "love_it" | "not_really") => void
}

export function ReviewPrompt({ visible, onDismiss, onResponse }: ReviewPromptProps) {
  const { t } = useTranslation()

  if (!visible) return null

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
    Linking.openURL("https://github.com/frankcalise/EcoMi/issues/new?template=feedback.yml")
  }

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.title}>{t("review:title")}</Text>
        <Text style={styles.subtitle}>{t("review:subtitle")}</Text>
        <View style={styles.buttons}>
          <Pressable testID="review-love-it" style={styles.loveItButton} onPress={handleLoveIt}>
            <Text style={styles.loveItText}>{t("review:loveIt")}</Text>
          </Pressable>
          <Pressable
            testID="review-not-really"
            style={styles.notReallyButton}
            onPress={handleNotReally}
          >
            <Text style={styles.notReallyText}>{t("review:notReally")}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    zIndex: 200,
  },
  buttons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  card: {
    alignItems: "center",
    backgroundColor: "#1a1a2e",
    borderColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 28,
    paddingVertical: 24,
    width: "80%",
  },
  loveItButton: {
    backgroundColor: "#22c55e",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  loveItText: {
    color: "white",
    fontFamily: "Oxanium-SemiBold",
    fontSize: 16,
  },
  notReallyButton: {
    backgroundColor: "#6b7280",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  notReallyText: {
    color: "white",
    fontFamily: "Oxanium-SemiBold",
    fontSize: 16,
  },
  subtitle: {
    color: "#a0a0a0",
    fontFamily: "Oxanium-Regular",
    fontSize: 14,
    marginTop: 8,
  },
  title: {
    color: "white",
    fontFamily: "Oxanium-Bold",
    fontSize: 22,
  },
})
