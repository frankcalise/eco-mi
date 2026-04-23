import { Image, View, Text, StyleSheet } from "react-native"
import { useRouter } from "expo-router"
import { requestTrackingPermissionsAsync } from "expo-tracking-transparency"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { PressableScale } from "@/components/PressableScale"
import { TRACKING_ASKED } from "@/config/storageKeys"
import { useTheme } from "@/hooks/useTheme"
import { saveString } from "@/utils/storage"

function markAsked() {
  saveString(TRACKING_ASKED, "true")
}

export default function TrackingScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const { activeTheme } = useTheme()

  async function handleContinue() {
    await requestTrackingPermissionsAsync().catch(() => {})
    markAsked()
    router.replace("/")
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: activeTheme.backgroundColor,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <View style={styles.content}>
        {/* eslint-disable-next-line @typescript-eslint/no-require-imports */}
        <Image source={require("../../assets/images/app-icon-ios.png")} style={styles.appIcon} />
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: activeTheme.surfaceColor, borderColor: activeTheme.borderColor },
          ]}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={64}
            color={activeTheme.accentColor}
          />
        </View>

        <Text style={[styles.title, { color: activeTheme.textColor }]}>{t("tracking:title")}</Text>
        <Text style={[styles.subtitle, { color: activeTheme.secondaryTextColor }]}>
          {t("tracking:subtitle")}
        </Text>
      </View>

      <View style={styles.buttons}>
        <PressableScale
          style={[styles.shareBtn, { backgroundColor: activeTheme.accentColor }]}
          onPress={handleContinue}
        >
          <Text style={[styles.shareBtnText, { color: activeTheme.primaryForegroundColor }]}>
            {t("tracking:continueButton")}
          </Text>
        </PressableScale>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  appIcon: {
    borderRadius: 20,
    height: 80,
    marginBottom: 24,
    width: 80,
  },
  buttons: {
    gap: 12,
    paddingHorizontal: 32,
    width: "100%",
  },
  container: {
    alignItems: "center",
    flex: 1,
    justifyContent: "space-between",
    paddingBottom: 48,
  },
  content: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  iconCircle: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 60,
    height: 120,
    justifyContent: "center",
    marginBottom: 32,
    width: 120,
  },
  shareBtn: {
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 16,
  },
  shareBtnText: {
    fontFamily: "Oxanium-SemiBold",
    fontSize: 16,
  },
  subtitle: {
    fontFamily: "Oxanium-Regular",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  title: {
    fontFamily: "Oxanium-Bold",
    fontSize: 24,
    marginBottom: 12,
    textAlign: "center",
  },
})
