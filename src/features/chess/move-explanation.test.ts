import { describe, expect, it } from "vitest";
import type { MoveAssessment } from "./move-assessment";
import {
  EVALUATION_DROP_CP,
  buildMoveExplanation,
  buildMoveExplanations,
} from "./move-explanation";

function makeAssessment(overrides: Partial<MoveAssessment> = {}): MoveAssessment {
  const base: MoveAssessment = {
    ply: 1,
    mover: "white",
    san: "e4",
    from: "e2",
    to: "e4",
    beforeFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    afterFen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    beforeScore: null,
    afterScore: null,
    delta: null,
    available: true,
    unavailableReason: null,
    playedUci: "e2e4",
    candidateRank: 1,
    bestCandidateUci: "e2e4",
    candidateMoves: ["e2e4"],
    bestCandidateScore: null,
    secondCandidateScore: null,
  };

  return { ...base, ...overrides };
}

describe("buildMoveExplanation", () => {
  it("unavailable returns exactly one fact and propagates the reason", () => {
    const assessment = makeAssessment({
      available: false,
      unavailableReason: "before-analysis-missing",
    });
    const explanation = buildMoveExplanation(assessment);
    expect(explanation.facts).toEqual([
      { kind: "unavailable", reason: "before-analysis-missing" },
    ]);
  });

  it("unavailable with a null reason", () => {
    const assessment = makeAssessment({
      available: false,
      unavailableReason: null,
    });
    const explanation = buildMoveExplanation(assessment);
    expect(explanation.facts).toEqual([
      { kind: "unavailable", reason: null },
    ]);
  });

  it("opening phase fact for opening position", () => {
    const assessment = makeAssessment({
      ply: 0,
      beforeFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    });
    const explanation = buildMoveExplanation(assessment);
    expect(explanation.facts[0]).toEqual({ kind: "phase", phase: "opening" });
  });

  it("middlegame phase fact for middlegame position", () => {
    const assessment = makeAssessment({
      ply: 25,
      beforeFen: "r1bq1rk1/ppp2ppp/2np1n2/4p3/2B1P3/2NP1N2/PPP2PPP/R2Q1RK1 w - - 0 8",
    });
    const explanation = buildMoveExplanation(assessment);
    expect(explanation.facts[0]).toEqual({ kind: "phase", phase: "middlegame" });
  });

  it("endgame phase fact for endgame position", () => {
    const assessment = makeAssessment({
      ply: 60,
      beforeFen: "8/8/4k3/8/8/4K3/8/8 w - - 0 31",
    });
    const explanation = buildMoveExplanation(assessment);
    expect(explanation.facts[0]).toEqual({ kind: "phase", phase: "endgame" });
  });

  it("played-best-move when playedUci equals bestCandidateUci", () => {
    const assessment = makeAssessment({
      playedUci: "e2e4",
      bestCandidateUci: "e2e4",
    });
    const explanation = buildMoveExplanation(assessment);
    expect(explanation.facts).toContainEqual({ kind: "played-best-move" });
  });

  it("missed-better-move carries bestCandidateUci verbatim", () => {
    const assessment = makeAssessment({
      playedUci: "e2e3",
      bestCandidateUci: "e2e4",
    });
    const explanation = buildMoveExplanation(assessment);
    expect(explanation.facts).toContainEqual({
      kind: "missed-better-move",
      bestUci: "e2e4",
    });
  });

  it("no best-move fact when bestCandidateUci is null", () => {
    const assessment = makeAssessment({
      bestCandidateUci: null,
    });
    const explanation = buildMoveExplanation(assessment);
    const hasBestMoveFact = explanation.facts.some(
      (f) => f.kind === "played-best-move" || f.kind === "missed-better-move"
    );
    expect(hasBestMoveFact).toBe(false);
  });

  it("material-won for the mover, using a real FEN pair", () => {
    const assessment = makeAssessment({
      mover: "white",
      beforeFen: "r1bqkbnr/pppppppp/2n5/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      afterFen: "r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    });
    const explanation = buildMoveExplanation(assessment);
    expect(explanation.facts).toContainEqual({
      kind: "material-won",
      centipawns: 320,
    });
  });

  it("material-lost for the mover, using a real FEN pair", () => {
    const assessment = makeAssessment({
      mover: "white",
      beforeFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      afterFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKB1R w KQkq - 0 1",
    });
    const explanation = buildMoveExplanation(assessment);
    expect(explanation.facts).toContainEqual({
      kind: "material-lost",
      centipawns: 320,
    });
  });

  it("material-even for a quiet move", () => {
    const assessment = makeAssessment({
      mover: "white",
      beforeFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      afterFen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    });
    const explanation = buildMoveExplanation(assessment);
    expect(explanation.facts).toContainEqual({ kind: "material-even" });
  });

  it("the material sign flips correctly when mover is \"black\"", () => {
    const wonAssessment = makeAssessment({
      mover: "black",
      beforeFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1",
      afterFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKB1R b KQkq - 0 1",
    });
    const wonExplanation = buildMoveExplanation(wonAssessment);
    expect(wonExplanation.facts).toContainEqual({
      kind: "material-won",
      centipawns: 320,
    });

    const lostAssessment = makeAssessment({
      mover: "black",
      beforeFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1",
      afterFen: "r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1",
    });
    const lostExplanation = buildMoveExplanation(lostAssessment);
    expect(lostExplanation.facts).toContainEqual({
      kind: "material-lost",
      centipawns: 320,
    });
  });

  it("evaluation-drop at exactly EVALUATION_DROP_CP", () => {
    const assessment = makeAssessment({
      delta: {
        kind: "exact",
        beforeMoverScore: { type: "cp", value: 100, perspective: "mover" },
        afterMoverScore: { type: "cp", value: 0, perspective: "mover" },
        signedChange: -100,
        centipawnLoss: EVALUATION_DROP_CP,
      },
    });
    const explanation = buildMoveExplanation(assessment);
    expect(explanation.facts).toContainEqual({
      kind: "evaluation-drop",
      centipawnLoss: EVALUATION_DROP_CP,
    });
  });

  it("evaluation-held just below EVALUATION_DROP_CP", () => {
    const assessment = makeAssessment({
      delta: {
        kind: "exact",
        beforeMoverScore: { type: "cp", value: 99, perspective: "mover" },
        afterMoverScore: { type: "cp", value: 0, perspective: "mover" },
        signedChange: -99,
        centipawnLoss: 99,
      },
    });
    const explanation = buildMoveExplanation(assessment);
    expect(explanation.facts).toContainEqual({
      kind: "evaluation-held",
      centipawnLoss: 99,
    });
  });

  it("no evaluation fact for delta.kind \"mate\"", () => {
    const assessment = makeAssessment({
      delta: {
        kind: "mate",
        beforeMoverScore: { type: "mate", value: 1, perspective: "mover" },
        afterMoverScore: { type: "mate", value: 0, perspective: "mover" },
      },
    });
    const explanation = buildMoveExplanation(assessment);
    const hasEvalFact = explanation.facts.some(
      (f) => f.kind === "evaluation-drop" || f.kind === "evaluation-held"
    );
    expect(hasEvalFact).toBe(false);
  });

  it("no evaluation fact for delta.kind \"bounded\"", () => {
    const assessment = makeAssessment({
      delta: {
        kind: "bounded",
        beforeMoverScore: { type: "cp", value: 100, perspective: "mover" },
        afterMoverScore: { type: "cp", value: 0, perspective: "mover" },
      },
    });
    const explanation = buildMoveExplanation(assessment);
    const hasEvalFact = explanation.facts.some(
      (f) => f.kind === "evaluation-drop" || f.kind === "evaluation-held"
    );
    expect(hasEvalFact).toBe(false);
  });

  it("no evaluation fact for a null delta", () => {
    const assessment = makeAssessment({
      delta: null,
    });
    const explanation = buildMoveExplanation(assessment);
    const hasEvalFact = explanation.facts.some(
      (f) => f.kind === "evaluation-drop" || f.kind === "evaluation-held"
    );
    expect(hasEvalFact).toBe(false);
  });

  it("the fact order is exactly phase, best-move, material, evaluation", () => {
    const assessment = makeAssessment({
      ply: 25,
      beforeFen: "r1bq1rk1/ppp2ppp/2np1n2/4p3/2B1P3/2NP1N2/PPP2PPP/R2Q1RK1 w - - 0 8",
      afterFen: "r1bq1rk1/ppp2ppp/2np1n2/4p3/2B1P3/2NP1N2/PPP2PPP/R2Q1RK1 w - - 0 8",
      playedUci: "e2e3",
      bestCandidateUci: "e2e4",
      delta: {
        kind: "exact",
        beforeMoverScore: { type: "cp", value: 200, perspective: "mover" },
        afterMoverScore: { type: "cp", value: 50, perspective: "mover" },
        signedChange: -150,
        centipawnLoss: 150,
      },
    });
    const explanation = buildMoveExplanation(assessment);
    expect(explanation.facts).toEqual([
      { kind: "phase", phase: "middlegame" },
      { kind: "missed-better-move", bestUci: "e2e4" },
      { kind: "material-even" },
      { kind: "evaluation-drop", centipawnLoss: 150 },
    ]);
  });

  it("buildMoveExplanations preserves input order", () => {
    const a1 = makeAssessment({ ply: 1, san: "e4" });
    const a2 = makeAssessment({ ply: 2, san: "e5" });
    const explanations = buildMoveExplanations([a1, a2]);
    expect(explanations.length).toBe(2);
    expect(explanations[0].ply).toBe(1);
    expect(explanations[0].san).toBe("e4");
    expect(explanations[1].ply).toBe(2);
    expect(explanations[1].san).toBe("e5");
  });

  it("mate-missed emitted when winning mate is lost", () => {
    const assessment = makeAssessment({
      delta: {
        kind: "mate",
        beforeMoverScore: { type: "mate", value: 3, perspective: "mover" },
        afterMoverScore: { type: "cp", value: 100, perspective: "mover" },
      },
    });
    const explanation = buildMoveExplanation(assessment);
    expect(explanation.facts).toContainEqual({
      kind: "mate-missed",
      movesToMate: 3,
    });
  });

  it("mate-allowed emitted when mover allows opponent mate", () => {
    const assessment = makeAssessment({
      delta: {
        kind: "mate",
        beforeMoverScore: { type: "cp", value: 0, perspective: "mover" },
        afterMoverScore: { type: "mate", value: -2, perspective: "mover" },
      },
    });
    const explanation = buildMoveExplanation(assessment);
    expect(explanation.facts).toContainEqual({
      kind: "mate-allowed",
      movesToMate: 2,
    });
  });

  it("mate-converted emitted when winning mate is maintained", () => {
    const assessment = makeAssessment({
      delta: {
        kind: "mate",
        beforeMoverScore: { type: "mate", value: 4, perspective: "mover" },
        afterMoverScore: { type: "mate", value: 3, perspective: "mover" },
      },
    });
    const explanation = buildMoveExplanation(assessment);
    expect(explanation.facts).toContainEqual({
      kind: "mate-converted",
      movesToMate: 3,
    });
  });

  it("mate delta emits no evaluation-drop or evaluation-held fact", () => {
    const assessment = makeAssessment({
      delta: {
        kind: "mate",
        beforeMoverScore: { type: "mate", value: 3, perspective: "mover" },
        afterMoverScore: { type: "cp", value: 100, perspective: "mover" },
      },
    });
    const explanation = buildMoveExplanation(assessment);
    const hasEval = explanation.facts.some(
      (f) => f.kind === "evaluation-drop" || f.kind === "evaluation-held"
    );
    expect(hasEval).toBe(false);
  });

  it("exact delta emits evaluation fact and no mate fact", () => {
    const assessment = makeAssessment({
      delta: {
        kind: "exact",
        beforeMoverScore: { type: "cp", value: 200, perspective: "mover" },
        afterMoverScore: { type: "cp", value: 50, perspective: "mover" },
        signedChange: -150,
        centipawnLoss: 150,
      },
    });
    const explanation = buildMoveExplanation(assessment);
    expect(explanation.facts).toContainEqual({
      kind: "evaluation-drop",
      centipawnLoss: 150,
    });
    const hasMateFact = explanation.facts.some(
      (f) =>
        f.kind === "mate-missed" ||
        f.kind === "mate-allowed" ||
        f.kind === "mate-converted"
    );
    expect(hasMateFact).toBe(false);
  });

  it("mate-missed carries before movesToMate value verbatim", () => {
    const assessment = makeAssessment({
      delta: {
        kind: "mate",
        beforeMoverScore: { type: "mate", value: 5, perspective: "mover" },
        afterMoverScore: { type: "cp", value: 50, perspective: "mover" },
      },
    });
    const explanation = buildMoveExplanation(assessment);
    expect(explanation.facts).toContainEqual({
      kind: "mate-missed",
      movesToMate: 5,
    });
  });

  it("mate-allowed carries absolute movesToMate value verbatim", () => {
    const assessment = makeAssessment({
      delta: {
        kind: "mate",
        beforeMoverScore: { type: "cp", value: 50, perspective: "mover" },
        afterMoverScore: { type: "mate", value: -4, perspective: "mover" },
      },
    });
    const explanation = buildMoveExplanation(assessment);
    expect(explanation.facts).toContainEqual({
      kind: "mate-allowed",
      movesToMate: 4,
    });
  });

  it("mate-converted carries after movesToMate value verbatim", () => {
    const assessment = makeAssessment({
      delta: {
        kind: "mate",
        beforeMoverScore: { type: "mate", value: 2, perspective: "mover" },
        afterMoverScore: { type: "mate", value: 1, perspective: "mover" },
      },
    });
    const explanation = buildMoveExplanation(assessment);
    expect(explanation.facts).toContainEqual({
      kind: "mate-converted",
      movesToMate: 1,
    });
  });

  it("mate delta when mover was already being mated emits no mate fact", () => {
    const assessment = makeAssessment({
      delta: {
        kind: "mate",
        beforeMoverScore: { type: "mate", value: -3, perspective: "mover" },
        afterMoverScore: { type: "mate", value: -2, perspective: "mover" },
      },
    });
    const explanation = buildMoveExplanation(assessment);
    const hasMateFact = explanation.facts.some(
      (f) =>
        f.kind === "mate-missed" ||
        f.kind === "mate-allowed" ||
        f.kind === "mate-converted"
    );
    expect(hasMateFact).toBe(false);
  });

  it("mate-converted fact is ordered last after phase, best-move, material", () => {
    const assessment = makeAssessment({
      ply: 25,
      beforeFen: "r1bq1rk1/ppp2ppp/2np1n2/4p3/2B1P3/2NP1N2/PPP2PPP/R2Q1RK1 w - - 0 8",
      afterFen: "r1bq1rk1/ppp2ppp/2np1n2/4p3/2B1P3/2NP1N2/PPP2PPP/R2Q1RK1 w - - 0 8",
      playedUci: "e2e4",
      bestCandidateUci: "e2e4",
      delta: {
        kind: "mate",
        beforeMoverScore: { type: "mate", value: 4, perspective: "mover" },
        afterMoverScore: { type: "mate", value: 3, perspective: "mover" },
      },
    });
    const explanation = buildMoveExplanation(assessment);
    expect(explanation.facts).toEqual([
      { kind: "phase", phase: "middlegame" },
      { kind: "played-best-move" },
      { kind: "material-even" },
      { kind: "mate-converted", movesToMate: 3 },
    ]);
  });
});
