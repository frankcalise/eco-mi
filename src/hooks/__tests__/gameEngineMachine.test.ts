import { createActor } from "xstate"

import { gameEngineMachine, type GameContext, type Color } from "../gameEngineMachine"

const actors: Array<ReturnType<typeof createActor<typeof gameEngineMachine>>> = []

function spawn() {
  const actor = createActor(gameEngineMachine).start()
  actors.push(actor)
  return actor
}

afterEach(() => {
  while (actors.length) actors.pop()?.stop()
})

function ctx(actor: ReturnType<typeof spawn>): GameContext {
  return actor.getSnapshot().context
}

function value(actor: ReturnType<typeof spawn>): string {
  return actor.getSnapshot().value as string
}

describe("gameEngineMachine — initial state", () => {
  it("starts in idle with default context", () => {
    const a = spawn()
    expect(value(a)).toBe("idle")
    expect(ctx(a)).toEqual({
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
    })
  })
})

describe("gameEngineMachine — START / initContext", () => {
  it("idle × START → starting and resets per-game context", () => {
    const a = spawn()
    a.send({ type: "SET_HIGH_SCORE", highScore: 99 })
    a.send({ type: "SET_MODE", mode: "timed" })
    a.send({ type: "START" })
    expect(value(a)).toBe("starting")
    const c = ctx(a)
    expect(c.sequence).toEqual([])
    expect(c.playerSequence).toEqual([])
    expect(c.level).toBe(1)
    expect(c.score).toBe(0)
    expect(c.isNewHighScore).toBe(false)
    expect(c.continuedThisGame).toBe(false)
    expect(c.gameResultRecorded).toBe(false)
    expect(c.sequencesCompleted).toBe(0)
    // initContext does not touch mode or highScore
    expect(c.mode).toBe("timed")
    expect(c.highScore).toBe(99)
  })
})

describe("gameEngineMachine — starting / SET_INITIAL_SEQUENCE", () => {
  it("starting × SET_INITIAL_SEQUENCE → showing with sequence set", () => {
    const a = spawn()
    a.send({ type: "START" })
    a.send({ type: "SET_INITIAL_SEQUENCE", sequence: ["red"] })
    expect(value(a)).toBe("showing")
    expect(ctx(a).sequence).toEqual(["red"])
  })
})

describe("gameEngineMachine — showing", () => {
  it("showing × SEQUENCE_DONE → waiting", () => {
    const a = spawn()
    a.send({ type: "START" })
    a.send({ type: "SET_INITIAL_SEQUENCE", sequence: ["red"] })
    a.send({ type: "SEQUENCE_DONE" })
    expect(value(a)).toBe("waiting")
  })

  it("showing × END_GAME → gameover and runs markGameOver", () => {
    const a = spawn()
    a.send({ type: "START" })
    a.send({ type: "SET_INITIAL_SEQUENCE", sequence: ["red", "blue"] })
    a.send({ type: "END_GAME" })
    expect(value(a)).toBe("gameover")
    expect(ctx(a).gameResultRecorded).toBe(true)
  })

  it("showing × TIMER_EXPIRED → gameover", () => {
    const a = spawn()
    a.send({ type: "START" })
    a.send({ type: "SET_INITIAL_SEQUENCE", sequence: ["red"] })
    a.send({ type: "TIMER_EXPIRED" })
    expect(value(a)).toBe("gameover")
    expect(ctx(a).gameResultRecorded).toBe(true)
  })
})

