import { useEffect, useRef, useState } from "react"
import { Animated, I18nManager, Pressable, StyleSheet, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Gesture, GestureDetector, Directions } from "react-native-gesture-handler"

import type { GameTheme } from "@/config/themes"
import { useHighScores, type HighScoreEntry, type GameMode } from "@/hooks/useHighScores"
import { translate } from "@/i18n/translate"

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

  return <Animated.View style={{ opacity: pulse }}>{children}</Animated.View>
}

export function HighScoreTable({
  initialMode,
  highlightIndex,
  highlightMode,
  theme,
}: HighScoreTableProps) {
  const [selectedMode, setSelectedMode] = useState<GameMode>(initialMode)
  const { getHighScores } = useHighScores()
  const scores = getHighScores(selectedMode)

  const cellColor = theme.textColor
  const highlight = theme.buttonColors.red.color
  const activeHighlight = selectedMode === highlightMode ? highlightIndex : undefined

  // Fling gestures for swiping between mode tabs
  // Directions are physical (not logical) — flip for RTL
  const leftDir = I18nManager.isRTL ? Directions.RIGHT : Directions.LEFT
  const rightDir = I18nManager.isRTL ? Directions.LEFT : Directions.RIGHT

  const flingNext = Gesture.Fling()
    .direction(leftDir)
    .onEnd(() => {
      setSelectedMode((prev) => {
        const idx = MODES.findIndex((m) => m.id === prev)
        if (idx >= MODES.length - 1) return prev
        return MODES[idx + 1].id
      })
    })
    .runOnJS(true)

  const flingPrev = Gesture.Fling()
    .direction(rightDir)
    .onEnd(() => {
      setSelectedMode((prev) => {
        const idx = MODES.findIndex((m) => m.id === prev)
        if (idx <= 0) return prev
        return MODES[idx - 1].id
      })
    })
    .runOnJS(true)

  const swipeGesture = Gesture.Simultaneous(flingNext, flingPrev)

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
    <View testID="high-score-table" style={styles.container}>
      <Text style={[styles.heading, { color: highlight }]}>{translate("game:highScores")}</Text>

      <View style={styles.modeTabs}>
        {MODES.map((m) => {
          const isActive = selectedMode === m.id
          return (
            <Pressable
              key={m.id}
              style={[styles.modeTab, isActive && { backgroundColor: theme.surfaceColor }]}
              onPress={() => setSelectedMode(m.id)}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
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

      <GestureDetector gesture={swipeGesture}>
        <View>
          <View style={[styles.headerRow, { borderBottomColor: theme.borderColor }]}>
            <Text style={[styles.headerCell, styles.rankCol, { color: theme.secondaryTextColor }]}>
              {translate("game:rank")}
            </Text>
            <Text style={[styles.headerCell, styles.nameCol, { color: theme.secondaryTextColor }]}>
              {translate("game:initials")}
            </Text>
            <Text style={[styles.headerCell, styles.scoreCol, { color: theme.secondaryTextColor }]}>
              {translate("game:scoreLbl")}
            </Text>
            <Text style={[styles.headerCell, styles.levelCol, { color: theme.secondaryTextColor }]}>
              {translate("game:levelLbl")}
            </Text>
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
                <Text
                  style={[
                    styles.cell,
                    styles.rankCol,
                    { color: cellColor },
                    isHighlighted && { color: highlight },
                  ]}
                >
                  {String(row.rank).padStart(2, " ")}.
                </Text>
                <Text
                  style={[
                    styles.cell,
                    styles.nameCol,
                    { color: cellColor },
                    isHighlighted && { color: highlight },
                  ]}
                >
                  {row.initials}
                </Text>
                <Text
                  style={[
                    styles.cell,
                    styles.scoreCol,
                    { color: cellColor },
                    isHighlighted && { color: highlight },
                  ]}
                >
                  {row.score}
                </Text>
                <Text
                  style={[
                    styles.cell,
                    styles.levelCol,
                    { color: cellColor },
                    isHighlighted && { color: highlight },
                  ]}
                >
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
      </GestureDetector>
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
  modeTabs: {
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    marginBottom: 12,
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
