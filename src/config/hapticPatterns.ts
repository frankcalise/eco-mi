import type { Pattern } from "react-native-pulsar"

/**
 * Signature haptic patterns for the game's two highest-emotion moments.
 * Times are milliseconds, amplitudes and frequencies are normalized 0..1.
 *
 * Both patterns are synced to the audio jingles defined in
 * src/hooks/useAudioTones.tsx — if jingle timings change there, update
 * these patterns too or the feel will drift off the music.
 */

/**
 * VICTORY_PATTERN — new high score.
 *
 * Rides the 720ms ascending HIGHSCORE_NOTES jingle (6 notes at 0, 120,
 * 240, 360, 480, 600 ms; each 120ms long, climbing 523 → 1568 Hz).
 *
 * Four-tap staircase lands on the jingle's 1st, 3rd, 5th, and 6th notes —
 * the perceptually heaviest beats. Amplitudes climb from 0.3 → 1.0 to match
 * the pitch rise; frequencies climb from 0.3 → 1.0 for extra "zing" on iOS
 * Core Haptics. Underneath, a continuous amplitude envelope provides a
 * Duolingo-style sparkle lift that sustains past the jingle end before
 * rolling off — so the last 180ms feels like confetti settling rather than
 * a sudden stop.
 */
export const VICTORY_PATTERN: Pattern = {
  discretePattern: [
    { time: 0, amplitude: 0.3, frequency: 0.3 }, // note 1 (523 Hz)
    { time: 240, amplitude: 0.6, frequency: 0.55 }, // note 3 (784 Hz)
    { time: 480, amplitude: 0.85, frequency: 0.8 }, // note 5 (1319 Hz)
    { time: 600, amplitude: 1.0, frequency: 1.0 }, // note 6 (1568 Hz) — trophy plunk
  ],
  continuousPattern: {
    amplitude: [
      { time: 0, value: 0 },
      { time: 120, value: 0.25 },
      { time: 600, value: 0.4 },
      { time: 900, value: 0 }, // 180ms tail past the jingle end
    ],
    frequency: [
      { time: 0, value: 0.3 },
      { time: 900, value: 0.9 },
    ],
  },
}

/**
 * SPIRAL_PATTERN — game over (non-high-score).
 *
 * Rides the 800ms descending GAMEOVER_NOTES jingle (4 notes at 0, 200, 400,
 * 600 ms; each 200ms long, falling 659 → 440 Hz). Classic Looney Tunes
 * falling-whistle into thud into bounce-and-settle.
 *
 * Four rapid descending taps simulate the whistle spiral (freq 1.0 → 0.3,
 * amp fading), then one hard THUD at 600ms aligned to the final 440Hz note
 * onset, then two decaying micro-pulses at 720ms and 820ms — the bounce
 * and settle. Continuous envelope drops frequency from 1.0 → 0.1 under
 * the spiral, then silences at the thud so the bounce taps feel crisp.
 */
export const SPIRAL_PATTERN: Pattern = {
  discretePattern: [
    { time: 0, amplitude: 0.6, frequency: 1.0 }, // spiral start (high freq)
    { time: 150, amplitude: 0.5, frequency: 0.7 },
    { time: 300, amplitude: 0.4, frequency: 0.5 },
    { time: 450, amplitude: 0.3, frequency: 0.3 },
    { time: 600, amplitude: 1.0, frequency: 0.2 }, // THUD — aligned to final 440Hz note
    { time: 720, amplitude: 0.3, frequency: 0.4 }, // bounce 1
    { time: 820, amplitude: 0.15, frequency: 0.35 }, // bounce 2 (settle)
  ],
  continuousPattern: {
    amplitude: [
      { time: 0, value: 0.3 },
      { time: 600, value: 0.5 },
      { time: 620, value: 0 }, // silence after the thud so bounces feel crisp
    ],
    frequency: [
      { time: 0, value: 1.0 },
      { time: 600, value: 0.1 },
    ],
  },
}