describe("gameEngineMachine — waiting / CORRECT_INPUT", () => {
  it("appends to playerSequence when sequence is incomplete", () => {
    const a = spawn()
    a.send({ type: "START" })
    a.send({ type: "SET_INITIAL_SEQUENCE", sequence: ["red", "blue"] })
    a.send({ type: "SEQUENCE_DONE" })
    a.send({ type: "CORRECT_INPUT", color: "red" })
    expect(value(a)).toBe("waiting")
    expect(ctx(a).playerSequence).toEqual(["red"])
  })

  it("transitions to advancing when sequence completes; advanceRound bumps score/level", () => {
    const a = spawn()
    a.send({ type: "START" })
    a.send({ type: "SET_INITIAL_SEQUENCE", sequence: ["red", "blue"] })
    a.send({ type: "SEQUENCE_DONE" })
    a.send({ type: "CORRECT_INPUT", color: "red" })
    a.send({ type: "CORRECT_INPUT", color: "blue" })
    expect(value(a)).toBe("advancing")
    const c = ctx(a)
    expect(c.score).toBe(20) // sequence.length (2) * 10
    expect(c.level).toBe(2) // started at 1
    expect(c.sequencesCompleted).toBe(0) // not timed mode
  })

  it("advanceRound increments sequencesCompleted only in timed mode", () => {
    const a = spawn()
    a.send({ type: "SET_MODE", mode: "timed" })
    a.send({ type: "START" })
    a.send({ type: "SET_INITIAL_SEQUENCE", sequence: ["red"] })
    a.send({ type: "SEQUENCE_DONE" })
    a.send({ type: "CORRECT_INPUT", color: "red" })
    expect(value(a)).toBe("advancing")
    expect(ctx(a).sequencesCompleted).toBe(1)
  })
})

describe("gameEngineMachine — waiting / WRONG_INPUT", () => {
  it("non-timed mode → gameover", () => {
    const a = spawn()
    a.send({ type: "START" })
    a.send({ type: "SET_INITIAL_SEQUENCE", sequence: ["red"] })
    a.send({ type: "SEQUENCE_DONE" })
    a.send({ type: "WRONG_INPUT" })
    expect(value(a)).toBe("gameover")
    expect(ctx(a).gameResultRecorded).toBe(true)
  })

  it("timed mode → replaying with playerSequence cleared", () => {
    const a = spawn()
    a.send({ type: "SET_MODE", mode: "timed" })
    a.send({ type: "START" })
    a.send({ type: "SET_INITIAL_SEQUENCE", sequence: ["red", "blue"] })
    a.send({ type: "SEQUENCE_DONE" })
    a.send({ type: "CORRECT_INPUT", color: "red" })
    expect(ctx(a).playerSequence).toEqual(["red"])
    a.send({ type: "WRONG_INPUT" })
    expect(value(a)).toBe("replaying")
    expect(ctx(a).playerSequence).toEqual([])
    expect(ctx(a).gameResultRecorded).toBe(false)
  })
})

describe("gameEngineMachine — waiting / autonomous transitions", () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it("INPUT_TIMEOUT after-delay (non-timed) → gameover", () => {
    const a = spawn()
    a.send({ type: "START" })
    a.send({ type: "SET_INITIAL_SEQUENCE", sequence: ["red"] })
    a.send({ type: "SEQUENCE_DONE" })
    expect(value(a)).toBe("waiting")
    // getInputTimeout(1) = 5000 + 1 * 2000 = 7000ms
    jest.advanceTimersByTime(7001)
    expect(value(a)).toBe("gameover")
    expect(ctx(a).gameResultRecorded).toBe(true)
  })

  it("INPUT_TIMEOUT in timed mode does not autonomously fire (effectively infinite)", () => {
    const a = spawn()
    a.send({ type: "SET_MODE", mode: "timed" })
    a.send({ type: "START" })
    a.send({ type: "SET_INITIAL_SEQUENCE", sequence: ["red"] })
    a.send({ type: "SEQUENCE_DONE" })
    expect(value(a)).toBe("waiting")
    // Advance well beyond any sane non-timed timeout
    jest.advanceTimersByTime(60_000)
    expect(value(a)).toBe("waiting")
  })

  it("INPUT_TIMEOUT explicit event → gameover", () => {
    const a = spawn()
    a.send({ type: "START" })
    a.send({ type: "SET_INITIAL_SEQUENCE", sequence: ["red"] })
    a.send({ type: "SEQUENCE_DONE" })
    a.send({ type: "INPUT_TIMEOUT" })
    expect(value(a)).toBe("gameover")
    expect(ctx(a).gameResultRecorded).toBe(true)
  })

  it("END_GAME from waiting → gameover", () => {
    const a = spawn()
    a.send({ type: "START" })
    a.send({ type: "SET_INITIAL_SEQUENCE", sequence: ["red"] })
    a.send({ type: "SEQUENCE_DONE" })
    a.send({ type: "END_GAME" })
    expect(value(a)).toBe("gameover")
    expect(ctx(a).gameResultRecorded).toBe(true)
  })

  it("TIMER_EXPIRED from waiting → gameover", () => {
    const a = spawn()
    a.send({ type: "SET_MODE", mode: "timed" })
    a.send({ type: "START" })
    a.send({ type: "SET_INITIAL_SEQUENCE", sequence: ["red"] })
    a.send({ type: "SEQUENCE_DONE" })
    a.send({ type: "TIMER_EXPIRED" })
    expect(value(a)).toBe("gameover")
    expect(ctx(a).gameResultRecorded).toBe(true)
  })
})

