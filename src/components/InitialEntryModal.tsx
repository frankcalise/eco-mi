import { useEffect, useRef, useState } from "react"
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"

import { PressableScale } from "@/components/PressableScale"
import type { GameTheme } from "@/config/themes"
import { translate } from "@/i18n/translate"

interface InitialEntryModalProps {
  visible: boolean
  score: number
  level: number
  theme: GameTheme
  onSubmit: (initials: string) => void
  onDismiss: () => void
}

export function InitialEntryModal({
  visible,
  score,
  level,
  theme,
  onSubmit,
  onDismiss,
}: InitialEntryModalProps) {
  const [letters, setLetters] = useState(["", "", ""])
  const inputRefs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)]
  const cursorAnim = useRef(new Animated.Value(1)).current

  const accent = theme.buttonColors.green.color
  const highlight = theme.buttonColors.red.color
  const inputColor = theme.textColor

  useEffect(() => {
    if (!visible) return
    setLetters(["", "", ""])
    const timer = setTimeout(() => inputRefs[0].current?.focus(), 300)
    return () => clearTimeout(timer)
  }, [visible])

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(cursorAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    )
    animation.start()
    return () => animation.stop()
  }, [cursorAnim])

  const handleChange = (text: string, index: number) => {
    const letter = text
      .replace(/[^A-Za-z]/g, "")
      .toUpperCase()
      .slice(-1)
    const next = [...letters]
    next[index] = letter
    setLetters(next)

    if (letter && index < 2) {
      inputRefs[index + 1].current?.focus()
    }
  }

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !letters[index] && index > 0) {
      const next = [...letters]
      next[index - 1] = ""
      setLetters(next)
      inputRefs[index - 1].current?.focus()
    }
  }

  const allFilled = letters.every((l) => l.length === 1)

  const handleDone = () => {
    if (allFilled) {
      onSubmit(letters.join(""))
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" testID="modal-initial-entry">
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoid}
        >
          <View
            style={[
              styles.container,
              { backgroundColor: theme.backgroundColor, borderColor: theme.borderColor },
            ]}
          >
            <PressableScale
              testID="btn-initial-dismiss"
              wrapperStyle={styles.dismissButton}
              onPress={onDismiss}
              accessibilityLabel="Dismiss"
              accessibilityRole="button"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={theme.secondaryTextColor} />
            </PressableScale>
            <Text style={[styles.title, { color: highlight }]}>
              {translate("game:newHighScoreEntry")}
            </Text>
            <Text style={[styles.scoreText, { color: theme.textColor }]}>
              {score} {translate("game:scoreLbl")} - {translate("game:levelLbl")} {level}
            </Text>
            <Text style={[styles.subtitle, { color: theme.secondaryTextColor }]}>
              {translate("game:enterInitials")}
            </Text>

            <View style={styles.inputRow}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.inputBox, { borderColor: accent }]}>
                  <TextInput
                    ref={inputRefs[i]}
                    testID={`input-initial-${i + 1}`}
                    style={[styles.inputText, { color: inputColor }]}
                    value={letters[i]}
                    onChangeText={(t) => handleChange(t, i)}
                    onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                    maxLength={1}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    textAlign="center"
                    selectionColor={accent}
                  />
                  {!letters[i] && (
                    <Animated.View
                      style={[styles.cursor, { backgroundColor: accent, opacity: cursorAnim }]}
                      pointerEvents="none"
                    />
                  )}
                </View>
              ))}
            </View>

            <PressableScale
              testID="btn-initial-done"
              style={[
                styles.doneButton,
                { backgroundColor: accent },
                !allFilled && { backgroundColor: theme.surfaceColor },
              ]}
              onPress={handleDone}
              disabled={!allFilled}
              accessibilityLabel={translate("game:done")}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.doneText,
                  { color: theme.backgroundColor },
                  !allFilled && { color: theme.secondaryTextColor },
                ]}
              >
                {translate("game:done")}
              </Text>
            </PressableScale>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 32,
    paddingHorizontal: 24,
    paddingVertical: 28,
    width: "85%",
  },
  cursor: {
    bottom: 12,
    height: 3,
    left: "25%",
    position: "absolute",
    width: "50%",
  },
  dismissButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    position: "absolute",
    right: 4,
    top: 4,
    width: 44,
    zIndex: 10,
  },
  doneButton: {
    borderRadius: 8,
    marginTop: 20,
    paddingHorizontal: 40,
    paddingVertical: 12,
  },
  doneText: {
    fontFamily: "Oxanium-Bold",
    fontSize: 18,
    letterSpacing: 2,
  },
  inputBox: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 2,
    height: 64,
    justifyContent: "center",
    marginHorizontal: 6,
    width: 56,
  },
  inputRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 16,
  },
  inputText: {
    fontFamily: "Oxanium-Bold",
    fontSize: 32,
    height: 60,
    textAlign: "center",
    width: 52,
  },
  keyboardAvoid: {
    alignItems: "center",
    width: "100%",
  },
  overlay: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    flex: 1,
    justifyContent: "center",
  },
  scoreText: {
    fontFamily: "Oxanium-Bold",
    fontSize: 22,
    letterSpacing: 1,
    marginTop: 8,
  },
  subtitle: {
    fontFamily: "Oxanium-Regular",
    fontSize: 14,
    marginTop: 12,
  },
  title: {
    fontFamily: "Oxanium-Bold",
    fontSize: 24,
    letterSpacing: 2,
    textAlign: "center",
  },
})
