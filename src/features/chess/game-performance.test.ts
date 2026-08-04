import { describe, expect, it } from "vitest";
import type { ClassifiedMove, MoveClassification } from "@/features/chess/move-classification";
import type { MoveAssessment } from "@/features/chess/move-assessment";
import { buildGamePerformance } from "@/features/chess/game-performance";

function classified(
  overrides: Partial<MoveAssessment> = {},
  classification: MoveClassification = "good",
): ClassifiedMove {
  const assessment: MoveAssessment = {
    ply: 1,
    mover: "white",
    san: "e4",
    from: "e2",
    to: "e4",
    beforeFen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    afterFen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    beforeScore: { type: "cp", value: 30, perspective: "white" },
    afterScore: { type: "cp", value: 20, perspective: "white" },
    delta: null,
    available: true,
    unavailableReason: null,
    playedUci: "e2e4",
    candidateRank: 1,
    bestCandidateUci: "e2e4",
    candidateMoves: [],
    bestCandidateScore: null,
    secondCandidateScore: null,
    ...overrides,
  };

  return {
    assessment,
    classification,
    basis: "centipawn-loss",
  };
}

describe("buildGamePerformance", () => {
  it("returns zeroed players for empty input", () => {
    const result = buildGamePerformance([]);
    expect(result.white.totalMoves).toBe(0);
    expect(result.white.countedMoves).toBe(0);
    expect(result.white.averageCentipawnLoss).toBeNull();
    expect(result.black.totalMoves).toBe(0);
    expect(result.black.countedMoves).toBe(0);
    expect(result.black.averageCentipawnLoss).toBeNull();
  });

  it("counts white-only moves", () => {
    const items: ClassifiedMove[] = [
      classified({ mover: "white", ply: 1 }),
      classified({ mover: "white", ply: 2 }),
    ];
    const result = buildGamePerformance(items);
    expect(result.white.totalMoves).toBe(2);
    expect(result.black.totalMoves).toBe(0);
  });

  it("counts black-only moves", () => {
    const items: ClassifiedMove[] = [
      classified({ mover: "black", ply: 1 }),
      classified({ mover: "black", ply: 2 }),
    ];
    const result = buildGamePerformance(items);
    expect(result.black.totalMoves).toBe(2);
    expect(result.white.totalMoves).toBe(0);
  });

  it("separates both players correctly", () => {
    const items: ClassifiedMove[] = [
      classified({ mover: "white", ply: 1 }),
      classified({ mover: "black", ply: 2 }),
    ];
    const result = buildGamePerformance(items);
    expect(result.white.totalMoves).toBe(1);
    expect(result.black.totalMoves).toBe(1);
  });

  it("includes all seven classification keys initialized to zero", () => {
    const result = buildGamePerformance([]);
    const keys: MoveClassification[] = ["brilliant", "great", "best", "excellent", "good", "inaccuracy", "mistake", "blunder", "unclassified"];
    for (const key of keys) {
      expect(result.white.counts[key]).toBe(0);
      expect(result.black.counts[key]).toBe(0);
    }
  });

  it("computes ACPL mean over exact deltas", () => {
    const items: ClassifiedMove[] = [
      classified({
        mover: "white",
        delta: { kind: "exact", beforeMoverScore: { type: "cp", value: 30, perspective: "mover" }, afterMoverScore: { type: "cp", value: 20, perspective: "mover" }, signedChange: 10, centipawnLoss: 10 },
      }),
      classified({
        mover: "white",
        delta: { kind: "exact", beforeMoverScore: { type: "cp", value: 20, perspective: "mover" }, afterMoverScore: { type: "cp", value: 0, perspective: "mover" }, signedChange: 20, centipawnLoss: 20 },
      }),
    ];
    const result = buildGamePerformance(items);
    expect(result.white.averageCentipawnLoss).toBe(15);
  });

  it("excludes mate deltas from ACPL", () => {
    const items: ClassifiedMove[] = [
      classified({
        mover: "white",
        delta: { kind: "mate", beforeMoverScore: { type: "cp", value: 30, perspective: "mover" }, afterMoverScore: { type: "mate", value: 2, perspective: "mover" } },
      }),
    ];
    const result = buildGamePerformance(items);
    expect(result.white.countedMoves).toBe(0);
    expect(result.white.averageCentipawnLoss).toBeNull();
  });

  it("excludes bounded deltas from ACPL", () => {
    const items: ClassifiedMove[] = [
      classified({
        mover: "white",
        delta: { kind: "bounded", beforeMoverScore: { type: "cp", value: 30, perspective: "mover" }, afterMoverScore: { type: "cp", value: 20, perspective: "mover" } },
      }),
    ];
    const result = buildGamePerformance(items);
    expect(result.white.countedMoves).toBe(0);
    expect(result.white.averageCentipawnLoss).toBeNull();
  });

  it("excludes null deltas from ACPL", () => {
    const items: ClassifiedMove[] = [
      classified({ mover: "white", delta: null }),
    ];
    const result = buildGamePerformance(items);
    expect(result.white.countedMoves).toBe(0);
    expect(result.white.averageCentipawnLoss).toBeNull();
  });

  it("returns null ACPL when no exact deltas exist", () => {
    const items: ClassifiedMove[] = [
      classified({ mover: "white", delta: null }),
      classified({ mover: "black", delta: null }),
    ];
    const result = buildGamePerformance(items);
    expect(result.white.averageCentipawnLoss).toBeNull();
    expect(result.black.averageCentipawnLoss).toBeNull();
  });

  it("counts each classification under the correct player", () => {
    const items: ClassifiedMove[] = [
      classified({ mover: "white" }, "best"),
      classified({ mover: "white" }, "blunder"),
      classified({ mover: "white" }, "blunder"),
      classified({ mover: "black" }, "good"),
      classified({ mover: "black" }, "mistake"),
      classified({ mover: "black" }, "unclassified"),
    ];
    const result = buildGamePerformance(items);
    expect(result.white.counts.best).toBe(1);
    expect(result.white.counts.blunder).toBe(2);
    expect(result.white.counts.good).toBe(0);
    expect(result.black.counts.good).toBe(1);
    expect(result.black.counts.mistake).toBe(1);
    expect(result.black.counts.unclassified).toBe(1);
    expect(result.black.counts.blunder).toBe(0);
  });

  it("scores a tiny exact delta near 100", () => {
    const items: ClassifiedMove[] = [
      classified({
        mover: "white",
        delta: { kind: "exact", beforeMoverScore: { type: "cp", value: 30, perspective: "mover" }, afterMoverScore: { type: "cp", value: 29, perspective: "mover" }, signedChange: -1, centipawnLoss: 1 },
      }),
    ];
    const result = buildGamePerformance(items);
    expect(result.white.accuracyMoves).toBe(1);
    expect(result.white.averageAccuracy).toBeGreaterThan(95);
  });

  it("scores a large exact delta lower than a tiny one", () => {
    const tiny = classified({
      mover: "white",
      delta: { kind: "exact", beforeMoverScore: { type: "cp", value: 30, perspective: "mover" }, afterMoverScore: { type: "cp", value: 29, perspective: "mover" }, signedChange: -1, centipawnLoss: 1 },
    });
    const large = classified({
      mover: "white",
      delta: { kind: "exact", beforeMoverScore: { type: "cp", value: 30, perspective: "mover" }, afterMoverScore: { type: "cp", value: -170, perspective: "mover" }, signedChange: -200, centipawnLoss: 200 },
    });
    const tinyResult = buildGamePerformance([tiny]);
    const largeResult = buildGamePerformance([large]);
    expect(tinyResult.white.averageAccuracy).toBeGreaterThan(95);
    expect(largeResult.white.averageAccuracy).toBeLessThan(60);
  });

  it("counts a mate delta for accuracy eligibility", () => {
    const items: ClassifiedMove[] = [
      classified({
        mover: "white",
        delta: { kind: "mate", beforeMoverScore: { type: "mate", value: 2, perspective: "mover" }, afterMoverScore: { type: "mate", value: 1, perspective: "mover" } },
      }),
    ];
    const result = buildGamePerformance(items);
    expect(result.white.accuracyMoves).toBe(1);
    expect(result.white.averageAccuracy).not.toBeNull();
    expect(result.white.countedMoves).toBe(0);
    expect(result.white.averageCentipawnLoss).toBeNull();
  });

  it("excludes a bounded delta from accuracy", () => {
    const items: ClassifiedMove[] = [
      classified({
        mover: "white",
        delta: { kind: "bounded", beforeMoverScore: { type: "cp", value: 30, perspective: "mover" }, afterMoverScore: { type: "cp", value: 20, perspective: "mover" } },
      }),
    ];
    const result = buildGamePerformance(items);
    expect(result.white.accuracyMoves).toBe(0);
    expect(result.white.averageAccuracy).toBeNull();
  });

  it("excludes a null delta from accuracy", () => {
    const items: ClassifiedMove[] = [
      classified({ mover: "white", delta: null }),
    ];
    const result = buildGamePerformance(items);
    expect(result.white.accuracyMoves).toBe(0);
    expect(result.white.averageAccuracy).toBeNull();
  });

  it("counts accuracyMoves per player independently", () => {
    const items: ClassifiedMove[] = [
      classified({
        mover: "white",
        delta: { kind: "exact", beforeMoverScore: { type: "cp", value: 30, perspective: "mover" }, afterMoverScore: { type: "cp", value: 29, perspective: "mover" }, signedChange: -1, centipawnLoss: 1 },
      }),
      classified({
        mover: "black",
        delta: { kind: "exact", beforeMoverScore: { type: "cp", value: 30, perspective: "mover" }, afterMoverScore: { type: "cp", value: 0, perspective: "mover" }, signedChange: -30, centipawnLoss: 30 },
      }),
    ];
    const result = buildGamePerformance(items);
    expect(result.white.accuracyMoves).toBe(1);
    expect(result.black.accuracyMoves).toBe(1);
  });

  it("scores a squandered forced mate for zero accuracy", () => {
    const items: ClassifiedMove[] = [
      classified({
        mover: "white",
        delta: { kind: "mate",
          beforeMoverScore: { type: "mate", value: 2, perspective: "mover" },
          afterMoverScore: { type: "mate", value: -1, perspective: "mover" } },
      }),
    ];
    const result = buildGamePerformance(items);
    expect(result.white.accuracyMoves).toBe(1);
    expect(result.white.averageAccuracy).toBe(0);
  });

  it("populates opening phase accuracy and leaves middlegame and endgame null", () => {
    const items: ClassifiedMove[] = [
      classified({
        mover: "white",
        ply: 0,
        beforeFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        delta: {
          kind: "exact",
          beforeMoverScore: { type: "cp", value: 30, perspective: "mover" },
          afterMoverScore: { type: "cp", value: 29, perspective: "mover" },
          signedChange: -1,
          centipawnLoss: 1,
        },
      }),
    ];
    const result = buildGamePerformance(items);
    expect(result.white.phaseMoves.opening).toBe(1);
    expect(result.white.phaseMoves.middlegame).toBe(0);
    expect(result.white.phaseMoves.endgame).toBe(0);
    expect(result.white.phaseAccuracy.opening).not.toBeNull();
    expect(result.white.phaseAccuracy.middlegame).toBeNull();
    expect(result.white.phaseAccuracy.endgame).toBeNull();
  });

  it("populates only endgame phase accuracy for an endgame move", () => {
    const items: ClassifiedMove[] = [
      classified({
        mover: "white",
        ply: 40,
        beforeFen: "4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1",
        delta: {
          kind: "exact",
          beforeMoverScore: { type: "cp", value: 30, perspective: "mover" },
          afterMoverScore: { type: "cp", value: 29, perspective: "mover" },
          signedChange: -1,
          centipawnLoss: 1,
        },
      }),
    ];
    const result = buildGamePerformance(items);
    expect(result.white.phaseMoves.opening).toBe(0);
    expect(result.white.phaseMoves.middlegame).toBe(0);
    expect(result.white.phaseMoves.endgame).toBe(1);
    expect(result.white.phaseAccuracy.opening).toBeNull();
    expect(result.white.phaseAccuracy.middlegame).toBeNull();
    expect(result.white.phaseAccuracy.endgame).not.toBeNull();
  });

  it("populates only middlegame phase accuracy for a middlegame move", () => {
    const items: ClassifiedMove[] = [
      classified({
        mover: "white",
        ply: 40,
        beforeFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        delta: {
          kind: "exact",
          beforeMoverScore: { type: "cp", value: 30, perspective: "mover" },
          afterMoverScore: { type: "cp", value: 29, perspective: "mover" },
          signedChange: -1,
          centipawnLoss: 1,
        },
      }),
    ];
    const result = buildGamePerformance(items);
    expect(result.white.phaseMoves.opening).toBe(0);
    expect(result.white.phaseMoves.middlegame).toBe(1);
    expect(result.white.phaseMoves.endgame).toBe(0);
    expect(result.white.phaseAccuracy.opening).toBeNull();
    expect(result.white.phaseAccuracy.middlegame).not.toBeNull();
    expect(result.white.phaseAccuracy.endgame).toBeNull();
  });

  it("averages moves in different phases separately", () => {
    const items: ClassifiedMove[] = [
      classified({
        mover: "white",
        ply: 0,
        beforeFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        delta: {
          kind: "exact",
          beforeMoverScore: { type: "cp", value: 30, perspective: "mover" },
          afterMoverScore: { type: "cp", value: 29, perspective: "mover" },
          signedChange: -1,
          centipawnLoss: 1,
        },
      }),
      classified({
        mover: "white",
        ply: 40,
        beforeFen: "4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1",
        delta: {
          kind: "exact",
          beforeMoverScore: { type: "cp", value: 30, perspective: "mover" },
          afterMoverScore: { type: "cp", value: -170, perspective: "mover" },
          signedChange: -200,
          centipawnLoss: 200,
        },
      }),
    ];
    const result = buildGamePerformance(items);
    expect(result.white.phaseMoves.opening).toBe(1);
    expect(result.white.phaseMoves.endgame).toBe(1);
    expect(result.white.phaseMoves.middlegame).toBe(0);
    expect(result.white.phaseAccuracy.opening).toBeGreaterThan(95);
    expect(result.white.phaseAccuracy.endgame).toBeLessThan(60);
    expect(result.white.phaseAccuracy.middlegame).toBeNull();
  });

  it("does not include bounded deltas in any phase bucket", () => {
    const items: ClassifiedMove[] = [
      classified({
        mover: "white",
        ply: 0,
        beforeFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        delta: {
          kind: "bounded",
          beforeMoverScore: { type: "cp", value: 30, perspective: "mover" },
          afterMoverScore: { type: "cp", value: 20, perspective: "mover" },
        },
      }),
    ];
    const result = buildGamePerformance(items);
    expect(result.white.phaseMoves.opening).toBe(0);
    expect(result.white.phaseMoves.middlegame).toBe(0);
    expect(result.white.phaseMoves.endgame).toBe(0);
    expect(result.white.phaseAccuracy.opening).toBeNull();
    expect(result.white.phaseAccuracy.middlegame).toBeNull();
    expect(result.white.phaseAccuracy.endgame).toBeNull();
  });

  it("tracks phase buckets independently per player", () => {
    const items: ClassifiedMove[] = [
      classified({
        mover: "white",
        ply: 0,
        beforeFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        delta: {
          kind: "exact",
          beforeMoverScore: { type: "cp", value: 30, perspective: "mover" },
          afterMoverScore: { type: "cp", value: 29, perspective: "mover" },
          signedChange: -1,
          centipawnLoss: 1,
        },
      }),
      classified({
        mover: "black",
        ply: 40,
        beforeFen: "4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1",
        delta: {
          kind: "exact",
          beforeMoverScore: { type: "cp", value: 30, perspective: "mover" },
          afterMoverScore: { type: "cp", value: 0, perspective: "mover" },
          signedChange: -30,
          centipawnLoss: 30,
        },
      }),
    ];
    const result = buildGamePerformance(items);
    expect(result.white.phaseMoves.opening).toBe(1);
    expect(result.white.phaseMoves.endgame).toBe(0);
    expect(result.black.phaseMoves.opening).toBe(0);
    expect(result.black.phaseMoves.endgame).toBe(1);
  });

  it("sums phaseMoves to equal accuracyMoves", () => {
    const items: ClassifiedMove[] = [
      classified({
        mover: "white",
        ply: 0,
        beforeFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        delta: {
          kind: "exact",
          beforeMoverScore: { type: "cp", value: 30, perspective: "mover" },
          afterMoverScore: { type: "cp", value: 29, perspective: "mover" },
          signedChange: -1,
          centipawnLoss: 1,
        },
      }),
      classified({
        mover: "white",
        ply: 40,
        beforeFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        delta: {
          kind: "exact",
          beforeMoverScore: { type: "cp", value: 30, perspective: "mover" },
          afterMoverScore: { type: "cp", value: 20, perspective: "mover" },
          signedChange: -10,
          centipawnLoss: 10,
        },
      }),
      classified({
        mover: "white",
        ply: 40,
        beforeFen: "4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1",
        delta: {
          kind: "mate",
          beforeMoverScore: { type: "mate", value: 2, perspective: "mover" },
          afterMoverScore: { type: "mate", value: 1, perspective: "mover" },
        },
      }),
    ];
    const result = buildGamePerformance(items);
    const sum =
      result.white.phaseMoves.opening +
      result.white.phaseMoves.middlegame +
      result.white.phaseMoves.endgame;
    expect(sum).toBe(result.white.accuracyMoves);
    expect(sum).toBe(3);
  });
});


