import { useEffect, useRef, useState } from "react"
import { Animated, I18nManager, PanResponder, Pressable, StyleSheet, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"

import type { GameTheme } from "@/config/themes"
import { translate } from "@/i18n/translate"
import { useHighScores, type HighScoreEntry, type GameMode } from "@/hooks/useHighScores"

const MODES: { id: GameMode; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "classic", icon: "game-controller" },
  { id: "daily", icon: "calendar" },
  { id: "timed", icon: "timer" },
  { id: "reverse", icon: "swap-horizontal" },
  { id: "chaos", icon: "shuffle" },
]

interface HighScoreTableProps {
  initialMode: GameMode
  highlightIndex?: number
  highlightMode?: GameMode
  theme: GameTheme
}

function HighlightRow({ children }: { children: React.ReactNode }) {
  const pulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    )
    animation.start()
    return () => animation.stop()
  }, [pulse])

  return (
    <Animated.View style={{ opacity: pulse }}>
      {children}
    </Animated.View>
  )
}

export function HighScoreTable({ initialMode, highlightIndex, highlightMode, theme }: HighScoreTableProps) {
  const [selectedMode, setSelectedMode] = useState<GameMode>(initialMode)
  const { getHighScores } = useHighScores()
  const scores = getHighScores(selectedMode)

  const SWIPE_THRESHOLD = 50
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 20 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dx) < SWIPE_THRESHOLD) return
        // In RTL, swipe directions are inverted
        const isNext = I18nManager.isRTL ? gesture.dx > 0 : gesture.dx < 0
        setSelectedMode((prev) => {
          const idx = MODES.findIndex((m) => m.id === prev)
          const next = isNext ? (idx + 1) % MODES.length : (idx - 1 + MODES.length) % MODES.length
          return MODES[next].id
        })
      },
    }),
  ).current

  const cellColor = theme.textColor
  const highlight = theme.buttonColors.red.color
  const activeHighlight = selectedMode === highlightMode ? highlightIndex : undefined

  const rows = Array.from({ length: 10 }, (_, i) => {
    const entry = scores[i]
    return {
      rank: i + 1,
      initials: entry?.initials ?? translate("game:emptyInitials"),
      score: entry ? String(entry.score).padStart(5, " ") : translate("game:emptyScore"),
      level: entry ? String(entry.level) : "-",
    }
  })

  return (
    <View testID="high-score-table" style={styles.container} {...panResponder.panHandlers}>
      <Text style={[styles.heading, { color: highlight }]}>{translate("game:highScores")}</Text>

      <View style={styles.modeTabs}>
        {MODES.map((m) => {
          const isActive = selectedMode === m.id
          return (
            <Pressable
              key={m.id}
              style={[styles.modeTab, isActive && { backgroundColor: theme.surfaceColor }]}
              onPress={() => setSelectedMode(m.id)}
            >
              <Ionicons
                name={m.icon}
                size={16}
                color={isActive ? theme.textColor : theme.secondaryTextColor}
              />
              <Text
                style={[
                  styles.modeTabLabel,
                  { color: isActive ? theme.textColor : theme.secondaryTextColor },
                ]}
              >
                {translate(`game:modes.${m.id}`)}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <View style={[styles.headerRow, { borderBottomColor: theme.borderColor }]}>
        <Text style={[styles.headerCell, styles.rankCol, { color: theme.secondaryTextColor }]}>{translate("game:rank")}</Text>
        <Text style={[styles.headerCell, styles.nameCol, { color: theme.secondaryTextColor }]}>{translate("game:initials")}</Text>
        <Text style={[styles.headerCell, styles.scoreCol, { color: theme.secondaryTextColor }]}>SCORE</Text>
        <Text style={[styles.headerCell, styles.levelCol, { color: theme.secondaryTextColor }]}>LVL</Text>
      </View>

      {rows.map((row, i) => {
        const isHighlighted = activeHighlight === i
        const rowContent = (
          <View
            key={i}
            style={[
              styles.row,
              isHighlighted && { backgroundColor: theme.surfaceColor, borderRadius: 4 },
              i % 2 === 0 && { backgroundColor: theme.surfaceColor },
            ]}
          >
            <Text style={[styles.cell, styles.rankCol, { color: cellColor }, isHighlighted && { color: highlight }]}>
              {String(row.rank).padStart(2, " ")}.
            </Text>
            <Text style={[styles.cell, styles.nameCol, { color: cellColor }, isHighlighted && { color: highlight }]}>
              {row.initials}
            </Text>
            <Text style={[styles.cell, styles.scoreCol, { color: cellColor }, isHighlighted && { color: highlight }]}>
              {row.score}
            </Text>
            <Text style={[styles.cell, styles.levelCol, { color: cellColor }, isHighlighted && { color: highlight }]}>
              {row.level}
            </Text>
          </View>
        )

        if (isHighlighted) {
          return <HighlightRow key={i}>{rowContent}</HighlightRow>
        }
        return rowContent
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  cell: {
    fontFamily: "Oxanium-Bold",
    fontSize: 15,
  },
  container: {
    paddingVertical: 8,
  },
  headerCell: {
    fontFamily: "Oxanium-Regular",
    fontSize: 11,
    letterSpacing: 1,
  },
  headerRow: {
    borderBottomWidth: 1,
    flexDirection: "row",
    marginBottom: 4,
    paddingBottom: 6,
    paddingHorizontal: 8,
  },
  heading: {
    fontFamily: "Oxanium-Bold",
    fontSize: 20,
    letterSpacing: 2,
    marginBottom: 8,
    textAlign: "center",
  },
  levelCol: {
    textAlign: "right",
    width: 36,
  },
  modeTabs: {
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    marginBottom: 12,
  },
  modeTab: {
    alignItems: "center",
    borderRadius: 6,
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  modeTabLabel: {
    fontFamily: "Oxanium-Regular",
    fontSize: 9,
    textTransform: "uppercase",
  },
  nameCol: {
    flex: 1,
    textAlign: "center",
  },
  rankCol: {
    width: 36,
  },
  row: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  scoreCol: {
    textAlign: "right",
    width: 60,
  },
})
