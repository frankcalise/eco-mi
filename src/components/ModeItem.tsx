import { View, Text, Pressable, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { EaseView } from "react-native-ease"

import type { GameTheme } from "@/config/themes"
import type { GameMode } from "@/hooks/useGameEngine"

const PULSE_DURATION = 300

type ModeItemProps = {
  mode: { id: GameMode; icon: keyof typeof Ionicons.glyphMap }
  isSelected: boolean
  isPulsing: boolean
  pulsePhase: "bright" | "dim"
  streak: number
  theme: GameTheme
  isTablet?: boolean
  onPress: () => void
}

export function ModeItem({
  mode: m,
  isSelected,
  isPulsing,
  pulsePhase,
  streak,
  theme,
  isTablet = false,
  onPress,
}: ModeItemProps) {
  const { t } = useTranslation()

  const pulseBright = isPulsing && pulsePhase === "bright"
  const showGreen = isSelected || pulseBright
  const accent = theme.accentColor

  return (
    <Pressable testID={`btn-mode-${m.id}`} onPress={onPress}>
      <EaseView
        animate={{
          scale: pulseBright ? 1.03 : 1,
          backgroundColor: pulseBright
            ? `${accent}40`
            : isSelected
              ? `${accent}1A`
              : "rgba(0, 0, 0, 0)",
        }}
        transition={{
          default: { type: "timing", duration: PULSE_DURATION, easing: "easeOut" },
        }}
        style={[
          styles.modeItem,
          isTablet && styles.modeItemTablet,
          { borderColor: showGreen ? accent : theme.borderColor },
        ]}
      >
        <Ionicons
          name={m.icon}
          size={isTablet ? 28 : 22}
          color={showGreen ? accent : theme.secondaryTextColor}
        />
        <View style={styles.modeItemText}>
          <Text
            style={[
              styles.modeItemLabel,
              isTablet && styles.modeItemLabelTablet,
              { color: showGreen ? accent : theme.textColor },
            ]}
          >
            {t(`game:modes.${m.id}`)}
            {m.id === "daily" && streak > 0 ? ` (${streak}d)` : ""}
          </Text>
          <Text
            style={[
              styles.modeItemDesc,
              isTablet && styles.modeItemDescTablet,
              { color: theme.secondaryTextColor },
            ]}
          >
            {t(`game:modeDescriptions.${m.id}`)}
          </Text>
        </View>
        <EaseView
          animate={{ opacity: isSelected ? 1 : 0, scale: isSelected ? 1 : 0.5 }}
          transition={{ default: { type: "spring", stiffness: 400, damping: 15 } }}
        >
          <Ionicons name="checkmark-circle" size={isTablet ? 28 : 22} color={accent} />
        </EaseView>
      </EaseView>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  modeItem: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modeItemDesc: {
    fontFamily: "Oxanium-Regular",
    fontSize: 12,
    marginTop: 2,
  },
  modeItemDescTablet: {
    fontSize: 15,
    marginTop: 4,
  },
  modeItemLabel: {
    fontFamily: "Oxanium-SemiBold",
    fontSize: 15,
  },
  modeItemLabelTablet: {
    fontSize: 18,
  },
  modeItemTablet: {
    borderRadius: 12,
    gap: 14,
    marginBottom: 10,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  modeItemText: {
    flex: 1,
  },
})
