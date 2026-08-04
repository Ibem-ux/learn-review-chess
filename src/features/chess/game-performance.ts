import type { Mover, MoverScore } from "./move-assessment";
import type { ClassifiedMove, MoveClassification } from "./move-classification";
import { winPercentFromCentipawns, winPercentFromMate, moveAccuracyPercent } from "./accuracy-model";
import type { GamePhase } from "./game-phase";
import { detectGamePhase } from "./game-phase";

function winPercentFromMoverScore(score: MoverScore): number {
  if (score.type === "mate") {
    return winPercentFromMate(score.value);
  }
  return winPercentFromCentipawns(score.value);
}

export type PlayerPerformance = {
  readonly mover: Mover;
  readonly totalMoves: number;
  readonly countedMoves: number;
  readonly accuracyMoves: number;
  readonly averageAccuracy: number | null;
  readonly phaseMoves: Readonly<Record<GamePhase, number>>;
  readonly phaseAccuracy: Readonly<Record<GamePhase, number | null>>;
  readonly counts: Readonly<Record<MoveClassification, number>>;
  readonly averageCentipawnLoss: number | null;
};

export type GamePerformance = {
  readonly white: PlayerPerformance;
  readonly black: PlayerPerformance;
};

export function buildGamePerformance(
  classified: readonly ClassifiedMove[],
): GamePerformance {
  const counts: Record<MoveClassification, number> = {
    best: 0,
    excellent: 0,
    good: 0,
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
    unclassified: 0,
  };

  const byMover = new Map<
    Mover,
    {
      totalMoves: number;
      exactLosses: number[];
      accuracyValues: number[];
      phaseValues: Record<GamePhase, number[]>;
    }
  >();

  for (const item of classified) {
    const mover = item.assessment.mover;
    const current = byMover.get(mover);
    const nextTotalMoves = (current?.totalMoves ?? 0) + 1;
    const exactLosses = current?.exactLosses ?? [];
    const accuracyValues = current?.accuracyValues ?? [];
    const phaseValues = current?.phaseValues ?? {
      opening: [],
      middlegame: [],
      endgame: [],
    };

    const delta = item.assessment.delta;
    // Accuracy counts mate deltas because win probability handles mate,
    // unlike centipawn loss.
    if (delta?.kind === "exact" || delta?.kind === "mate") {
      if (delta.kind === "exact") {
        exactLosses.push(delta.centipawnLoss);
      }
      const before = winPercentFromMoverScore(delta.beforeMoverScore);
      const after = winPercentFromMoverScore(delta.afterMoverScore);
      const accuracy = moveAccuracyPercent(before, after);
      accuracyValues.push(accuracy);

      const phase = detectGamePhase(item.assessment.beforeFen, item.assessment.ply);
      phaseValues[phase].push(accuracy);
    }

    byMover.set(mover, { totalMoves: nextTotalMoves, exactLosses, accuracyValues, phaseValues });
  }

  const buildPlayer = (mover: Mover): PlayerPerformance => {
    const entry = byMover.get(mover);
    const totalMoves = entry?.totalMoves ?? 0;
    const exactLosses = entry?.exactLosses ?? [];
    const accuracyValues = entry?.accuracyValues ?? [];
    const phaseValues = entry?.phaseValues ?? {
      opening: [],
      middlegame: [],
      endgame: [],
    };

    const countedMoves = exactLosses.length;
    const averageCentipawnLoss =
      countedMoves === 0
        ? null
        : exactLosses.reduce((sum, value) => sum + value, 0) / countedMoves;

    const accuracyMoves = accuracyValues.length;
    const averageAccuracy =
      accuracyMoves === 0 ? null : accuracyValues.reduce((sum, value) => sum + value, 0) / accuracyMoves;

    const phaseMoves: Record<GamePhase, number> = {
      opening: phaseValues.opening.length,
      middlegame: phaseValues.middlegame.length,
      endgame: phaseValues.endgame.length,
    };

    const computePhaseMean = (values: readonly number[]): number | null => {
      if (values.length === 0) return null;
      return values.reduce((sum, val) => sum + val, 0) / values.length;
    };

    const phaseAccuracy: Record<GamePhase, number | null> = {
      opening: computePhaseMean(phaseValues.opening),
      middlegame: computePhaseMean(phaseValues.middlegame),
      endgame: computePhaseMean(phaseValues.endgame),
    };

    const moverCounts: Record<MoveClassification, number> = { ...counts };
    for (const item of classified) {
      if (item.assessment.mover === mover) {
        moverCounts[item.classification] += 1;
      }
    }

    return {
      mover,
      totalMoves,
      countedMoves,
      accuracyMoves,
      averageAccuracy,
      phaseMoves,
      phaseAccuracy,
      counts: moverCounts,
      averageCentipawnLoss,
    };
  };

  return {
    white: buildPlayer("white"),
    black: buildPlayer("black"),
  };
}

