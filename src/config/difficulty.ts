/**
 * Difficulty scaling constants and functions.
 * Consumed by useGameEngine() to control game pacing.
 *
 * Levels 1-16: original curve (backward compatible).
 * Levels 17+: extended curve enabled by the oscillator pool architecture
 * which removes the ~300ms floor imposed by oscillator lifecycle overhead.
 * The new floor is ~120ms (human perception limit for distinguishing
 * sequential tones at different frequencies).
 */

/** Base tone duration in ms — how long a button stays lit during sequence playback */
export const BASE_TONE_DURATION = 600

/**
 * Returns the tone duration for a given level.
 * Levels 1-16: decreases by 20ms per level, floored at 300ms.
 * Levels 17+: decreases by 15ms per level, floored at 100ms.
 */
export function getToneDuration(level: number): number {
  if (level <= 16) return Math.max(300, BASE_TONE_DURATION - (level - 1) * 20)
  return Math.max(100, 300 - (level - 16) * 15)
}

/**
 * Returns the interval between sequence items during playback.
 * Levels 1-16: starts at 800ms, decreases 30ms per level, floored at 300ms.
 * Levels 17+: decreases 15ms per level, floored at 120ms.
 */
export function getSequenceInterval(level: number): number {
  if (level <= 16) return Math.max(300, 800 - level * 30)
  return Math.max(120, 300 - (level - 16) * 15)
}

/**
 * Returns the input timeout — how long the player has to complete the sequence.
 * Base of 5 seconds plus 2 seconds per item in the sequence.
 */
export function getInputTimeout(sequenceLength: number): number {
  return 5000 + sequenceLength * 2000
}
