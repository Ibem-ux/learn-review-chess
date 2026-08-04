// Lichess-published accuracy formulas; the values are a model
// estimate, not ground truth.

/** Win probability 0..100 for a centipawn score. */
export function winPercentFromCentipawns(cp: number): number {
  if (!Number.isFinite(cp)) {
    throw new RangeError("Centipawn score must be finite.");
  }

  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** Win probability 0..100 for a mate score.
 *
 * A mate distance of 0 returns 0, taking the losing branch deliberately,
 * matching evaluation-graph-model.
 */
export function winPercentFromMate(movesToMate: number): number {
  if (!Number.isFinite(movesToMate)) {
    throw new RangeError("Mate distance must be finite.");
  }

  if (movesToMate > 0) {
    return 100;
  }

  return 0;
}

/** Accuracy 0..100 for one move. */
export function moveAccuracyPercent(
  winPercentBefore: number,
  winPercentAfter: number,
): number {
  if (!Number.isFinite(winPercentBefore) || !Number.isFinite(winPercentAfter)) {
    throw new RangeError("Win percentages must be finite.");
  }

  const raw = 103.1668 * Math.exp(-0.04354 * (winPercentBefore - winPercentAfter)) - 3.1669;
  return Math.max(0, Math.min(100, raw));
}