describe("gameEngineMachine — replaying", () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it("after 500ms returns to showing, sequence preserved", () => {
    const a = spawn()
    a.send({ type: "SET_MODE", mode: "timed" })
    a.send({ type: "START" })
    a.send({ type: "SET_INITIAL_SEQUENCE", sequence: ["red", "blue"] })
    a.send({ type: "SEQUENCE_DONE" })
    a.send({ type: "WRONG_INPUT" })
    expect(value(a)).toBe("replaying")
    jest.advanceTimersByTime(501)
    expect(value(a)).toBe("showing")
    expect(ctx(a).sequence).toEqual(["red", "blue"])
  })

  it("TIMER_EXPIRED from replaying → gameover", () => {
    const a = spawn()
    a.send({ type: "SET_MODE", mode: "timed" })
    a.send({ type: "START" })
    a.send({ type: "SET_INITIAL_SEQUENCE", sequence: ["red", "blue"] })
    a.send({ type: "SEQUENCE_DONE" })
    a.send({ type: "WRONG_INPUT" })
    expect(value(a)).toBe("replaying")
    a.send({ type: "TIMER_EXPIRED" })
    expect(value(a)).toBe("gameover")
    expect(ctx(a).gameResultRecorded).toBe(true)
  })
})

describe("gameEngineMachine — advancing", () => {
  it("ADVANCE_COMPLETE → showing with new sequence and cleared playerSequence", () => {
    const a = spawn()
    a.send({ type: "START" })
    a.send({ type: "SET_INITIAL_SEQUENCE", sequence: ["red"] })
    a.send({ type: "SEQUENCE_DONE" })
    a.send({ type: "CORRECT_INPUT", color: "red" })
    expect(value(a)).toBe("advancing")
    const newSeq: Color[] = ["red", "blue"]
    a.send({ type: "ADVANCE_COMPLETE", newSequence: newSeq })
    expect(value(a)).toBe("showing")
    expect(ctx(a).sequence).toEqual(newSeq)
    expect(ctx(a).playerSequence).toEqual([])
  })

  it("END_GAME from advancing → gameover", () => {
    const a = spawn()
    a.send({ type: "START" })
    a.send({ type: "SET_INITIAL_SEQUENCE", sequence: ["red"] })
    a.send({ type: "SEQUENCE_DONE" })
    a.send({ type: "CORRECT_INPUT", color: "red" })
    a.send({ type: "END_GAME" })
    expect(value(a)).toBe("gameover")
    expect(ctx(a).gameResultRecorded).toBe(true)
  })
})

