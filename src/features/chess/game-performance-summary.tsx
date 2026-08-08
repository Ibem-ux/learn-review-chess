"use client";

import type { GamePerformance, PlayerPerformance } from "./game-performance";
import type { GamePhase } from "./game-phase";
import { MOVE_CLASSIFICATION_ORDER } from "./move-classification";
import { ClassificationIcon } from "./classification-icon";
import { estimateRatingFromAccuracy } from "./rating-estimate";
import { CLASSIFICATION_LABELS } from "./classification-presentation";

const PHASES: readonly GamePhase[] = ["opening", "middlegame", "endgame"];

const PHASE_LABELS: Record<GamePhase, string> = {
  opening: "Opening",
  middlegame: "Middlegame",
  endgame: "Endgame",
};

function PlayerBlock({
  title,
  testId,
  player,
}: {
  title: string;
  testId: string;
  player: PlayerPerformance;
}): React.ReactElement {
  const ratingEstimate = estimateRatingFromAccuracy(
    player.averageAccuracy,
    player.accuracyMoves
  );

  return (
    <div
      data-testid={testId}
      className="flex flex-col gap-3 rounded-lg border border-black/[.12] p-4 text-black dark:border-white/[.2] dark:text-zinc-50"
    >
      <h3 className="text-lg font-bold">{title}</h3>

      <div className="flex flex-col gap-1 text-sm">
        <div>
          <span className="font-semibold">Accuracy: </span>
          {player.averageAccuracy !== null
            ? `${player.averageAccuracy.toFixed(1)}%`
            : "Not enough data."}
        </div>

        <div>
          <span className="font-semibold">Estimated rating: </span>
          {ratingEstimate !== null
            ? `${ratingEstimate} (estimate)`
            : "Not enough data."}
        </div>

        <div>
          <span className="font-semibold">Avg centipawn loss: </span>
          {player.averageCentipawnLoss !== null
            ? Math.round(player.averageCentipawnLoss)
            : "Not enough data."}
        </div>
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">Phases:</span>
        <ul className="flex flex-col gap-0.5 pl-2">
          {PHASES.map((phase) => {
            const acc = player.phaseAccuracy[phase];
            return (
              <li key={phase}>
                <span>{PHASE_LABELS[phase]}: </span>
                {acc !== null ? `${acc.toFixed(1)}%` : "Not enough data."}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">Classifications:</span>
        <ul className="flex flex-col gap-1">
          {MOVE_CLASSIFICATION_ORDER.map((classification) => {
            const count = player.counts[classification];
            if (count <= 0) {
              return null;
            }
            return (
              <li
                key={classification}
                data-testid="count-row"
                className="flex items-center gap-2"
              >
                <ClassificationIcon classification={classification} />
                <span className="sr-only">{CLASSIFICATION_LABELS[classification]}</span>
                <span className="font-mono text-xs">({count})</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function GamePerformanceSummary({
  performance,
}: {
  performance: GamePerformance | null;
}): React.ReactElement {
  if (performance === null) {
    return (
      <div className="rounded-lg border border-black/[.12] p-4 text-sm text-black dark:border-white/[.2] dark:text-zinc-50">
        Run a full-game analysis to see game performance summary.
      </div>
    );
  }

  return (
    <section
      aria-label="Game performance"
      className="flex flex-col gap-4 max-w-2xl"
    >
      <PlayerBlock
        title="White"
        testId="performance-white"
        player={performance.white}
      />
      <PlayerBlock
        title="Black"
        testId="performance-black"
        player={performance.black}
      />
    </section>
  );
}
