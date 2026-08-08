import { describe, expect, it } from "vitest";
import type { MoveAssessment } from "@/features/chess/move-assessment";
import {
  classifyMove,
  classifyMoves,
  isSacrifice,
  DEFAULT_CLASSIFICATION_POLICY,
  MOVE_CLASSIFICATION_ORDER,
  type MoveClassification,
} from "@/features/chess/move-classification";

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const WHITE_LOST_KNIGHT_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/R1BQKBNR b KQkq - 0 1";
const WHITE_LOST_PAWN_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const BLACK_LOST_KNIGHT_FEN = "r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

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

  describe("great", () => {
    it("classifies as great with only-move basis when margin is exactly 150 and loss is 0 at rank 1", () => {
      const result = classifyMove(
        makeAssessment({
          candidateRank: 1,
          bestCandidateScore: { type: "cp", value: 200, perspective: "mover" },
          secondCandidateScore: { type: "cp", value: 50, perspective: "mover" },
          delta: exactDelta(0),
        })
      );
      expect(result.classification).toBe("great");
      expect(result.basis).toBe("only-move");
    });

    it("classifies as great when margin is 200 and loss is exactly 20 at rank 1", () => {
      const result = classifyMove(
        makeAssessment({
          candidateRank: 1,
          bestCandidateScore: { type: "cp", value: 200, perspective: "mover" },
          secondCandidateScore: { type: "cp", value: 0, perspective: "mover" },
          delta: exactDelta(20),
        })
      );
      expect(result.classification).toBe("great");
      expect(result.basis).toBe("only-move");
    });

    it("falls back to best with candidate-rank basis when margin is 149", () => {
      const result = classifyMove(
        makeAssessment({
          candidateRank: 1,
          bestCandidateScore: { type: "cp", value: 199, perspective: "mover" },
          secondCandidateScore: { type: "cp", value: 50, perspective: "mover" },
          delta: exactDelta(0),
        })
      );
      expect(result.classification).toBe("best");
      expect(result.basis).toBe("candidate-rank");
    });

    it("falls back to best when loss is 21", () => {
      const result = classifyMove(
        makeAssessment({
          candidateRank: 1,
          bestCandidateScore: { type: "cp", value: 200, perspective: "mover" },
          secondCandidateScore: { type: "cp", value: 0, perspective: "mover" },
          delta: exactDelta(21),
        })
      );
      expect(result.classification).toBe("best");
      expect(result.basis).toBe("candidate-rank");
    });

    it("does not classify rank 2 as great and falls through to centipawn-loss best", () => {
      const result = classifyMove(
        makeAssessment({
          candidateRank: 2,
          bestCandidateScore: { type: "cp", value: 200, perspective: "mover" },
          secondCandidateScore: { type: "cp", value: 0, perspective: "mover" },
          delta: exactDelta(0),
        })
      );
      expect(result.classification).toBe("best");
      expect(result.basis).toBe("centipawn-loss");
    });

    it("falls back to best when bestCandidateScore is null", () => {
      const result = classifyMove(
        makeAssessment({
          candidateRank: 1,
          bestCandidateScore: null,
          secondCandidateScore: { type: "cp", value: 0, perspective: "mover" },
          delta: exactDelta(0),
        })
      );
      expect(result.classification).toBe("best");
      expect(result.basis).toBe("candidate-rank");
    });

    it("falls back to best when secondCandidateScore is null", () => {
      const result = classifyMove(
        makeAssessment({
          candidateRank: 1,
          bestCandidateScore: { type: "cp", value: 200, perspective: "mover" },
          secondCandidateScore: null,
          delta: exactDelta(0),
        })
      );
      expect(result.classification).toBe("best");
      expect(result.basis).toBe("candidate-rank");
    });

    it("falls back to best when bestCandidateScore is mate", () => {
      const result = classifyMove(
        makeAssessment({
          candidateRank: 1,
          bestCandidateScore: { type: "mate", value: 2, perspective: "mover" },
          secondCandidateScore: { type: "cp", value: 50, perspective: "mover" },
          delta: exactDelta(0),
        })
      );
      expect(result.classification).toBe("best");
      expect(result.basis).toBe("candidate-rank");
    });

    it("falls back to best when secondCandidateScore is mate", () => {
      const result = classifyMove(
        makeAssessment({
          candidateRank: 1,
          bestCandidateScore: { type: "cp", value: 200, perspective: "mover" },
          secondCandidateScore: { type: "mate", value: -2, perspective: "mover" },
          delta: exactDelta(0),
        })
      );
      expect(result.classification).toBe("best");
      expect(result.basis).toBe("candidate-rank");
    });

    it("falls back to best when bestCandidateScore carries lowerbound", () => {
      const result = classifyMove(
        makeAssessment({
          candidateRank: 1,
          bestCandidateScore: { type: "cp", value: 200, perspective: "mover", bound: "lowerbound" },
          secondCandidateScore: { type: "cp", value: 0, perspective: "mover" },
          delta: exactDelta(0),
        })
      );
      expect(result.classification).toBe("best");
      expect(result.basis).toBe("candidate-rank");
    });

    it("classifies as great when margin crosses zero with best +50 and second -120", () => {
      const result = classifyMove(
        makeAssessment({
          candidateRank: 1,
          bestCandidateScore: { type: "cp", value: 50, perspective: "mover" },
          secondCandidateScore: { type: "cp", value: -120, perspective: "mover" },
          delta: exactDelta(0),
        })
      );
      expect(result.classification).toBe("great");
      expect(result.basis).toBe("only-move");
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

    it("mate delta delivering mate classifies as best", () => {
      const result = classifyMove(
        makeAssessment({
          delta: {
            kind: "mate",
            beforeMoverScore: { type: "cp", value: 100, perspective: "mover" },
            afterMoverScore: { type: "mate", value: 3, perspective: "mover" },
          },
        })
      );
      expect(result.classification).toBe("best");
      expect(result.basis).toBe("mate-delivered");
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

  describe("brilliant", () => {
    it("classifies as brilliant when all great conditions met, knight sacrificed, and best candidate score is positive", () => {
      const whiteMove = makeAssessment({
        mover: "white",
        beforeFen: INITIAL_FEN,
        afterFen: INITIAL_FEN,
        candidateRank: 1,
        bestCandidateScore: { type: "cp", value: 200, perspective: "mover" },
        secondCandidateScore: { type: "cp", value: 0, perspective: "mover" },
        delta: exactDelta(0),
      });
      const opponentReply = makeAssessment({
        mover: "black",
        beforeFen: INITIAL_FEN,
        afterFen: WHITE_LOST_KNIGHT_FEN,
        delta: exactDelta(0),
      });
      const results = classifyMoves([whiteMove, opponentReply]);
      expect(results[0].classification).toBe("brilliant");
      expect(results[0].basis).toBe("sacrifice");
    });

    it("classifies as great when post-reply neighbour is absent", () => {
      const whiteMove = makeAssessment({
        mover: "white",
        beforeFen: INITIAL_FEN,
        afterFen: INITIAL_FEN,
        candidateRank: 1,
        bestCandidateScore: { type: "cp", value: 200, perspective: "mover" },
        secondCandidateScore: { type: "cp", value: 0, perspective: "mover" },
        delta: exactDelta(0),
      });
      const results = classifyMoves([whiteMove]);
      expect(results[0].classification).toBe("great");
      expect(results[0].basis).toBe("only-move");
    });

    it("classifies as great when material drop is smaller than MINOR_PIECE_VALUE", () => {
      const whiteMove = makeAssessment({
        mover: "white",
        beforeFen: INITIAL_FEN,
        afterFen: INITIAL_FEN,
        candidateRank: 1,
        bestCandidateScore: { type: "cp", value: 200, perspective: "mover" },
        secondCandidateScore: { type: "cp", value: 0, perspective: "mover" },
        delta: exactDelta(0),
      });
      const opponentReply = makeAssessment({
        mover: "black",
        beforeFen: INITIAL_FEN,
        afterFen: WHITE_LOST_PAWN_FEN,
        delta: exactDelta(0),
      });
      const results = classifyMoves([whiteMove, opponentReply]);
      expect(results[0].classification).toBe("great");
      expect(results[0].basis).toBe("only-move");
    });

    it("classifies as great when best candidate score is negative", () => {
      const whiteMove = makeAssessment({
        mover: "white",
        beforeFen: INITIAL_FEN,
        afterFen: INITIAL_FEN,
        candidateRank: 1,
        bestCandidateScore: { type: "cp", value: -10, perspective: "mover" },
        secondCandidateScore: { type: "cp", value: -200, perspective: "mover" },
        delta: exactDelta(0),
      });
      const opponentReply = makeAssessment({
        mover: "black",
        beforeFen: INITIAL_FEN,
        afterFen: WHITE_LOST_KNIGHT_FEN,
        delta: exactDelta(0),
      });
      const results = classifyMoves([whiteMove, opponentReply]);
      expect(results[0].classification).toBe("great");
      expect(results[0].basis).toBe("only-move");
    });

    it("classifies as neither brilliant nor great when candidate rank is 2", () => {
      const whiteMove = makeAssessment({
        mover: "white",
        beforeFen: INITIAL_FEN,
        afterFen: INITIAL_FEN,
        candidateRank: 2,
        bestCandidateScore: { type: "cp", value: 200, perspective: "mover" },
        secondCandidateScore: { type: "cp", value: 0, perspective: "mover" },
        delta: exactDelta(0),
      });
      const opponentReply = makeAssessment({
        mover: "black",
        beforeFen: INITIAL_FEN,
        afterFen: WHITE_LOST_KNIGHT_FEN,
        delta: exactDelta(0),
      });
      const results = classifyMoves([whiteMove, opponentReply]);
      expect(results[0].classification).toBe("best");
      expect(results[0].basis).toBe("centipawn-loss");
    });

    it("detects a sacrifice by black correctly using perspective flip", () => {
      const blackMove = makeAssessment({
        mover: "black",
        beforeFen: INITIAL_FEN,
        afterFen: INITIAL_FEN,
        candidateRank: 1,
        bestCandidateScore: { type: "cp", value: 200, perspective: "mover" },
        secondCandidateScore: { type: "cp", value: 0, perspective: "mover" },
        delta: exactDelta(0),
      });
      const opponentReply = makeAssessment({
        mover: "white",
        beforeFen: INITIAL_FEN,
        afterFen: BLACK_LOST_KNIGHT_FEN,
        delta: exactDelta(0),
      });
      const results = classifyMoves([blackMove, opponentReply]);
      expect(results[0].classification).toBe("brilliant");
      expect(results[0].basis).toBe("sacrifice");
    });

    it("handles malformed FEN without throwing and classifies move as great", () => {
      const whiteMove = makeAssessment({
        mover: "white",
        beforeFen: "invalid fen string",
        afterFen: INITIAL_FEN,
        candidateRank: 1,
        bestCandidateScore: { type: "cp", value: 200, perspective: "mover" },
        secondCandidateScore: { type: "cp", value: 0, perspective: "mover" },
        delta: exactDelta(0),
      });
      const opponentReply = makeAssessment({
        mover: "black",
        beforeFen: INITIAL_FEN,
        afterFen: WHITE_LOST_KNIGHT_FEN,
        delta: exactDelta(0),
      });
      expect(isSacrifice(whiteMove, opponentReply)).toBe(false);
      const results = classifyMoves([whiteMove, opponentReply]);
      expect(results[0].classification).toBe("great");
      expect(results[0].basis).toBe("only-move");
    });

    it("returns great when classifyMove is called on a single assessment", () => {
      const whiteMove = makeAssessment({
        mover: "white",
        beforeFen: INITIAL_FEN,
        afterFen: INITIAL_FEN,
        candidateRank: 1,
        bestCandidateScore: { type: "cp", value: 200, perspective: "mover" },
        secondCandidateScore: { type: "cp", value: 0, perspective: "mover" },
        delta: exactDelta(0),
      });
      const result = classifyMove(whiteMove);
      expect(result.classification).toBe("great");
      expect(result.basis).toBe("only-move");
    });

    it("classifies brilliant at the correct index only in a sequence of moves", () => {
      const move1 = makeAssessment({
        ply: 1,
        mover: "white",
        beforeFen: INITIAL_FEN,
        afterFen: INITIAL_FEN,
        candidateRank: 1,
        bestCandidateScore: { type: "cp", value: 200, perspective: "mover" },
        secondCandidateScore: { type: "cp", value: 0, perspective: "mover" },
        delta: exactDelta(0),
      });
      const move2 = makeAssessment({
        ply: 2,
        mover: "black",
        beforeFen: INITIAL_FEN,
        afterFen: WHITE_LOST_KNIGHT_FEN,
        candidateRank: 1,
        bestCandidateScore: { type: "cp", value: 10, perspective: "mover" },
        secondCandidateScore: { type: "cp", value: 0, perspective: "mover" },
        delta: exactDelta(0),
      });
      const move3 = makeAssessment({
        ply: 3,
        mover: "white",
        beforeFen: WHITE_LOST_KNIGHT_FEN,
        afterFen: WHITE_LOST_KNIGHT_FEN,
        delta: exactDelta(0),
      });

      const results = classifyMoves([move1, move2, move3]);
      expect(results[0].classification).toBe("brilliant");
      expect(results[0].basis).toBe("sacrifice");
      expect(results[1].classification).toBe("best");
      expect(results[2].classification).toBe("best");
    });
  });

  describe("mate classification", () => {
    it("case (a): delivering a forced mate classifies as best with mate-delivered basis", () => {
      const result = classifyMove(
        makeAssessment({
          delta: {
            kind: "mate",
            beforeMoverScore: { type: "cp", value: 50, perspective: "mover" },
            afterMoverScore: { type: "mate", value: 4, perspective: "mover" },
          },
        })
      );
      expect(result.classification).toBe("best");
      expect(result.basis).toBe("mate-delivered");
    });

    it("case (a): preserving a forced mate classifies as best with mate-preserved basis", () => {
      const result = classifyMove(
        makeAssessment({
          delta: {
            kind: "mate",
            beforeMoverScore: { type: "mate", value: 5, perspective: "mover" },
            afterMoverScore: { type: "mate", value: 4, perspective: "mover" },
          },
        })
      );
      expect(result.classification).toBe("best");
      expect(result.basis).toBe("mate-preserved");
    });

    it("case (a): playing a slower mate classifies as good with mate-drift basis", () => {
      const result = classifyMove(
        makeAssessment({
          delta: {
            kind: "mate",
            beforeMoverScore: { type: "mate", value: 3, perspective: "mover" },
            afterMoverScore: { type: "mate", value: 5, perspective: "mover" },
          },
        })
      );
      expect(result.classification).toBe("good");
      expect(result.basis).toBe("mate-drift");
    });

    it("case (a) + sacrifice: mate-delivering sacrifice classifies as brilliant", () => {
      const whiteMove = makeAssessment({
        mover: "white",
        beforeFen: INITIAL_FEN,
        afterFen: INITIAL_FEN,
        candidateRank: 1,
        bestCandidateScore: { type: "cp", value: 200, perspective: "mover" },
        secondCandidateScore: { type: "cp", value: 0, perspective: "mover" },
        delta: {
          kind: "mate",
          beforeMoverScore: { type: "cp", value: 200, perspective: "mover" },
          afterMoverScore: { type: "mate", value: 3, perspective: "mover" },
        },
      });
      const opponentReply = makeAssessment({
        mover: "black",
        beforeFen: INITIAL_FEN,
        afterFen: WHITE_LOST_KNIGHT_FEN,
        delta: exactDelta(0),
      });
      const results = classifyMoves([whiteMove, opponentReply]);
      expect(results[0].classification).toBe("brilliant");
      expect(results[0].basis).toBe("sacrifice");
    });

    it("case (b): losing a winning mate classifies as missed-win", () => {
      const result = classifyMove(
        makeAssessment({
          delta: {
            kind: "mate",
            beforeMoverScore: { type: "mate", value: 3, perspective: "mover" },
            afterMoverScore: { type: "cp", value: 200, perspective: "mover" },
          },
        })
      );
      expect(result.classification).toBe("missed-win");
      expect(result.basis).toBe("mate-missed");
    });

    it("case (c): allowing opponent a forced mate classifies as blunder", () => {
      const result = classifyMove(
        makeAssessment({
          delta: {
            kind: "mate",
            beforeMoverScore: { type: "cp", value: 0, perspective: "mover" },
            afterMoverScore: { type: "mate", value: -2, perspective: "mover" },
          },
        })
      );
      expect(result.classification).toBe("blunder");
      expect(result.basis).toBe("mate-allowed");
    });

    it("case (d): flipping winning mate to being mated classifies as blunder", () => {
      const result = classifyMove(
        makeAssessment({
          delta: {
            kind: "mate",
            beforeMoverScore: { type: "mate", value: 3, perspective: "mover" },
            afterMoverScore: { type: "mate", value: -1, perspective: "mover" },
          },
        })
      );
      expect(result.classification).toBe("blunder");
      expect(result.basis).toBe("mate-allowed");
    });

    it("case (b) for black: losing a winning mate classifies as missed-win with correct perspective", () => {
      const result = classifyMove(
        makeAssessment({
          mover: "black",
          delta: {
            kind: "mate",
            beforeMoverScore: { type: "mate", value: 2, perspective: "mover" },
            afterMoverScore: { type: "cp", value: 150, perspective: "mover" },
          },
        })
      );
      expect(result.classification).toBe("missed-win");
      expect(result.basis).toBe("mate-missed");
    });

    it("case (c) for black: allowing opponent a forced mate classifies as blunder", () => {
      const result = classifyMove(
        makeAssessment({
          mover: "black",
          delta: {
            kind: "mate",
            beforeMoverScore: { type: "cp", value: -50, perspective: "mover" },
            afterMoverScore: { type: "mate", value: -3, perspective: "mover" },
          },
        })
      );
      expect(result.classification).toBe("blunder");
      expect(result.basis).toBe("mate-allowed");
    });

    it("remaining mate transition (was being mated, still being mated) stays unclassified", () => {
      const result = classifyMove(
        makeAssessment({
          delta: {
            kind: "mate",
            beforeMoverScore: { type: "mate", value: -3, perspective: "mover" },
            afterMoverScore: { type: "mate", value: -2, perspective: "mover" },
          },
        })
      );
      expect(result.classification).toBe("unclassified");
      expect(result.basis).toBe("bounded");
    });

    it("mate-delivering move without sacrifice conditions classifies as best not brilliant", () => {
      const whiteMove = makeAssessment({
        mover: "white",
        beforeFen: INITIAL_FEN,
        afterFen: INITIAL_FEN,
        candidateRank: 1,
        bestCandidateScore: { type: "cp", value: 200, perspective: "mover" },
        secondCandidateScore: { type: "cp", value: 100, perspective: "mover" },
        delta: {
          kind: "mate",
          beforeMoverScore: { type: "cp", value: 200, perspective: "mover" },
          afterMoverScore: { type: "mate", value: 2, perspective: "mover" },
        },
      });
      const opponentReply = makeAssessment({
        mover: "black",
        beforeFen: INITIAL_FEN,
        afterFen: INITIAL_FEN,
        delta: exactDelta(0),
      });
      const results = classifyMoves([whiteMove, opponentReply]);
      expect(results[0].classification).toBe("best");
      expect(results[0].basis).toBe("mate-delivered");
    });
  });

  describe("MOVE_CLASSIFICATION_ORDER", () => {
    // This object is what makes the compiler enforce completeness: omitting a union member from it is a tsc error.
    const EVERY_CLASSIFICATION: Record<MoveClassification, true> = {
      brilliant: true,
      great: true,
      best: true,
      excellent: true,
      good: true,
      "missed-win": true,
      inaccuracy: true,
      mistake: true,
      blunder: true,
      unclassified: true,
    };

    it("has sorted contents equal to the sorted keys of EVERY_CLASSIFICATION", () => {
      const sortedOrder = [...MOVE_CLASSIFICATION_ORDER].sort();
      const sortedKeys = Object.keys(EVERY_CLASSIFICATION).sort();
      expect(sortedOrder).toEqual(sortedKeys);
    });

    it("contains no duplicates", () => {
      const uniqueElements = new Set(MOVE_CLASSIFICATION_ORDER);
      expect(uniqueElements.size).toBe(MOVE_CLASSIFICATION_ORDER.length);
    });

    it("places brilliant at index 0 and great at index 1", () => {
      expect(MOVE_CLASSIFICATION_ORDER[0]).toBe("brilliant");
      expect(MOVE_CLASSIFICATION_ORDER[1]).toBe("great");
    });

    it("places unclassified as the last element", () => {
      expect(MOVE_CLASSIFICATION_ORDER[MOVE_CLASSIFICATION_ORDER.length - 1]).toBe(
        "unclassified"
      );
    });
  });
});
