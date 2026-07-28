"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EngineAnalysisLimit, EngineScore } from "./engine";
import { useEngineAnalysis } from "./use-engine-analysis";

type AnalysisPanelProps = {
  readonly fen: string;
  readonly analysisEligible: boolean;
  readonly limit: EngineAnalysisLimit;
};

type ActiveRequest = {
  readonly requestId: string;
  readonly fen: string;
};

function formatScore(score: EngineScore): string {
  if (score.type === "cp") {
    return (score.value / 100).toFixed(2);
  }
  return `M${score.value}`;
}

function AnalysisPanelEligible({
  fen,
  limit,
}: {
  readonly fen: string;
  readonly limit: EngineAnalysisLimit;
}) {
  const {
    status,
    error,
    lastInfo,
    lastInfoRequestId,
    bestMove,
    bestMoveRequestId,
    analyze,
    stop,
  } = useEngineAnalysis();

  const [activeRequest, setActiveRequest] = useState<ActiveRequest | null>(null);
  const activeRequestRef = useRef<ActiveRequest | null>(null);
  const previousCommittedFenRef = useRef(fen);

  useEffect(() => {
    if (previousCommittedFenRef.current === fen) {
      return;
    }
    previousCommittedFenRef.current = fen;
    if (activeRequestRef.current !== null) {
      stop();
      activeRequestRef.current = null;
      setActiveRequest(null);
    }
  }, [fen, stop]);

  const infoForDisplay =
    activeRequest !== null &&
    activeRequest.fen === fen &&
    lastInfoRequestId === activeRequest.requestId
      ? lastInfo
      : null;

  const scoreText = infoForDisplay?.score ? formatScore(infoForDisplay.score) : null;

  const bestMoveForDisplay =
    activeRequest !== null &&
    activeRequest.fen === fen &&
    bestMoveRequestId === activeRequest.requestId
      ? bestMove
      : null;

  const analyzeFn = useCallback(() => {
    const requestId = analyze(fen, limit);
    if (requestId !== null) {
      const newRequest = { requestId, fen };
      activeRequestRef.current = newRequest;
      setActiveRequest(newRequest);
    }
  }, [analyze, fen, limit]);

  return (
    <section
      aria-label="Position analysis"
      className="mt-4 rounded-lg border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-black"
    >
      <h3 className="text-sm font-semibold text-black dark:text-zinc-50">
        Position analysis
      </h3>

      <div
        role="status"
        aria-live="polite"
        className="mt-2 text-sm text-zinc-600 dark:text-zinc-400"
      >
        {status === "loading" && "Loading engine…"}
        {status === "analyzing" && "Analyzing position…"}
        {status === "error" && error}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={analyzeFn}
          disabled={status === "loading" || status === "analyzing"}
          className="rounded-md border border-black/[.12] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
        >
          Analyze position
        </button>

        {status === "analyzing" && (
          <button
            type="button"
            onClick={stop}
            className="rounded-md border border-black/[.12] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
          >
            Stop
          </button>
        )}
      </div>

      <div
        data-testid="analysis-results"
        className="mt-4 space-y-2 text-sm text-zinc-700 dark:text-zinc-300"
      >
        {infoForDisplay && (
          <div className="space-y-1">
            {infoForDisplay.depth !== undefined && (
              <div>
                <span className="font-medium">Depth:</span> {infoForDisplay.depth}
              </div>
            )}
            {infoForDisplay.nodes !== undefined && (
              <div>
                <span className="font-medium">Nodes:</span>{" "}
                {infoForDisplay.nodes.toLocaleString()}
              </div>
            )}
            {infoForDisplay.timeMs !== undefined && (
              <div>
                <span className="font-medium">Time:</span> {infoForDisplay.timeMs}ms
              </div>
            )}
            {scoreText && (
              <div>
                <span className="font-medium">Score:</span> {scoreText}
              </div>
            )}
            {infoForDisplay.pv && infoForDisplay.pv.length > 0 && (
              <div>
                <span className="font-medium">PV:</span> {infoForDisplay.pv.join(" ")}
              </div>
            )}
          </div>
        )}

        {bestMoveForDisplay && (bestMoveForDisplay.move || bestMoveForDisplay.ponder) && (
          <div>
            <span className="font-medium">Best move:</span> {bestMoveForDisplay.move}
            {bestMoveForDisplay.ponder && <> (ponder: {bestMoveForDisplay.ponder})</>}
          </div>
        )}
      </div>
    </section>
  );
}

export default function AnalysisPanel({
  fen,
  analysisEligible,
  limit,
}: AnalysisPanelProps) {
  if (!analysisEligible) {
    return (
      <p
        role="status"
        aria-live="polite"
        className="mt-4 text-sm text-zinc-600 dark:text-zinc-400"
      >
        Analysis is available only for completed games.
      </p>
    );
  }

  return <AnalysisPanelEligible fen={fen} limit={limit} />;
}
