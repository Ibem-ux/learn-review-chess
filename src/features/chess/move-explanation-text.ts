/**
 * Converts structured explanation facts into human-readable sentences.
 */

import type { ExplanationFact, MoveExplanation } from "./move-explanation";

export function explanationFactToSentence(fact: ExplanationFact): string {
  switch (fact.kind) {
    case "unavailable": {
      let clause: string;
      if (fact.reason === "before-analysis-missing") {
        clause = "the position before it was not analyzed";
      } else if (fact.reason === "after-analysis-missing") {
        clause = "the position after it was not analyzed";
      } else if (fact.reason === "before-score-missing") {
        clause = "no evaluation was available before it";
      } else if (fact.reason === "after-score-missing") {
        clause = "no evaluation was available after it";
      } else {
        clause = "it was not analyzed";
      }
      return `This move could not be explained because ${clause}.`;
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
