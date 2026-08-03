import { describe, expect, it } from "vitest";
import type { ClassifiedMove } from "@/features/chess/move-classification";
import type { MoveAssessment } from "@/features/chess/move-assessment";
import { buildGamePerformance } from "@/features/chess/game-performance";

function classified(
  overrides: Partial<MoveAssessment> = {},
  classification: string = "good",
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
    ...overrides,
  };

  return {
    assessment,
    classification: classification as ClassifiedMove["classification"],
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
    const keys = Object.keys(result.white.counts) as Array<keyof typeof result.white.counts>;
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
});
