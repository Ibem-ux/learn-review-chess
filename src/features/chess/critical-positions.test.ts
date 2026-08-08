import { describe, expect, it } from "vitest";
import type { ClassifiedMove, MoveClassification } from "./move-classification";
import { selectCriticalPositions } from "./critical-positions";

function makeClassifiedMove(
  ply: number,
  classification: MoveClassification,
  beforeFen: string = `fen-${ply}`
): ClassifiedMove {
  return {
    assessment: {
      ply,
      mover: "white",
      san: "e4",
      from: "e2",
      to: "e4",
      beforeFen,
      afterFen: `after-${ply}`,
      beforeScore: null,
      afterScore: null,
      delta: null,
      available: true,
      unavailableReason: null,
      playedUci: "e2e4",
      candidateRank: null,
      bestCandidateUci: null,
      candidateMoves: [],
      bestCandidateScore: null,
      secondCandidateScore: null,
    },
    classification,
    basis: "centipawn-loss",
  };
}

describe("selectCriticalPositions", () => {
  it("an empty input returns an empty array", () => {
    expect(selectCriticalPositions([])).toEqual([]);
  });

  it("a game with only best and good moves returns an empty array", () => {
    const moves = [
      makeClassifiedMove(1, "best"),
      makeClassifiedMove(2, "good"),
    ];
    expect(selectCriticalPositions(moves)).toEqual([]);
  });

  it("a blunder is selected and its reason is blunder", () => {
    const moves = [makeClassifiedMove(5, "blunder", "fen-5")];
    const result = selectCriticalPositions(moves);
    expect(result).toEqual([{ ply: 5, fen: "fen-5", reason: "blunder" }]);
  });

  it("given one inaccuracy and one blunder, the blunder comes first", () => {
    const moves = [
      makeClassifiedMove(1, "inaccuracy"),
      makeClassifiedMove(2, "blunder"),
    ];
    const result = selectCriticalPositions(moves);
    expect(result.map((r) => r.reason)).toEqual(["blunder", "inaccuracy"]);
  });

  it("two blunders at different plies are ordered by ascending ply", () => {
    const moves = [
      makeClassifiedMove(10, "blunder"),
      makeClassifiedMove(3, "blunder"),
    ];
    const result = selectCriticalPositions(moves);
    expect(result.map((r) => r.ply)).toEqual([3, 10]);
  });

  it("with limit 2 and four candidates, exactly two entries are returned", () => {
    const moves = [
      makeClassifiedMove(1, "blunder"),
      makeClassifiedMove(2, "mistake"),
      makeClassifiedMove(3, "inaccuracy"),
      makeClassifiedMove(4, "great"),
    ];
    const result = selectCriticalPositions(moves, 2);
    expect(result).toHaveLength(2);
  });

  it("two candidates sharing the same fen produce exactly one entry, and it is the higher-priority one", () => {
    const moves = [
      makeClassifiedMove(1, "inaccuracy", "same-fen"),
      makeClassifiedMove(2, "blunder", "same-fen"),
    ];
    const result = selectCriticalPositions(moves);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ ply: 2, fen: "same-fen", reason: "blunder" });
  });

  it("limit 0 throws RangeError, and limit 1.5 throws RangeError", () => {
    expect(() => selectCriticalPositions([], 0)).toThrow(RangeError);
    expect(() => selectCriticalPositions([], 1.5)).toThrow(RangeError);
  });
});
