import { useEffect, useState } from "react"
import { View, Text, Pressable, StyleSheet, ScrollView, Switch } from "react-native"
import * as Haptics from "expo-haptics"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { EaseView } from "react-native-ease"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { PressableScale } from "@/components/PressableScale"
import { SOUND_PACKS } from "@/config/soundPacks"
import {
  SETTINGS_HAPTICS_ENABLED,
  SETTINGS_NOTIFY_DAILY,
  SETTINGS_NOTIFY_STREAK,
  SETTINGS_NOTIFY_WINBACK,
  SETTINGS_SOUND_ENABLED,
} from "@/config/storageKeys"
import { themeIds, gameThemes } from "@/config/themes"
import { useAudioTones, type ColorMap } from "@/hooks/useAudioTones"
import { usePurchases } from "@/hooks/usePurchases"
import { useSoundPack } from "@/hooks/useSoundPack"
import { useTheme } from "@/hooks/useTheme"
import { useAnalytics } from "@/utils/analytics"
import { loadString, saveString } from "@/utils/storage"

function buildColorMap(theme: typeof gameThemes.classic): ColorMap {
  return {
    red: {
      color: theme.buttonColors.red.color,
      activeColor: theme.buttonColors.red.activeColor,
      sound: 220,
      position: "topLeft",
    },
    blue: {
      color: theme.buttonColors.blue.color,
      activeColor: theme.buttonColors.blue.activeColor,
      sound: 277,
      position: "topRight",
    },
    green: {
      color: theme.buttonColors.green.color,
      activeColor: theme.buttonColors.green.activeColor,
      sound: 330,
      position: "bottomLeft",
    },
    yellow: {
      color: theme.buttonColors.yellow.color,
      activeColor: theme.buttonColors.yellow.activeColor,
      sound: 415,
      position: "bottomRight",
    },
  }
}

