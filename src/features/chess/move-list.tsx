import type { ReviewTimeline } from "./timeline";
import type { MoveClassification } from "./move-classification";
import { ClassificationIcon } from "./classification-icon";

const LABELS: Record<MoveClassification, string> = {
  brilliant: "Brilliant move",
  great: "Great move",
  best: "Best move",
  excellent: "Excellent move",
  good: "Good move",
  "missed-win": "Missed Win",
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder",
  unclassified: "Unclassified",
};

export type MoveListProps = {
  readonly timeline: ReviewTimeline;
  readonly currentPly: number;
  readonly onSelectPly: (ply: number) => void;
  readonly classifications?: ReadonlyMap<number, MoveClassification>;
};

export function MoveList({
  timeline,
  currentPly,
  onSelectPly,
  classifications,
}: MoveListProps): React.ReactElement | null {
  const moves: { readonly ply: number; readonly label: string; readonly isCurrent: boolean }[] = [];

  for (const step of timeline.steps) {
    if (step.move === null) {
      continue;
    }
    const moveNumber = Math.floor((step.ply - 1) / 2) + 1;
    const isWhite = step.ply % 2 === 1;
    const label = `${moveNumber}${isWhite ? "." : "..."} ${step.move.san}`;
    moves.push({
      ply: step.ply,
      label,
      isCurrent: step.ply === currentPly,
    });
  }

  if (moves.length === 0) {
    return null;
  }

  return (
    <ol className="flex flex-wrap gap-2" aria-label="Move list">
      {moves.map(({ ply, label, isCurrent }) => (
        <li key={ply}>
          <button
            type="button"
            data-ply={ply}
            aria-current={isCurrent ? "true" : undefined}
            onClick={() => onSelectPly(ply)}
            className={`inline-flex items-center rounded px-1.5 py-0.5 text-sm transition-colors ${
              isCurrent
                ? "bg-black font-medium text-white dark:bg-white dark:text-black"
                : "text-black hover:bg-black/[.06] dark:text-zinc-50 dark:hover:bg-white/[.08]"
            }`}
          >
            {label}
          {(() => {
            const classification = classifications?.get(ply);
            if (!classification) return null;
            return (
              <>
                <ClassificationIcon classification={classification} />
                <span className="sr-only">{LABELS[classification]}</span>
              </>
            );
          })()}
          </button>
        </li>
      ))}
    </ol>
  );
}
