import type { Mover } from "./move-assessment";
import type { ClassifiedMove, MoveClassification } from "./move-classification";
import type { MoverScore } from "./move-assessment";
import { winPercentFromCentipawns, winPercentFromMate, moveAccuracyPercent } from "./accuracy-model";

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

  const byMover = new Map<Mover, { totalMoves: number; exactLosses: number[]; accuracyValues: number[] }>();

  for (const item of classified) {
    const mover = item.assessment.mover;
    const current = byMover.get(mover);
    const nextTotalMoves = (current?.totalMoves ?? 0) + 1;
    const exactLosses = current?.exactLosses ?? [];
    const accuracyValues = current?.accuracyValues ?? [];

    if (item.assessment.delta?.kind === "exact") {
      exactLosses.push(item.assessment.delta.centipawnLoss);
      const before = winPercentFromMoverScore(item.assessment.delta.beforeMoverScore);
      const after = winPercentFromMoverScore(item.assessment.delta.afterMoverScore);
      accuracyValues.push(moveAccuracyPercent(before, after));
    } else if (item.assessment.delta?.kind === "mate") {
      const before = winPercentFromMoverScore(item.assessment.delta.beforeMoverScore);
      const after = winPercentFromMoverScore(item.assessment.delta.afterMoverScore);
      accuracyValues.push(moveAccuracyPercent(before, after));
    }

    // Accuracy counts mate deltas because win probability handles mate,
    // unlike centipawn loss.

    byMover.set(mover, { totalMoves: nextTotalMoves, exactLosses, accuracyValues });
  }

  const buildPlayer = (mover: Mover): PlayerPerformance => {
    const entry = byMover.get(mover);
    const totalMoves = entry?.totalMoves ?? 0;
    const exactLosses = entry?.exactLosses ?? [];
    const accuracyValues = entry?.accuracyValues ?? [];
    const countedMoves = exactLosses.length;
    const averageCentipawnLoss =
      countedMoves === 0
        ? null
        : exactLosses.reduce((sum, value) => sum + value, 0) / countedMoves;

    const accuracyMoves = accuracyValues.length;
    const averageAccuracy =
      accuracyMoves === 0 ? null : accuracyValues.reduce((sum, value) => sum + value, 0) / accuracyMoves;

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
      counts: moverCounts,
      averageCentipawnLoss,
    };
  };

  return {
    white: buildPlayer("white"),
    black: buildPlayer("black"),
  };
}
