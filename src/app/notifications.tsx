import { View, Text, StyleSheet } from "react-native"
import { useRouter } from "expo-router"
import * as ExpoNotifications from "expo-notifications"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { PressableScale } from "@/components/PressableScale"
import { NOTIFICATIONS_PERMISSION_ASKED } from "@/config/storageKeys"
import { saveString } from "@/utils/storage"

function markAsked() {
  saveString(NOTIFICATIONS_PERMISSION_ASKED, "true")
}

export default function NotificationsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

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
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="notifications-outline" size={64} color="#fbbf24" />
        </View>

        <Text style={styles.title}>{t("notifications:prePromptTitle")}</Text>
        <Text style={styles.subtitle}>{t("notifications:prePromptBody")}</Text>
      </View>

      <View style={styles.buttons}>
        <PressableScale style={styles.enableBtn} onPress={handleEnable}>
          <Text style={styles.enableBtnText}>{t("notifications:enableReminders")}</Text>
        </PressableScale>
        <PressableScale
          style={styles.skipBtn}
          onPress={handleNotNow}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.skipBtnText}>{t("notifications:notNow")}</Text>
        </PressableScale>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  buttons: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 32,
    width: "100%",
  },
  container: {
    alignItems: "center",
    backgroundColor: "#1a1a2e",
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
    backgroundColor: "#fbbf24",
    borderRadius: 12,
    paddingVertical: 16,
    width: "100%",
  },
  enableBtnText: {
    color: "#1a1a2e",
    fontFamily: "Oxanium-SemiBold",
    fontSize: 16,
  },
  iconCircle: {
    alignItems: "center",
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    borderRadius: 60,
    height: 120,
    justifyContent: "center",
    marginBottom: 32,
    width: 120,
  },
  skipBtn: {
    paddingVertical: 8,
  },
  skipBtnText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontFamily: "Oxanium-Regular",
    fontSize: 14,
  },
  subtitle: {
    color: "rgba(255, 255, 255, 0.6)",
    fontFamily: "Oxanium-Regular",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  title: {
    color: "white",
    fontFamily: "Oxanium-Bold",
    fontSize: 24,
    marginBottom: 12,
    textAlign: "center",
  },
})