export default function SettingsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const analytics = useAnalytics()

  const { soundPack, previewSoundPack, setSoundPack, setPreviewSoundPack, clearSoundPreview } =
    useSoundPack()
  const { theme, activeTheme, previewTheme, setTheme, setPreviewTheme, clearPreview } = useTheme()
  const {
    removeAds,
    purchaseRemoveAds,
    purchaseProduct,
    restorePurchases,
    ownsTheme,
    ownsSoundPack,
    getThemeProductId,
    getSoundProductId,
  } = usePurchases()

  const [soundEnabled, setSoundEnabled] = useState(
    () => loadString(SETTINGS_SOUND_ENABLED) !== "false",
  )
  const [hapticsEnabled, setHapticsEnabled] = useState(
    () => loadString(SETTINGS_HAPTICS_ENABLED) !== "false",
  )
  const [notifyDaily, setNotifyDaily] = useState(
    () => loadString(SETTINGS_NOTIFY_DAILY) !== "false",
  )
  const [notifyStreak, setNotifyStreak] = useState(
    () => loadString(SETTINGS_NOTIFY_STREAK) !== "false",
  )
  const [notifyWinback, setNotifyWinback] = useState(
    () => loadString(SETTINGS_NOTIFY_WINBACK) !== "false",
  )

  const [poppingSoundPack, setPoppingSoundPack] = useState<string | null>(null)
  const [soundHint, setSoundHint] = useState(false)
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null)
  const [poppingTheme, setPoppingTheme] = useState<string | null>(null)

  const colorMap = buildColorMap(activeTheme)
  const { playPreview, initialize, cleanup } = useAudioTones(
    colorMap,
    soundEnabled,
    soundPack.oscillatorType,
  )

  useEffect(() => {
    initialize()
    return () => {
      cleanup()
    }
  }, [])

  function toggleSoundEnabled() {
    const next = !soundEnabled
    setSoundEnabled(next)
    saveString(SETTINGS_SOUND_ENABLED, next ? "true" : "false")
  }

  function toggleHaptics() {
    const next = !hapticsEnabled
    setHapticsEnabled(next)
    saveString(SETTINGS_HAPTICS_ENABLED, next ? "true" : "false")
  }

  function toggleNotifyDaily() {
    const next = !notifyDaily
    setNotifyDaily(next)
    saveString(SETTINGS_NOTIFY_DAILY, next ? "true" : "false")
  }

  function toggleNotifyStreak() {
    const next = !notifyStreak
    setNotifyStreak(next)
    saveString(SETTINGS_NOTIFY_STREAK, next ? "true" : "false")
  }

  function toggleNotifyWinback() {
    const next = !notifyWinback
    setNotifyWinback(next)
    saveString(SETTINGS_NOTIFY_WINBACK, next ? "true" : "false")
  }

  function handleBack() {
    clearPreview()
    clearSoundPreview()
    router.back()
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, backgroundColor: activeTheme.backgroundColor },
      ]}
    >
      <View style={styles.header}>
        <PressableScale
          accessibilityLabel={t("common:back")}
          accessibilityRole="button"
          style={styles.backButton}
          onPress={handleBack}
        >
          <Ionicons name="arrow-back" size={24} color={activeTheme.textColor} />
        </PressableScale>
        <Text style={[styles.title, { color: activeTheme.textColor }]}>{t("game:settings")}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Sound Toggle */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: activeTheme.secondaryTextColor }]}>
            {t("game:soundToggle")}
          </Text>
          <PressableScale
            testID="btn-sound-toggle"
            accessibilityLabel={t("a11y:soundToggle")}
            accessibilityRole="button"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              toggleSoundEnabled()
            }}
            style={[styles.soundToggleBtn, soundEnabled && styles.soundToggleBtnActive]}
          >
            <Ionicons name={soundEnabled ? "volume-high" : "volume-mute"} size={20} color="white" />
            <Text style={styles.soundToggleText}>
              {soundEnabled ? t("common:on") : t("common:off")}
            </Text>
          </PressableScale>
        </View>

        {/* Sound Pack */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: activeTheme.secondaryTextColor }]}>
            {t("game:soundPack")}
          </Text>
          <View style={styles.row}>
            {SOUND_PACKS.map((pack) => {
              const isOwned = pack.free || ownsSoundPack(pack.id)
              const isSelected = pack.id === soundPack.id
              const isPreviewing = !isOwned && pack.id === (previewSoundPack?.id ?? null)
              const isPopping = poppingSoundPack === pack.id
              return (
                <Pressable
                  key={pack.id}
                  testID={`btn-sound-pack-${pack.id}`}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  onPress={() => {
                    if (pack.id === soundPack.id) return
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    if (!soundEnabled) {
                      setSoundHint(true)
                      setTimeout(() => setSoundHint(false), 2000)
                    }
                    playPreview(pack.oscillatorType)
                    setPoppingSoundPack(pack.id)
                    setTimeout(() => setPoppingSoundPack(null), 150)
                    if (isOwned) {
                      setSoundPack(pack.id)
                    } else {
                      setPreviewSoundPack(pack.id)
                    }
                  }}
                >
                  <EaseView
                    animate={{ scale: isPopping ? 1.08 : 1 }}
                    transition={{ default: { type: "spring", stiffness: 400, damping: 15 } }}
                    style={[
                      styles.selectorButton,
                      {
                        borderColor: isSelected
                          ? activeTheme.accentColor
                          : isPreviewing
                            ? activeTheme.warningColor
                            : activeTheme.borderColor,
                      },
                      isSelected && styles.selectorButtonActive,
                      isPreviewing && styles.selectorButtonPreviewing,
                    ]}
                  >
                    <View style={styles.selectorButtonInner}>
                      <Text
                        style={[
                          styles.soundPackName,
                          {
                            color: isSelected
                              ? activeTheme.accentColor
                              : isPreviewing
                                ? activeTheme.warningColor
                                : activeTheme.secondaryTextColor,
                          },
                        ]}
                      >
                        {pack.name}
                      </Text>
                      {!isOwned && (
                        <Ionicons
                          name="lock-closed"
                          size={10}
                          color={activeTheme.secondaryTextColor}
                          style={styles.lockIconSmall}
                        />
                      )}
                    </View>
                  </EaseView>
                </Pressable>
              )
            })}
          </View>
          {previewSoundPack && !ownsSoundPack(previewSoundPack.id) && (
            <PressableScale
              style={styles.unlockBtn}
              onPress={async () => {
                const productId = getSoundProductId(previewSoundPack.id)
                if (!productId) return
                analytics.trackIapInitiated(productId)
                const success = await purchaseProduct(productId)
                if (success) {
                  analytics.trackIapCompleted(productId)
                  setSoundPack(previewSoundPack.id)
                }
              }}
            >
              <Ionicons name="lock-open" size={14} color="white" />
              <Text style={styles.unlockBtnText}>
                {t("game:unlockSound", { name: previewSoundPack.name })}
              </Text>
            </PressableScale>
          )}
          <EaseView
            animate={{ opacity: soundHint ? 1 : 0, scale: soundHint ? 1 : 0.95 }}
            transition={{ default: { type: "timing", duration: 200, easing: "easeOut" } }}
            style={soundHint ? undefined : styles.hidden}
          >
            <Text style={[styles.hintText, { color: activeTheme.secondaryTextColor }]}>
              {t("game:soundDisabledHint")}
            </Text>
          </EaseView>
        </View>

        {/* Theme */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: activeTheme.secondaryTextColor }]}>
            {t("game:theme")}
          </Text>
          <View style={styles.row}>
            {themeIds.map((id) => {
              const isOwned = gameThemes[id].free || ownsTheme(id)
              const isSelected = id === theme.id
              const isPreviewing = previewTheme?.id === id
              const isPopping = poppingTheme === id
              return (
                <Pressable
                  key={id}
                  testID={`btn-theme-${id}`}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => {
                    if (id === theme.id) return
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setPoppingTheme(id)
                    setTimeout(() => setPoppingTheme(null), 150)
                    if (isOwned) {
                      setTheme(id)
                    } else {
                      setPreviewTheme(id)
                    }
                  }}
                >
                  <EaseView
                    animate={{ scale: isPopping ? 1.08 : 1 }}
                    transition={{ default: { type: "spring", stiffness: 400, damping: 15 } }}
                    style={[
                      styles.themeCircle,
                      { backgroundColor: gameThemes[id].buttonColors.red.color },
                      isSelected && styles.themeCircleSelected,
                      isPreviewing && styles.themeCirclePreviewing,
                    ]}
                  >
                    {!isOwned && (
                      <Ionicons
                        name="lock-closed"
                        size={12}
                        color="rgba(255, 255, 255, 0.7)"
                        style={styles.lockIconMedium}
                      />
                    )}
                  </EaseView>
                </Pressable>
              )
            })}
          </View>
          {previewTheme && !ownsTheme(previewTheme.id) && (
            <PressableScale
              style={styles.unlockBtn}
              onPress={async () => {
                const productId = getThemeProductId(previewTheme.id)
                if (!productId) return
                analytics.trackIapInitiated(productId)
                const success = await purchaseProduct(productId)
                if (success) {
                  analytics.trackIapCompleted(productId)
                  setTheme(previewTheme.id)
                }
              }}
            >
              <Ionicons name="lock-open" size={14} color="white" />
              <Text style={styles.unlockBtnText}>
                {t("game:unlockTheme", { name: previewTheme.name })}
              </Text>
            </PressableScale>
          )}
        </View>

        {/* Haptics */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: activeTheme.secondaryTextColor }]}>
            {t("settings:haptics")}
          </Text>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: activeTheme.textColor }]}>
              {t("settings:hapticsToggle")}
            </Text>
            <Switch
              value={hapticsEnabled}
              onValueChange={toggleHaptics}
              trackColor={{ false: activeTheme.borderColor, true: activeTheme.accentColor }}
            />
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: activeTheme.secondaryTextColor }]}>
            {t("settings:notifications")}
          </Text>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: activeTheme.textColor }]}>
              {t("settings:notifyDaily")}
            </Text>
            <Switch
              value={notifyDaily}
              onValueChange={toggleNotifyDaily}
              trackColor={{ false: activeTheme.borderColor, true: activeTheme.accentColor }}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: activeTheme.textColor }]}>
              {t("settings:notifyStreak")}
            </Text>
            <Switch
              value={notifyStreak}
              onValueChange={toggleNotifyStreak}
              trackColor={{ false: activeTheme.borderColor, true: activeTheme.accentColor }}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: activeTheme.textColor }]}>
              {t("settings:notifyWinback")}
            </Text>
            <Switch
              value={notifyWinback}
              onValueChange={toggleNotifyWinback}
              trackColor={{ false: activeTheme.borderColor, true: activeTheme.accentColor }}
            />
          </View>
        </View>

        {/* Remove Ads */}
        {!removeAds && (
          <View style={styles.section}>
            <PressableScale
              style={styles.removeAdsBtn}
              accessibilityLabel={t("a11y:removeAds")}
              accessibilityRole="button"
              onPress={async () => {
                analytics.trackIapInitiated("ecomi_remove_ads")
                const success = await purchaseRemoveAds()
                if (success) analytics.trackIapCompleted("ecomi_remove_ads")
              }}
            >
              <Ionicons name="shield-checkmark" size={18} color="white" />
              <Text style={styles.removeAdsBtnText}>{t("game:removeAds")}</Text>
            </PressableScale>
          </View>
        )}

        {/* Restore Purchases */}
        <View style={styles.section}>
          <PressableScale
            style={[styles.restoreBtn, { borderColor: activeTheme.borderColor }]}
            accessibilityLabel={t("a11y:restorePurchases")}
            accessibilityRole="button"
            onPress={async () => {
              const success = await restorePurchases()
              setRestoreMessage(success ? t("game:restoreSuccess") : t("game:restoreFailed"))
              setTimeout(() => setRestoreMessage(null), 3000)
            }}
          >
            <Ionicons name="refresh" size={18} color={activeTheme.textColor} />
            <Text style={[styles.restoreBtnText, { color: activeTheme.textColor }]}>
              {t("game:restorePurchases")}
            </Text>
          </PressableScale>
          <EaseView
            animate={{ opacity: restoreMessage ? 1 : 0, scale: restoreMessage ? 1 : 0.95 }}
            transition={{ default: { type: "timing", duration: 200, easing: "easeOut" } }}
            style={restoreMessage ? undefined : styles.hidden}
          >
            <Text style={[styles.hintText, { color: activeTheme.secondaryTextColor }]}>
              {restoreMessage}
            </Text>
          </EaseView>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  backButton: {
    marginRight: 16,
    padding: 10,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  content: {
    paddingBottom: 40,
    paddingTop: 8,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
  },
  hidden: {
    height: 0,
    overflow: "hidden",
  },
  hintText: {
    fontFamily: "Oxanium-Regular",
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },
  lockIconMedium: {
    opacity: 0.7,
  },
  lockIconSmall: {
    opacity: 0.6,
  },
  removeAdsBtn: {
    alignItems: "center",
    backgroundColor: "#8b5cf6",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  removeAdsBtnText: {
    color: "white",
    fontFamily: "Oxanium-SemiBold",
    fontSize: 14,
  },
  restoreBtn: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  restoreBtnText: {
    fontFamily: "Oxanium-SemiBold",
    fontSize: 14,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontFamily: "Oxanium-Medium",
    fontSize: 13,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  selectorButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectorButtonActive: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
  },
  selectorButtonInner: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  selectorButtonPreviewing: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
  },
  soundPackName: {
    fontFamily: "Oxanium-Regular",
    fontSize: 12,
  },
  soundToggleBtn: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  soundToggleBtnActive: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
  },
  soundToggleText: {
    color: "white",
    fontFamily: "Oxanium-SemiBold",
    fontSize: 14,
  },
  switchLabel: {
    fontFamily: "Oxanium-Regular",
    fontSize: 14,
  },
  switchRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  themeCircle: {
    alignItems: "center",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  themeCirclePreviewing: {
    borderColor: "#f59e0b",
    borderWidth: 2,
  },
  themeCircleSelected: {
    borderColor: "#22c55e",
    borderWidth: 2,
  },
  title: {
    fontFamily: "Oxanium-Bold",
    fontSize: 28,
  },
  unlockBtn: {
    alignItems: "center",
    backgroundColor: "#8b5cf6",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  unlockBtnText: {
    color: "white",
    fontFamily: "Oxanium-SemiBold",
    fontSize: 14,
  },
})
