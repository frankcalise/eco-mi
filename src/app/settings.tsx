import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { View, Text, Pressable, Platform, StyleSheet, ScrollView } from "react-native"
import * as Application from "expo-application"
import { useNavigation } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { EaseView } from "react-native-ease"

import { NativeToggle } from "@/components/NativeToggle"
import { PressableScale } from "@/components/PressableScale"
import { SOUND_PACKS } from "@/config/soundPacks"
import { SETTINGS_SOUND_PREVIEW_HINT_SEEN } from "@/config/storageKeys"
import { themeIds, gameThemes } from "@/config/themes"
import { useAudioTones, type ColorMap } from "@/hooks/useAudioTones"
import { useHaptics } from "@/hooks/useHaptics"
import { usePurchases } from "@/hooks/usePurchases"
import { useSoundPack } from "@/hooks/useSoundPack"
import { useTheme } from "@/hooks/useTheme"
import { useTransientTimers } from "@/hooks/useTransientTimers"
import { stackHeaderOptionsFromTheme } from "@/navigation/secondaryStackHeader"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { UI_COLORS } from "@/theme/uiColors"
import { useAnalytics } from "@/utils/analytics"
import { getReadableForeground } from "@/utils/color"
import { loadString, saveString } from "@/utils/storage"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Host, Slider: NativeSlider } =
  Platform.OS === "ios" ? require("@expo/ui/swift-ui") : require("@expo/ui/jetpack-compose")

