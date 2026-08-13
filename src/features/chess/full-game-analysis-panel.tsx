"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { EngineAnalysisLimit, EngineScore } from "./engine";
import type { ReviewTimeline } from "./timeline";
import type { UseQuickPassAnalysis } from "./use-quick-pass-analysis";

type FullGameAnalysisPanelProps = {
  readonly timeline: ReviewTimeline;
  readonly currentPly: number;
  readonly limit: EngineAnalysisLimit;
  readonly multiPv?: number;
  readonly analysisState: UseQuickPassAnalysis;
  readonly controlsHost?: HTMLElement | null;
};

function timelineIdentity(timeline: ReviewTimeline): string {
  const steps = timeline.steps
    .map((step) => `${step.ply}:${step.fen}:${step.move?.san ?? ""}`)
    .join("|");
  return `${timeline.initialFen}#${timeline.totalPlies}#${timeline.finalFen}#${timeline.analysisEligible}#${steps}`;
}

function formatScore(score: EngineScore): string {
  if (score.type === "cp") {
    return (score.value / 100).toFixed(2);
  }
  return `M${score.value}`;
}

type DisplayState = {
  readonly status: "idle" | "loading" | "ready" | "running" | "completed" | "cancelled" | "error";
  readonly error: string | null;
  readonly results: readonly QuickPassResult[];
};

const defaultDisplayState: DisplayState = {
  status: "loading",
  error: null,
  results: [],
};

type QuickPassResult = {
  readonly job: { readonly ply: number };
  readonly info: { readonly depth?: number; readonly nodes?: number; readonly timeMs?: number; readonly score?: EngineScore; readonly pv?: readonly string[] } | null;
  readonly bestMove: { readonly move: string | null; readonly ponder: string | null } | null;
  readonly candidateLines: readonly { readonly rank: number; readonly info: { readonly depth?: number; readonly score?: EngineScore; readonly nodes?: number; readonly timeMs?: number; readonly pv?: readonly string[] } }[];
};

