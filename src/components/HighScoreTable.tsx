import { useEffect, useRef } from "react"
import { Animated, StyleSheet, Text, View } from "react-native"

import { translate } from "@/i18n/translate"
import type { HighScoreEntry } from "@/hooks/useHighScores"

interface HighScoreTableProps {
  scores: HighScoreEntry[]
  highlightIndex?: number
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

export function HighScoreTable({ scores, highlightIndex }: HighScoreTableProps) {
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
      <Text style={styles.heading}>{translate("game:highScores")}</Text>

      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, styles.rankCol]}>{translate("game:rank")}</Text>
        <Text style={[styles.headerCell, styles.nameCol]}>{translate("game:initials")}</Text>
        <Text style={[styles.headerCell, styles.scoreCol]}>SCORE</Text>
        <Text style={[styles.headerCell, styles.levelCol]}>LVL</Text>
      </View>

      {rows.map((row, i) => {
        const isHighlighted = highlightIndex === i
        const rowContent = (
          <View
            key={i}
            style={[
              styles.row,
              isHighlighted && styles.highlightedRow,
              i % 2 === 0 && styles.evenRow,
            ]}
          >
            <Text style={[styles.cell, styles.rankCol, isHighlighted && styles.highlightedText]}>
              {String(row.rank).padStart(2, " ")}.
            </Text>
            <Text style={[styles.cell, styles.nameCol, isHighlighted && styles.highlightedText]}>
              {row.initials}
            </Text>
            <Text style={[styles.cell, styles.scoreCol, isHighlighted && styles.highlightedText]}>
              {row.score}
            </Text>
            <Text style={[styles.cell, styles.levelCol, isHighlighted && styles.highlightedText]}>
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
    color: "#22c55e",
    fontFamily: "Oxanium-Bold",
    fontSize: 15,
  },
  container: {
    paddingVertical: 8,
  },
  evenRow: {
    backgroundColor: "rgba(34, 197, 94, 0.04)",
  },
  headerCell: {
    color: "#666",
    fontFamily: "Oxanium-Regular",
    fontSize: 11,
    letterSpacing: 1,
  },
  headerRow: {
    borderBottomColor: "rgba(34, 197, 94, 0.3)",
    borderBottomWidth: 1,
    flexDirection: "row",
    marginBottom: 4,
    paddingBottom: 6,
    paddingHorizontal: 8,
  },
  heading: {
    color: "#fbbf24",
    fontFamily: "Oxanium-Bold",
    fontSize: 20,
    letterSpacing: 2,
    marginBottom: 12,
    textAlign: "center",
  },
  highlightedRow: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderRadius: 4,
  },
  highlightedText: {
    color: "#fbbf24",
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
