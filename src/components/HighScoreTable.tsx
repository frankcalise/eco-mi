import { useEffect, useRef } from "react"
import { Animated, StyleSheet, Text, View } from "react-native"

import type { GameTheme } from "@/config/themes"
import { translate } from "@/i18n/translate"
import type { HighScoreEntry } from "@/hooks/useHighScores"

interface HighScoreTableProps {
  scores: HighScoreEntry[]
  highlightIndex?: number
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

export function HighScoreTable({ scores, highlightIndex, theme }: HighScoreTableProps) {
  const accent = theme.buttonColors.green.color
  const highlight = theme.buttonColors.yellow.color

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

      <View style={[styles.headerRow, { borderBottomColor: theme.borderColor }]}>
        <Text style={[styles.headerCell, styles.rankCol, { color: theme.secondaryTextColor }]}>{translate("game:rank")}</Text>
        <Text style={[styles.headerCell, styles.nameCol, { color: theme.secondaryTextColor }]}>{translate("game:initials")}</Text>
        <Text style={[styles.headerCell, styles.scoreCol, { color: theme.secondaryTextColor }]}>SCORE</Text>
        <Text style={[styles.headerCell, styles.levelCol, { color: theme.secondaryTextColor }]}>LVL</Text>
      </View>

      {rows.map((row, i) => {
        const isHighlighted = highlightIndex === i
        const rowContent = (
          <View
            key={i}
            style={[
              styles.row,
              isHighlighted && { backgroundColor: theme.surfaceColor, borderRadius: 4 },
              i % 2 === 0 && { backgroundColor: theme.surfaceColor },
            ]}
          >
            <Text style={[styles.cell, styles.rankCol, { color: accent }, isHighlighted && { color: highlight }]}>
              {String(row.rank).padStart(2, " ")}.
            </Text>
            <Text style={[styles.cell, styles.nameCol, { color: accent }, isHighlighted && { color: highlight }]}>
              {row.initials}
            </Text>
            <Text style={[styles.cell, styles.scoreCol, { color: accent }, isHighlighted && { color: highlight }]}>
              {row.score}
            </Text>
            <Text style={[styles.cell, styles.levelCol, { color: accent }, isHighlighted && { color: highlight }]}>
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
    marginBottom: 12,
    textAlign: "center",
  },
  levelCol: {
    textAlign: "right",
    width: 36,
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