describe("gameEngineMachine — markGameOver / high-score logic", () => {
  it("sets isNewHighScore and bumps highScore when score > highScore", () => {
    const a = spawn()
    a.send({ type: "SET_HIGH_SCORE", highScore: 50 })
    a.send({ type: "START" })
    a.send({ type: "SET_INITIAL_SEQUENCE", sequence: ["red"] })
    a.send({ type: "SEQUENCE_DONE" })
    a.send({ type: "CORRECT_INPUT", color: "red" })
    // After CORRECT_INPUT completes the sequence (length 1), advanceRound runs:
    // score: 0 + 1*10 = 10. Not > 50. So markGameOver should NOT bump.
    a.send({ type: "ADVANCE_COMPLETE", newSequence: ["red", "blue"] })
    a.send({ type: "END_GAME" })
    const c = ctx(a)
    expect(c.isNewHighScore).toBe(false)
    expect(c.highScore).toBe(50)
    expect(c.score).toBe(10)
  })

  it("bumps highScore when score > highScore", () => {
    const a = spawn()
    a.send({ type: "SET_HIGH_SCORE", highScore: 5 })
    a.send({ type: "START" })
    a.send({ type: "SET_INITIAL_SEQUENCE", sequence: ["red"] })
    a.send({ type: "SEQUENCE_DONE" })
    a.send({ type: "CORRECT_INPUT", color: "red" })
    // score = 10 > 5
    a.send({ type: "END_GAME" })
    const c = ctx(a)
    expect(c.isNewHighScore).toBe(true)
    expect(c.highScore).toBe(10)
    expect(c.gameResultRecorded).toBe(true)
  })

  it("is idempotent on second-fire: isNewHighScore not re-bumped", () => {
    // markGameOver guards on `!isNewHighScore`. Once set, subsequent gameovers in
    // the same game do not flip it again. (Reachable today only via re-entry — the
    // gameover state has no transition that re-fires markGameOver short of CONTINUE
    // back through starting/showing/waiting/gameover.)
    const a = spawn()
    a.send({ type: "SET_HIGH_SCORE", highScore: 5 })
    a.send({ type: "START" })
    a.send({ type: "SET_INITIAL_SEQUENCE", sequence: ["red"] })
    a.send({ type: "SEQUENCE_DONE" })
    a.send({ type: "CORRECT_INPUT", color: "red" })
    a.send({ type: "END_GAME" })
    const firstHigh = ctx(a).highScore
    expect(ctx(a).isNewHighScore).toBe(true)

    // Continue → start a new round but do not score; END_GAME again.
    a.send({ type: "CONTINUE" })
    expect(ctx(a).isNewHighScore).toBe(false) // setupContinue clears it
    a.send({ type: "SET_INITIAL_SEQUENCE", sequence: ["red"] })
    a.send({ type: "END_GAME" })
    // score is 10 from before continue (preserved); highScore is also 10.
    // 10 > 10 is false → isNewHighScore stays false, highScore unchanged.
    expect(ctx(a).highScore).toBe(firstHigh)
    expect(ctx(a).isNewHighScore).toBe(false)
  })
})

describe("gameEngineMachine — gameover / CONTINUE", () => {
  it("setupContinue clears isNewHighScore and playerSequence; preserves sequence and level", () => {
    const a = spawn()
    a.send({ type: "SET_HIGH_SCORE", highScore: 0 })
    a.send({ type: "START" })
    a.send({ type: "SET_INITIAL_SEQUENCE", sequence: ["red"] })
    a.send({ type: "SEQUENCE_DONE" })
    a.send({ type: "CORRECT_INPUT", color: "red" }) // → advancing, level 2, score 10, isNewHighScore on END
    a.send({ type: "ADVANCE_COMPLETE", newSequence: ["red", "blue"] })
    a.send({ type: "SEQUENCE_DONE" })
    a.send({ type: "CORRECT_INPUT", color: "red" })
    a.send({ type: "WRONG_INPUT" }) // non-timed → gameover
    expect(value(a)).toBe("gameover")
    const sequenceAtGameover = ctx(a).sequence
    const levelAtGameover = ctx(a).level
    expect(ctx(a).isNewHighScore).toBe(true)
    expect(ctx(a).playerSequence.length).toBeGreaterThan(0)

    a.send({ type: "CONTINUE" })
    expect(value(a)).toBe("starting")
    const c = ctx(a)
    expect(c.continuedThisGame).toBe(true)
    expect(c.isNewHighScore).toBe(false)
    expect(c.playerSequence).toEqual([])
    expect(c.sequence).toEqual(sequenceAtGameover)
    expect(c.level).toBe(levelAtGameover)
  })
})

