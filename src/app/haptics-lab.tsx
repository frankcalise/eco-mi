/**
 * Dev-only haptic pattern lab. Reached via the Expo dev menu
 * ("Haptics Lab"). Registered in src/app/_layout.tsx behind __DEV__ so the
 * dev-menu registration, and every import the menu callback reaches, get
 * tree-shaken from production bundles.
 *
 * Why this exists: iterating on VICTORY_PATTERN / SPIRAL_PATTERN amplitude
 * + frequency + timing values via hot reload means triggering a full game
 * flow each tweak. This screen fires the patterns directly — optionally
 * paired with the corresponding jingle so you can validate haptic/audio
 * sync — and lets you hand-edit the JSON before playing. When satisfied,
 * copy the JSON back into src/config/hapticPatterns.ts.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useNavigation } from "expo-router"
import { useTranslation } from "react-i18next"
import { Presets, usePatternComposer, type Pattern } from "react-native-pulsar"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { PressableScale } from "@/components/PressableScale"
import { SPIRAL_PATTERN, VICTORY_PATTERN } from "@/config/hapticPatterns"
import { useAudioTones } from "@/hooks/useAudioTones"
import { getColorMapForTheme } from "@/hooks/useGameEngine"
import { useSoundPack } from "@/hooks/useSoundPack"
import { useTheme } from "@/hooks/useTheme"
import { UI_COLORS } from "@/theme/uiColors"

export default function HapticsLabScreen() {
  useTranslation()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { activeTheme } = useTheme()
  const { soundPack } = useSoundPack()

  useLayoutEffect(() => {
    navigation.setOptions({ title: "Haptics Lab" })
  }, [navigation])

  const victoryComposer = usePatternComposer(VICTORY_PATTERN)
  const spiralComposer = usePatternComposer(SPIRAL_PATTERN)

  const { initialize, cleanup, playHighScoreJingle, playGameOverJingle } = useAudioTones(
    getColorMapForTheme(activeTheme),
    soundPack.oscillatorType,
  )

  useEffect(() => {
    initialize()
    return () => {
      cleanup()
    }
  }, [cleanup, initialize])

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: activeTheme.backgroundColor }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Text style={[styles.intro, { color: activeTheme.secondaryTextColor }]}>
        Edit the JSON and tap &ldquo;Parse &amp; Play&rdquo; to feel the variation. Toggle{" "}
        <Text style={styles.mono}>+ audio</Text> to fire the jingle alongside so you can validate
        sync. Audio respects the app&rsquo;s sound toggle in Settings. Copy final values back into{" "}
        <Text style={styles.mono}>src/config/hapticPatterns.ts</Text>.
      </Text>

      <PatternEditor
        title="VICTORY_PATTERN"
        subtitle="newHighScore — rides the 720ms ascending high-score jingle"
        composer={victoryComposer}
        source={VICTORY_PATTERN}
        theme={activeTheme}
        playJingle={playHighScoreJingle}
      />

      <PatternEditor
        title="SPIRAL_PATTERN"
        subtitle="gameOver — rides the 800ms descending jingle; thud at 600ms"
        composer={spiralComposer}
        source={SPIRAL_PATTERN}
        theme={activeTheme}
        playJingle={playGameOverJingle}
      />

      <View style={styles.presetGroup}>
        <Text style={[styles.groupTitle, { color: activeTheme.textColor }]}>
          Pulsar presets (for calibrating intensity vs. our patterns)
        </Text>
        {(
          [
            ["impactLight", Presets.System.impactLight],
            ["impactMedium", Presets.System.impactMedium],
            ["impactHeavy", Presets.System.impactHeavy],
            ["notificationSuccess", Presets.System.notificationSuccess],
            ["notificationError", Presets.System.notificationError],
            ["notificationWarning", Presets.System.notificationWarning],
            ["selection", Presets.System.selection],
          ] as const
        ).map(([name, fire]) => (
          <PressableScale
            key={name}
            style={[styles.presetButton, { borderColor: activeTheme.borderColor }]}
            onPress={() => fire()}
          >
            <Text style={[styles.presetButtonLabel, { color: activeTheme.textColor }]}>{name}</Text>
          </PressableScale>
        ))}
      </View>
    </ScrollView>
  )
}

type PatternEditorProps = {
  title: string
  subtitle: string
  composer: ReturnType<typeof usePatternComposer>
  source: Pattern
  theme: ReturnType<typeof useTheme>["activeTheme"]
  playJingle: () => void
}

function PatternEditor({
  title,
  subtitle,
  composer,
  source,
  theme,
  playJingle,
}: PatternEditorProps) {
  const [jsonText, setJsonText] = useState(() => JSON.stringify(source, null, 2))
  const [error, setError] = useState<string | null>(null)
  const [audioOn, setAudioOn] = useState(true)
  const lastPlayedRef = useRef<Pattern>(source)

  function fireHapticAndMaybeAudio(pattern: Pattern) {
    composer.parse(pattern)
    lastPlayedRef.current = pattern
    // Fire both in the same JS tick so haptic and audio start together —
    // same shape as GameScreen's `playHighScoreJingle(); haptics.play(...)`
    // effect, so the lab feel matches production.
    composer.play()
    if (audioOn) playJingle()
  }

  function handlePlaySource() {
    fireHapticAndMaybeAudio(source)
  }

  function handleParseAndPlay() {
    try {
      const parsed = JSON.parse(jsonText) as Pattern
      fireHapticAndMaybeAudio(parsed)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON")
    }
  }

  function handleReset() {
    setJsonText(JSON.stringify(source, null, 2))
    setError(null)
  }

  return (
    <View style={[styles.patternBlock, { borderColor: theme.borderColor }]}>
      <Text style={[styles.patternTitle, { color: theme.textColor }]}>{title}</Text>
      <Text style={[styles.patternSubtitle, { color: theme.secondaryTextColor }]}>{subtitle}</Text>

      <View style={styles.audioToggleRow}>
        <PressableScale
          onPress={() => setAudioOn((v) => !v)}
          style={[
            styles.audioToggle,
            {
              backgroundColor: audioOn ? theme.accentColor : theme.surfaceColor,
              borderColor: theme.borderColor,
            },
          ]}
        >
          <Text
            style={[
              styles.audioToggleLabel,
              { color: audioOn ? UI_COLORS.white : theme.secondaryTextColor },
            ]}
          >
            {audioOn ? "+ audio: ON" : "+ audio: OFF"}
          </Text>
        </PressableScale>
      </View>

      <View style={styles.buttonRow}>
        <PressableScale
          style={[styles.primaryButton, { backgroundColor: theme.accentColor }]}
          onPress={handlePlaySource}
        >
          <Text style={styles.primaryButtonLabel}>Play source</Text>
        </PressableScale>
        <PressableScale
          style={[styles.primaryButton, { backgroundColor: theme.accentColor }]}
          onPress={handleParseAndPlay}
        >
          <Text style={styles.primaryButtonLabel}>Parse &amp; play</Text>
        </PressableScale>
        <PressableScale
          style={[styles.secondaryButton, { borderColor: theme.borderColor }]}
          onPress={handleReset}
        >
          <Text style={[styles.secondaryButtonLabel, { color: theme.textColor }]}>Reset</Text>
        </PressableScale>
      </View>

      <TextInput
        value={jsonText}
        onChangeText={setJsonText}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        style={[
          styles.jsonInput,
          {
            backgroundColor: theme.surfaceColor,
            color: theme.textColor,
            borderColor: theme.borderColor,
          },
        ]}
      />

      {error ? (
        <Text style={[styles.errorText, { color: theme.destructiveColor }]}>{error}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  audioToggle: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  audioToggleLabel: {
    fontFamily: "Oxanium-SemiBold",
    fontSize: 12,
  },
  audioToggleRow: {
    alignItems: "flex-start",
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  content: {
    gap: 18,
    paddingHorizontal: 16,
  },
  errorText: {
    fontFamily: "Oxanium-Medium",
    fontSize: 13,
    marginTop: 6,
  },
  groupTitle: {
    fontFamily: "Oxanium-Bold",
    fontSize: 15,
    marginBottom: 10,
  },
  intro: {
    fontFamily: "Oxanium-Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  jsonInput: {
    borderRadius: 8,
    borderWidth: 1,
    fontFamily: "Courier",
    fontSize: 12,
    lineHeight: 16,
    minHeight: 200,
    padding: 10,
    textAlignVertical: "top",
  },
  mono: {
    fontFamily: "Courier",
  },
  patternBlock: {
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  patternSubtitle: {
    fontFamily: "Oxanium-Medium",
    fontSize: 12,
    marginBottom: 6,
  },
  patternTitle: {
    fontFamily: "Oxanium-Bold",
    fontSize: 16,
  },
  presetButton: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  presetButtonLabel: {
    fontFamily: "Oxanium-Medium",
    fontSize: 14,
  },
  presetGroup: {
    gap: 4,
  },
  primaryButton: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryButtonLabel: {
    color: UI_COLORS.white,
    fontFamily: "Oxanium-SemiBold",
    fontSize: 14,
  },
  root: {
    flex: 1,
  },
  secondaryButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonLabel: {
    fontFamily: "Oxanium-Medium",
    fontSize: 14,
  },
})