function CurrentPlyResult({
  currentResult,
  currentPly,
}: {
  readonly currentResult: QuickPassResult;
  readonly currentPly: number;
}) {
  const info = currentResult.info;
  const bestMove = currentResult.bestMove;
  const candidateLines = currentResult.candidateLines;

  return (
    <div data-testid="current-ply-result" className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
      <div>
        <span className="font-medium">Ply:</span> {currentPly}
      </div>

      {info && (
        <div className="space-y-1">
          {info.depth !== undefined && (
            <div>
              <span className="font-medium">Depth:</span> {info.depth}
            </div>
          )}
          {info.nodes !== undefined && (
            <div>
              <span className="font-medium">Nodes:</span>{" "}
              {info.nodes.toLocaleString()}
            </div>
          )}
          {info.timeMs !== undefined && (
            <div>
              <span className="font-medium">Time:</span>{" "}
              {info.timeMs}ms
            </div>
          )}
          {info.score && (
            <div>
              <span className="font-medium">Score:</span>{" "}
              {formatScore(info.score)}
            </div>
          )}
          {info.pv && info.pv.length > 0 && (
            <div>
              <span className="font-medium">Engine line:</span>{" "}
              {info.pv.join(" ")}
            </div>
          )}
        </div>
      )}

      {bestMove && (bestMove.move || bestMove.ponder) && (
        <div>
          <span className="font-medium">Best move:</span>{" "}
          {bestMove.move}
          {bestMove.ponder && (
            <> (ponder: {bestMove.ponder})</>
          )}
        </div>
      )}

      {candidateLines.length > 0 && (
        <div className="space-y-1">
          <span className="font-medium">Candidate lines:</span>
          {candidateLines
            .slice()
            .sort((a, b) => a.rank - b.rank)
            .map((line, index) => (
              <div key={index} className="ml-2">
                <span className="font-medium">Rank {line.rank}:</span>
                {line.info.score && (
                  <span> Score: {formatScore(line.info.score)}</span>
                )}
                {line.info.depth !== undefined && (
                  <span> Depth: {line.info.depth}</span>
                )}
                {line.info.nodes !== undefined && (
                  <span> Nodes: {line.info.nodes.toLocaleString()}</span>
                )}
                {line.info.timeMs !== undefined && (
                  <span> Time: {line.info.timeMs}ms</span>
                )}
                {line.info.pv && line.info.pv.length > 0 && (
                  <div>Engine line: {line.info.pv.join(" ")}</div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function FullGameAnalysisPanelEligible({
  timeline,
  currentPly,
  limit,
  multiPv,
  analysisState,
  controlsHost,
}: {
  readonly timeline: ReviewTimeline;
  readonly currentPly: number;
  readonly limit: EngineAnalysisLimit;
  readonly multiPv: number;
  readonly analysisState: UseQuickPassAnalysis;
  readonly controlsHost?: HTMLElement | null;
}) {
  const {
    status,
    error,
    totalJobs,
    completedJobs,
    currentJobId,
    results,
    start,
    cancel,
  } = analysisState;

  const startedTimelineRef = useRef<string | null>(null);
  const [displayState, setDisplayState] = useState<DisplayState>(defaultDisplayState);

  const timelineId = timelineIdentity(timeline);

  useEffect(() => {
    if (startedTimelineRef.current === timelineId) {
      setDisplayState({ status, error, results });
    } else {
      const effectiveStatus =
        status === "running" ||
        status === "completed" ||
        status === "cancelled"
          ? "ready"
          : status;
      setDisplayState((prev) => ({
        status: effectiveStatus,
        error: status === "error" ? error : prev.error,
        results: [],
      }));
    }
  }, [status, error, results, timelineId]);

  useEffect(() => {
    if (startedTimelineRef.current === null) return;
    if (startedTimelineRef.current !== timelineId) {
      if (status === "running") {
        cancel();
      }
      startedTimelineRef.current = null;
    }
  }, [timelineId, status, cancel]);

  const handleStart = useCallback(() => {
    const accepted = start(timeline, limit, multiPv);
    if (accepted) {
      startedTimelineRef.current = timelineId;
      setDisplayState({ status: "loading", error: null, results: [] });
    }
  }, [start, timeline, limit, multiPv, timelineId]);

  const handleCancel = useCallback(() => {
    cancel();
  }, [cancel]);

  const isRunning = displayState.status === "running";
  const canStart = !isRunning && displayState.status !== "loading";

  const analysisControls = (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={handleStart}
        disabled={!canStart}
        aria-busy={!canStart}
        className="rounded-md border border-black/[.12] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
      >
        Analyze full game
      </button>

      {isRunning && (
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-md border border-black/[.12] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
        >
          Cancel
        </button>
      )}
    </div>
  );

  const currentResult = displayState.results.find(
    (result) => result.job.ply === currentPly
  );

  const progressText = isRunning
    ? `Analyzing position ${currentJobId ?? "..."} (${completedJobs}/${totalJobs})`
    : displayState.status === "completed"
      ? "Analysis complete."
      : displayState.status === "cancelled"
        ? "Analysis cancelled."
        : displayState.status === "error"
          ? displayState.error ?? "Analysis error."
          : displayState.status === "loading"
            ? "Loading engine..."
            : "Ready to analyze.";

  const progressPercent =
    totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

  return (
    <section aria-label="Full-game analysis" className="mt-4 space-y-3">
      {isRunning && totalJobs > 0 && (
        <div
          role="progressbar"
          aria-label="Full-game analysis progress"
          aria-valuenow={completedJobs}
          aria-valuemin={0}
          aria-valuemax={totalJobs}
          className="h-2 w-full overflow-hidden rounded-full bg-black/[.06] dark:bg-white/[.08]"
        >
          <div
            className="h-full bg-black dark:bg-zinc-50"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
      <div role="status" aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-400">
        {progressText}
      </div>

      {controlsHost ? createPortal(analysisControls, controlsHost) : analysisControls}

      {currentResult && (
        <CurrentPlyResult currentResult={currentResult} currentPly={currentPly} />
      )}

      {!currentResult && displayState.status !== "loading" && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Position not yet analyzed.
        </p>
      )}
    </section>
  );
}

export default function FullGameAnalysisPanel({
  timeline,
  currentPly,
  limit,
  multiPv = 3,
  analysisState,
  controlsHost,
}: FullGameAnalysisPanelProps) {
  if (!timeline.analysisEligible) {
    return (
      <p
        role="status"
        aria-live="polite"
        className="mt-4 text-sm text-zinc-600 dark:text-zinc-400"
      >
        Full-game analysis is available only for completed games.
      </p>
    );
  }

  return (
    <FullGameAnalysisPanelEligible
      timeline={timeline}
      currentPly={currentPly}
      limit={limit}
      multiPv={multiPv}
      analysisState={analysisState}
      controlsHost={controlsHost}
    />
  );
}
