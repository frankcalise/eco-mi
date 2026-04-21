import { assign, setup } from "xstate"

import { getInputTimeout } from "@/config/difficulty"

export type Color = "red" | "blue" | "green" | "yellow"
export type GameMode = "classic" | "daily" | "timed" | "reverse" | "chaos"
export type PublicGameState = "idle" | "showing" | "waiting" | "gameover"

export const colors: Color[] = ["red", "blue", "green", "yellow"]

export interface GameContext {
  mode: GameMode
  sequence: Color[]
  playerSequence: Color[]
  level: number
  score: number
  highScore: number
  isNewHighScore: boolean
  continuedThisGame: boolean
  sequencesCompleted: number
  gameResultRecorded: boolean
}

export type GameEvent =
  | { type: "START" }
  | { type: "SEQUENCE_DONE" }
  | { type: "CORRECT_INPUT"; color: Color }
  | { type: "WRONG_INPUT" }
  | { type: "INPUT_TIMEOUT" }
  | { type: "TIMER_EXPIRED" }
  | { type: "END_GAME" }
  | { type: "CONTINUE" }
  | { type: "RESET" }
  | { type: "ADVANCE_COMPLETE"; newSequence: Color[] }
  | { type: "SET_INITIAL_SEQUENCE"; sequence: Color[] }
  | { type: "SET_HIGH_SCORE"; highScore: number }
  | { type: "SET_MODE"; mode: GameMode }

const initialContext: GameContext = {
  mode: "classic",
  sequence: [],
  playerSequence: [],
  level: 1,
  score: 0,
  highScore: 0,
  isNewHighScore: false,
  continuedThisGame: false,
  sequencesCompleted: 0,
  gameResultRecorded: false,
}

export const gameEngineMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
  },
  guards: {
    isTimedMode: ({ context }) => context.mode === "timed",
    isNotTimedMode: ({ context }) => context.mode !== "timed",
    isSequenceComplete: ({ context }) =>
      context.playerSequence.length + 1 === context.sequence.length,
  },
  delays: {
    START_DELAY: 500,
    ADVANCE_DELAY: 400,
    INPUT_TIMEOUT: ({ context }) => {
      if (context.mode === "timed") return 2_147_483_647 // effectively infinite
      return getInputTimeout(context.sequence.length)
    },
  },
  actions: {
    initContext: assign(() => ({
      sequence: [],
      playerSequence: [],
      level: 1,
      score: 0,
      isNewHighScore: false,
      continuedThisGame: false,
      gameResultRecorded: false,
      sequencesCompleted: 0,
    })),
    addPlayerInput: assign(({ context, event }) => {
      if (event.type !== "CORRECT_INPUT") return {}
      return { playerSequence: [...context.playerSequence, event.color] }
    }),
    advanceRound: assign(({ context }) => ({
      score: context.score + context.sequence.length * 10,
      level: context.level + 1,
      sequencesCompleted:
        context.mode === "timed" ? context.sequencesCompleted + 1 : context.sequencesCompleted,
    })),
    setAdvancedSequence: assign(({ event }) => {
      if (event.type !== "ADVANCE_COMPLETE") return {}
      return {
        sequence: event.newSequence,
        playerSequence: [],
      }
    }),
    markGameOver: assign(({ context }) => {
      const isNew = context.score > context.highScore && !context.isNewHighScore
      return {
        isNewHighScore: isNew ? true : context.isNewHighScore,
        highScore: isNew ? context.score : context.highScore,
        gameResultRecorded: true,
      }
    }),
    setupContinue: assign({
      continuedThisGame: true,
      isNewHighScore: false,
      playerSequence: [],
    }),
    resetContext: assign(({ context }) => ({
      ...initialContext,
      mode: context.mode,
      highScore: context.highScore,
    })),
    setHighScore: assign(({ event }) => {
      if (event.type !== "SET_HIGH_SCORE") return {}
      return { highScore: event.highScore }
    }),
    setMode: assign(({ event }) => {
      if (event.type !== "SET_MODE") return {}
      return { mode: event.mode }
    }),
  },
}).createMachine({
  id: "gameEngine",
  initial: "idle",
  context: initialContext,
  on: {
    RESET: {
      target: ".idle",
      actions: "resetContext",
    },
    START: {
      target: ".starting",
      actions: "initContext",
    },
    SET_HIGH_SCORE: {
      actions: "setHighScore",
    },
    SET_MODE: {
      actions: "setMode",
    },
  },
  states: {
    idle: {},
    starting: {
      on: {
        SET_INITIAL_SEQUENCE: {
          target: "showing",
          actions: assign(({ event }) => {
            if (event.type !== "SET_INITIAL_SEQUENCE") return {}
            return { sequence: event.sequence }
          }),
        },
      },
    },
    showing: {
      on: {
        SEQUENCE_DONE: "waiting",
        END_GAME: {
          target: "gameover",
          actions: "markGameOver",
        },
        TIMER_EXPIRED: {
          target: "gameover",
          actions: "markGameOver",
        },
      },
    },
    waiting: {
      after: {
        INPUT_TIMEOUT: {
          target: "gameover",
          actions: "markGameOver",
        },
      },
      on: {
        CORRECT_INPUT: [
          {
            guard: "isSequenceComplete",
            target: "advancing",
            actions: ["addPlayerInput", "advanceRound"],
          },
          {
            actions: "addPlayerInput",
          },
        ],
        WRONG_INPUT: [
          {
            guard: "isTimedMode",
            target: "replaying",
            actions: assign({ playerSequence: [] }),
          },
          {
            target: "gameover",
            actions: "markGameOver",
          },
        ],
        INPUT_TIMEOUT: {
          target: "gameover",
          actions: "markGameOver",
        },
        END_GAME: {
          target: "gameover",
          actions: "markGameOver",
        },
        TIMER_EXPIRED: {
          target: "gameover",
          actions: "markGameOver",
        },
      },
    },
    replaying: {
      after: {
        500: "showing",
      },
      on: {
        TIMER_EXPIRED: {
          target: "gameover",
          actions: "markGameOver",
        },
      },
    },
    advancing: {
      on: {
        ADVANCE_COMPLETE: {
          target: "showing",
          actions: "setAdvancedSequence",
        },
        END_GAME: {
          target: "gameover",
          actions: "markGameOver",
        },
      },
    },
    gameover: {
      on: {
        CONTINUE: {
          target: "starting",
          actions: "setupContinue",
        },
      },
    },
  },
})

/**
 * Maps internal machine state to the public GameState type.
 * `starting` and `advancing` are internal — consumers see "showing".
 */
export function toPublicState(value: string): PublicGameState {
  switch (value) {
    case "starting":
    case "advancing":
    case "replaying":
      return "showing"
    case "showing":
      return "showing"
    case "waiting":
      return "waiting"
    case "gameover":
      return "gameover"
    default:
      return "idle"
  }
}
