import { useEffect, useRef, useState } from "react"
import { Animated, Pressable, StyleSheet, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"

import type { GameTheme } from "@/config/themes"
import { useHighScores, type GameMode } from "@/hooks/useHighScores"
import { translate } from "@/i18n/translate"
import { UI_COLORS } from "@/theme/uiColors"

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

  const rows = Array.from({ length: 5 }, (_, i) => {
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
      <View style={styles.modeTabs}>
        {MODES.map((m) => {
          const isActive = selectedMode === m.id
          return (
            <Pressable
              key={m.id}
              style={[
                styles.modeTab,
                // eslint-disable-next-line react-native/no-inline-styles, react-native/no-color-literals
                {
                  borderColor: isActive ? theme.accentColor : theme.borderColor,
                  backgroundColor: isActive ? `${theme.accentColor}1A` : "transparent",
                },
              ]}
              onPress={() => setSelectedMode(m.id)}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              accessibilityLabel={translate(`game:modes.${m.id}`)}
              accessibilityRole="button"
            >
              <Ionicons
                name={m.icon}
                size={20}
                color={isActive ? theme.accentColor : theme.secondaryTextColor}
              />
              <Text
                style={[
                  styles.modeTabLabel,
                  { color: isActive ? theme.accentColor : theme.secondaryTextColor },
                ]}
              >
                {translate(`game:modes.${m.id}`)}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {scores.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="trophy-outline" size={48} color={theme.secondaryTextColor} />
          <Text style={[styles.emptyTitle, { color: theme.textColor }]}>
            {translate("leaderboard:emptyTitle")}
          </Text>
          <Text style={[styles.emptyBody, { color: theme.secondaryTextColor }]}>
            {translate("game:emptyLeaderboard")}
          </Text>
        </View>
      ) : (
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
                  i % 2 === 0 && { backgroundColor: theme.surfaceColor },
                  isHighlighted && styles.rowHighlighted,
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
      )}
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
  emptyBody: {
    fontFamily: "Oxanium-Regular",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontFamily: "Oxanium-Bold",
    fontSize: 20,
    marginTop: 16,
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
  levelCol: {
    textAlign: "right",
    width: 36,
  },
  modeTab: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    paddingVertical: 12,
  },
  modeTabLabel: {
    fontFamily: "Oxanium-Medium",
    fontSize: 11,
    textTransform: "uppercase",
  },
  modeTabs: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginBottom: 16,
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
  rowHighlighted: {
    backgroundColor: UI_COLORS.amberTint15,
    borderColor: UI_COLORS.amberTint30,
    borderRadius: 4,
    borderWidth: 1,
  },
  scoreCol: {
    textAlign: "right",
    width: 60,
  },
})
