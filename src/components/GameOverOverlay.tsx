import { View, Text, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import LottieView from "lottie-react-native"
import { useTranslation } from "react-i18next"
import { EaseView } from "react-native-ease"

import { PressableScale } from "@/components/PressableScale"
import type { GameTheme } from "@/config/themes"

type GameOverOverlayProps = {
  visible: boolean
  score: number
  level: number
  highScore: number
  isNewHighScore: boolean
  showRemoveAds?: boolean
  showContinue?: boolean
  theme: GameTheme
  onPlayAgain: () => void
  onContinue?: () => void
  onShare?: () => void
  onRemoveAds?: () => void
  onHome?: () => void
  onViewStats?: () => void
  onViewAchievements?: () => void
}

export function GameOverOverlay({
  visible,
  score,
  level,
  highScore,
  isNewHighScore,
  showRemoveAds,
  showContinue,
  theme,
  onPlayAgain,
  onContinue,
  onShare,
  onRemoveAds,
  onHome,
  onViewStats,
  onViewAchievements,
}: GameOverOverlayProps) {
  const { t } = useTranslation()

  if (!visible) return null

  return (
    <EaseView
      testID="overlay-game-over"
      style={styles.backdrop}
      initialAnimate={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ default: { type: "timing", duration: 200 } }}
    >
      <EaseView
        style={[
          styles.card,
          { backgroundColor: theme.backgroundColor, borderColor: theme.borderColor },
        ]}
        initialAnimate={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ default: { type: "spring", stiffness: 300, damping: 20 } }}
      >
        {onHome && (
          <PressableScale
            testID="btn-home"
            wrapperStyle={styles.homeButton}
            onPress={onHome}
            accessibilityLabel={t("game:home")}
            accessibilityRole="button"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color={theme.secondaryTextColor} />
          </PressableScale>
        )}

        <Text style={styles.title}>{t("game:gameOver")}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: theme.secondaryTextColor }]}>
              {t("game:score")}
            </Text>
            <Text style={[styles.statValue, { color: theme.textColor }]}>{score}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: theme.secondaryTextColor }]}>
              {t("game:level")}
            </Text>
            <Text style={[styles.statValue, { color: theme.textColor }]}>{level}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: theme.secondaryTextColor }]}>
              {t("game:best")}
            </Text>
            <Text style={[styles.statValue, { color: theme.textColor }]}>{highScore}</Text>
          </View>
        </View>

        {isNewHighScore && (
          <View style={styles.celebrationContainer}>
            <LottieView
              source={require("../../assets/animations/trophy.json")}
              autoPlay
              loop={false}
              style={styles.lottie}
            />
            <View style={styles.badgeContainer}>
              <Ionicons name="trophy" size={20} color="#fbbf24" />
              <Text style={styles.badgeText}>{t("game:newHighScore")}</Text>
            </View>
          </View>
        )}

        <View style={styles.actions}>
          <PressableScale
            testID="btn-play-again"
            style={styles.playAgainButton}
            onPress={onPlayAgain}
            accessibilityLabel={t("game:playAgain")}
            accessibilityRole="button"
          >
            <Ionicons name="refresh" size={20} color="white" />
            <Text style={styles.buttonText}>{t("game:playAgain")}</Text>
          </PressableScale>

          {onShare && (
            <PressableScale
              testID="btn-share"
              style={styles.shareButton}
              onPress={onShare}
              accessibilityLabel={t("game:share")}
              accessibilityRole="button"
            >
              <Ionicons name="share-outline" size={20} color="white" />
              <Text style={styles.buttonText}>{t("game:share")}</Text>
            </PressableScale>
          )}
        </View>

        {showContinue && onContinue && (
          <PressableScale
            testID="btn-continue"
            style={styles.continueButton}
            onPress={onContinue}
            accessibilityLabel={t("game:continue")}
            accessibilityRole="button"
          >
            <Ionicons name="play-forward" size={18} color="white" />
            <Text style={styles.continueText}>{t("game:continue")}</Text>
          </PressableScale>
        )}

        {(onViewStats || onViewAchievements) && (
          <View style={styles.linkRow}>
            {onViewStats && (
              <PressableScale
                testID="btn-view-stats"
                onPress={onViewStats}
                accessibilityLabel={t("stats:title")}
                accessibilityRole="button"
              >
                <Text style={[styles.linkText, { color: theme.secondaryTextColor }]}>
                  {t("stats:title")}
                </Text>
              </PressableScale>
            )}
            {onViewAchievements && (
              <PressableScale
                testID="btn-view-achievements"
                onPress={onViewAchievements}
                accessibilityLabel={t("achievements:title")}
                accessibilityRole="button"
              >
                <Text style={[styles.linkText, { color: theme.secondaryTextColor }]}>
                  {t("achievements:title")}
                </Text>
              </PressableScale>
            )}
          </View>
        )}

        {showRemoveAds && onRemoveAds && (
          <PressableScale
            testID="btn-remove-ads"
            style={styles.removeAdsButton}
            onPress={onRemoveAds}
            accessibilityLabel={t("game:removeAds")}
            accessibilityRole="button"
          >
            <Ionicons name="close-circle-outline" size={18} color="#fbbf24" />
            <Text style={styles.removeAdsText}>{t("game:removeAds")}</Text>
          </PressableScale>
        )}
      </EaseView>
    </EaseView>
  )
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    zIndex: 100,
  },
  badgeContainer: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  badgeText: {
    color: "#fbbf24",
    fontFamily: "Oxanium-Bold",
    fontSize: 16,
  },
  buttonText: {
    color: "white",
    fontFamily: "Oxanium-SemiBold",
    fontSize: 16,
  },
  card: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    maxWidth: 380,
    paddingHorizontal: 24,
    paddingVertical: 28,
    width: "85%",
  },
  celebrationContainer: {
    alignItems: "center",
    marginTop: 12,
  },
  continueButton: {
    alignItems: "center",
    backgroundColor: "#8b5cf6",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  continueText: {
    color: "white",
    fontFamily: "Oxanium-SemiBold",
    fontSize: 14,
  },
  homeButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    position: "absolute",
    right: 8,
    top: 8,
    width: 44,
    zIndex: 1,
  },
  linkRow: {
    flexDirection: "row",
    gap: 20,
    justifyContent: "center",
    marginTop: 16,
  },
  linkText: {
    color: "#a0a0a0",
    fontFamily: "Oxanium-Medium",
    fontSize: 13,
  },
  lottie: {
    height: 80,
    width: 80,
  },
  playAgainButton: {
    alignItems: "center",
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  removeAdsButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 16,
    paddingVertical: 8,
  },
  removeAdsText: {
    color: "#fbbf24",
    fontFamily: "Oxanium-Medium",
    fontSize: 14,
  },
  shareButton: {
    alignItems: "center",
    backgroundColor: "#6b7280",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  statBox: {
    alignItems: "center",
    flex: 1,
  },
  statLabel: {
    color: "#a0a0a0",
    fontFamily: "Oxanium-Regular",
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: "white",
    fontFamily: "Oxanium-Bold",
    fontSize: 24,
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 16,
    width: "100%",
  },
  title: {
    color: "#ef4444",
    fontFamily: "Oxanium-Bold",
    fontSize: 28,
  },
})
