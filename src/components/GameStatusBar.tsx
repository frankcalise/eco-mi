import { useEffect, useState } from "react"
import { View, Text, StyleSheet } from "react-native"
import { useTranslation } from "react-i18next"
import { EaseView } from "react-native-ease"

import type { GameTheme } from "@/config/themes"
import type { Color } from "@/hooks/useGameEngine"

type GameStatusBarProps = {
  gameState: string
  sequence: Color[]
  playerSequence: Color[]
  theme: GameTheme
  timerDelta?: number | null
}

export function GameStatusBar({
  gameState,
  sequence,
  playerSequence,
  theme,
  timerDelta,
}: GameStatusBarProps) {
  const { t } = useTranslation()

  // Lag displayDelta behind timerDelta so the exit fade has content to render
  const [displayDelta, setDisplayDelta] = useState<number | null>(null)
  useEffect(() => {
    if (timerDelta !== null && timerDelta !== undefined) {
      setDisplayDelta(timerDelta)
      return undefined
    }
    if (displayDelta !== null) {
      const timeout = setTimeout(() => setDisplayDelta(null), 350)
      return () => clearTimeout(timeout)
    }
    return undefined
  }, [timerDelta])

  return (
    <View
      style={styles.statusContainer}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityRole="text"
    >
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
        {(gameState === "showing" ||
          gameState === "waiting" ||
          gameState === "advancing" ||
          gameState === "replaying") &&
          (sequence.length <= 15 ? (
            sequence.map((_, i) => {
              // Fill on any state where the player has inputted this index —
              // includes "advancing" so the last dot animates before the next level starts.
              const isFilled = i < playerSequence.length
              return (
                <EaseView
                  key={i}
                  // Outer animation runs on mount — existing dots don't re-mount
                  // (stable key), so only new dots pop in when the sequence grows.
                  initialAnimate={{ opacity: 0, scale: 0.3 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    default: { type: "spring", stiffness: 300, damping: 20 },
                  }}
                >
                  <View style={[styles.progressDot, { backgroundColor: theme.borderColor }]}>
                    <EaseView
                      style={[styles.progressDotFill, { backgroundColor: theme.accentColor }]}
                      initialAnimate={{ opacity: 0, scale: 0.5 }}
                      animate={{
                        opacity: isFilled ? 1 : 0,
                        scale: isFilled ? 1 : 0.5,
                      }}
                      transition={{
                        default: { type: "spring", stiffness: 400, damping: 18, mass: 0.6 },
                      }}
                    />
                  </View>
                </EaseView>
              )
            })
          ) : (
            <Text style={[styles.progressFraction, { color: theme.secondaryTextColor }]}>
              {playerSequence.length}/{sequence.length}
            </Text>
          ))}
      </View>
      {/* Reserved slot for timer delta feedback — prevents layout shift */}
      <View style={styles.deltaSlot}>
        {displayDelta !== null && (
          <EaseView
            initialAnimate={{ opacity: 0, translateY: 4 }}
            animate={{
              opacity: timerDelta !== null && timerDelta !== undefined ? 1 : 0,
              translateY: 0,
            }}
            transition={{
              default: { type: "timing", duration: 300, easing: "easeInOut" },
            }}
          >
            <Text
              style={[
                styles.deltaText,
                {
                  color: displayDelta > 0 ? theme.accentColor : theme.destructiveColor,
                },
              ]}
            >
              {displayDelta > 0
                ? t("game:timeGained", { delta: displayDelta })
                : t("game:timePenalty", { delta: Math.abs(displayDelta) })}
            </Text>
          </EaseView>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  deltaSlot: {
    alignItems: "center",
    height: 22,
    justifyContent: "center",
    marginTop: 6,
  },
  deltaText: {
    fontFamily: "Oxanium-SemiBold",
    fontSize: 14,
    textAlign: "center",
  },
  progressDot: {
    alignItems: "center",
    borderRadius: 5,
    height: 10,
    justifyContent: "center",
    width: 10,
  },
  progressDotFill: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
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
