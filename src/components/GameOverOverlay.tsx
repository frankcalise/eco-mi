import { View, Text, Pressable, StyleSheet } from "react-native"

import { Ionicons } from "@expo/vector-icons"

type GameOverOverlayProps = {
  visible: boolean
  score: number
  level: number
  highScore: number
  isNewHighScore: boolean
  showRemoveAds?: boolean
  onPlayAgain: () => void
  onShare?: () => void
  onRemoveAds?: () => void
}

export function GameOverOverlay({
  visible,
  score,
  level,
  highScore,
  isNewHighScore,
  showRemoveAds,
  onPlayAgain,
  onShare,
  onRemoveAds,
}: GameOverOverlayProps) {
  if (!visible) return null

  return (
    <View testID="overlay-game-over" style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.title}>Game Over</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Score</Text>
            <Text style={styles.statValue}>{score}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Level</Text>
            <Text style={styles.statValue}>{level}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Best</Text>
            <Text style={styles.statValue}>{highScore}</Text>
          </View>
        </View>

        {isNewHighScore && (
          <View style={styles.badgeContainer}>
            <Ionicons name="trophy" size={20} color="#fbbf24" />
            <Text style={styles.badgeText}>New High Score!</Text>
          </View>
        )}

        <View style={styles.actions}>
          <Pressable testID="btn-play-again" style={styles.playAgainButton} onPress={onPlayAgain}>
            <Ionicons name="refresh" size={20} color="white" />
            <Text style={styles.buttonText}>Play Again</Text>
          </Pressable>

          {onShare && (
            <Pressable testID="btn-share" style={styles.shareButton} onPress={onShare}>
              <Ionicons name="share-outline" size={20} color="white" />
              <Text style={styles.buttonText}>Share</Text>
            </Pressable>
          )}
        </View>

        {showRemoveAds && onRemoveAds && (
          <Pressable testID="btn-remove-ads" style={styles.removeAdsButton} onPress={onRemoveAds}>
            <Ionicons name="close-circle-outline" size={18} color="#fbbf24" />
            <Text style={styles.removeAdsText}>Remove Ads</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    zIndex: 100,
  },
  badgeContainer: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
  },
  badgeText: {
    color: "#fbbf24",
    fontFamily: "Oxanium-Bold",
    fontSize: 16,
  },
  buttonText: {
    color: "white",
    fontFamily: "Oxanium-SemiBold",
    fontSize: 16,
  },
  card: {
    alignItems: "center",
    backgroundColor: "#1a1a2e",
    borderColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 32,
    paddingHorizontal: 24,
    paddingVertical: 28,
    width: "85%",
  },
  playAgainButton: {
    alignItems: "center",
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  removeAdsButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 16,
    paddingVertical: 8,
  },
  removeAdsText: {
    color: "#fbbf24",
    fontFamily: "Oxanium-Medium",
    fontSize: 14,
  },
  shareButton: {
    alignItems: "center",
    backgroundColor: "#6b7280",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  statBox: {
    alignItems: "center",
    flex: 1,
  },
  statLabel: {
    color: "#a0a0a0",
    fontFamily: "Oxanium-Regular",
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: "white",
    fontFamily: "Oxanium-Bold",
    fontSize: 24,
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 16,
    width: "100%",
  },
  title: {
    color: "#ef4444",
    fontFamily: "Oxanium-Bold",
    fontSize: 28,
  },
})
