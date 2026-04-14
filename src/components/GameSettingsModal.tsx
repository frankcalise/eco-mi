import { useState } from "react"
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native"
import * as Haptics from "expo-haptics"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { EaseView } from "react-native-ease"
import type { OscillatorType } from "react-native-audio-api"

import { ModalOverlay } from "@/components/ModalOverlay"
import { PressableScale } from "@/components/PressableScale"

import { SOUND_PACKS } from "@/config/soundPacks"
import type { GameTheme } from "@/config/themes"
import { themeIds, gameThemes } from "@/config/themes"
import { usePurchases } from "@/hooks/usePurchases"
import { useSoundPack } from "@/hooks/useSoundPack"
import { useTheme } from "@/hooks/useTheme"
import { useAnalytics } from "@/utils/analytics"

type GameSettingsModalProps = {
  visible: boolean
  onDismiss: () => void
  soundEnabled: boolean
  toggleSound: () => void
  playPreview: (type?: OscillatorType) => void
}

export function GameSettingsModal({
  visible,
  onDismiss,
  soundEnabled,
  toggleSound,
  playPreview,
}: GameSettingsModalProps) {
  const { t } = useTranslation()
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
  const analytics = useAnalytics()

  const [poppingSoundPack, setPoppingSoundPack] = useState<string | null>(null)
  const [soundHint, setSoundHint] = useState(false)
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null)
  const [poppingTheme, setPoppingTheme] = useState<string | null>(null)

  function handleDismiss() {
    clearPreview()
    clearSoundPreview()
    onDismiss()
  }

  async function handleRemoveAds() {
    analytics.trackIapInitiated("ecomi_remove_ads")
    const success = await purchaseRemoveAds()
    if (success) {
      analytics.trackIapCompleted("ecomi_remove_ads")
    }
  }

  return (
    <ModalOverlay visible={visible} theme={activeTheme} onDismiss={handleDismiss}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: activeTheme.textColor }]}>
            {t("game:settings")}
          </Text>
          <PressableScale
            testID="btn-settings-done"
            onPress={handleDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.doneText, { color: activeTheme.accentColor }]}>
              {t("common:done")}
            </Text>
          </PressableScale>
        </View>

            {/* Sound Toggle */}
            <View style={styles.settingsSection}>
              <Text
                style={[styles.settingsSectionLabel, { color: activeTheme.secondaryTextColor }]}
              >
                {t("game:soundToggle")}
              </Text>
              <PressableScale
                testID="btn-sound-toggle"
                accessibilityLabel={t("a11y:soundToggle")}
                accessibilityRole="button"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  toggleSound()
                }}
                style={[styles.soundToggleBtn, soundEnabled && styles.soundToggleBtnActive]}
              >
                <Ionicons
                  name={soundEnabled ? "volume-high" : "volume-mute"}
                  size={20}
                  color="white"
                />
                <Text style={styles.soundToggleText}>
                  {soundEnabled ? t("common:on") : t("common:off")}
                </Text>
              </PressableScale>
            </View>

            {/* Sound Pack */}
            <View style={styles.settingsSection}>
              <Text
                style={[styles.settingsSectionLabel, { color: activeTheme.secondaryTextColor }]}
              >
                {t("game:soundPack")}
              </Text>
              <View style={styles.settingsRow}>
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
                        if (isOwned && pack.id === soundPack.id) return
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
                        transition={{
                          default: { type: "spring", stiffness: 400, damping: 15 },
                        }}
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
                            style={{
                              color: isSelected
                                ? activeTheme.accentColor
                                : isPreviewing
                                  ? activeTheme.warningColor
                                  : activeTheme.secondaryTextColor,
                              fontFamily: "Oxanium-Regular",
                              fontSize: 12,
                            }}
                          >
                            {pack.name}
                          </Text>
                          {!isOwned && (
                            <Ionicons
                              name="lock-closed"
                              size={10}
                              color={activeTheme.secondaryTextColor}
                              style={styles.lockIcon}
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
            </View>
            <EaseView
              animate={{ opacity: soundHint ? 1 : 0, scale: soundHint ? 1 : 0.95 }}
              transition={{ default: { type: "timing", duration: 200, easing: "easeOut" } }}
              style={soundHint ? undefined : styles.hintHidden}
            >
              <Text style={[styles.soundHintText, { color: activeTheme.secondaryTextColor }]}>
                {t("game:soundDisabledHint")}
              </Text>
            </EaseView>

            {/* Theme */}
            <View style={styles.settingsSection}>
              <Text
                style={[styles.settingsSectionLabel, { color: activeTheme.secondaryTextColor }]}
              >
                {t("game:theme")}
              </Text>
              <View style={styles.settingsRow}>
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
                        if (isOwned && id === theme.id) return
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
                        transition={{
                          default: { type: "spring", stiffness: 400, damping: 15 },
                        }}
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
                            style={styles.themeLockIcon}
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

            {/* Remove Ads */}
            {!removeAds && (
              <View style={styles.settingsSection}>
                <PressableScale
                  style={styles.removeAdsBtn}
                  accessibilityLabel={t("a11y:removeAds")}
                  accessibilityRole="button"
                  onPress={handleRemoveAds}
                >
                  <Ionicons name="shield-checkmark" size={18} color="white" />
                  <Text style={styles.removeAdsBtnText}>{t("game:removeAds")}</Text>
                </PressableScale>
              </View>
            )}

            {/* Restore Purchases */}
            <View style={styles.settingsSection}>
              <PressableScale
                style={styles.restoreBtn}
                accessibilityLabel={t("a11y:restorePurchases")}
                accessibilityRole="button"
                onPress={async () => {
                  const success = await restorePurchases()
                  setRestoreMessage(
                    success ? t("game:restoreSuccess") : t("game:restoreFailed"),
                  )
                  setTimeout(() => setRestoreMessage(null), 3000)
                }}
              >
                <Ionicons name="refresh" size={16} color={activeTheme.secondaryTextColor} />
                <Text style={[styles.restoreBtnText, { color: activeTheme.secondaryTextColor }]}>
                  {t("game:restorePurchases")}
                </Text>
              </PressableScale>
              <EaseView
                animate={{
                  opacity: restoreMessage ? 1 : 0,
                  scale: restoreMessage ? 1 : 0.95,
                }}
                transition={{
                  default: { type: "timing", duration: 200, easing: "easeOut" },
                }}
                style={restoreMessage ? undefined : styles.hintHidden}
              >
                <Text style={[styles.restoreHintText, { color: activeTheme.secondaryTextColor }]}>
                  {restoreMessage}
                </Text>
              </EaseView>
            </View>
      </ScrollView>
    </ModalOverlay>
  )
}

const styles = StyleSheet.create({
  doneText: {
    fontFamily: "Oxanium-SemiBold",
    fontSize: 16,
  },
  hintHidden: {
    height: 0,
    overflow: "hidden",
  },
  lockIcon: {
    opacity: 0.6,
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: "Oxanium-Bold",
    fontSize: 20,
  },
  removeAdsBtn: {
    alignItems: "center",
    backgroundColor: "#8b5cf6",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
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
    flexDirection: "row",
    gap: 6,
    paddingVertical: 8,
  },
  restoreBtnText: {
    fontFamily: "Oxanium-Regular",
    fontSize: 13,
  },
  restoreHintText: {
    fontFamily: "Oxanium-Regular",
    fontSize: 12,
    marginTop: 6,
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
  settingsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  settingsSection: {
    marginBottom: 16,
  },
  settingsSectionLabel: {
    fontFamily: "Oxanium-Medium",
    fontSize: 13,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  soundHintText: {
    fontFamily: "Oxanium-Regular",
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },
  soundToggleBtn: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
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
  themeLockIcon: {
    opacity: 0.7,
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
