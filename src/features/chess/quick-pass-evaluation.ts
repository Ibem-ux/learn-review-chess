import { Chess } from "chess.js";
import type { EngineColor, EngineInfo, EngineScore } from "./engine";
import { isEngineColor, scoreToWhitePerspective } from "./engine";
import type { ReviewTimeline, TimelinePly } from "./timeline";
import type { QuickPassCompletedJob } from "./quick-pass-runner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Side to move parsed from a fully validated FEN via chess.js.
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
 * Parses the side to move from a fully validated FEN using chess.js.
 *
 * Rejects:
 * - Empty or non-string input
 * - Malformed FEN (invalid board layout, rank count, piece placement, etc.)
 * - Unsupported active-color values
 *
 * Evidence: `new Chess(fen)` throws on structurally invalid FEN, including
 * `"not-a-valid-board w"` (piece data does not contain 8 '/'-delimited rows).
 * `chess.turn()` returns `"w"` or `"b"` for any valid position.
 */
export function parseSideToMove(fen: string): SideToMove | null {
  if (typeof fen !== "string" || fen.trim().length === 0) {
    return null;
  }

  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return null;
  }

  const turn = chess.turn();
  if (!isEngineColor(turn)) {
    return null;
  }
  return turn;
}

// ---------------------------------------------------------------------------
// Score normalization
// ---------------------------------------------------------------------------

/**
 * Normalizes an `EngineScore` to the White perspective without mutating the
 * source.
 *
 * Behavior:
 * - `undefined` input → `null`
 * - Already White-perspective score → returned as White-perspective, no inversion
 * - Side-to-move score with White to move → preserved
 * - Side-to-move score with Black to move → value negated, bound swapped
 *
 * The `scoreToWhitePerspective` helper (engine.ts) handles side-to-move input
 * and swaps bounds when Black is to move. We guard already-White-perspective
 * input so it is not incorrectly inverted.
 *
 * Type assertion is required because `scoreToWhitePerspective` returns
 * `EngineScore`, not the narrower `NormalizedScore`.
 */
export function normalizeScore(
  score: EngineScore | undefined,
  sideToMove: SideToMove,
): NormalizedScore | null {
  if (score === undefined) {
    return null;
  }
  if (score.perspective === "white") {
    return { ...score, perspective: "white" } as NormalizedScore;
  }
  return scoreToWhitePerspective(score, sideToMove) as NormalizedScore;
}

// ---------------------------------------------------------------------------
// Ply validation
// ---------------------------------------------------------------------------

/**
 * Validates a result ply. Returns a deterministic failure reason for:
 * - Non-finite values (`NaN`, `Infinity`, `-Infinity`)
 * - Fractional values
 * - Negative integers
 *
 * Returns `null` for valid finite non-negative integers.
 */
export function validateResultPly(ply: number): string | null {
  if (!Number.isFinite(ply)) {
    return `Result ply must be a finite integer, got ${String(ply)}.`;
  }
  if (!Number.isInteger(ply)) {
    return `Result ply must be an integer, got ${ply}.`;
  }
  if (ply < 0) {
    return `Result has negative ply: ${ply}.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Timeline lookup
// ---------------------------------------------------------------------------

/**
 * Safely retrieves a timeline step by ply. Returns `null` if the ply is
 * out of range or the step does not carry the expected ply identifier.
 *
 * This guards against malformed timeline input where `steps[ply]` could be
 * `undefined` or carry an unexpected ply value.
 */
export function getTimelineStepSafe(
  timeline: ReviewTimeline,
  ply: number,
): TimelinePly | null {
  if (ply < 0 || ply > timeline.totalPlies) {
    return null;
  }
  const step = timeline.steps[ply];
  if (!step || step.ply !== ply) {
    return null;
  }
  return step;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Selects the deepest result for each ply from a list of completed jobs.
 *
 * Rules:
 * - Group by `job.ply`.
 * - Keep the entry with the greatest `info?.depth`.
 * - Treat a missing or non-finite depth as 0.
 * - On a depth tie, keep the LATER entry in array order.
 * - Return one entry per ply, ordered by first appearance of that ply in the input array.
 * - No mutation of the input array or of any entry.
 */
export function selectDeepestResultsByPly(
  results: readonly QuickPassCompletedJob[],
): readonly QuickPassCompletedJob[] {
  const map = new Map<number, QuickPassCompletedJob>();
  for (const r of results) {
    const existing = map.get(r.job.ply);
    if (!existing) {
      map.set(r.job.ply, r);
    } else {
      const existingDepth =
        existing.info?.depth !== undefined && Number.isFinite(existing.info.depth)
          ? existing.info.depth
          : 0;
      const rDepth =
        r.info?.depth !== undefined && Number.isFinite(r.info.depth)
          ? r.info.depth
          : 0;
      if (rDepth >= existingDepth) {
        map.set(r.job.ply, r);
      }
    }
  }
  return Array.from(map.values());
}

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
 * - Duplicate result plies for a ply select the deepest result. Non-finite/fractional/negative plies,
 *   out-of-range plies, FEN mismatches, and malformed FEN are rejected with
 *   a safe reason.
 */
export function buildQuickPassEvaluationSeries(
  timeline: ReviewTimeline,
  results: readonly QuickPassCompletedJob[],
): EvaluationSeriesResult {
  const selectedResults = selectDeepestResultsByPly(results);
  const resultByPly = new Map<number, QuickPassCompletedJob>();

  for (const result of selectedResults) {
    const plyValidation = validateResultPly(result.job.ply);
    if (plyValidation !== null) {
      return {
        ok: false,
        reason: plyValidation,
      };
    }

    const ply = result.job.ply;

    // Reject out-of-range plies.
    if (ply > timeline.totalPlies) {
      return {
        ok: false,
        reason: `Result ply ${ply} is out of range (max ${timeline.totalPlies}).`,
      };
    }

    // Reject FEN mismatch against the exact timeline step.
    const timelineStep = getTimelineStepSafe(timeline, ply);
    if (timelineStep === null) {
      return {
        ok: false,
        reason: `Timeline has no step for ply ${ply}.`,
      };
    }
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
