import type { MoveAssessment } from "./move-assessment";
import { MINOR_PIECE_VALUE, materialBalanceFromFen } from "./material";

export type MoveClassification =
  | "brilliant"
  | "great"
  | "best"
  | "excellent"
  | "good"
  | "missed-win"
  | "inaccuracy"
  | "mistake"
  | "blunder"
  | "unclassified";

// Canonical display order for any UI that lists classifications, best first and unclassified last.
export const MOVE_CLASSIFICATION_ORDER: readonly MoveClassification[] = [
  "brilliant",
  "great",
  "best",
  "excellent",
  "good",
  "inaccuracy",
  "mistake",
  "missed-win",
  "blunder",
  "unclassified",
];

export type ClassificationPolicy = {
  readonly bestMax: number;
  readonly excellentMax: number;
  readonly goodMax: number;
  readonly inaccuracyMax: number;
  readonly mistakeMax: number;
};

export const DEFAULT_CLASSIFICATION_POLICY: ClassificationPolicy = Object.freeze({
  bestMax: 10,
  excellentMax: 30,
  goodMax: 70,
  inaccuracyMax: 120,
  mistakeMax: 250,
});

export const GREAT_MARGIN_CP = 150;
export const GREAT_MAX_LOSS_CP = 20;

export type ClassificationBasis =
  | "only-move"
  | "candidate-rank"
  | "centipawn-loss"
  | "unavailable"
  | "delta-missing"
  | "mate-delivered"
  | "mate-preserved"
  | "mate-drift"
  | "mate-missed"
  | "mate-allowed"
  | "bounded"
  | "invalid-loss"
  | "sacrifice";

export type ClassifiedMove = {
  readonly assessment: MoveAssessment;
  readonly classification: MoveClassification;
  readonly basis: ClassificationBasis;
};

export function isSacrifice(
  assessment: MoveAssessment,
  postReply: MoveAssessment | undefined
): boolean {
  if (!postReply) {
    return false;
  }
  // A malformed FEN must never break classification of an entire game.
  try {
    const rawBefore = materialBalanceFromFen(assessment.beforeFen);
    const rawAfter = materialBalanceFromFen(postReply.afterFen);
    const moverBefore = assessment.mover === "white" ? rawBefore : -rawBefore;
    const moverAfter = assessment.mover === "white" ? rawAfter : -rawAfter;
    return moverAfter <= moverBefore - MINOR_PIECE_VALUE;
  } catch {
    return false;
  }
}

function validatePolicy(policy: ClassificationPolicy): void {
  const values = [
    policy.bestMax,
    policy.excellentMax,
    policy.goodMax,
    policy.inaccuracyMax,
    policy.mistakeMax,
  ];
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0) {
      throw new RangeError(
        "Classification policy thresholds must be finite and non-negative."
      );
    }
  }
  for (let i = 1; i < values.length; i++) {
    if (values[i] < values[i - 1]) {
      throw new RangeError(
        "Classification policy thresholds must be monotonically non-decreasing."
      );
    }
  }
}

