import { View, Text, StyleSheet } from "react-native"
import { useTranslation } from "react-i18next"
import { EaseView } from "react-native-ease"

import type { GameTheme } from "@/config/themes"

type OnboardingTooltipProps = {
  visible: boolean
  theme: GameTheme
}

export function OnboardingTooltip({ visible, theme }: OnboardingTooltipProps) {
  const { t } = useTranslation()

  if (!visible) return null

  return (
    <EaseView
      style={styles.container}
      initialAnimate={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ default: { type: "spring", stiffness: 300, damping: 20 } }}
    >
      <View style={[styles.tooltip, { backgroundColor: theme.accentColor }]}>
        <Text style={[styles.text, { color: theme.primaryForegroundColor }]}>
          {t("onboarding:tapHint")}
        </Text>
      </View>
    </EaseView>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginBottom: 8,
  },
  text: {
    fontFamily: "Oxanium-SemiBold",
    fontSize: 15,
    textAlign: "center",
  },
  tooltip: {
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
})
