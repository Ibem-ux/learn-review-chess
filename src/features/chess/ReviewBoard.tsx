"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Chessboard, type PieceDropHandlerArgs } from "react-chessboard";
import { getTimelineStep, type ReviewTimeline } from "@/features/chess/timeline";
import { useQuickPassAnalysis } from "@/features/chess/use-quick-pass-analysis";
import { ARROW_COLORS } from "@/features/chess/engine-arrows";
import { usePositionAnalysis } from "./use-position-analysis";
import { buildAnalysisCache } from "./analysis-cache";
import FullGameAnalysisPanel from "@/features/chess/full-game-analysis-panel";
import { MoveList } from "@/features/chess/move-list";
import { buildMoveAssessments } from "@/features/chess/move-assessment";
import { classifyMoves, type MoveClassification } from "@/features/chess/move-classification";
import type { EngineAnalysisLimit } from "@/features/chess/engine";
import type { QuickPassCompletedJob } from "@/features/chess/quick-pass-runner";
import { selectCriticalPositions, type CriticalPosition } from "./critical-positions";
import { buildQuickPassEvaluationSeries } from "./quick-pass-evaluation";
import { buildEvaluationGraphPoints } from "./evaluation-graph-model";
import { EvaluationBar } from "./evaluation-bar";
import { EvaluationGraph } from "./evaluation-graph";
import {
  type ExplorerStack,
  createExplorerStack,
  pushExplorerPosition,
  popExplorerPosition,
  currentExplorerFen,
} from "./explorer-position-stack";
import { ExplorerPanel } from "./explorer-panel";
import { applyExplorerMove } from "./explorer-move";
import { buildGamePerformance, type GamePerformance } from "./game-performance";
import { GamePerformanceSummary } from "./game-performance-summary";
import { buildMoveExplanations } from "./move-explanation";
import { MoveExplanationPanel } from "./move-explanation-panel";

const FULL_GAME_ANALYSIS_LIMIT: EngineAnalysisLimit = { kind: "depth", value: 10 };
const DEEP_PASS_LIMIT: EngineAnalysisLimit = { kind: "depth", value: 18 };

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

export function buildClassificationMap(
  timeline: ReviewTimeline,
  results: readonly QuickPassCompletedJob[],
): ReadonlyMap<number, MoveClassification> {
  if (results.length === 0) {
    return new Map<number, MoveClassification>();
  }
  const assessmentResult = buildMoveAssessments(timeline, results);
  if (!assessmentResult.ok) {
    return new Map<number, MoveClassification>();
  }
  return classifyMoves(assessmentResult.assessments)
    .filter((classified) => classified.classification !== "unclassified")
    .reduce((map, classified) => {
      map.set(classified.assessment.ply, classified.classification);
      return map;
    }, new Map<number, MoveClassification>());
}

export function buildPerformance(
  timeline: ReviewTimeline,
  results: readonly QuickPassCompletedJob[],
): GamePerformance | null {
  if (results.length === 0) {
    return null;
  }
  const assessmentResult = buildMoveAssessments(timeline, results);
  if (!assessmentResult.ok) {
    return null;
  }
  return buildGamePerformance(classifyMoves(assessmentResult.assessments));
}

