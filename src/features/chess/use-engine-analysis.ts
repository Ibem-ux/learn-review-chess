"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EngineAnalysisLimit, EngineConfiguration, EngineInfo, EngineStatus, EngineWorkerEvent } from "./engine";
import { EngineController } from "./engine-controller";
import { createStockfishWorkerFactory } from "./engine-worker-factory";
import { acquireEngine, releaseEngine } from "./engine-ownership";

let engineOwnerCounter = 0;

type AnalysisState = {
  status: EngineStatus;
  error: string | null;
  lastInfo: EngineInfo | null;
  lastInfoRequestId: string | null;
  bestMove: { move: string | null; ponder: string | null } | null;
  bestMoveRequestId: string | null;
  lines: readonly EngineInfo[];
};

const initialState: AnalysisState = {
  status: "idle",
  error: null,
  lastInfo: null,
  lastInfoRequestId: null,
  bestMove: null,
  bestMoveRequestId: null,
  lines: [],
};

export type UseEngineAnalysisOptions = {
  readonly configuration?: EngineConfiguration;
};

export type UseEngineAnalysis = {
  readonly status: EngineStatus;
  readonly error: string | null;
  readonly lastInfo: EngineInfo | null;
  readonly lastInfoRequestId: string | null;
  readonly bestMove: { move: string | null; ponder: string | null } | null;
  readonly bestMoveRequestId: string | null;
  readonly lines: readonly EngineInfo[];
  readonly analyze: (fen: string, limit: EngineAnalysisLimit, multiPv?: number) => string | null;
  readonly stop: () => void;
};

export function useEngineAnalysis(
  options?: UseEngineAnalysisOptions
): UseEngineAnalysis {
  const controllerRef = useRef<EngineController | null>(null);
  const ownerIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const unsubRef = useRef<(() => void) | null>(null);
  const optionsRef = useRef(options);
  const mountedRef = useRef(true);
  const linesMapRef = useRef<Map<number, EngineInfo>>(new Map());

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const [state, setState] = useState<AnalysisState>(initialState);

  const setSafeState = useCallback((updater: (prev: AnalysisState) => AnalysisState) => {
    if (mountedRef.current) {
      setState(updater);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let disposed = false;
    let controller: EngineController | null = null;
    let unsubscribe: (() => void) | null = null;

    const cleanup = () => {
      disposed = true;
      mountedRef.current = false;
      initializedRef.current = false;

      if (unsubRef.current) {
        try {
          unsubRef.current();
        } catch {}
        unsubRef.current = null;
      }

      if (controllerRef.current) {
        try {
          controllerRef.current.dispose();
        } catch {}
        controllerRef.current = null;
      }

      if (ownerIdRef.current !== null) {
        releaseEngine(ownerIdRef.current);
      }
      ownerIdRef.current = null;
    };

    try {
      const ownerId = `engine-analysis-${engineOwnerCounter++}`;
      ownerIdRef.current = ownerId;
      // onRevoked must not set React state; it runs synchronously during another component's acquireEngine call.
      acquireEngine({
        id: ownerId,
        onRevoked: () => {
          try {
            controllerRef.current?.dispose();
          } catch {
            // swallow
          }
          controllerRef.current = null;
        },
      });
      const factory = createStockfishWorkerFactory();
      controller = new EngineController(factory);
      controllerRef.current = controller;

      const listener = (event: EngineWorkerEvent) => {
        if (disposed) return;

        switch (event.type) {
          case "loading":
            setSafeState((prev) => ({ ...prev, status: "loading" }));
            break;
          case "ready":
            setSafeState((prev) => ({ ...prev, status: "ready" }));
            break;
          case "analysis-info": {
            const multipv = event.info.multipv ?? 1;
            const newMap = new Map(linesMapRef.current);
            newMap.set(multipv, event.info);
            linesMapRef.current = newMap;
            const sortedLines = Array.from(newMap.entries())
              .sort(([a], [b]) => a - b)
              .map(([, info]) => info);
            setSafeState((prev) => ({
              ...prev,
              lastInfo: event.info,
              lastInfoRequestId: event.requestId,
              lines: sortedLines,
            }));
            break;
          }
          case "best-move":
            setSafeState((prev) => ({
              ...prev,
              bestMove: event.move,
              bestMoveRequestId: event.requestId,
              status: "ready",
            }));
            break;
          case "stopped":
            setSafeState((prev) => ({ ...prev, status: "ready" }));
            break;
          case "error":
            setSafeState((prev) => ({
              ...prev,
              status: "error",
              error: event.message,
            }));
            break;
        }
      };

      unsubscribe = controller.subscribe(listener);
      unsubRef.current = unsubscribe;

      controller.initialize({ configuration: optionsRef.current?.configuration });
      initializedRef.current = true;
    } catch (error) {
      setSafeState(() => ({
        ...initialState,
        status: "error",
        error: error instanceof Error ? error.message : "Engine setup failed.",
      }));
      cleanup();
      return cleanup;
    }

    return cleanup;
  }, [setSafeState]);

  const analyze = useCallback(
    (fen: string, limit: EngineAnalysisLimit, multiPv?: number): string | null => {
      if (!mountedRef.current) return null;
      const controller = controllerRef.current;
      if (!controller || !initializedRef.current) return null;

      const requestId = `req-${Date.now()}-${Math.random()}`;
      linesMapRef.current = new Map();
      setSafeState((prev) => ({ ...prev, status: controller.status, lines: [] }));
      controller.analyze(requestId, {
        fen,
        limit,
        multiPv,
      });
      return requestId;
    },
    [setSafeState]
  );

  const stop = useCallback(() => {
    if (!mountedRef.current) return;
    const controller = controllerRef.current;
    if (!controller || !initializedRef.current) return;
    controller.stop();
  }, []);

  return {
    status: state.status,
    error: state.error,
    lastInfo: state.lastInfo,
    lastInfoRequestId: state.lastInfoRequestId,
    bestMove: state.bestMove,
    bestMoveRequestId: state.bestMoveRequestId,
    lines: state.lines,
    analyze,
    stop,
  };
}
