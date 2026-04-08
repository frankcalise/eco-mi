/**
 * Difficulty scaling constants and functions.
 * Consumed by useGameEngine() to control game pacing.
 */

/** Base tone duration in ms — how long a button stays lit during sequence playback */
export const BASE_TONE_DURATION = 600

/** Minimum tone duration in ms — floor so the game never becomes impossible */
export const MIN_TONE_DURATION = 300

/**
 * Returns the tone duration for a given level.
 * Decreases by 20ms per level, floored at MIN_TONE_DURATION.
 */
export function getToneDuration(level: number): number {
  return Math.max(MIN_TONE_DURATION, BASE_TONE_DURATION - (level - 1) * 20)
}

/**
 * Returns the interval between sequence items during playback.
 * Starts at 800ms, decreases 30ms per level, floored at 300ms.
 */
export function getSequenceInterval(level: number): number {
  return Math.max(300, 800 - level * 30)
}

/**
 * Returns the input timeout — how long the player has to complete the sequence.
 * Proportional to sequence length so longer sequences get more time.
 */
export function getInputTimeout(sequenceLength: number): number {
  return sequenceLength * 2000
}
