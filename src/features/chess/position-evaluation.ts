import type { CachedAnalysis } from "./analysis-cache";
import type { GraphPoint } from "./evaluation-graph-model";
import { EVAL_CLAMP_CP } from "./evaluation-graph-model";
import { normalizeScore, parseSideToMove } from "./quick-pass-evaluation";

export function cachedAnalysisToGraphPoint(
  entry: CachedAnalysis | null,
  ply: number
): GraphPoint | null {
  if (entry === null) {
    return null;
  }

  const score = entry.score;
  if (score === null) {
    return {
      ply,
      hasValue: false,
      clampedCp: null,
      advantage: null,
      isMate: false,
      san: null,
    };
  }

  const sideToMove = parseSideToMove(entry.fen);
  if (sideToMove === null) {
    return {
      ply,
      hasValue: false,
      clampedCp: null,
      advantage: null,
      isMate: false,
      san: null,
    };
  }

  const normalized = normalizeScore(score, sideToMove);
  if (normalized === null) {
    return {
      ply,
      hasValue: false,
      clampedCp: null,
      advantage: null,
      isMate: false,
      san: null,
    };
  }

  if (normalized.type === "mate") {
    const isPositiveMate = normalized.value > 0;
    const clampedCp = isPositiveMate ? EVAL_CLAMP_CP : -EVAL_CLAMP_CP;
    const advantage = (clampedCp / (2 * EVAL_CLAMP_CP)) + 0.5;
    return {
      ply,
      hasValue: true,
      clampedCp,
      advantage,
      isMate: true,
      san: null,
    };
  }

  const rawCp = normalized.value;
  if (!Number.isFinite(rawCp)) {
    return {
      ply,
      hasValue: false,
      clampedCp: null,
      advantage: null,
      isMate: false,
      san: null,
    };
  }

  const clampedCp = Math.max(-EVAL_CLAMP_CP, Math.min(EVAL_CLAMP_CP, rawCp));
  const advantage = (clampedCp / (2 * EVAL_CLAMP_CP)) + 0.5;
  return {
    ply,
    hasValue: true,
    clampedCp,
    advantage,
    isMate: false,
    san: null,
  };
}
