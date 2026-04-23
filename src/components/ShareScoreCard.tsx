import { forwardRef } from "react"
import { View, Text, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import ViewShot from "react-native-view-shot"

import type { GameTheme } from "@/config/themes"
import type { GameMode } from "@/hooks/useGameEngine"

type ShareScoreCardProps = {
  score: number
  level: number
  mode: GameMode
  isNewHighScore: boolean
  theme: GameTheme
}

export const ShareScoreCard = forwardRef<ViewShot, ShareScoreCardProps>(function ShareScoreCard(
  { score, level, mode, isNewHighScore, theme },
  ref,
) {
  const { t } = useTranslation()

  // The 4 pad colors in their canonical screen positions (red=TL, blue=TR,
  // green=BL, yellow=BR). Used for both the logo dots and the per-digit score
  // split so the card reads as "Eco Mi" even at thumbnail size.
  const padColors = [
    theme.buttonColors.red.color,
    theme.buttonColors.blue.color,
    theme.buttonColors.green.color,
    theme.buttonColors.yellow.color,
  ]

  const scoreDigits = String(score).split("")

  return (
    <ViewShot ref={ref} options={{ format: "png", quality: 1.0 }} style={styles.offscreen}>
      <View style={[styles.card, { backgroundColor: theme.backgroundColor }]}>
        <View style={styles.header}>
          {/* 2×2 pad-dot mark pairs with "ECO MI" so the game's pad identity
            is visible at feed-thumbnail scale even if the wordmark isn't. */}
          <View style={styles.logoMark}>
            <View style={styles.logoRow}>
              <View style={[styles.logoDot, { backgroundColor: padColors[0] }]} />
              <View style={[styles.logoDot, { backgroundColor: padColors[1] }]} />
            </View>
            <View style={styles.logoRow}>
              <View style={[styles.logoDot, { backgroundColor: padColors[2] }]} />
              <View style={[styles.logoDot, { backgroundColor: padColors[3] }]} />
            </View>
          </View>
          <Text style={[styles.appName, { color: theme.secondaryTextColor }]}>Eco Mi</Text>
        </View>

        {isNewHighScore && (
          <View style={styles.badge}>
            <Ionicons name="trophy" size={16} color={theme.warningColor} />
            <Text style={[styles.badgeText, { color: theme.warningColor }]}>
              {t("game:newHighScore")}
            </Text>
          </View>
        )}

        {/* Per-digit pad-color split. Cycles red → blue → green → yellow on
          scores longer than 4 digits so the palette signature survives at
          any score length. */}
        <Text style={[styles.scoreValue, { color: theme.textColor }]}>
          {scoreDigits.map((digit, i) => (
            <Text key={i} style={{ color: padColors[i % padColors.length] }}>
              {digit}
            </Text>
          ))}
        </Text>
        <Text style={[styles.scoreLabel, { color: theme.secondaryTextColor }]}>
          {t("game:score")}
        </Text>

        <View style={styles.detailRow}>
          <View style={styles.detail}>
            <Text style={[styles.detailValue, { color: theme.textColor }]}>{level}</Text>
            <Text style={[styles.detailLabel, { color: theme.secondaryTextColor }]}>
              {t("game:level")}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.borderColor }]} />
          <View style={styles.detail}>
            <Text style={[styles.detailValue, { color: theme.textColor }]}>
              {t(`game:modes.${mode}`)}
            </Text>
            <Text style={[styles.detailLabel, { color: theme.secondaryTextColor }]}>
              {t("game:mode")}
            </Text>
          </View>
        </View>

        <Text style={[styles.watermark, { color: theme.secondaryTextColor }]}>
          {t("game:shareCardWatermark")}
        </Text>
      </View>
    </ViewShot>
  )
})

const styles = StyleSheet.create({
  appName: {
    fontFamily: "Oxanium-Bold",
    fontSize: 14,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  badge: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginBottom: 4,
  },
  badgeText: {
    fontFamily: "Oxanium-Bold",
    fontSize: 12,
  },
  card: {
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 40,
    paddingVertical: 32,
    width: 320,
  },
  detail: {
    alignItems: "center",
    flex: 1,
  },
  detailLabel: {
    fontFamily: "Oxanium-Regular",
    fontSize: 11,
    marginTop: 2,
  },
  detailRow: {
    alignItems: "center",
    flexDirection: "row",
    marginTop: 16,
    width: "100%",
  },
  detailValue: {
    fontFamily: "Oxanium-Bold",
    fontSize: 18,
  },
  divider: {
    height: 24,
    marginHorizontal: 16,
    width: 1,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  logoDot: {
    borderRadius: 2,
    height: 7,
    width: 7,
  },
  logoMark: {
    gap: 2,
  },
  logoRow: {
    flexDirection: "row",
    gap: 2,
  },
  offscreen: {
    left: -9999,
    position: "absolute",
    top: -9999,
  },
  scoreLabel: {
    fontFamily: "Oxanium-Regular",
    fontSize: 14,
    marginTop: 4,
  },
  scoreValue: {
    fontFamily: "Oxanium-Bold",
    fontSize: 56,
  },
  watermark: {
    fontFamily: "Oxanium-Regular",
    fontSize: 11,
    marginTop: 20,
    opacity: 0.6,
  },
})
