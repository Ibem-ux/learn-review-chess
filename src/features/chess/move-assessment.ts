import type { EngineScore, ScoreBound } from "./engine";
import type { ReviewTimeline, TimelinePly } from "./timeline";
import type { QuickPassCompletedJob } from "./quick-pass-runner";
import type { NormalizedScore, SideToMove } from "./quick-pass-evaluation";
import {
  buildQuickPassEvaluationSeries,
  normalizeScore,
  selectDeepestResultsByPly,
} from "./quick-pass-evaluation";

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type Mover = "white" | "black";

export type MoverScore = Omit<NormalizedScore, "perspective"> & {
  readonly perspective: "mover";
};

export type CentipawnLoss = {
  readonly kind: "exact";
  readonly beforeMoverScore: MoverScore;
  readonly afterMoverScore: MoverScore;
  readonly signedChange: number;
  readonly centipawnLoss: number;
};

export type MateTransition = {
  readonly kind: "mate";
  readonly beforeMoverScore: MoverScore;
  readonly afterMoverScore: MoverScore;
};

export type BoundedDelta = {
  readonly kind: "bounded";
  readonly beforeMoverScore: MoverScore;
  readonly afterMoverScore: MoverScore;
};

export type Delta = CentipawnLoss | MateTransition | BoundedDelta;

export type UnavailableReason =
  | "before-analysis-missing"
  | "after-analysis-missing"
  | "before-score-missing"
  | "after-score-missing";

export type MoveAssessment = {
  readonly ply: number;
  readonly mover: Mover;
  readonly san: string;
  readonly from: string;
  readonly to: string;
  readonly promotion?: string;
  readonly beforeFen: string;
  readonly afterFen: string;
  readonly beforeScore: NormalizedScore | null;
  readonly afterScore: NormalizedScore | null;
  readonly delta: Delta | null;
  readonly available: boolean;
  readonly unavailableReason: UnavailableReason | null;
  readonly playedUci: string;
  readonly candidateRank: number | null;
  readonly bestCandidateUci: string | null;
  readonly candidateMoves: readonly string[];
  readonly bestCandidateScore: MoverScore | null;
  readonly secondCandidateScore: MoverScore | null;
};

export type AssessmentSuccess = {
  readonly ok: true;
  readonly assessments: readonly MoveAssessment[];
};

export type AssessmentFailure = {
  readonly ok: false;
  readonly reason: string;
};

export type AssessmentResult = AssessmentSuccess | AssessmentFailure;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts a normalized White-perspective score to the mover's perspective.
 *
 * - White mover: score preserved as-is (no mutation).
 * - Black mover: value negated, lower/upper bounds swapped.
 *
 * The source score is never mutated.
 */
function toMoverScore(score: NormalizedScore, mover: Mover): MoverScore {
  if (mover === "white") {
    return { ...score, perspective: "mover" };
  }
  const { bound, ...rest } = score;
  let swappedBound: ScoreBound | undefined;
  if (bound === "lowerbound") {
    swappedBound = "upperbound";
  } else if (bound === "upperbound") {
    swappedBound = "lowerbound";
  }
  return {
    ...rest,
    value: -score.value,
    perspective: "mover",
    bound: swappedBound,
  };
}

/**
 * Converts a timeline move to canonical UCI notation using verified from/to
 * and promotion fields. Does not parse SAN.
 */
function toUci(move: TimelinePly["move"]): string {
  if (!move) return "";
  let uci = move.from + move.to;
  const promotion = move.promotion;
  if (promotion) {
    uci += promotion.toLowerCase();
  }
  return uci;
}

interface CandidateOutcome {
  readonly candidateRank: number | null;
  readonly bestCandidateUci: string | null;
  readonly candidateMoves: readonly string[];
  readonly bestCandidateScore: MoverScore | null;
  readonly secondCandidateScore: MoverScore | null;
}

/**
 * Extracts matching candidate information from the quick-pass result for the
 * position before the played move.
 *
 * - Reads only the first PV move from each candidate line.
 * - Rejects duplicate candidate ranks.
 * - Sorts by rank.
 * - Compares playedUci case-insensitively.
 */
