import { describe, expect, it } from "vitest";
import type { ExplanationFact, MoveExplanation } from "./move-explanation";
import {
  explanationFactToSentence,
  explanationToSentences,
} from "./move-explanation-text";

describe("explanationFactToSentence", () => {
  it("unavailable with before-analysis-missing", () => {
    const fact: ExplanationFact = {
      kind: "unavailable",
      reason: "before-analysis-missing",
    };
    expect(explanationFactToSentence(fact)).toBe(
      "This move could not be explained because the position before it was not analyzed."
    );
  });

  it("unavailable with after-analysis-missing", () => {
    const fact: ExplanationFact = {
      kind: "unavailable",
      reason: "after-analysis-missing",
    };
    expect(explanationFactToSentence(fact)).toBe(
      "This move could not be explained because the position after it was not analyzed."
    );
  });

  it("unavailable with before-score-missing", () => {
    const fact: ExplanationFact = {
      kind: "unavailable",
      reason: "before-score-missing",
    };
    expect(explanationFactToSentence(fact)).toBe(
      "This move could not be explained because no evaluation was available before it."
    );
  });

  it("unavailable with after-score-missing", () => {
    const fact: ExplanationFact = {
      kind: "unavailable",
      reason: "after-score-missing",
    };
    expect(explanationFactToSentence(fact)).toBe(
      "This move could not be explained because no evaluation was available after it."
    );
  });

  it("unavailable with null reason", () => {
    const fact: ExplanationFact = {
      kind: "unavailable",
      reason: null,
    };
    expect(explanationFactToSentence(fact)).toBe(
      "This move could not be explained because it was not analyzed."
    );
  });

  it("phase opening, middlegame, endgame", () => {
    expect(
      explanationFactToSentence({ kind: "phase", phase: "opening" })
    ).toBe("Played in the opening.");
    expect(
      explanationFactToSentence({ kind: "phase", phase: "middlegame" })
    ).toBe("Played in the middlegame.");
    expect(
      explanationFactToSentence({ kind: "phase", phase: "endgame" })
    ).toBe("Played in the endgame.");
  });

  it("played-best-move", () => {
    const fact: ExplanationFact = { kind: "played-best-move" };
    expect(explanationFactToSentence(fact)).toBe(
      "This was the engine's top choice."
    );
  });

  it("missed-better-move", () => {
    const fact: ExplanationFact = {
      kind: "missed-better-move",
      bestUci: "e2e4",
    };
    expect(explanationFactToSentence(fact)).toBe(
      "The engine preferred e2e4."
    );
  });

  it("material-won", () => {
    const fact: ExplanationFact = {
      kind: "material-won",
      centipawns: 320,
    };
    expect(explanationFactToSentence(fact)).toBe(
      "This move gains 320 centipawns of material."
    );
  });

  it("material-lost", () => {
    const fact: ExplanationFact = {
      kind: "material-lost",
      centipawns: 320,
    };
    expect(explanationFactToSentence(fact)).toBe(
      "This move gives up 320 centipawns of material."
    );
  });

  it("material-even", () => {
    const fact: ExplanationFact = { kind: "material-even" };
    expect(explanationFactToSentence(fact)).toBe(
      "Material is unchanged on this move."
    );
  });

  it("evaluation-drop", () => {
    const fact: ExplanationFact = {
      kind: "evaluation-drop",
      centipawnLoss: 150,
    };
    expect(explanationFactToSentence(fact)).toBe(
      "The evaluation dropped by 150 centipawns."
    );
  });

  it("evaluation-held", () => {
    const fact: ExplanationFact = {
      kind: "evaluation-held",
      centipawnLoss: 50,
    };
    expect(explanationFactToSentence(fact)).toBe(
      "The evaluation held (50 centipawns lost)."
    );
  });

  it("mate-missed", () => {
    const fact: ExplanationFact = {
      kind: "mate-missed",
      movesToMate: 3,
    };
    expect(explanationFactToSentence(fact)).toBe(
      "A forced mate in 3 was available and was missed."
    );
  });

  it("mate-allowed", () => {
    const fact: ExplanationFact = {
      kind: "mate-allowed",
      movesToMate: 2,
    };
    expect(explanationFactToSentence(fact)).toBe(
      "This move allows a forced mate in 2."
    );
  });

  it("mate-converted", () => {
    const fact: ExplanationFact = {
      kind: "mate-converted",
      movesToMate: 3,
    };
    expect(explanationFactToSentence(fact)).toBe(
      "This move keeps a forced mate in 3."
    );
  });

  it("mate-found", () => {
    const fact: ExplanationFact = {
      kind: "mate-found",
      movesToMate: 4,
    };
    expect(explanationFactToSentence(fact)).toBe(
      "This move creates a forced mate in 4."
    );
  });
});

describe("explanationToSentences", () => {
  it("maps facts in order", () => {
    const explanation: MoveExplanation = {
      ply: 25,
      mover: "white",
      san: "e4",
      facts: [
        { kind: "phase", phase: "middlegame" },
        { kind: "played-best-move" },
        { kind: "material-even" },
        { kind: "mate-converted", movesToMate: 3 },
      ],
    };
    expect(explanationToSentences(explanation)).toEqual([
      "Played in the middlegame.",
      "This was the engine's top choice.",
      "Material is unchanged on this move.",
      "This move keeps a forced mate in 3.",
    ]);
  });

  it("handles unavailable explanation", () => {
    const explanation: MoveExplanation = {
      ply: 1,
      mover: "white",
      san: "e4",
      facts: [
        { kind: "unavailable", reason: "before-analysis-missing" },
      ],
    };
    expect(explanationToSentences(explanation)).toEqual([
      "This move could not be explained because the position before it was not analyzed.",
    ]);
  });
});
