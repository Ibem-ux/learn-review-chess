import { describe, expect, it } from "vitest";
import type { EngineScore } from "@/features/chess/engine";
import type { CachedAnalysis, CachedLine } from "@/features/chess/analysis-cache";
import { cachedAnalysisToGraphPoint } from "@/features/chess/position-evaluation";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

function cpScore(value: number): EngineScore {
  return { type: "cp", value, perspective: "white" };
}

function sideToMoveScore(value: number): EngineScore {
  return { type: "cp", value, perspective: "side-to-move" };
}

function mateScore(value: number): EngineScore {
  return { type: "mate", value, perspective: "white" };
}

function cachedAnalysis(
  fen: string,
  score: EngineScore | null,
  lines: readonly CachedLine[] = []
): CachedAnalysis {
  return { fen, score, depth: null, lines };
}

describe("cachedAnalysisToGraphPoint", () => {
  it("returns null for a null entry", () => {
    expect(cachedAnalysisToGraphPoint(null, 0)).toBeNull();
  });

  it("returns a hasValue-false GraphPoint for an entry with a null score", () => {
    const entry = cachedAnalysis(START_FEN, null);
    const point = cachedAnalysisToGraphPoint(entry, 2);
    expect(point).not.toBeNull();
    expect(point?.ply).toBe(2);
    expect(point?.hasValue).toBe(false);
    expect(point?.clampedCp).toBeNull();
    expect(point?.advantage).toBeNull();
    expect(point?.isMate).toBe(false);
    expect(point?.san).toBeNull();
  });

  it("produces the correct white-relative value for a white-to-move cp score", () => {
    const entry = cachedAnalysis(START_FEN, cpScore(100));
    const point = cachedAnalysisToGraphPoint(entry, 0);
    expect(point?.hasValue).toBe(true);
    expect(point?.clampedCp).toBe(100);
    expect(point?.advantage).toBeCloseTo(0.55);
    expect(point?.isMate).toBe(false);
    expect(point?.san).toBeNull();
  });

  it("negates the score for a black-to-move cp score producing the correct white-relative value", () => {
    const entry = cachedAnalysis(AFTER_E4_FEN, sideToMoveScore(100));
    const point = cachedAnalysisToGraphPoint(entry, 1);
    expect(point?.hasValue).toBe(true);
    expect(point?.clampedCp).toBe(-100);
    expect(point?.advantage).toBeCloseTo(0.45);
    expect(point?.isMate).toBe(false);
  });

  it("sets isMate true for a mate score", () => {
    const entry = cachedAnalysis(START_FEN, mateScore(5));
    const point = cachedAnalysisToGraphPoint(entry, 0);
    expect(point?.hasValue).toBe(true);
    expect(point?.isMate).toBe(true);
    expect(point?.clampedCp).toBe(1000);
    expect(point?.advantage).toBeCloseTo(1.0);
  });

  it("clamps a positive cp score at the upper bound", () => {
    const entry = cachedAnalysis(START_FEN, cpScore(1500));
    const point = cachedAnalysisToGraphPoint(entry, 0);
    expect(point?.clampedCp).toBe(1000);
    expect(point?.advantage).toBeCloseTo(1.0);
  });

  it("clamps a negative cp score at the lower bound", () => {
    const entry = cachedAnalysis(START_FEN, cpScore(-1500));
    const point = cachedAnalysisToGraphPoint(entry, 0);
    expect(point?.clampedCp).toBe(-1000);
    expect(point?.advantage).toBeCloseTo(0.0);
  });

  it("always sets san to null", () => {
    const entry = cachedAnalysis(START_FEN, cpScore(50));
    const point = cachedAnalysisToGraphPoint(entry, 0);
    expect(point?.san).toBeNull();
  });

  it("carries the supplied ply through unchanged", () => {
    const entry = cachedAnalysis(START_FEN, cpScore(50));
    const point = cachedAnalysisToGraphPoint(entry, 7);
    expect(point?.ply).toBe(7);
  });

  it("does not re-invert a score already in white perspective", () => {
    const entry = cachedAnalysis(AFTER_E4_FEN, cpScore(100));
    const point = cachedAnalysisToGraphPoint(entry, 1);
    expect(point?.clampedCp).toBe(100);
    expect(point?.advantage).toBeCloseTo(0.55);
  });

  it("returns a hasValue-false GraphPoint when the FEN cannot be parsed", () => {
    const entry = cachedAnalysis("not-a-valid-fen", cpScore(100));
    const point = cachedAnalysisToGraphPoint(entry, 0);
    expect(point?.hasValue).toBe(false);
    expect(point?.clampedCp).toBeNull();
    expect(point?.advantage).toBeNull();
  });

  it("returns a hasValue-false GraphPoint for a non-finite cp value", () => {
    const entry = cachedAnalysis(START_FEN, { type: "cp", value: NaN, perspective: "white" });
    const point = cachedAnalysisToGraphPoint(entry, 0);
    expect(point?.hasValue).toBe(false);
    expect(point?.clampedCp).toBeNull();
    expect(point?.advantage).toBeNull();
  });

  it("sets isMate true for a negative mate score", () => {
    const entry = cachedAnalysis(START_FEN, mateScore(-5));
    const point = cachedAnalysisToGraphPoint(entry, 0);
    expect(point?.hasValue).toBe(true);
    expect(point?.isMate).toBe(true);
    expect(point?.clampedCp).toBe(-1000);
    expect(point?.advantage).toBeCloseTo(0.0);
  });
});