function findCandidateMatch(
  result: QuickPassCompletedJob | undefined,
  move: TimelinePly["move"],
  sideToMove: SideToMove,
  mover: Mover,
): CandidateOutcome {
  const playedUci = toUci(move);
  const normalizedPlayed = playedUci.toLowerCase();

  if (!result || !result.info || !result.info.pv || result.candidateLines.length === 0) {
    return {
      candidateRank: null,
      bestCandidateUci: null,
      candidateMoves: [],
      bestCandidateScore: null,
      secondCandidateScore: null,
    };
  }

  const seen = new Set<number>();
  const candidates: { rank: number; move: string; score?: EngineScore }[] = [];

  for (const line of result.candidateLines) {
    if (!Number.isInteger(line.rank) || line.rank < 1) {
      continue;
    }
    if (seen.has(line.rank)) {
      continue;
    }
    seen.add(line.rank);

    const pv = line.info.pv;
    if (!pv || pv.length === 0) {
      continue;
    }
    const firstMove = pv[0];
    if (typeof firstMove !== "string" || firstMove.length === 0) {
      continue;
    }
    candidates.push({
      rank: line.rank,
      move: firstMove.toLowerCase(),
      score: line.info.score,
    });
  }

  candidates.sort((a, b) => a.rank - b.rank);

  const candidateMoves = candidates.map((c) => c.move);
  const bestCandidateUci = candidates.length > 0 ? candidates[0].move : null;

  const match = candidates.find((c) => c.move === normalizedPlayed);
  const candidateRank = match ? match.rank : null;

  const firstNorm = candidates.length > 0 ? normalizeScore(candidates[0].score, sideToMove) : null;
  const bestCandidateScore = firstNorm ? toMoverScore(firstNorm, mover) : null;

  const secondNorm = candidates.length > 1 ? normalizeScore(candidates[1].score, sideToMove) : null;
  const secondCandidateScore = secondNorm ? toMoverScore(secondNorm, mover) : null;

  return {
    candidateRank,
    bestCandidateUci,
    candidateMoves,
    bestCandidateScore,
    secondCandidateScore,
  };
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Builds ordered per-move assessments by comparing before/after evaluation
 * points for every played move (ply 1 through totalPlies).
 *
 * - Reuses `buildQuickPassEvaluationSeries` for normalization and FEN validation.
 * - Propagates evaluation-series failures deterministically.
 * - One assessment per played move in timeline order.
 * - Does not calculate move-loss classifications, accuracy percentages,
 *   or any scoring beyond centipawn loss and signed change.
 */
export function buildMoveAssessments(
  timeline: ReviewTimeline,
  results: readonly QuickPassCompletedJob[],
): AssessmentResult {
  const seriesResult = buildQuickPassEvaluationSeries(timeline, results);
  if (!seriesResult.ok) {
    return { ok: false, reason: seriesResult.reason };
  }

  const points = seriesResult.points;
  const selectedResults = selectDeepestResultsByPly(results);
  const resultByPly = new Map(selectedResults.map((r) => [r.job.ply, r]));
  const assessments: MoveAssessment[] = [];

  for (let i = 1; i < timeline.steps.length; i++) {
    const step = timeline.steps[i];
    const beforePoint = points[i - 1];
    const afterPoint = points[i];

    // Timeline move must exist for every played move.
    const move = step.move;
    if (!move) {
      return {
        ok: false,
        reason: `Timeline move missing at ply ${step.ply}.`,
      };
    }

    // Mover from timeline move color.
    const mover: Mover = move.color === "w" ? "white" : "black";

    // Cross-check mover against before position side to move.
    if (beforePoint.sideToMove !== move.color) {
      return {
        ok: false,
        reason: `Mover color mismatch at ply ${step.ply}: timeline move color is ${move.color}, but before position has ${beforePoint.sideToMove} to move.`,
      };
    }

    const playedUci = toUci(move);
    const beforeResult = resultByPly.get(beforePoint.ply);
    const candidateMatch = findCandidateMatch(
      beforeResult,
      move,
      beforePoint.sideToMove,
      mover,
    );

    // Determine availability and reason.
    const beforeMissing = !beforePoint.completed || beforePoint.score === null;
    const afterMissing = !afterPoint.completed || afterPoint.score === null;

    if (beforeMissing) {
      const reason: UnavailableReason = !beforePoint.completed
        ? "before-analysis-missing"
        : "before-score-missing";

      assessments.push({
        ply: step.ply,
        mover,
        san: move.san,
        from: move.from,
        to: move.to,
        promotion: move.promotion,
        beforeFen: beforePoint.fen,
        afterFen: afterPoint.fen,
        beforeScore: beforePoint.score,
        afterScore: afterPoint.score,
        delta: null,
        available: false,
        unavailableReason: reason,
        playedUci,
        ...candidateMatch,
      });
      continue;
    }

    if (afterMissing) {
      const reason: UnavailableReason = !afterPoint.completed
        ? "after-analysis-missing"
        : "after-score-missing";

      assessments.push({
        ply: step.ply,
        mover,
        san: move.san,
        from: move.from,
        to: move.to,
        promotion: move.promotion,
        beforeFen: beforePoint.fen,
        afterFen: afterPoint.fen,
        beforeScore: beforePoint.score,
        afterScore: afterPoint.score,
        delta: null,
        available: false,
        unavailableReason: reason,
        playedUci,
        ...candidateMatch,
      });
      continue;
    }

    const beforeMoverScore = toMoverScore(beforePoint.score, mover);
    const afterMoverScore = toMoverScore(afterPoint.score, mover);

    let delta: Delta;
    if (
      beforeMoverScore.type === "mate" ||
      afterMoverScore.type === "mate"
    ) {
      delta = {
        kind: "mate",
        beforeMoverScore,
        afterMoverScore,
      };
    } else if (
      beforeMoverScore.bound === "lowerbound" ||
      beforeMoverScore.bound === "upperbound" ||
      afterMoverScore.bound === "lowerbound" ||
      afterMoverScore.bound === "upperbound"
    ) {
      delta = {
        kind: "bounded",
        beforeMoverScore,
        afterMoverScore,
      };
    } else {
      const signedChange = afterMoverScore.value - beforeMoverScore.value;
      const centipawnLoss = Math.max(0, beforeMoverScore.value - afterMoverScore.value);
      delta = {
        kind: "exact",
        beforeMoverScore,
        afterMoverScore,
        signedChange,
        centipawnLoss,
      };
    }

    assessments.push({
      ply: step.ply,
      mover,
      san: move.san,
      from: move.from,
      to: move.to,
      promotion: move.promotion,
      beforeFen: beforePoint.fen,
      afterFen: afterPoint.fen,
      beforeScore: beforePoint.score,
      afterScore: afterPoint.score,
      delta,
      available: true,
      unavailableReason: null,
      playedUci,
      ...candidateMatch,
    });
  }

  return { ok: true, assessments };
}
