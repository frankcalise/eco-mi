import { View, Text, StyleSheet } from "react-native"
import { useTranslation } from "react-i18next"

import { ModeItem } from "@/components/ModeItem"
import { GAME_MODES } from "@/config/gameModes"
import { DAILY_CURRENT_STREAK } from "@/config/storageKeys"
import type { GameTheme } from "@/config/themes"
import type { GameMode } from "@/hooks/useGameEngine"
import { loadString } from "@/utils/storage"

type GameModePickerContentProps = {
  selectedMode: GameMode
  pulsingMode: GameMode | null
  pulsePhase: "bright" | "dim"
  theme: GameTheme
  onSelectMode: (id: GameMode) => void
}

export function GameModePickerContent({
  selectedMode,
  pulsingMode,
  pulsePhase,
  theme,
  onSelectMode,
}: GameModePickerContentProps) {
  const { t } = useTranslation()

  return (
    <View style={styles.inner}>
      <Text style={[styles.title, { color: theme.textColor }]}>{t("game:modeSelect")}</Text>
      {GAME_MODES.map((entry) => {
        const streak =
          entry.id === "daily" ? parseInt(loadString(DAILY_CURRENT_STREAK) ?? "0", 10) : 0
        return (
          <ModeItem
            key={entry.id}
            mode={entry}
            isSelected={selectedMode === entry.id}
            isPulsing={pulsingMode === entry.id}
            pulsePhase={pulsePhase}
            streak={streak}
            theme={theme}
            onPress={() => onSelectMode(entry.id)}
          />
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  inner: {
    width: "100%",
  },
  title: {
    fontFamily: "Oxanium-Bold",
    fontSize: 18,
    marginBottom: 12,
    textAlign: "center",
  },
})
