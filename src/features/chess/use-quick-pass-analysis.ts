"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EngineAnalysisLimit, EngineConfiguration, EngineWorkerEvent } from "./engine";
import type { ReviewTimeline } from "./timeline";
import type { CriticalPosition } from "./critical-positions";
import { planCriticalPass, planQuickPass, type QuickPassPlan } from "./quick-pass-planner";
import { QuickPassRunner, type QuickPassCompletedJob, type QuickPassRunnerState } from "./quick-pass-runner";
import { EngineController } from "./engine-controller";
import { createStockfishWorkerFactory } from "./engine-worker-factory";
import { acquireEngine, releaseEngine } from "./engine-ownership";

let quickPassOwnerCounter = 0;

type HookStatus = "idle" | "loading" | "ready" | "running" | "completed" | "cancelled" | "error";

type QuickPassAnalysisState = {
  readonly status: HookStatus;
  readonly error: string | null;
  readonly totalJobs: number;
  readonly completedJobs: number;
  readonly currentJobId: string | null;
  readonly results: readonly QuickPassCompletedJob[];
};

const DEFAULT_MULTI_PV = 3;

const initialState: QuickPassAnalysisState = {
  status: "idle",
  error: null,
  totalJobs: 0,
  completedJobs: 0,
  currentJobId: null,
  results: [],
};

export type UseQuickPassAnalysisOptions = {
  readonly configuration?: EngineConfiguration;
};

export type UseQuickPassAnalysis = {
  readonly status: HookStatus;
  readonly error: string | null;
  readonly totalJobs: number;
  readonly completedJobs: number;
  readonly currentJobId: string | null;
  readonly results: readonly QuickPassCompletedJob[];
  readonly start: (timeline: ReviewTimeline, limit: EngineAnalysisLimit, multiPv?: number) => boolean;
  readonly startCriticalPass: (
    positions: readonly CriticalPosition[],
    limit: EngineAnalysisLimit,
    multiPv?: number
  ) => boolean;
  readonly cancel: () => void;
};

