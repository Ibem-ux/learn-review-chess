import type { EvaluationPoint } from "./quick-pass-evaluation";

export const EVAL_CLAMP_CP = 1000;

export type GraphPoint = {
  readonly ply: number;
  readonly hasValue: boolean;
  readonly clampedCp: number | null;
  readonly advantage: number | null;
  readonly isMate: boolean;
};

export function buildEvaluationGraphPoints(
  points: readonly EvaluationPoint[],
): readonly GraphPoint[] {
  const result: GraphPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (!point.completed || point.score === null) {
      result.push({
        ply: point.ply,
        hasValue: false,
        clampedCp: null,
        advantage: null,
        isMate: false,
      });
      continue;
    }

    const score = point.score;
    if (score.type === "mate") {
      const isPositiveMate = score.value > 0;
      const clampedCp = isPositiveMate ? EVAL_CLAMP_CP : -EVAL_CLAMP_CP;
      const advantage = (clampedCp / (2 * EVAL_CLAMP_CP)) + 0.5;
      result.push({
        ply: point.ply,
        hasValue: true,
        clampedCp,
        advantage,
        isMate: true,
      });
      continue;
    }

    const rawCp = score.value;
    if (!Number.isFinite(rawCp)) {
      result.push({
        ply: point.ply,
        hasValue: false,
        clampedCp: null,
        advantage: null,
        isMate: false,
      });
      continue;
    }

    const clampedCp = Math.max(-EVAL_CLAMP_CP, Math.min(EVAL_CLAMP_CP, rawCp));
    const advantage = (clampedCp / (2 * EVAL_CLAMP_CP)) + 0.5;
    result.push({
      ply: point.ply,
      hasValue: true,
      clampedCp,
      advantage,
      isMate: false,
    });
  }
  return result;
}
