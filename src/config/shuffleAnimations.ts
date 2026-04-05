import type { Color } from "@/hooks/useGameEngine"

/**
 * Shuffle sequence definitions for chaos mode.
 * Each function takes the current button positions and returns the new positions.
 * Position indices: 0=topLeft, 1=topRight, 2=bottomLeft, 3=bottomRight
 */

type ShuffleFn = (positions: Color[]) => Color[]

function clockwise(positions: Color[]): Color[] {
  // topLeft -> topRight -> bottomRight -> bottomLeft -> topLeft
  const result = [...positions]
  const temp = result[0]
  result[0] = result[2] // bottomLeft -> topLeft
  result[2] = result[3] // bottomRight -> bottomLeft
  result[3] = result[1] // topRight -> bottomRight
  result[1] = temp // topLeft -> topRight
  return result
}

function counterClockwise(positions: Color[]): Color[] {
  // topLeft -> bottomLeft -> bottomRight -> topRight -> topLeft
  const result = [...positions]
  const temp = result[0]
  result[0] = result[1] // topRight -> topLeft
  result[1] = result[3] // bottomRight -> topRight
  result[3] = result[2] // bottomLeft -> bottomRight
  result[2] = temp // topLeft -> bottomLeft
  return result
}

function diagonalSwap(positions: Color[]): Color[] {
  // topLeft <-> bottomRight AND topRight <-> bottomLeft
  const result = [...positions]
  ;[result[0], result[3]] = [result[3], result[0]]
  ;[result[1], result[2]] = [result[2], result[1]]
  return result
}

function horizontalSwap(positions: Color[]): Color[] {
  // left pair <-> right pair
  const result = [...positions]
  ;[result[0], result[1]] = [result[1], result[0]]
  ;[result[2], result[3]] = [result[3], result[2]]
  return result
}

function verticalSwap(positions: Color[]): Color[] {
  // top pair <-> bottom pair
  const result = [...positions]
  ;[result[0], result[2]] = [result[2], result[0]]
  ;[result[1], result[3]] = [result[3], result[1]]
  return result
}

function shellShuffle(positions: Color[]): Color[] {
  // 2-3 rapid sequential pair swaps applied in sequence
  const result = [...positions]
  // Swap 0 <-> 1
  ;[result[0], result[1]] = [result[1], result[0]]
  // Swap 2 <-> 3
  ;[result[2], result[3]] = [result[3], result[2]]
  // Swap 0 <-> 2
  ;[result[0], result[2]] = [result[2], result[0]]
  return result
}

const SINGLE_SEQUENCES: ShuffleFn[] = [
  clockwise,
  counterClockwise,
  diagonalSwap,
  horizontalSwap,
  verticalSwap,
  shellShuffle,
]

/**
 * Returns the step delay in ms based on level.
 * Faster steps at higher levels for more chaos.
 */
export function getShuffleStepDelay(level: number): number {
  if (level <= 3) return 400
  if (level <= 6) return 300
  return 200
}

/**
 * Picks a shuffle sequence chain based on level and returns
 * the intermediate position states (including the final state).
 *
 * - Levels 1-3: 1 sequence
 * - Levels 4-6: 2 chained sequences
 * - Levels 7+: 3 chained sequences
 */
export function pickShuffleSequence(level: number, currentPositions: Color[]): Color[][] {
  const chainLength = level <= 3 ? 1 : level <= 6 ? 2 : 3

  const steps: Color[][] = []
  let positions = [...currentPositions]

  for (let i = 0; i < chainLength; i++) {
    const index = Math.floor(Math.random() * SINGLE_SEQUENCES.length)
    const fn = SINGLE_SEQUENCES[index]
    positions = fn(positions)
    steps.push([...positions])
  }

  return steps
}