function classifyMoveUnvalidated(
  assessment: MoveAssessment,
  policy: ClassificationPolicy,
  postReply?: MoveAssessment
): ClassifiedMove {
  if (!assessment.available) {
    return { assessment, classification: "unclassified", basis: "unavailable" };
  }

  if (assessment.delta === null) {
    return { assessment, classification: "unclassified", basis: "delta-missing" };
  }

  if (assessment.delta.kind === "mate") {
    const before = assessment.delta.beforeMoverScore;
    const after = assessment.delta.afterMoverScore;

    const hadWinningMate = before.type === "mate" && before.value > 0;
    const hasWinningMate = after.type === "mate" && after.value > 0;
    const wasBeingMated = before.type === "mate" && before.value < 0;
    const isBeingMated = after.type === "mate" && after.value < 0;

    // Case (a): delivers or preserves a forced mate for the mover.
    if (hasWinningMate) {
      // Check the sacrifice gate: a mate-delivering/preserving move that is
      // also a sacrifice at rank 1 with positive best candidate score is brilliant.
      const best = assessment.bestCandidateScore;
      const second = assessment.secondCandidateScore;
      if (
        assessment.candidateRank === 1 &&
        best !== null &&
        second !== null &&
        best.type === "cp" &&
        second.type === "cp" &&
        best.bound === undefined &&
        second.bound === undefined &&
        best.value - second.value >= GREAT_MARGIN_CP &&
        best.value >= 0 &&
        isSacrifice(assessment, postReply)
      ) {
        return { assessment, classification: "brilliant", basis: "sacrifice" };
      }

      if (!hadWinningMate) {
        return { assessment, classification: "best", basis: "mate-delivered" };
      }
      // Mate-converted: compare distances. A longer distance means the mover
      // played a slower mate — suboptimal but not losing.
      if (after.value > before.value) {
        return { assessment, classification: "good", basis: "mate-drift" };
      }
      return { assessment, classification: "best", basis: "mate-preserved" };
    }

    // Case (d): winning mate flipped to being mated — strictly worse than case (c).
    if (hadWinningMate && isBeingMated) {
      return { assessment, classification: "blunder", basis: "mate-allowed" };
    }

    // Case (b): had a winning mate but lost it (position remains winning or drawn, not mated).
    if (hadWinningMate && !hasWinningMate) {
      return { assessment, classification: "missed-win", basis: "mate-missed" };
    }

    // Case (c): allows the opponent a forced mate.
    if (!wasBeingMated && isBeingMated) {
      return { assessment, classification: "blunder", basis: "mate-allowed" };
    }

    // Remaining mate transitions (e.g. was being mated and still being mated)
    // are left unclassified — no centipawn loss is available.
    return { assessment, classification: "unclassified", basis: "bounded" };
  }

  if (assessment.delta.kind === "bounded") {
    return { assessment, classification: "unclassified", basis: "bounded" };
  }

  const loss = assessment.delta.centipawnLoss;

  if (!Number.isFinite(loss) || loss < 0) {
    return { assessment, classification: "unclassified", basis: "invalid-loss" };
  }

  const best = assessment.bestCandidateScore;
  const second = assessment.secondCandidateScore;
  if (
    assessment.candidateRank === 1 &&
    best !== null &&
    second !== null &&
    best.type === "cp" &&
    second.type === "cp" &&
    best.bound === undefined &&
    second.bound === undefined &&
    best.value - second.value >= GREAT_MARGIN_CP &&
    loss <= GREAT_MAX_LOSS_CP
  ) {
    if (best.value >= 0 && isSacrifice(assessment, postReply)) {
      return { assessment, classification: "brilliant", basis: "sacrifice" };
    }
    return { assessment, classification: "great", basis: "only-move" };
  }

  if (assessment.candidateRank === 1) {
    return { assessment, classification: "best", basis: "candidate-rank" };
  }

  if (loss <= policy.bestMax) {
    return { assessment, classification: "best", basis: "centipawn-loss" };
  }
  if (loss <= policy.excellentMax) {
    return { assessment, classification: "excellent", basis: "centipawn-loss" };
  }
  if (loss <= policy.goodMax) {
    return { assessment, classification: "good", basis: "centipawn-loss" };
  }
  if (loss <= policy.inaccuracyMax) {
    return { assessment, classification: "inaccuracy", basis: "centipawn-loss" };
  }
  if (loss <= policy.mistakeMax) {
    return { assessment, classification: "mistake", basis: "centipawn-loss" };
  }
  return { assessment, classification: "blunder", basis: "centipawn-loss" };
}

export function classifyMove(
  assessment: MoveAssessment,
  policy: ClassificationPolicy = DEFAULT_CLASSIFICATION_POLICY
): ClassifiedMove {
  validatePolicy(policy);
  // classifyMove passes undefined for postReply, so a single move can never be brilliant.
  return classifyMoveUnvalidated(assessment, policy, undefined);
}

export function classifyMoves(
  assessments: readonly MoveAssessment[],
  policy: ClassificationPolicy = DEFAULT_CLASSIFICATION_POLICY
): readonly ClassifiedMove[] {
  validatePolicy(policy);
  return assessments.map((a, i) =>
    classifyMoveUnvalidated(a, policy, assessments[i + 1])
  );
}

