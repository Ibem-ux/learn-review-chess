"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { EngineInfo, EngineWorkerEvent } from "./engine";
import { EngineController } from "./engine-controller";
import { createStockfishWorkerFactory } from "./engine-worker-factory";
import { acquireEngine, releaseEngine } from "./engine-ownership";
import type { AnalysisCache, CachedAnalysis } from "./analysis-cache";
import type { GraphPoint } from "./evaluation-graph-model";
import type { EngineArrow } from "./engine-arrows";
import { cachedAnalysisToGraphPoint } from "./position-evaluation";
import { buildEngineArrows } from "./engine-arrows";
import { normalizeScore, parseSideToMove } from "./quick-pass-evaluation";

let positionAnalysisOwnerCounter = 0;

type PositionAnalysisState = {
  point: GraphPoint | null;
  arrows: readonly EngineArrow[];
  isAnalyzing: boolean;
};

const initialState: PositionAnalysisState = {
  point: null,
  arrows: [],
  isAnalyzing: false,
};

export type UsePositionAnalysis = {
  readonly point: GraphPoint | null;
  readonly arrows: readonly EngineArrow[];
  readonly isAnalyzing: boolean;
};

export function usePositionAnalysis(args: {
  fen: string | null;
  cache: AnalysisCache;
  enabled: boolean;
  ply: number;
  debounceMs?: number;
}): UsePositionAnalysis {
  const { fen, cache, enabled, ply, debounceMs = 300 } = args;

  const controllerRef = useRef<EngineController | null>(null);
  const ownerIdRef = useRef<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);

  const [state, setState] = useState<PositionAnalysisState>(initialState);

  const linesByMultipvRef = useRef<Map<number, EngineInfo>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFenRef = useRef<string | null>(null);
  const currentRequestIdRef = useRef<string | null>(null);
  const pendingAnalysisRef = useRef<{ fen: string } | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const setSafeState = useCallback(
    (updater: (prev: PositionAnalysisState) => PositionAnalysisState) => {
      if (mountedRef.current) {
        setState(updater);
      }
    },
    []
  );

  const dispatchAnalysis = useCallback(
    (fenToAnalyze: string) => {
      const controller = controllerRef.current;
      if (!controller || controller.status !== "ready") {
        pendingAnalysisRef.current = { fen: fenToAnalyze };
        return;
      }

      const requestId = `req-${Date.now()}-${Math.random()}`;
      currentRequestIdRef.current = requestId;
      pendingFenRef.current = fenToAnalyze;
      linesByMultipvRef.current = new Map();
      setSafeState(() => ({ point: null, arrows: [], isAnalyzing: true }));
      controller.analyze(requestId, {
        fen: fenToAnalyze,
        limit: { kind: "depth", value: 10 },
        multiPv: 3,
      });
    },
    [setSafeState]
  );

  const handleEvent = useCallback(
    (event: EngineWorkerEvent) => {
      if (!mountedRef.current) {
        return;
      }

      if (
        event.type === "analysis-info" ||
        event.type === "best-move" ||
        event.type === "stopped" ||
        event.type === "error"
      ) {
        if (event.requestId !== currentRequestIdRef.current) {
          return;
        }
      }

      switch (event.type) {
        case "analysis-info": {
          const multipv = event.info.multipv ?? 1;
          const newMap = new Map(linesByMultipvRef.current);
          newMap.set(multipv, event.info);
          linesByMultipvRef.current = newMap;
          break;
        }
        case "best-move":
        case "stopped": {
          const fen = pendingFenRef.current;
          if (!fen) {
            break;
          }

          const entries = Array.from(linesByMultipvRef.current.entries());
          const sortedLines = entries
            .sort(([a], [b]) => a - b)
            .map(([multipv, info]) => ({
              rank: multipv,
              moves: info.pv ?? [],
              score: info.score ?? null,
            }));

          if (sortedLines.length === 0) {
            setSafeState((prev) => ({ ...prev, isAnalyzing: false }));
            break;
          }

          const bestInfo = linesByMultipvRef.current.get(1);
          const sideToMove = parseSideToMove(fen) ?? "w";
          const rawScore = sortedLines[0]?.score ?? null;
          const normalizedScore =
            rawScore !== null ? normalizeScore(rawScore, sideToMove) : null;
          const cachedAnalysis: CachedAnalysis = {
            fen,
            score: normalizedScore,
            depth: bestInfo?.depth ?? null,
            lines: sortedLines,
          };

          const newPoint = cachedAnalysisToGraphPoint(cachedAnalysis, 0);
          const newArrows = buildEngineArrows(cachedAnalysis);
          setSafeState(() => ({ point: newPoint, arrows: newArrows, isAnalyzing: false }));
          break;
        }
        case "error": {
          pendingAnalysisRef.current = null;
          setSafeState((prev) => ({ ...prev, isAnalyzing: false }));
          break;
        }
        case "ready": {
          if (pendingAnalysisRef.current !== null) {
            const { fen } = pendingAnalysisRef.current;
            pendingAnalysisRef.current = null;
            dispatchAnalysis(fen);
          }
          break;
        }
      }
    },
    [setSafeState, dispatchAnalysis]
  );

  const ensureEngine = useCallback(() => {
    if (controllerRef.current !== null) {
      return;
    }

    const ownerId = `position-analysis-${positionAnalysisOwnerCounter++}`;
    ownerIdRef.current = ownerId;
    acquireEngine({
      id: ownerId,
      onRevoked: () => {
        try {
          controllerRef.current?.dispose();
        } catch (error) {
          console.error("Engine revoke failed", error);
        }
        controllerRef.current = null;
      },
    });

    const factory = createStockfishWorkerFactory();
    const controller = new EngineController(factory);
    controllerRef.current = controller;

    const unsubscribe = controller.subscribe(handleEvent);
    unsubRef.current = unsubscribe;

    controller.initialize({});
  }, [handleEvent]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      clearTimer();

      if (unsubRef.current !== null) {
        try {
          unsubRef.current();
        } catch (error) {
          console.error("Unsubscribe failed", error);
        }
        unsubRef.current = null;
      }

      if (controllerRef.current !== null) {
        try {
          controllerRef.current.dispose();
        } catch (error) {
          console.error("Controller dispose failed", error);
        }
        controllerRef.current = null;
      }

      if (ownerIdRef.current !== null) {
        releaseEngine(ownerIdRef.current);
      }
      ownerIdRef.current = null;
    };
  }, [clearTimer]);

  useLayoutEffect(() => {
    clearTimer();
    pendingAnalysisRef.current = null;
    currentRequestIdRef.current = null;
    linesByMultipvRef.current = new Map();

    if (controllerRef.current?.status === "analyzing") {
      controllerRef.current.stop();
    }

    if (fen === null) {
      setSafeState(() => initialState);
      return;
    }

    const cached = cache.get(fen) ?? null;
    if (cached !== null) {
      const point = cachedAnalysisToGraphPoint(cached, ply);
      const arrows = buildEngineArrows(cached);
      setSafeState(() => ({ point, arrows, isAnalyzing: false }));
      return;
    }

    if (!enabled) {
      setSafeState(() => initialState);
      return;
    }

    setSafeState(() => ({ point: null, arrows: [], isAnalyzing: false }));

    ensureEngine();

    const timer = setTimeout(() => {
      dispatchAnalysis(fen);
    }, debounceMs);

    timerRef.current = timer;
  }, [fen, cache, enabled, ply, debounceMs, clearTimer, setSafeState, dispatchAnalysis, ensureEngine]);

  return {
    point: state.point,
    arrows: state.arrows,
    isAnalyzing: state.isAnalyzing,
  };
}
