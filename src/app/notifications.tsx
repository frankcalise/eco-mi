import { View, Text, StyleSheet } from "react-native"
import * as ExpoNotifications from "expo-notifications"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { PressableScale } from "@/components/PressableScale"
import { NOTIFICATIONS_PERMISSION_ASKED } from "@/config/storageKeys"
import { useTheme } from "@/hooks/useTheme"
import { saveString } from "@/utils/storage"

function markAsked() {
  saveString(NOTIFICATIONS_PERMISSION_ASKED, "true")
}

export default function NotificationsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const { activeTheme } = useTheme()

  async function handleEnable() {
    markAsked()
    await ExpoNotifications.requestPermissionsAsync().catch(() => {})
    router.replace("/")
  }

  function handleNotNow() {
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
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: activeTheme.surfaceColor, borderColor: activeTheme.borderColor },
          ]}
        >
          <Ionicons name="notifications-outline" size={64} color={activeTheme.warningColor} />
        </View>

        <Text style={[styles.title, { color: activeTheme.textColor }]}>
          {t("notifications:prePromptTitle")}
        </Text>
        <Text style={[styles.subtitle, { color: activeTheme.secondaryTextColor }]}>
          {t("notifications:prePromptBody")}
        </Text>
      </View>

      <View style={styles.buttons}>
        <PressableScale
          style={[styles.enableBtn, { backgroundColor: activeTheme.accentColor }]}
          onPress={handleEnable}
        >
          <Text style={[styles.enableBtnText, { color: activeTheme.primaryForegroundColor }]}>
            {t("notifications:enableReminders")}
          </Text>
        </PressableScale>
        <PressableScale
          style={styles.skipBtn}
          onPress={handleNotNow}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.skipBtnText, { color: activeTheme.secondaryTextColor }]}>
            {t("notifications:maybeLater")}
          </Text>
        </PressableScale>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
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
  enableBtn: {
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 16,
    width: "100%",
  },
  enableBtnText: {
    fontFamily: "Oxanium-SemiBold",
    fontSize: 16,
  },
  iconCircle: {
    alignItems: "center",
    borderRadius: 60,
    borderWidth: 1,
    height: 120,
    justifyContent: "center",
    marginBottom: 32,
    width: 120,
  },
  skipBtn: {
    alignSelf: "center",
    marginBottom: 8,
    paddingVertical: 8,
  },
  skipBtnText: {
    fontFamily: "Oxanium-Regular",
    fontSize: 14,
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
