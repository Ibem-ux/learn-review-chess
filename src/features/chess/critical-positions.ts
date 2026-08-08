import type { ClassifiedMove, MoveClassification } from "./move-classification";

export type CriticalPosition = {
  readonly ply: number;
  readonly fen: string;
  readonly reason: MoveClassification;
};

export const DEFAULT_CRITICAL_POSITION_LIMIT = 16;

const PRIORITY_MAP: Readonly<Record<MoveClassification, number | undefined>> = {
  blunder: 1,
  "missed-win": 2,
  mistake: 3,
  brilliant: 4,
  great: 5,
  inaccuracy: 6,
  best: undefined,
  excellent: undefined,
  good: undefined,
  unclassified: undefined,
};

export function selectCriticalPositions(
  moves: readonly ClassifiedMove[],
  limit: number = DEFAULT_CRITICAL_POSITION_LIMIT
): readonly CriticalPosition[] {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new RangeError("Limit must be an integer greater than zero.");
  }

  type Candidate = {
    readonly move: ClassifiedMove;
    readonly priority: number;
  };

  const candidates: Candidate[] = [];

  for (const move of moves) {
    const priority = PRIORITY_MAP[move.classification];
    if (priority !== undefined) {
      candidates.push({ move, priority });
    }
  }

  candidates.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.move.assessment.ply - b.move.assessment.ply;
  });

  const result: CriticalPosition[] = [];
  const seenFens = new Set<string>();

  for (const candidate of candidates) {
    const fen = candidate.move.assessment.beforeFen;
    if (!seenFens.has(fen)) {
      seenFens.add(fen);
      result.push({
        ply: candidate.move.assessment.ply,
        fen,
        reason: candidate.move.classification,
      });
      if (result.length === limit) {
        break;
      }
    }
  }

  return result;
}