export function useQuickPassAnalysis(
  options?: UseQuickPassAnalysisOptions
): UseQuickPassAnalysis {
  const controllerRef = useRef<EngineController | null>(null);
  const ownerIdRef = useRef<string | null>(null);
  const controllerUnsubRef = useRef<(() => void) | null>(null);
  const runnerRef = useRef<QuickPassRunner | null>(null);
  const runnerUnsubRef = useRef<(() => void) | null>(null);
  const initializedRef = useRef(false);
  const mountedRef = useRef(true);
  const disposedRef = useRef(false);
  const optionsRef = useRef(options);
  const pendingRequestRef = useRef<{ plan: QuickPassPlan; multiPv: number } | null>(null);

  const [state, setState] = useState<QuickPassAnalysisState>(initialState);

  const setSafeState = useCallback((updater: (prev: QuickPassAnalysisState) => QuickPassAnalysisState) => {
    if (mountedRef.current) {
      setState(updater);
    }
  }, []);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const executeRequest = useCallback(
    (request: { plan: QuickPassPlan; multiPv: number }) => {
      const { plan, multiPv } = request;
      const resolvedMultiPv = multiPv ?? DEFAULT_MULTI_PV;

      if (runnerRef.current) {
        pendingRequestRef.current = null;
        return;
      }

      const controller = controllerRef.current;
      if (!controller || controller.status !== "ready") {
        pendingRequestRef.current = null;
        return;
      }

      const engineAdapter = {
        analyze(id: string, payload: { fen: string; limit: EngineAnalysisLimit; multiPv?: number }): void {
          controller.analyze(id, payload);
        },
        stop(): void {
          controller.stop();
        },
        subscribe(listener: (event: EngineWorkerEvent) => void): () => void {
          return controller.subscribe(listener);
        },
      };

      const runner = new QuickPassRunner({
        engine: engineAdapter,
        multiPv: resolvedMultiPv,
      });

      const runnerUnsub = runner.subscribe((runnerState: QuickPassRunnerState) => {
        if (disposedRef.current) return;
        if (runnerRef.current !== runner) return;

        let hookStatus: HookStatus;
        switch (runnerState.status) {
          case "running":
            hookStatus = "running";
            break;
          case "completed":
            hookStatus = "completed";
            break;
          case "cancelled":
            hookStatus = "cancelled";
            break;
          case "error":
            hookStatus = "error";
            break;
          default:
            hookStatus = "ready";
        }

        setSafeState((prev) => ({
          ...prev,
          status: hookStatus,
          totalJobs: runnerState.totalJobs,
          completedJobs: runnerState.completedJobs,
          currentJobId: runnerState.currentJobId,
          results: runnerState.results,
          error: runnerState.error ?? prev.error,
        }));

        if (
          runnerState.status === "completed" ||
          runnerState.status === "cancelled" ||
          runnerState.status === "error"
        ) {
          if (runnerUnsubRef.current === runnerUnsub) {
            try {
              runnerUnsubRef.current();
            } catch {}
            runnerUnsubRef.current = null;
          }
          if (runnerRef.current === runner) {
            try {
              runnerRef.current.dispose();
            } catch {}
            runnerRef.current = null;
          }
        }
      });

      runnerRef.current = runner;
      runnerUnsubRef.current = runnerUnsub;

      try {
        runner.start(plan);
      } catch (error) {
        if (runnerRef.current === runner) {
          if (runnerUnsubRef.current === runnerUnsub) {
            try {
              runnerUnsubRef.current();
            } catch {}
            runnerUnsubRef.current = null;
          }
          runnerRef.current = null;
          setSafeState(() => ({
            ...initialState,
            status: "error",
            error: error instanceof Error ? error.message : "Failed to start analysis.",
          }));
        }
      }
    },
    [setSafeState]
  );

  const handleControllerEvent = useCallback(
    (event: EngineWorkerEvent) => {
      if (disposedRef.current) return;
      if (event.type !== "error" && runnerRef.current) return;

      switch (event.type) {
        case "loading":
          setSafeState((prev) => ({ ...prev, status: "loading" }));
          break;
        case "ready":
          setSafeState((prev) => ({ ...prev, status: "ready" }));
          if (pendingRequestRef.current) {
            const request = pendingRequestRef.current;
            pendingRequestRef.current = null;
            executeRequest(request);
          }
          break;
        case "error":
          setSafeState((prev) => ({
            ...prev,
            status: "error",
            error: event.message,
          }));
          pendingRequestRef.current = null;
          break;
      }
    },
    [setSafeState, executeRequest]
  );

  useEffect(() => {
    mountedRef.current = true;
    disposedRef.current = false;
    initializedRef.current = false;

    return () => {
      disposedRef.current = true;
      mountedRef.current = false;
      initializedRef.current = false;
      pendingRequestRef.current = null;

      if (runnerUnsubRef.current) {
        try {
          runnerUnsubRef.current();
        } catch {}
        runnerUnsubRef.current = null;
      }

      if (runnerRef.current) {
        try {
          runnerRef.current.dispose();
        } catch {}
        runnerRef.current = null;
      }

      if (controllerUnsubRef.current) {
        try {
          controllerUnsubRef.current();
        } catch {}
        controllerUnsubRef.current = null;
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
  }, [setSafeState]);

  const cancel = useCallback(() => {
    if (!mountedRef.current) return;
    const runner = runnerRef.current;
    if (!runner) {
      pendingRequestRef.current = null;
      return;
    }
    runner.cancel();
  }, []);

  const startWithPlan = useCallback(
    (plan: QuickPassPlan, multiPv?: number): boolean => {
      if (!mountedRef.current || disposedRef.current) {
        return false;
      }

      if (pendingRequestRef.current) {
        return false;
      }

      if (runnerRef.current) {
        return false;
      }

      const resolvedMultiPv = multiPv ?? DEFAULT_MULTI_PV;
      if (!Number.isInteger(resolvedMultiPv) || resolvedMultiPv < 1) {
        setSafeState(() => ({
          ...initialState,
          status: "error",
          error: "multiPv must be a positive integer.",
        }));
        return false;
      }

      if (!plan.ok) {
        setSafeState(() => ({
          ...initialState,
          status: "error",
          error: plan.reason,
        }));
        return false;
      }

      if (!controllerRef.current) {
        try {
          const factory = createStockfishWorkerFactory();
          const controller = new EngineController(factory);
          const ownerId = `quick-pass-${quickPassOwnerCounter++}`;
          ownerIdRef.current = ownerId;
          acquireEngine({
            id: ownerId,
            onRevoked: () => {
              try {
                runnerUnsubRef.current?.();
              } catch {}
              runnerUnsubRef.current = null;

              const runner = runnerRef.current;
              runnerRef.current = null;

              try {
                runner?.cancel();
              } catch {}
              try {
                runner?.dispose();
              } catch {}

              try {
                controllerUnsubRef.current?.();
              } catch {}
              controllerUnsubRef.current = null;

              try {
                controllerRef.current?.dispose();
              } catch {}
              controllerRef.current = null;

              initializedRef.current = false;
            },
          });
          controllerRef.current = controller;

          const unsubscribe = controller.subscribe(handleControllerEvent);
          controllerUnsubRef.current = unsubscribe;

          controller.initialize({ configuration: optionsRef.current?.configuration });
          initializedRef.current = true;
        } catch (error) {
          if (controllerRef.current) {
            try {
              controllerRef.current.dispose();
            } catch {}
            controllerRef.current = null;
          }
          controllerUnsubRef.current = null;
          initializedRef.current = false;
          setSafeState(() => ({
            ...initialState,
            status: "error",
            error: error instanceof Error ? error.message : "Engine setup failed.",
          }));
          return false;
        }
      }

      const controller = controllerRef.current;
      if (!controller || controller.status !== "ready") {
        pendingRequestRef.current = { plan, multiPv: resolvedMultiPv };
        return true;
      }

      executeRequest({ plan, multiPv: resolvedMultiPv });
      return true;
    },
    [setSafeState, handleControllerEvent, executeRequest]
  );

  const start = useCallback(
    (timeline: ReviewTimeline, limit: EngineAnalysisLimit, multiPv?: number): boolean => {
      const plan = planQuickPass(timeline, limit);
      return startWithPlan(plan, multiPv);
    },
    [startWithPlan]
  );

  const startCriticalPass = useCallback(
    (
      positions: readonly CriticalPosition[],
      limit: EngineAnalysisLimit,
      multiPv?: number
    ): boolean => {
      const plan = planCriticalPass(positions, limit);
      return startWithPlan(plan, multiPv);
    },
    [startWithPlan]
  );

  return {
    status: state.status,
    error: state.error,
    totalJobs: state.totalJobs,
    completedJobs: state.completedJobs,
    currentJobId: state.currentJobId,
    results: state.results,
    start,
    startCriticalPass,
    cancel,
  };
}