export default function ReviewBoard({
  timeline,
}: {
  timeline: ReviewTimeline;
}) {
  const [ply, setPly] = useState(0);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [controlsHost, setControlsHost] = useState<HTMLDivElement | null>(null);
  const [explorer, setExplorer] = useState<ExplorerStack | null>(null);
  const [criticalSelection, setCriticalSelection] = useState<readonly CriticalPosition[] | null>(null);
  const setControlsHostRef = useCallback((node: HTMLDivElement | null) => {
    setControlsHost(node);
  }, []);
  const [lastIdentity, setLastIdentity] = useState(() =>
    timelineIdentity(timeline)
  );
  const identity = timelineIdentity(timeline);
  if (identity !== lastIdentity) {
    setLastIdentity(identity);
    setPly(0);
    setCriticalSelection(null);
  }
  const analysisState = useQuickPassAnalysis();

  const classifications = useMemo(
    () => buildClassificationMap(timeline, analysisState.results),
    [timeline, analysisState.results]
  );

  const performance = useMemo(
    () => buildPerformance(timeline, analysisState.results),
    [timeline, analysisState.results]
  );

  const classifiedMoves = useMemo(() => {
    const res = buildMoveAssessments(timeline, analysisState.results);
    return res.ok ? classifyMoves(res.assessments) : [];
  }, [timeline, analysisState.results]);

  if (analysisState.status === "completed" && criticalSelection === null) {
    setCriticalSelection(selectCriticalPositions(classifiedMoves));
  }

  const graphPoints = useMemo(() => {
    const series = buildQuickPassEvaluationSeries(timeline, analysisState.results);
    if (series.ok) {
      return buildEvaluationGraphPoints(series.points, timeline);
    }
    return [];
  }, [timeline, analysisState.results]);

  const analysisCache = useMemo(
    () => buildAnalysisCache(analysisState.results),
    [analysisState.results]
  );

  const moveExplanations = useMemo(() => {
    const res = buildMoveAssessments(timeline, analysisState.results);
    return res.ok ? buildMoveExplanations(res.assessments) : [];
  }, [timeline, analysisState.results]);

  const explanation =
    moveExplanations.find((e) => e.ply === ply) ?? null;

  const currentGraphPoint = useMemo(() => {
    return graphPoints.find((point) => point.ply === ply) ?? null;
  }, [graphPoints, ply]);

  const result = getTimelineStep(timeline, ply);
  const fen = result.ok ? result.step.fen : timeline.initialFen;
  const displayedFen = explorer !== null ? currentExplorerFen(explorer) : fen;
  const positionAnalysis = usePositionAnalysis({
    fen: displayedFen,
    cache: analysisCache,
    enabled: analysisState.status !== "running" && analysisState.results.length > 0,
    ply,
  });
  const currentMove = result.ok ? result.step.move : null;

  const { atStart, atEnd } = isDisabled(ply, timeline.totalPlies);

  const handlePieceDrop = useCallback(
    (args: PieceDropHandlerArgs) => {
      const { sourceSquare, targetSquare } = args;
      if (sourceSquare === null || targetSquare === null) {
        return false;
      }
      const currentFen = explorer !== null ? currentExplorerFen(explorer) : fen;
      const result = applyExplorerMove(currentFen, {
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });
      if (!result.ok) {
        return false;
      }
      if (explorer === null) {
        setExplorer(
          pushExplorerPosition(createExplorerStack({ ply, fen }), {
            fen: result.fen,
            san: result.san,
          })
        );
      } else {
        setExplorer(
          pushExplorerPosition(explorer, { fen: result.fen, san: result.san })
        );
      }
      return true;
    },
    [explorer, fen, ply]
  );

  const goTo = (next: number) => {
    const step = getTimelineStep(timeline, next);
    if (step.ok) {
      setPly(next);
      setExplorer(null);
    }
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

      <MoveList timeline={timeline} currentPly={ply} onSelectPly={goTo} classifications={classifications} />

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
        <div
          className="contents"
          data-testid="analysis-controls-host"
          ref={setControlsHostRef}
        />
      </div>

      <div className="flex w-full max-w-2xl items-stretch gap-3">
        <div
          className="aspect-square w-full max-w-2xl overflow-hidden rounded-lg border border-black/[.15] dark:border-white/[.2]"
        >
          <section aria-label="Review chessboard" className="h-full w-full">
             <Chessboard
              options={{
                id: "review",
                position: displayedFen,
                boardOrientation: orientation,
                allowDragging: true,
                onPieceDrop: handlePieceDrop,
                arrows: [...positionAnalysis.arrows],
                clearArrowsOnPositionChange: true,
                animationDurationInMs: 150,
              }}
            />
          </section>
        </div>
        <EvaluationBar point={currentGraphPoint} orientation={orientation} />
      </div>

      {positionAnalysis.arrows.length > 0 && (
        <div
          data-testid="arrow-legend"
          aria-label="Engine suggestion legend"
          className="flex flex-wrap gap-3 text-sm font-medium text-black dark:text-zinc-50"
        >
          {positionAnalysis.arrows.slice(0, 3).map((arrow, index) => {
            const label =
              index === 0
                ? "Best"
                : index === 1
                  ? "2nd best"
                  : "3rd best";
            const swatchColor =
              index === 0
                ? ARROW_COLORS.first
                : index === 1
                  ? ARROW_COLORS.second
                  : ARROW_COLORS.third;

            return (
              <div
                key={index}
                data-testid="arrow-legend-item"
                className="flex items-center gap-2"
              >
                <span
                  aria-hidden
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ backgroundColor: swatchColor }}
                />
                {label}
              </div>
            );
          })}
        </div>
      )}

      <ExplorerPanel
        stack={explorer ?? createExplorerStack({ ply, fen })}
        onBack={() =>
          setExplorer((prev) =>
            prev === null ? null : popExplorerPosition(prev)
          )
        }
        onReset={() => setExplorer(null)}
      />

      <div className="w-full max-w-2xl">
        <EvaluationGraph points={graphPoints} currentPly={ply} onSelectPly={goTo} />
      </div>
      <div className="w-full max-w-2xl space-y-3">
        {criticalSelection !== null && criticalSelection.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (criticalSelection) {
                analysisState.startCriticalPass(criticalSelection, DEEP_PASS_LIMIT, 3);
              }
            }}
            disabled={analysisState.status === "running"}
            className="rounded-md border border-black/[.12] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
          >
            Analyze critical moments
          </button>
        )}
        <FullGameAnalysisPanel
          timeline={timeline}
          currentPly={ply}
          limit={FULL_GAME_ANALYSIS_LIMIT}
          multiPv={3}
          analysisState={analysisState}
          controlsHost={controlsHost}
        />
      </div>
      <div className="w-full max-w-2xl">
        <GamePerformanceSummary performance={performance} />
      </div>
      <div className="w-full max-w-2xl">
        <MoveExplanationPanel explanation={explanation} />
      </div>
    </div>
  );
}
