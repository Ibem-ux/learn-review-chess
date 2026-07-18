"use client";

import { useState } from "react";
import { Chessboard } from "react-chessboard";
import { getTimelineStep, type ReviewTimeline } from "@/features/chess/timeline";

function isDisabled(ply: number, total: number): {
  atStart: boolean;
  atEnd: boolean;
} {
  return { atStart: ply <= 0, atEnd: ply >= total };
}

function timelineIdentity(timeline: ReviewTimeline): string {
  const steps = timeline.steps
    .map((step) => `${step.ply}:${step.fen}:${step.move?.san ?? ""}`)
    .join("|");
  return `${timeline.initialFen}#${timeline.totalPlies}#${steps}`;
}

export default function ReviewBoard({
  timeline,
}: {
  timeline: ReviewTimeline;
}) {
  const [ply, setPly] = useState(0);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [lastIdentity, setLastIdentity] = useState(() =>
    timelineIdentity(timeline)
  );
  const identity = timelineIdentity(timeline);
  if (identity !== lastIdentity) {
    setLastIdentity(identity);
    setPly(0);
  }
  const result = getTimelineStep(timeline, ply);
  const fen = result.ok ? result.step.fen : timeline.initialFen;
  const currentMove = result.ok ? result.step.move : null;

  const { atStart, atEnd } = isDisabled(ply, timeline.totalPlies);

  const goTo = (next: number) => {
    const step = getTimelineStep(timeline, next);
    if (step.ok) setPly(next);
  };

  const handleStart = () => goTo(0);
  const handlePrevious = () => goTo(ply - 1);
  const handleNext = () => goTo(ply + 1);
  const handleEnd = () => goTo(timeline.totalPlies);
  const handleFlip = () =>
    setOrientation((current) => (current === "white" ? "black" : "white"));

  const statusText =
    ply === 0
      ? "Start position"
      : currentMove
        ? currentMove.san
        : "Position";

  return (
    <div className="flex flex-col gap-4">
      <div
        role="status"
        aria-live="polite"
        className="text-sm font-medium text-black dark:text-zinc-50"
      >
        <span data-testid="review-ply-status">
          {ply === 0 ? "Start position" : statusText}
        </span>{" "}
        <span data-testid="review-ply-count">
          ({ply} / {timeline.totalPlies})
        </span>
      </div>

      <div
        role="group"
        aria-label="Timeline navigation"
        className="flex flex-wrap gap-2"
      >
        <button
          type="button"
          onClick={handleStart}
          disabled={atStart}
          className="rounded-md border border-black/[.12] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
        >
          Start
        </button>
        <button
          type="button"
          onClick={handlePrevious}
          disabled={atStart}
          className="rounded-md border border-black/[.12] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={atEnd}
          className="rounded-md border border-black/[.12] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
        >
          Next
        </button>
        <button
          type="button"
          onClick={handleEnd}
          disabled={atEnd}
          className="rounded-md border border-black/[.12] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
        >
          End
        </button>
        <button
          type="button"
          onClick={handleFlip}
          className="rounded-md border border-black/[.12] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
        >
          Flip board
        </button>
      </div>

      <div className="aspect-square w-full max-w-2xl overflow-hidden rounded-lg border border-black/[.15] dark:border-white/[.2]">
        <Chessboard
          options={{
            id: "review",
            position: fen,
            boardOrientation: orientation,
            allowDragging: false,
            animationDurationInMs: 150,
          }}
        />
      </div>
    </div>
  );
}