function SoundPackIcon({
  isOwned,
  isSpeaking,
  color,
}: {
  isOwned: boolean
  isSpeaking: boolean
  color: string
}) {
  if (!isOwned && !isSpeaking) {
    return <Ionicons name="lock-closed" size={12} color={color} />
  }
  const iconName = isSpeaking ? "volume-high" : "volume-medium"
  return (
    <EaseView
      animate={{ opacity: isSpeaking ? 0.55 : 1 }}
      transition={{
        default: isSpeaking
          ? { type: "timing", duration: 700, easing: "easeInOut", loop: "reverse" }
          : { type: "timing", duration: 200 },
      }}
    >
      <Ionicons name={iconName} size={12} color={color} />
    </EaseView>
  )
}

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
  const { t, i18n } = useTranslation()
  const navigation = useNavigation()
  const analytics = useAnalytics()
  const haptics = useHaptics()

  const { soundPack, previewSoundPack, setSoundPack, setPreviewSoundPack, clearSoundPreview } =
    useSoundPack()
  const { theme, activeTheme, previewTheme, setTheme, setPreviewTheme, clearPreview } = useTheme()
  const clearPreviewRef = useRef(clearPreview)
  const clearSoundPreviewRef = useRef(clearSoundPreview)
  clearPreviewRef.current = clearPreview
  clearSoundPreviewRef.current = clearSoundPreview
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

  const soundEnabled = usePreferencesStore((s) => s.soundEnabled)
  const setSoundEnabled = usePreferencesStore((s) => s.setSoundEnabled)
  const volume = usePreferencesStore((s) => s.volume)
  const setVolume = usePreferencesStore((s) => s.setVolume)
  const hapticsEnabled = usePreferencesStore((s) => s.hapticsEnabled)
  const setHapticsEnabled = usePreferencesStore((s) => s.setHapticsEnabled)
  const notifyDaily = usePreferencesStore((s) => s.notifyDaily)
  const setNotifyDaily = usePreferencesStore((s) => s.setNotifyDaily)
  const notifyStreak = usePreferencesStore((s) => s.notifyStreak)
  const setNotifyStreak = usePreferencesStore((s) => s.setNotifyStreak)
  const notifyWinback = usePreferencesStore((s) => s.notifyWinback)
  const setNotifyWinback = usePreferencesStore((s) => s.setNotifyWinback)
  const colorblindPatternsEnabled = usePreferencesStore((s) => s.colorblindPatternsEnabled)
  const setColorblindPatternsEnabled = usePreferencesStore((s) => s.setColorblindPatternsEnabled)

  const [poppingSoundPack, setPoppingSoundPack] = useState<string | null>(null)
  const [soundHint, setSoundHint] = useState(false)
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null)
  const [poppingTheme, setPoppingTheme] = useState<string | null>(null)
  const [showPreviewHint, setShowPreviewHint] = useState(
    () => loadString(SETTINGS_SOUND_PREVIEW_HINT_SEEN) !== "true",
  )
  function dismissPreviewHint() {
    if (!showPreviewHint) return
    setShowPreviewHint(false)
    saveString(SETTINGS_SOUND_PREVIEW_HINT_SEEN, "true")
  }

  const scheduleTransient = useTransientTimers()

  const colorMap = buildColorMap(activeTheme)
  const { playPreview, initialize, cleanup } = useAudioTones(colorMap, soundPack.oscillatorType)

  useEffect(() => {
    initialize()
    return () => {
      cleanup()
    }
  }, [])

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("game:settings"),
      headerBackAccessibilityLabel: t("common:back"),
      ...stackHeaderOptionsFromTheme(activeTheme),
    })
  }, [navigation, t, i18n.language, activeTheme])

  useEffect(() => {
    return navigation.addListener("beforeRemove", () => {
      clearPreviewRef.current()
      clearSoundPreviewRef.current()
    })
  }, [navigation])

  function toggleSoundEnabled() {
    setSoundEnabled(!soundEnabled)
  }

  function handleVolumeChange(value: number) {
    // Snap to the same 0.05 step Settings renders on, then let the store
    // clamp + persist + notify subscribers (useAudioTones instances re-apply
    // gain via their reactive effect).
    setVolume(Math.round(value * 100) / 100)
  }

  function toggleHaptics() {
    // Fire one last buzz on disable so the user feels confirmation; on enable
    // the new state will govern the *next* interaction naturally.
    haptics.play("menuTap")
    setHapticsEnabled(!hapticsEnabled)
  }

  function toggleNotifyDaily() {
    setNotifyDaily(!notifyDaily)
  }

  function toggleNotifyStreak() {
    setNotifyStreak(!notifyStreak)
  }

  function toggleNotifyWinback() {
    setNotifyWinback(!notifyWinback)
  }

  return (
    <View style={[styles.container, { backgroundColor: activeTheme.backgroundColor }]}>
      <StatusBar style={activeTheme.statusBarStyle} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Sound */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: activeTheme.secondaryTextColor }]}>
            {t("game:sound")}
          </Text>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: activeTheme.textColor }]}>
              {t("settings:soundEnabled")}
            </Text>
            <NativeToggle
              testID="btn-sound-toggle"
              value={soundEnabled}
              onValueChange={() => {
                haptics.play("menuTap")
                toggleSoundEnabled()
              }}
              activeColor={activeTheme.accentColor}
              inactiveColor={activeTheme.secondaryTextColor}
            />
          </View>
          <View style={styles.volumeRow}>
            <Text
              style={[
                styles.switchLabel,
                { color: soundEnabled ? activeTheme.textColor : activeTheme.secondaryTextColor },
              ]}
            >
              {t("settings:volume")}
            </Text>
            <Host style={styles.volumeSlider}>
              <NativeSlider
                value={volume}
                min={0}
                max={1}
                {...(Platform.OS === "ios"
                  ? { step: 0.05 }
                  : {
                      steps: 20,
                      enabled: soundEnabled,
                      colors: {
                        thumbColor: soundEnabled
                          ? activeTheme.accentColor
                          : activeTheme.secondaryTextColor,
                        activeTrackColor: soundEnabled
                          ? activeTheme.accentColor
                          : activeTheme.secondaryTextColor,
                        inactiveTrackColor: activeTheme.secondaryTextColor,
                      },
                    })}
                onValueChange={handleVolumeChange}
              />
            </Host>
            <Text style={[styles.volumeLabel, { color: activeTheme.secondaryTextColor }]}>
              {Math.round(volume * 100)}%
            </Text>
          </View>
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
              const labelColor = isSelected
                ? activeTheme.accentColor
                : activeTheme.secondaryTextColor
              return (
                <Pressable
                  key={pack.id}
                  testID={`btn-sound-pack-${pack.id}`}
                  hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={pack.name}
                  accessibilityHint={t(
                    isOwned ? "a11y:applySoundPack" : "a11y:previewLockedSoundPack",
                  )}
                  accessibilityState={{ selected: isSelected, disabled: false }}
                  onPress={() => {
                    dismissPreviewHint()
                    if (pack.id === soundPack.id) {
                      clearSoundPreview()
                      return
                    }
                    haptics.play("menuTap")
                    if (!soundEnabled) {
                      setSoundHint(true)
                      scheduleTransient(() => setSoundHint(false), 2000)
                    }
                    playPreview(pack.oscillatorType)
                    setPoppingSoundPack(pack.id)
                    scheduleTransient(() => setPoppingSoundPack(null), 150)
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
                        backgroundColor: isSelected
                          ? `${activeTheme.accentColor}1A`
                          : isPreviewing
                            ? `${activeTheme.warningColor}1A`
                            : activeTheme.surfaceColor,
                        borderColor: isSelected
                          ? activeTheme.accentColor
                          : isPreviewing
                            ? activeTheme.warningColor
                            : activeTheme.borderColor,
                      },
                    ]}
                  >
                    <View style={styles.selectorButtonInner}>
                      <Text style={[styles.soundPackName, { color: labelColor }]}>{pack.name}</Text>
                      <SoundPackIcon
                        isOwned={isOwned}
                        isSpeaking={isSelected || isPreviewing}
                        color={labelColor}
                      />
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
                  playPreview(previewSoundPack.oscillatorType)
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
          {showPreviewHint && !soundHint && (
            <Text style={[styles.hintText, { color: activeTheme.secondaryTextColor }]}>
              {t("game:soundPreviewHint")}
            </Text>
          )}
        </View>

        {/* Theme */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: activeTheme.secondaryTextColor }]}>
            {t("game:theme")}
            <Text style={{ color: activeTheme.textColor }}>
              {" — "}
              {t(`themes:${activeTheme.id}` as const)}
            </Text>
          </Text>
          <View style={styles.row}>
            {themeIds.map((id) => {
              const swatchTheme = gameThemes[id]
              const isOwned = swatchTheme.free || ownsTheme(id)
              const isSelected = id === theme.id
              const isPreviewing = previewTheme?.id === id
              const isPopping = poppingTheme === id
              const outlineColor = isSelected
                ? activeTheme.accentColor
                : isPreviewing
                  ? activeTheme.warningColor
                  : activeTheme.borderColor
              return (
                <Pressable
                  key={id}
                  testID={`btn-theme-${id}`}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={t(`themes:${id}` as const)}
                  accessibilityHint={t(isOwned ? "a11y:applyTheme" : "a11y:previewLockedTheme")}
                  accessibilityState={{ selected: isSelected, disabled: false }}
                  onPress={() => {
                    if (id === theme.id) {
                      clearPreview()
                      return
                    }
                    haptics.play("menuTap")
                    setPoppingTheme(id)
                    scheduleTransient(() => setPoppingTheme(null), 150)
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
                      styles.themeSwatch,
                      isSelected || isPreviewing
                        ? styles.themeSwatchEmphasized
                        : styles.themeSwatchNormal,
                      { borderColor: outlineColor },
                    ]}
                  >
                    <View style={styles.themeSwatchRow}>
                      <View
                        style={[
                          styles.themeSwatchCell,
                          { backgroundColor: swatchTheme.buttonColors.red.color },
                        ]}
                      />
                      <View
                        style={[
                          styles.themeSwatchCell,
                          { backgroundColor: swatchTheme.buttonColors.blue.color },
                        ]}
                      />
                    </View>
                    <View style={styles.themeSwatchRow}>
                      <View
                        style={[
                          styles.themeSwatchCell,
                          { backgroundColor: swatchTheme.buttonColors.green.color },
                        ]}
                      />
                      <View
                        style={[
                          styles.themeSwatchCell,
                          { backgroundColor: swatchTheme.buttonColors.yellow.color },
                        ]}
                      />
                    </View>
                    {!isOwned && (
                      <View style={styles.themeSwatchLockOverlay}>
                        <Ionicons name="lock-closed" size={16} color={UI_COLORS.white} />
                      </View>
                    )}
                    {isSelected && (
                      <View
                        style={[
                          styles.themeSwatchCheck,
                          {
                            backgroundColor: activeTheme.accentColor,
                            borderColor: activeTheme.backgroundColor,
                          },
                        ]}
                      >
                        <Ionicons
                          name="checkmark"
                          size={10}
                          color={getReadableForeground(activeTheme.accentColor)}
                        />
                      </View>
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
            <NativeToggle
              value={hapticsEnabled}
              onValueChange={toggleHaptics}
              activeColor={activeTheme.accentColor}
              inactiveColor={activeTheme.secondaryTextColor}
            />
          </View>
        </View>

        {/* Accessibility */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: activeTheme.secondaryTextColor }]}>
            {t("settings:accessibility")}
          </Text>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: activeTheme.textColor }]}>
              {t("settings:colorblindPatterns")}
            </Text>
            <NativeToggle
              value={colorblindPatternsEnabled}
              onValueChange={setColorblindPatternsEnabled}
              activeColor={activeTheme.accentColor}
              inactiveColor={activeTheme.secondaryTextColor}
            />
          </View>
          <Text
            style={[styles.sectionHint, { color: activeTheme.secondaryTextColor }]}
            accessibilityElementsHidden
          >
            {t("settings:colorblindPatternsHint")}
          </Text>
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
            <NativeToggle
              value={notifyDaily}
              onValueChange={toggleNotifyDaily}
              activeColor={activeTheme.accentColor}
              inactiveColor={activeTheme.secondaryTextColor}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: activeTheme.textColor }]}>
              {t("settings:notifyStreak")}
            </Text>
            <NativeToggle
              value={notifyStreak}
              onValueChange={toggleNotifyStreak}
              activeColor={activeTheme.accentColor}
              inactiveColor={activeTheme.secondaryTextColor}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: activeTheme.textColor }]}>
              {t("settings:notifyWinback")}
            </Text>
            <NativeToggle
              value={notifyWinback}
              onValueChange={toggleNotifyWinback}
              activeColor={activeTheme.accentColor}
              inactiveColor={activeTheme.secondaryTextColor}
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
              scheduleTransient(() => setRestoreMessage(null), 3000)
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

        <Text style={[styles.versionText, { color: activeTheme.secondaryTextColor }]}>
          v{Application.nativeApplicationVersion}
        </Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  content: {
    paddingBottom: 40,
    paddingTop: 8,
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
  removeAdsBtn: {
    alignItems: "center",
    backgroundColor: UI_COLORS.brandPurple,
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  removeAdsBtnText: {
    color: UI_COLORS.white,
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
  sectionHint: {
    fontFamily: "Oxanium-Regular",
    fontSize: 12,
    marginTop: 6,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectorButtonInner: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  soundPackName: {
    fontFamily: "Oxanium-Regular",
    fontSize: 12,
  },
  switchLabel: {
    fontFamily: "Oxanium-Regular",
    fontSize: 14,
  },
  switchRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingRight: Platform.OS === "ios" ? 8 : 0,
    paddingVertical: 8,
  },
  themeSwatch: {
    borderRadius: 10,
    height: 48,
    overflow: "hidden",
    padding: 2,
    width: 48,
  },
  themeSwatchCell: {
    flex: 1,
  },
  themeSwatchCheck: {
    alignItems: "center",
    borderRadius: 9,
    borderWidth: 1.5,
    bottom: -4,
    height: 18,
    justifyContent: "center",
    position: "absolute",
    right: -4,
    width: 18,
  },
  themeSwatchEmphasized: {
    borderWidth: 2.5,
  },
  themeSwatchLockOverlay: {
    alignItems: "center",
    backgroundColor: UI_COLORS.backdropSoft,
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  themeSwatchNormal: {
    borderWidth: 1,
  },
  themeSwatchRow: {
    flex: 1,
    flexDirection: "row",
    gap: 2,
    marginBottom: 2,
  },
  unlockBtn: {
    alignItems: "center",
    backgroundColor: UI_COLORS.brandPurple,
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  unlockBtnText: {
    color: UI_COLORS.white,
    fontFamily: "Oxanium-SemiBold",
    fontSize: 14,
  },
  versionText: {
    fontFamily: "Oxanium-Regular",
    fontSize: 12,
    marginTop: 16,
    paddingBottom: 8,
    textAlign: "center",
  },
  volumeLabel: {
    fontFamily: "Oxanium-Medium",
    fontSize: 12,
    minWidth: 36,
    textAlign: "right",
  },
  volumeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  volumeSlider: {
    flex: 1,
    height: 32,
  },
})
