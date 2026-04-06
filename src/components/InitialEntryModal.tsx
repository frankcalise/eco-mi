import { useEffect, useRef, useState } from "react"
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"

import { translate } from "@/i18n/translate"

interface InitialEntryModalProps {
  visible: boolean
  score: number
  level: number
  onSubmit: (initials: string) => void
}

export function InitialEntryModal({ visible, score, level, onSubmit }: InitialEntryModalProps) {
  const [letters, setLetters] = useState(["", "", ""])
  const inputRefs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ]
  const cursorAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (!visible) return
    setLetters(["", "", ""])
    const timer = setTimeout(() => inputRefs[0].current?.focus(), 300)
    return () => clearTimeout(timer)
  }, [visible])

  // Blinking cursor effect
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
    const letter = text.replace(/[^A-Za-z]/g, "").toUpperCase().slice(-1)
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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      testID="modal-initial-entry"
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{translate("game:newHighScoreEntry")}</Text>
          <Text style={styles.scoreText}>
            {score} {translate("game:rank")} - LVL {level}
          </Text>
          <Text style={styles.subtitle}>{translate("game:enterInitials")}</Text>

          <View style={styles.inputRow}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.inputBox}>
                <TextInput
                  ref={inputRefs[i]}
                  testID={`input-initial-${i + 1}`}
                  style={styles.inputText}
                  value={letters[i]}
                  onChangeText={(t) => handleChange(t, i)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                  maxLength={1}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  textAlign="center"
                  selectionColor="#22c55e"
                />
                {!letters[i] && (
                  <Animated.View
                    style={[styles.cursor, { opacity: cursorAnim }]}
                    pointerEvents="none"
                  />
                )}
              </View>
            ))}
          </View>

          <Pressable
            testID="btn-initial-done"
            style={[styles.doneButton, !allFilled && styles.doneButtonDisabled]}
            onPress={handleDone}
            disabled={!allFilled}
          >
            <Text style={[styles.doneText, !allFilled && styles.doneTextDisabled]}>
              {translate("game:done")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#0a0a0a",
    borderColor: "#22c55e",
    borderRadius: 12,
    borderWidth: 2,
    marginHorizontal: 32,
    paddingHorizontal: 24,
    paddingVertical: 28,
    width: "85%",
  },
  cursor: {
    backgroundColor: "#22c55e",
    bottom: 12,
    height: 3,
    left: "25%",
    position: "absolute",
    width: "50%",
  },
  doneButton: {
    backgroundColor: "#22c55e",
    borderRadius: 8,
    marginTop: 20,
    paddingHorizontal: 40,
    paddingVertical: 12,
  },
  doneButtonDisabled: {
    backgroundColor: "#333",
  },
  doneText: {
    color: "#0a0a0a",
    fontFamily: "Oxanium-Bold",
    fontSize: 18,
    letterSpacing: 2,
  },
  doneTextDisabled: {
    color: "#666",
  },
  inputBox: {
    alignItems: "center",
    borderColor: "#22c55e",
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
    color: "#22c55e",
    fontFamily: "Oxanium-Bold",
    fontSize: 32,
    height: 60,
    textAlign: "center",
    width: 52,
  },
  overlay: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    flex: 1,
    justifyContent: "center",
  },
  scoreText: {
    color: "#22c55e",
    fontFamily: "Oxanium-Bold",
    fontSize: 22,
    letterSpacing: 1,
    marginTop: 8,
  },
  subtitle: {
    color: "#888",
    fontFamily: "Oxanium-Regular",
    fontSize: 14,
    marginTop: 12,
  },
  title: {
    color: "#fbbf24",
    fontFamily: "Oxanium-Bold",
    fontSize: 24,
    letterSpacing: 2,
    textAlign: "center",
  },
})
