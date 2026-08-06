/**
 * Converts structured explanation facts into human-readable sentences.
 */

import type { ExplanationFact, MoveExplanation } from "./move-explanation";

export function explanationFactToSentence(fact: ExplanationFact): string {
  switch (fact.kind) {
    case "unavailable": {
      const reason = fact.reason;
      if (reason === null) {
        return "This move could not be explained because it was not analyzed.";
      }
      switch (reason) {
        case "before-analysis-missing":
          return "This move could not be explained because the position before it was not analyzed.";
        case "after-analysis-missing":
          return "This move could not be explained because the position after it was not analyzed.";
        case "before-score-missing":
          return "This move could not be explained because no evaluation was available before it.";
        case "after-score-missing":
          return "This move could not be explained because no evaluation was available after it.";
      }
      const exhaustive: never = reason;
      return exhaustive;
    }
    case "phase":
      return `Played in the ${fact.phase}.`;
    case "played-best-move":
      return "This was the engine's top choice.";
    case "missed-better-move":
      return `The engine preferred ${fact.bestUci}.`;
    case "material-won":
      return `This move gains ${fact.centipawns} centipawns of material.`;
    case "material-lost":
      return `This move gives up ${fact.centipawns} centipawns of material.`;
    case "material-even":
      return "Material is unchanged on this move.";
    case "evaluation-drop":
      return `The evaluation dropped by ${fact.centipawnLoss} centipawns.`;
    case "evaluation-held":
      return `The evaluation held (${fact.centipawnLoss} centipawns lost).`;
    case "mate-missed":
      return `A forced mate in ${fact.movesToMate} was available and was missed.`;
    case "mate-allowed":
      return `This move allows a forced mate in ${fact.movesToMate}.`;
    case "mate-converted":
      return `This move keeps a forced mate in ${fact.movesToMate}.`;
    case "mate-found":
      return `This move creates a forced mate in ${fact.movesToMate}.`;
  }
  const exhaustive: never = fact;
  return exhaustive;
}

export function explanationToSentences(
  explanation: MoveExplanation
): readonly string[] {
  return explanation.facts.map(explanationFactToSentence);
}