describe("gameEngineMachine — top-level RESET / SET_HIGH_SCORE / SET_MODE", () => {
  it("RESET from any state → idle, preserves mode and highScore", () => {
    const a = spawn()
    a.send({ type: "SET_HIGH_SCORE", highScore: 42 })
    a.send({ type: "SET_MODE", mode: "daily" })
    a.send({ type: "START" })
    a.send({ type: "SET_INITIAL_SEQUENCE", sequence: ["red", "blue", "green"] })
    a.send({ type: "SEQUENCE_DONE" })
    a.send({ type: "CORRECT_INPUT", color: "red" })
    a.send({ type: "RESET" })
    expect(value(a)).toBe("idle")
    const c = ctx(a)
    expect(c.mode).toBe("daily")
    expect(c.highScore).toBe(42)
    expect(c.sequence).toEqual([])
    expect(c.playerSequence).toEqual([])
    expect(c.level).toBe(1)
    expect(c.score).toBe(0)
    expect(c.isNewHighScore).toBe(false)
    expect(c.continuedThisGame).toBe(false)
    expect(c.sequencesCompleted).toBe(0)
    expect(c.gameResultRecorded).toBe(false)
  })

  it("RESET from gameover → idle, mode/highScore preserved", () => {
    const a = spawn()
    a.send({ type: "SET_HIGH_SCORE", highScore: 7 })
    a.send({ type: "START" })
    a.send({ type: "SET_INITIAL_SEQUENCE", sequence: ["red"] })
    a.send({ type: "END_GAME" })
    expect(value(a)).toBe("gameover")
    a.send({ type: "RESET" })
    expect(value(a)).toBe("idle")
    expect(ctx(a).highScore).toBe(7)
  })

  it("SET_HIGH_SCORE updates context without changing state", () => {
    const a = spawn()
    a.send({ type: "SET_HIGH_SCORE", highScore: 123 })
    expect(ctx(a).highScore).toBe(123)
    expect(value(a)).toBe("idle")
    a.send({ type: "START" })
    a.send({ type: "SET_HIGH_SCORE", highScore: 456 })
    expect(ctx(a).highScore).toBe(456)
    expect(value(a)).toBe("starting")
  })

  it("SET_MODE updates context without changing state", () => {
    const a = spawn()
    a.send({ type: "SET_MODE", mode: "reverse" })
    expect(ctx(a).mode).toBe("reverse")
    expect(value(a)).toBe("idle")
    a.send({ type: "START" })
    a.send({ type: "SET_MODE", mode: "chaos" })
    expect(ctx(a).mode).toBe("chaos")
    expect(value(a)).toBe("starting")
  })

  it("START from gameover (not just idle) re-enters starting and resets context", () => {
    const a = spawn()
    a.send({ type: "SET_HIGH_SCORE", highScore: 5 })
    a.send({ type: "START" })
    a.send({ type: "SET_INITIAL_SEQUENCE", sequence: ["red"] })
    a.send({ type: "SEQUENCE_DONE" })
    a.send({ type: "CORRECT_INPUT", color: "red" })
    a.send({ type: "END_GAME" })
    expect(value(a)).toBe("gameover")
    expect(ctx(a).score).toBe(10)
    a.send({ type: "START" })
    expect(value(a)).toBe("starting")
    expect(ctx(a).score).toBe(0)
    expect(ctx(a).highScore).toBe(10) // preserved (was bumped on END_GAME)
  })
})
