import { describe, expect, it } from "vitest";
import type { MoveAssessment } from "@/features/chess/move-assessment";
import {
  classifyMove,
  classifyMoves,
  DEFAULT_CLASSIFICATION_POLICY,
} from "@/features/chess/move-classification";

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

function makeAssessment(
  overrides: Partial<MoveAssessment>
): MoveAssessment {
  return {
    ply: 1,
    mover: "white",
    san: "e4",
    from: "e2",
    to: "e4",
    beforeFen: INITIAL_FEN,
    afterFen: AFTER_E4,
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
    ...overrides,
  };
}

function exactDelta(loss: number): MoveAssessment["delta"] {
  return {
    kind: "exact",
    beforeMoverScore: { type: "cp", value: 100, perspective: "mover" },
    afterMoverScore: {
      type: "cp",
      value: 100 - loss,
      perspective: "mover",
    },
    signedChange: -loss,
    centipawnLoss: loss,
  };
}

describe("classifyMove", () => {
  describe("thresholds", () => {
    it("best at loss 0", () => {
      const result = classifyMove(makeAssessment({ delta: exactDelta(0) }));
      expect(result.classification).toBe("best");
      expect(result.basis).toBe("centipawn-loss");
    });

    it("best at loss 10", () => {
      const result = classifyMove(makeAssessment({ delta: exactDelta(10) }));
      expect(result.classification).toBe("best");
      expect(result.basis).toBe("centipawn-loss");
    });

    it("excellent immediately above best at loss 11", () => {
      const result = classifyMove(makeAssessment({ delta: exactDelta(11) }));
      expect(result.classification).toBe("excellent");
      expect(result.basis).toBe("centipawn-loss");
    });

    it("excellent at loss 30", () => {
      const result = classifyMove(makeAssessment({ delta: exactDelta(30) }));
      expect(result.classification).toBe("excellent");
      expect(result.basis).toBe("centipawn-loss");
    });

    it("good immediately above excellent at loss 31", () => {
      const result = classifyMove(makeAssessment({ delta: exactDelta(31) }));
      expect(result.classification).toBe("good");
      expect(result.basis).toBe("centipawn-loss");
    });

    it("good at loss 70", () => {
      const result = classifyMove(makeAssessment({ delta: exactDelta(70) }));
      expect(result.classification).toBe("good");
      expect(result.basis).toBe("centipawn-loss");
    });

    it("inaccuracy immediately above good at loss 71", () => {
      const result = classifyMove(makeAssessment({ delta: exactDelta(71) }));
      expect(result.classification).toBe("inaccuracy");
      expect(result.basis).toBe("centipawn-loss");
    });

    it("inaccuracy at loss 120", () => {
      const result = classifyMove(makeAssessment({ delta: exactDelta(120) }));
      expect(result.classification).toBe("inaccuracy");
      expect(result.basis).toBe("centipawn-loss");
    });

    it("mistake immediately above inaccuracy at loss 121", () => {
      const result = classifyMove(makeAssessment({ delta: exactDelta(121) }));
      expect(result.classification).toBe("mistake");
      expect(result.basis).toBe("centipawn-loss");
    });

    it("mistake at loss 250", () => {
      const result = classifyMove(makeAssessment({ delta: exactDelta(250) }));
      expect(result.classification).toBe("mistake");
      expect(result.basis).toBe("centipawn-loss");
    });

    it("blunder immediately above mistake at loss 251", () => {
      const result = classifyMove(makeAssessment({ delta: exactDelta(251) }));
      expect(result.classification).toBe("blunder");
      expect(result.basis).toBe("centipawn-loss");
    });

    it("blunder at large loss", () => {
      const result = classifyMove(makeAssessment({ delta: exactDelta(300) }));
      expect(result.classification).toBe("blunder");
      expect(result.basis).toBe("centipawn-loss");
    });
  });

  describe("candidate rank", () => {
    it("rank 1 overrides loss classification with candidate-rank basis", () => {
      const result = classifyMove(
        makeAssessment({ candidateRank: 1, delta: exactDelta(300) })
      );
      expect(result.classification).toBe("best");
      expect(result.basis).toBe("candidate-rank");
    });

    it("rank 2 does not override centipawn classification", () => {
      const result = classifyMove(
        makeAssessment({ candidateRank: 2, delta: exactDelta(0) })
      );
      expect(result.classification).toBe("best");
      expect(result.basis).toBe("centipawn-loss");
    });

    it("rank 3 does not override centipawn classification", () => {
      const result = classifyMove(
        makeAssessment({ candidateRank: 3, delta: exactDelta(300) })
      );
      expect(result.classification).toBe("blunder");
      expect(result.basis).toBe("centipawn-loss");
    });
  });

  describe("unclassifiable inputs", () => {
    it("unavailable assessment", () => {
      const result = classifyMove(
        makeAssessment({
          available: false,
          unavailableReason: "before-analysis-missing",
        })
      );
      expect(result.classification).toBe("unclassified");
      expect(result.basis).toBe("unavailable");
    });

    it("null delta", () => {
      const result = classifyMove(makeAssessment({ delta: null }));
      expect(result.classification).toBe("unclassified");
      expect(result.basis).toBe("delta-missing");
    });

    it("mate delta", () => {
      const result = classifyMove(
        makeAssessment({
          delta: {
            kind: "mate",
            beforeMoverScore: { type: "cp", value: 100, perspective: "mover" },
            afterMoverScore: { type: "mate", value: 3, perspective: "mover" },
          },
        })
      );
      expect(result.classification).toBe("unclassified");
      expect(result.basis).toBe("mate");
    });

    it("bounded delta", () => {
      const result = classifyMove(
        makeAssessment({
          delta: {
            kind: "bounded",
            beforeMoverScore: { type: "cp", value: 100, perspective: "mover" },
            afterMoverScore: { type: "cp", value: 80, perspective: "mover" },
          },
        })
      );
      expect(result.classification).toBe("unclassified");
      expect(result.basis).toBe("bounded");
    });

    it("negative loss", () => {
      const result = classifyMove(
        makeAssessment({ delta: exactDelta(-5) })
      );
      expect(result.classification).toBe("unclassified");
      expect(result.basis).toBe("invalid-loss");
    });

    it("NaN loss", () => {
      const result = classifyMove(
        makeAssessment({
          delta: {
            kind: "exact",
            beforeMoverScore: { type: "cp", value: 100, perspective: "mover" },
            afterMoverScore: { type: "cp", value: NaN, perspective: "mover" },
            signedChange: NaN,
            centipawnLoss: NaN,
          },
        })
      );
      expect(result.classification).toBe("unclassified");
      expect(result.basis).toBe("invalid-loss");
    });

    it("positive Infinity loss", () => {
      const result = classifyMove(
        makeAssessment({
          delta: {
            kind: "exact",
            beforeMoverScore: { type: "cp", value: Infinity, perspective: "mover" },
            afterMoverScore: { type: "cp", value: 0, perspective: "mover" },
            signedChange: -Infinity,
            centipawnLoss: Infinity,
          },
        })
      );
      expect(result.classification).toBe("unclassified");
      expect(result.basis).toBe("invalid-loss");
    });
  });

  describe("classifyMoves", () => {
    it("preserves input order", () => {
      const assessments = [
        makeAssessment({ ply: 1, delta: exactDelta(10) }),
        makeAssessment({ ply: 2, delta: exactDelta(200) }),
        makeAssessment({ ply: 3, delta: exactDelta(300) }),
      ];
      const results = classifyMoves(assessments);
      expect(results.map((r) => r.assessment.ply)).toEqual([1, 2, 3]);
    });

    it("produces exactly one result per assessment", () => {
      const assessments = [
        makeAssessment({ ply: 1, delta: exactDelta(10) }),
        makeAssessment({ ply: 2, delta: exactDelta(200) }),
      ];
      const results = classifyMoves(assessments);
      expect(results).toHaveLength(2);
      expect(results[0].assessment.ply).toBe(1);
      expect(results[1].assessment.ply).toBe(2);
    });

    it("returns an empty array for empty input with default policy", () => {
      const results = classifyMoves([]);
      expect(results).toEqual([]);
    });

    it("validates invalid policy on empty input", () => {
      const invalidPolicy = {
        bestMax: NaN,
        excellentMax: 30,
        goodMax: 70,
        inaccuracyMax: 120,
        mistakeMax: 250,
      };
      expect(() => classifyMoves([], invalidPolicy)).toThrow(RangeError);
    });

    it("validates invalid policy on non-empty input", () => {
      const invalidPolicy = {
        bestMax: 30,
        excellentMax: 10,
        goodMax: 70,
        inaccuracyMax: 120,
        mistakeMax: 250,
      };
      expect(() =>
        classifyMoves([makeAssessment({ delta: exactDelta(10) })], invalidPolicy)
      ).toThrow(RangeError);
    });

    it("propagates custom policy for classifyMoves", () => {
      const customPolicy = {
        bestMax: 5,
        excellentMax: 20,
        goodMax: 60,
        inaccuracyMax: 100,
        mistakeMax: 200,
      };
      const results = classifyMoves(
        [makeAssessment({ delta: exactDelta(8) })],
        customPolicy
      );
      expect(results[0].classification).toBe("excellent");
    });
  });

  describe("immutability", () => {
    it("does not mutate source assessment", () => {
      const assessment = makeAssessment({ delta: exactDelta(10) });
      const beforeSnapshot = JSON.stringify(assessment);
      const result = classifyMove(assessment);
      expect(JSON.stringify(assessment)).toBe(beforeSnapshot);
      expect(result.assessment).toBe(assessment);
    });

    it("does not mutate default policy", () => {
      expect(Object.isFrozen(DEFAULT_CLASSIFICATION_POLICY)).toBe(true);
      expect(() => {
        (DEFAULT_CLASSIFICATION_POLICY as Record<string, number>).bestMax = 999;
      }).toThrow();
      expect(DEFAULT_CLASSIFICATION_POLICY.bestMax).toBe(10);
    });
  });

  describe("custom policy validation", () => {
    it("accepts valid custom policy", () => {
      const customPolicy = {
        bestMax: 5,
        excellentMax: 20,
        goodMax: 60,
        inaccuracyMax: 100,
        mistakeMax: 200,
      };
      const result = classifyMove(
        makeAssessment({ delta: exactDelta(3) }),
        customPolicy
      );
      expect(result.classification).toBe("best");
    });

    it("rejects negative custom threshold", () => {
      expect(() =>
        classifyMove(
          makeAssessment({ delta: exactDelta(10) }),
          {
            bestMax: -1,
            excellentMax: 30,
            goodMax: 70,
            inaccuracyMax: 120,
            mistakeMax: 250,
          }
        )
      ).toThrow(RangeError);
    });

    it("rejects non-finite custom threshold", () => {
      expect(() =>
        classifyMove(
          makeAssessment({ delta: exactDelta(10) }),
          {
            bestMax: NaN,
            excellentMax: 30,
            goodMax: 70,
            inaccuracyMax: 120,
            mistakeMax: 250,
          }
        )
      ).toThrow(RangeError);
    });

    it("rejects decreasing custom thresholds", () => {
      expect(() =>
        classifyMove(
          makeAssessment({ delta: exactDelta(10) }),
          {
            bestMax: 30,
            excellentMax: 10,
            goodMax: 70,
            inaccuracyMax: 120,
            mistakeMax: 250,
          }
        )
      ).toThrow(RangeError);
    });

    it("accepts equal adjacent custom thresholds", () => {
      const result = classifyMove(
        makeAssessment({ delta: exactDelta(10) }),
        {
          bestMax: 10,
          excellentMax: 10,
          goodMax: 70,
          inaccuracyMax: 120,
          mistakeMax: 250,
        }
      );
      expect(result.classification).toBe("best");
    });
  });
});
