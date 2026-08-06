/**
 * Explains individual chess moves by building structured facts.
 * Mate and bounded deltas are deliberately not explained yet.
 */

import type { GamePhase } from "./game-phase";
import { detectGamePhase } from "./game-phase";
import { MINOR_PIECE_VALUE, materialBalanceFromFen } from "./material";
import type { MoveAssessment, Mover, UnavailableReason } from "./move-assessment";

export const EVALUATION_DROP_CP = 100;

export type ExplanationFact =
  | { readonly kind: "unavailable"; readonly reason: UnavailableReason | null }
  | { readonly kind: "phase"; readonly phase: GamePhase }
  | { readonly kind: "played-best-move" }
  | { readonly kind: "missed-better-move"; readonly bestUci: string }
  | { readonly kind: "material-won"; readonly centipawns: number }
  | { readonly kind: "material-lost"; readonly centipawns: number }
  | { readonly kind: "material-even" }
  | { readonly kind: "evaluation-drop"; readonly centipawnLoss: number }
  | { readonly kind: "evaluation-held"; readonly centipawnLoss: number };

export type MoveExplanation = {
  readonly ply: number;
  readonly mover: Mover;
  readonly san: string;
  readonly facts: readonly ExplanationFact[];
};

export function buildMoveExplanation(
  assessment: MoveAssessment
): MoveExplanation {
  if (!assessment.available) {
    return {
      ply: assessment.ply,
      mover: assessment.mover,
      san: assessment.san,
      facts: [
        {
          kind: "unavailable",
          reason: assessment.unavailableReason,
        },
      ],
    };
  }

  const facts: ExplanationFact[] = [];

  const phase = detectGamePhase(assessment.beforeFen, assessment.ply);
  facts.push({ kind: "phase", phase });

  if (assessment.bestCandidateUci !== null) {
    if (assessment.playedUci === assessment.bestCandidateUci) {
      facts.push({ kind: "played-best-move" });
    } else {
      facts.push({
        kind: "missed-better-move",
        bestUci: assessment.bestCandidateUci,
      });
    }
  }

  const rawSwing =
    materialBalanceFromFen(assessment.afterFen) -
    materialBalanceFromFen(assessment.beforeFen);
  const swing = assessment.mover === "white" ? rawSwing : -rawSwing;

  if (swing >= MINOR_PIECE_VALUE) {
    facts.push({ kind: "material-won", centipawns: swing });
  } else if (swing <= -MINOR_PIECE_VALUE) {
    facts.push({ kind: "material-lost", centipawns: Math.abs(swing) });
  } else {
    facts.push({ kind: "material-even" });
  }

  if (assessment.delta !== null) {
    if (assessment.delta.kind === "exact") {
      if (assessment.delta.centipawnLoss >= EVALUATION_DROP_CP) {
        facts.push({
          kind: "evaluation-drop",
          centipawnLoss: assessment.delta.centipawnLoss,
        });
      } else {
        facts.push({
          kind: "evaluation-held",
          centipawnLoss: assessment.delta.centipawnLoss,
        });
      }
    }
  }

  return {
    ply: assessment.ply,
    mover: assessment.mover,
    san: assessment.san,
    facts,
  };
}

export function buildMoveExplanations(
  assessments: readonly MoveAssessment[]
): readonly MoveExplanation[] {
  return assessments.map(buildMoveExplanation);
}
