import type { MoveAssessment } from "./move-assessment";

export type MoveClassification =
  | "best"
  | "excellent"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder"
  | "unclassified";

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

export type ClassificationBasis =
  | "candidate-rank"
  | "centipawn-loss"
  | "unavailable"
  | "delta-missing"
  | "mate"
  | "bounded"
  | "invalid-loss";

export type ClassifiedMove = {
  readonly assessment: MoveAssessment;
  readonly classification: MoveClassification;
  readonly basis: ClassificationBasis;
};

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
  policy: ClassificationPolicy
): ClassifiedMove {
  if (!assessment.available) {
    return { assessment, classification: "unclassified", basis: "unavailable" };
  }

  if (assessment.delta === null) {
    return { assessment, classification: "unclassified", basis: "delta-missing" };
  }

  if (assessment.delta.kind === "mate") {
    return { assessment, classification: "unclassified", basis: "mate" };
  }

  if (assessment.delta.kind === "bounded") {
    return { assessment, classification: "unclassified", basis: "bounded" };
  }

  const loss = assessment.delta.centipawnLoss;

  if (!Number.isFinite(loss) || loss < 0) {
    return { assessment, classification: "unclassified", basis: "invalid-loss" };
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
  return classifyMoveUnvalidated(assessment, policy);
}

export function classifyMoves(
  assessments: readonly MoveAssessment[],
  policy: ClassificationPolicy = DEFAULT_CLASSIFICATION_POLICY
): readonly ClassifiedMove[] {
  validatePolicy(policy);
  return assessments.map((a) => classifyMoveUnvalidated(a, policy));
}
