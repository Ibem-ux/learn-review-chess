import { describe, expect, it } from "vitest";
import type { EvaluationPoint } from "./quick-pass-evaluation";
import { buildEvaluationGraphPoints, EVAL_CLAMP_CP } from "./evaluation-graph-model";

function makePoint(
  ply: number,
  overrides: Partial<EvaluationPoint> = {},
): EvaluationPoint {
  const completed = overrides.completed ?? true;
  return {
    ply,
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    sideToMove: "w",
    completed,
    score: null,
    depth: 10,
    nodes: 1000,
    timeMs: 100,
    pv: ["e2e4"],
    ...overrides,
  };
}

describe("buildEvaluationGraphPoints", () => {
  it("returns an empty array for empty input", () => {
    const result = buildEvaluationGraphPoints([]);
    expect(result).toEqual([]);
  });

  it("a series that is entirely incomplete returns all hasValue false", () => {
    const points = [
      makePoint(0, { completed: false, score: null }),
      makePoint(1, { completed: false, score: null }),
      makePoint(2, { completed: false, score: null }),
    ];
    const result = buildEvaluationGraphPoints(points);
    expect(result).toHaveLength(3);
    for (const gp of result) {
      expect(gp.hasValue).toBe(false);
      expect(gp.clampedCp).toBeNull();
      expect(gp.advantage).toBeNull();
      expect(gp.isMate).toBe(false);
    }
  });

  it("makePoint with no score override produces hasValue false", () => {
    const points = [makePoint(0)];
    const result = buildEvaluationGraphPoints(points);
    expect(result[0].hasValue).toBe(false);
    expect(result[0].clampedCp).toBeNull();
    expect(result[0].advantage).toBeNull();
    expect(result[0].isMate).toBe(false);
  });

  it("a gap in the middle preserves ply ordering around it", () => {
    const points = [
      makePoint(0, { completed: true, score: { type: "cp", value: 100, perspective: "white" } }),
      makePoint(1, { completed: false, score: null }),
      makePoint(2, { completed: true, score: { type: "cp", value: -50, perspective: "white" } }),
    ];
    const result = buildEvaluationGraphPoints(points);
    expect(result).toHaveLength(3);
    expect(result[0].ply).toBe(0);
    expect(result[1].ply).toBe(1);
    expect(result[2].ply).toBe(2);
    expect(result[0].hasValue).toBe(true);
    expect(result[1].hasValue).toBe(false);
    expect(result[2].hasValue).toBe(true);
  });

  it("cp exactly at +1000 is unchanged", () => {
    const points = [
      makePoint(0, { completed: true, score: { type: "cp", value: EVAL_CLAMP_CP, perspective: "white" } }),
    ];
    const result = buildEvaluationGraphPoints(points);
    expect(result[0].clampedCp).toBe(EVAL_CLAMP_CP);
    expect(result[0].hasValue).toBe(true);
    expect(result[0].isMate).toBe(false);
  });

  it("cp exactly at -1000 is unchanged", () => {
    const points = [
      makePoint(0, { completed: true, score: { type: "cp", value: -EVAL_CLAMP_CP, perspective: "white" } }),
    ];
    const result = buildEvaluationGraphPoints(points);
    expect(result[0].clampedCp).toBe(-EVAL_CLAMP_CP);
    expect(result[0].hasValue).toBe(true);
    expect(result[0].isMate).toBe(false);
  });

  it("cp beyond the clamp in the positive direction saturates", () => {
    const points = [
      makePoint(0, { completed: true, score: { type: "cp", value: 1500, perspective: "white" } }),
    ];
    const result = buildEvaluationGraphPoints(points);
    expect(result[0].clampedCp).toBe(EVAL_CLAMP_CP);
    expect(result[0].hasValue).toBe(true);
    expect(result[0].isMate).toBe(false);
  });

  it("cp beyond the clamp in the negative direction saturates", () => {
    const points = [
      makePoint(0, { completed: true, score: { type: "cp", value: -1500, perspective: "white" } }),
    ];
    const result = buildEvaluationGraphPoints(points);
    expect(result[0].clampedCp).toBe(-EVAL_CLAMP_CP);
    expect(result[0].hasValue).toBe(true);
    expect(result[0].isMate).toBe(false);
  });

  it("advantage for cp 0 is exactly 0.5", () => {
    const points = [
      makePoint(0, { completed: true, score: { type: "cp", value: 0, perspective: "white" } }),
    ];
    const result = buildEvaluationGraphPoints(points);
    expect(result[0].advantage).toBe(0.5);
    expect(result[0].hasValue).toBe(true);
    expect(result[0].clampedCp).toBe(0);
  });

  it("cp at +1000 gives advantage exactly 1", () => {
    const points = [
      makePoint(0, { completed: true, score: { type: "cp", value: EVAL_CLAMP_CP, perspective: "white" } }),
    ];
    const result = buildEvaluationGraphPoints(points);
    expect(result[0].advantage).toBe(1);
    expect(result[0].clampedCp).toBe(EVAL_CLAMP_CP);
  });

  it("cp at -1000 gives advantage exactly 0", () => {
    const points = [
      makePoint(0, { completed: true, score: { type: "cp", value: -EVAL_CLAMP_CP, perspective: "white" } }),
    ];
    const result = buildEvaluationGraphPoints(points);
    expect(result[0].advantage).toBe(0);
    expect(result[0].clampedCp).toBe(-EVAL_CLAMP_CP);
  });

  it("cp at +500 gives advantage exactly 0.75", () => {
    const points = [
      makePoint(0, { completed: true, score: { type: "cp", value: 500, perspective: "white" } }),
    ];
    const result = buildEvaluationGraphPoints(points);
    expect(result[0].advantage).toBe(0.75);
    expect(result[0].clampedCp).toBe(500);
  });

  it("positive mate yields isMate true and clampedCp +1000", () => {
    const points = [
      makePoint(0, { completed: true, score: { type: "mate", value: 3, perspective: "white" } }),
    ];
    const result = buildEvaluationGraphPoints(points);
    expect(result[0].isMate).toBe(true);
    expect(result[0].clampedCp).toBe(EVAL_CLAMP_CP);
    expect(result[0].hasValue).toBe(true);
  });

  it("negative mate yields isMate true and clampedCp -1000", () => {
    const points = [
      makePoint(0, { completed: true, score: { type: "mate", value: -2, perspective: "white" } }),
    ];
    const result = buildEvaluationGraphPoints(points);
    expect(result[0].isMate).toBe(true);
    expect(result[0].clampedCp).toBe(-EVAL_CLAMP_CP);
    expect(result[0].hasValue).toBe(true);
  });

  it("mate value of exactly 0 is treated as negative", () => {
    const points = [
      makePoint(0, { completed: true, score: { type: "mate", value: 0, perspective: "white" } }),
    ];
    const result = buildEvaluationGraphPoints(points);
    expect(result[0].isMate).toBe(true);
    expect(result[0].clampedCp).toBe(-EVAL_CLAMP_CP);
    expect(result[0].hasValue).toBe(true);
  });

  it("completed false without null score yields hasValue false", () => {
    const points = [
      makePoint(0, {
        completed: false,
        score: { type: "cp", value: 100, perspective: "white" },
      }),
    ];
    const result = buildEvaluationGraphPoints(points);
    expect(result[0].hasValue).toBe(false);
    expect(result[0].clampedCp).toBeNull();
    expect(result[0].advantage).toBeNull();
    expect(result[0].isMate).toBe(false);
  });

  it("non-finite cp value yields hasValue false and does not throw", () => {
    const points = [
      makePoint(0, { completed: true, score: { type: "cp", value: Infinity, perspective: "white" } }),
    ];
    const result = buildEvaluationGraphPoints(points);
    expect(result[0].hasValue).toBe(false);
    expect(result[0].clampedCp).toBeNull();
    expect(result[0].advantage).toBeNull();
    expect(result[0].isMate).toBe(false);
  });

  it("NaN cp value yields hasValue false and does not throw", () => {
    const points = [
      makePoint(0, { completed: true, score: { type: "cp", value: NaN, perspective: "white" } }),
    ];
    const result = buildEvaluationGraphPoints(points);
    expect(result[0].hasValue).toBe(false);
    expect(result[0].clampedCp).toBeNull();
    expect(result[0].advantage).toBeNull();
    expect(result[0].isMate).toBe(false);
  });

  it("preserves ordering across mixed complete and incomplete points", () => {
    const points = [
      makePoint(0, { completed: true, score: { type: "cp", value: 200, perspective: "white" } }),
      makePoint(1, { completed: false, score: null }),
      makePoint(2, { completed: true, score: { type: "cp", value: -300, perspective: "white" } }),
      makePoint(3, { completed: true, score: { type: "mate", value: 5, perspective: "white" } }),
    ];
    const result = buildEvaluationGraphPoints(points);
    expect(result).toHaveLength(4);
    expect(result[0].ply).toBe(0);
    expect(result[1].ply).toBe(1);
    expect(result[2].ply).toBe(2);
    expect(result[3].ply).toBe(3);
    expect(result[0].hasValue).toBe(true);
    expect(result[1].hasValue).toBe(false);
    expect(result[2].hasValue).toBe(true);
    expect(result[3].hasValue).toBe(true);
  });
});
