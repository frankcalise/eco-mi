import { View, Text, StyleSheet } from "react-native"
import { useTranslation } from "react-i18next"

import type { GameTheme } from "@/config/themes"
import type { Color } from "@/hooks/useGameEngine"

type GameStatusBarProps = {
  gameState: string
  sequence: Color[]
  playerSequence: Color[]
  theme: GameTheme
}

export function GameStatusBar({ gameState, sequence, playerSequence, theme }: GameStatusBarProps) {
  const { t } = useTranslation()

  return (
    <View style={styles.statusContainer}>
      {gameState === "showing" && (
        <Text style={[styles.statusText, { color: theme.secondaryTextColor }]}>
          {t("game:watchSequence")}
        </Text>
      )}
      {gameState === "waiting" && (
        <Text style={[styles.statusText, { color: theme.textColor }]}>
          {t("game:repeatSequence")}
        </Text>
      )}
      <View style={styles.progressRow}>
        {(gameState === "showing" || gameState === "waiting") &&
          (sequence.length <= 15 ? (
            sequence.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  { backgroundColor: theme.borderColor },
                  gameState === "waiting" &&
                    i < playerSequence.length &&
                    styles.progressDotFilled,
                  gameState === "waiting" &&
                    i < playerSequence.length && { backgroundColor: theme.accentColor },
                ]}
              />
            ))
          ) : (
            <Text style={[styles.progressFraction, { color: theme.secondaryTextColor }]}>
              {playerSequence.length}/{sequence.length}
            </Text>
          ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  progressDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  progressDotFilled: {},
  progressFraction: {
    fontFamily: "Oxanium-Regular",
    fontSize: 14,
  },
  progressRow: {
    flexDirection: "row",
    gap: 6,
    height: 18,
    justifyContent: "center",
    marginTop: 8,
  },
  statusContainer: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  statusText: {
    fontFamily: "Oxanium-Regular",
    fontSize: 16,
    textAlign: "center",
  },
})
