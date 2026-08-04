export const MIN_RATED_MOVES = 4;

/**
 * Maps an accuracy percentage to a rough Elo-style estimate. This is a
 * presentation heuristic, not a measured rating: 0% maps to 400 and 100%
 * maps to 2600, linearly. Never present the result without the word
 * "estimate".
 */
export function estimateRatingFromAccuracy(
  accuracy: number | null,
  moves: number,
): number | null {
  if (accuracy === null) {
    return null;
  }
  if (!Number.isFinite(accuracy)) {
    throw new RangeError("Accuracy must be a finite number.");
  }
  if (accuracy < 0 || accuracy > 100) {
    throw new RangeError("Accuracy must be between 0 and 100.");
  }
  if (!Number.isFinite(moves) || moves < 0) {
    throw new RangeError("Move count must be a finite non-negative number.");
  }
  if (moves < MIN_RATED_MOVES) {
    return null;
  }
  return Math.round(400 + accuracy * 22);
}
