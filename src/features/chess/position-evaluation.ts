import type { CachedAnalysis } from "./analysis-cache";
import type { GraphPoint } from "./evaluation-graph-model";
import { scoreToGraphValues } from "./evaluation-graph-model";
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

  const graphValues = scoreToGraphValues(normalized.type, normalized.value);
  if (!graphValues.hasValue) {
    return {
      ply,
      hasValue: false,
      clampedCp: null,
      advantage: null,
      isMate: false,
      san: null,
    };
  }

  return {
    ply,
    hasValue: true,
    clampedCp: graphValues.clampedCp,
    advantage: graphValues.advantage,
    isMate: graphValues.isMate,
    san: null,
  };
}
