import type { PgnMove, PgnParsed } from "@/features/chess/pgn";

export type TimelinePly = {
  readonly ply: number;
  readonly fen: string;
  readonly move: PgnMove | null;
};

export type ReviewTimeline = {
  readonly steps: readonly TimelinePly[];
  readonly totalPlies: number;
  readonly initialFen: string;
  readonly finalFen: string;
};

export type TimelineStepSuccess = {
  ok: true;
  step: TimelinePly;
};

export type TimelineStepFailure = {
  ok: false;
  reason: string;
};

export type TimelineStepResult = TimelineStepSuccess | TimelineStepFailure;

export function buildTimeline(parsed: PgnParsed): ReviewTimeline {
  const initialFen = parsed.moves[0]?.before ?? parsed.finalFen;

  const steps: TimelinePly[] = [
    { ply: 0, fen: initialFen, move: null },
  ];

  for (let i = 0; i < parsed.moves.length; i += 1) {
    const move = parsed.moves[i];
    steps.push({ ply: i + 1, fen: move.after, move });
  }

  return {
    steps,
    totalPlies: parsed.moves.length,
    initialFen,
    finalFen: parsed.finalFen,
  };
}

export function getTimelineStep(
  timeline: ReviewTimeline,
  ply: number
): TimelineStepResult {
  if (!Number.isInteger(ply)) {
    return { ok: false, reason: "Ply must be an integer." };
  }
  if (ply < 0) {
    return { ok: false, reason: "Ply cannot be negative." };
  }
  if (ply > timeline.totalPlies) {
    return { ok: false, reason: "Ply is beyond the final position." };
  }
  return { ok: true, step: timeline.steps[ply] };
}
