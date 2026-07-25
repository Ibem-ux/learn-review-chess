import type { EngineColor, EngineInfo, EngineScore } from "./engine";
import { isEngineColor, scoreToWhitePerspective } from "./engine";
import type { ReviewTimeline } from "./timeline";
import type { QuickPassCompletedJob } from "./quick-pass-runner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Side to move parsed from the FEN active-color field.
 *
 * Verified contract:
 * - The UCI parser (uci.ts line 187) sets `perspective: "side-to-move"` on
 *   every parsed `EngineScore`. Stockfish UCI scores are always relative to
 *   the side to move.
 * - `scoreToWhitePerspective` (engine.ts line 109) converts a side-to-move
 *   score to a White-perspective score by preserving when White is to move
 *   and negating (value + bound swap) when Black is to move.
 */
export type SideToMove = EngineColor;

/**
 * A White-perspective normalized score. The `type` discriminant preserves the
 * original score category: centipawn remains centipawn, mate remains mate.
 * Mate scores are never converted to an arbitrary centipawn value.
 */
export type NormalizedScore = EngineScore & { readonly perspective: "white" };

/**
 * One evaluation point per timeline ply. Aligned by ply and FEN to the
 * timeline. Score is normalized to the White perspective.
 */
export type EvaluationPoint = {
  readonly ply: number;
  readonly fen: string;
  readonly sideToMove: SideToMove;
  readonly completed: boolean;
  readonly score: NormalizedScore | null;
  readonly depth: number | null;
  readonly nodes: number | null;
  readonly timeMs: number | null;
  readonly pv: readonly string[] | null;
};

export type EvaluationSeriesSuccess = {
  readonly ok: true;
  readonly points: readonly EvaluationPoint[];
};

export type EvaluationSeriesFailure = {
  readonly ok: false;
  readonly reason: string;
};

export type EvaluationSeriesResult =
  | EvaluationSeriesSuccess
  | EvaluationSeriesFailure;

// ---------------------------------------------------------------------------
// FEN parsing
// ---------------------------------------------------------------------------

/**
 * Parses the side to move from the FEN active-color field (the second
 * space-delimited token). Returns `null` for malformed FEN or unsupported
 * active-color values.
 */
export function parseSideToMove(fen: string): SideToMove | null {
  if (typeof fen !== "string" || fen.trim().length === 0) {
    return null;
  }
  const parts = fen.split(" ");
  if (parts.length < 2) {
    return null;
  }
  const activeColor = parts[1];
  if (!isEngineColor(activeColor)) {
    return null;
  }
  return activeColor;
}

// ---------------------------------------------------------------------------
// Score normalization
// ---------------------------------------------------------------------------

/**
 * Normalizes an `EngineScore` to the White perspective without mutating the
 * source. Delegates to the verified `scoreToWhitePerspective` utility.
 *
 * Returns `null` if the input score is `undefined`.
 */
export function normalizeScore(
  score: EngineScore | undefined,
  sideToMove: SideToMove,
): NormalizedScore | null {
  if (score === undefined) {
    return null;
  }
  return scoreToWhitePerspective(score, sideToMove) as NormalizedScore;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Builds an ordered evaluation series by aligning completed quick-pass
 * results with timeline positions.
 *
 * Rules:
 * - Returns one `EvaluationPoint` per timeline step, including ply 0.
 * - Results are aligned by `job.ply`, not input-array index.
 * - Timeline order is preserved even when the result array is unordered.
 * - Only rank-1 `result.info` is used as the primary position evaluation.
 *   Rank 2/3 candidate lines are never substituted.
 * - Missing result → `completed: false`, `score: null`.
 * - Completed result without score → `completed: true`, `score: null`.
 * - Duplicate result plies, negative plies, out-of-range plies,
 *   FEN mismatches, and malformed FEN are rejected with a safe reason.
 */
export function buildQuickPassEvaluationSeries(
  timeline: ReviewTimeline,
  results: readonly QuickPassCompletedJob[],
): EvaluationSeriesResult {
  // Index results by ply for alignment.
  const resultByPly = new Map<number, QuickPassCompletedJob>();

  for (const result of results) {
    const ply = result.job.ply;

    // Reject negative plies.
    if (ply < 0) {
      return {
        ok: false,
        reason: `Result has negative ply: ${ply}.`,
      };
    }

    // Reject out-of-range plies.
    if (ply > timeline.totalPlies) {
      return {
        ok: false,
        reason: `Result ply ${ply} is out of range (max ${timeline.totalPlies}).`,
      };
    }

    // Reject duplicate plies.
    if (resultByPly.has(ply)) {
      return {
        ok: false,
        reason: `Duplicate result for ply ${ply}.`,
      };
    }

    // Reject FEN mismatch.
    const timelineStep = timeline.steps[ply];
    if (result.job.fen !== timelineStep.fen) {
      return {
        ok: false,
        reason: `FEN mismatch at ply ${ply}: result FEN does not match timeline FEN.`,
      };
    }

    resultByPly.set(ply, result);
  }

  // Build one point per timeline step.
  const points: EvaluationPoint[] = [];

  for (const step of timeline.steps) {
    const sideToMove = parseSideToMove(step.fen);
    if (sideToMove === null) {
      return {
        ok: false,
        reason: `Malformed FEN at ply ${step.ply}: cannot parse side to move.`,
      };
    }

    const result = resultByPly.get(step.ply);

    if (result === undefined) {
      // Missing result → incomplete point.
      points.push({
        ply: step.ply,
        fen: step.fen,
        sideToMove,
        completed: false,
        score: null,
        depth: null,
        nodes: null,
        timeMs: null,
        pv: null,
      });
      continue;
    }

    // Use only the rank-1 info (result.info).
    const info: EngineInfo | null = result.info;
    const score = normalizeScore(info?.score, sideToMove);

    points.push({
      ply: step.ply,
      fen: step.fen,
      sideToMove,
      completed: true,
      score,
      depth: info?.depth ?? null,
      nodes: info?.nodes ?? null,
      timeMs: info?.timeMs ?? null,
      pv: info?.pv ?? null,
    });
  }

  return { ok: true, points };
}
