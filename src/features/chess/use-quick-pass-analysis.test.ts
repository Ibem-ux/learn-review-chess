import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { EngineWorkerEvent, EngineAnalysisLimit } from "@/features/chess/engine";
import type { ReviewTimeline } from "@/features/chess/timeline";

type FakeWorker = {
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
  addMessageListener: ReturnType<typeof vi.fn>;
  removeMessageListener: ReturnType<typeof vi.fn>;
  addErrorListener: ReturnType<typeof vi.fn>;
  removeErrorListener: ReturnType<typeof vi.fn>;
};

function createFakeWorker(): FakeWorker {
  return {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addMessageListener: vi.fn(),
    removeMessageListener: vi.fn(),
    addErrorListener: vi.fn(),
    removeErrorListener: vi.fn(),
  };
}

type FakeController = {
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
  addMessageListener: ReturnType<typeof vi.fn>;
  removeMessageListener: ReturnType<typeof vi.fn>;
  addErrorListener: ReturnType<typeof vi.fn>;
  removeErrorListener: ReturnType<typeof vi.fn>;
  get status(): string;
  subscribe: ReturnType<typeof vi.fn>;
  initialize: ReturnType<typeof vi.fn>;
  analyze: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  emit(event: EngineWorkerEvent): void;
};

function createFakeController(fakeWorker: FakeWorker): FakeController {
  const eventListeners = new Set<(event: EngineWorkerEvent) => void>();
  let internalStatus = "idle";

  return {
    postMessage: fakeWorker.postMessage,
    terminate: fakeWorker.terminate,
    addMessageListener: fakeWorker.addMessageListener,
    removeMessageListener: fakeWorker.removeMessageListener,
    addErrorListener: fakeWorker.addErrorListener,
    removeErrorListener: fakeWorker.removeErrorListener,
    get status() {
      return internalStatus;
    },
    subscribe: vi.fn((listener: (event: EngineWorkerEvent) => void) => {
      eventListeners.add(listener);
      return () => {
        eventListeners.delete(listener);
      };
    }),
    initialize: vi.fn(() => {
      internalStatus = "loading";
      for (const listener of eventListeners) {
        listener({ type: "loading", requestId: "init-1" });
      }
    }),
    analyze: vi.fn(() => {
      if (internalStatus === "ready") {
        internalStatus = "analyzing";
      }
    }),
    stop: vi.fn(() => {
      internalStatus = "ready";
    }),
    dispose: vi.fn(() => {
      internalStatus = "idle";
    }),
    emit(event: EngineWorkerEvent) {
      if (event.type === "ready") {
        internalStatus = "ready";
      } else if (event.type === "stopped" || event.type === "best-move") {
        internalStatus = "ready";
      } else if (event.type === "error") {
        internalStatus = "error";
      }
      for (const listener of eventListeners) {
        listener(event);
      }
    },
  };
}

type FakeRunner = {
  start: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  emitState(state: { status: string; totalJobs: number; completedJobs: number; currentJobId: string | null; results: unknown[]; error: string | null }): void;
  readonly unsubCalls: Set<() => void>;
};

function createFakeRunner(): FakeRunner {
  const listeners = new Set<(state: { status: string; totalJobs: number; completedJobs: number; currentJobId: string | null; results: unknown[]; error: string | null }) => void>();
  const unsubCalls = new Set<() => void>();

  return {
    start: vi.fn(),
    cancel: vi.fn(),
    subscribe: vi.fn((listener: (state: { status: string; totalJobs: number; completedJobs: number; currentJobId: string | null; results: unknown[]; error: string | null }) => void) => {
      listeners.add(listener);
      const unsub = () => {
        unsubCalls.add(unsub);
        listeners.delete(listener);
      };
      return unsub;
    }),
    dispose: vi.fn(),
    emitState(state) {
      for (const listener of listeners) {
        listener(state);
      }
    },
    unsubCalls,
  };
}

let fakeWorker: FakeWorker;
let fakeController: FakeController;
let fakeRunner: FakeRunner;

describe("use-quick-pass-analysis", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("does not construct a Worker or EngineController on module import", async () => {
    const WorkerSpy = vi.fn();
    const EngineControllerSpy = vi.fn();

    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);
    fakeRunner = createFakeRunner();

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => {
        WorkerSpy();
        return () => fakeWorker;
      }),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        EngineControllerSpy();
        return fakeController;
      }),
    }));

    vi.doMock("@/features/chess/quick-pass-planner", () => ({
      planQuickPass: vi.fn(),
    }));

    vi.doMock("@/features/chess/quick-pass-runner", () => ({
      QuickPassRunner: vi.fn(),
    }));

    await import("@/features/chess/use-quick-pass-analysis");

    expect(WorkerSpy).not.toHaveBeenCalled();
    expect(EngineControllerSpy).not.toHaveBeenCalled();
  });

  describe("when Worker is available", () => {
    let WorkerSpy: ReturnType<typeof vi.fn>;
    let EngineControllerSpy: ReturnType<typeof vi.fn>;
    let planQuickPassSpy: ReturnType<typeof vi.fn>;
    let QuickPassRunnerSpy: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      vi.resetModules();

      fakeWorker = createFakeWorker();
      fakeController = createFakeController(fakeWorker);
      fakeRunner = createFakeRunner();

      WorkerSpy = vi.fn();
      EngineControllerSpy = vi.fn();
      planQuickPassSpy = vi.fn(() => ({ ok: true, jobs: [] }));
      QuickPassRunnerSpy = vi.fn(function MockQuickPassRunner() {
        return fakeRunner;
      });

      vi.doMock("@/features/chess/engine-worker-factory", () => ({
        createStockfishWorkerFactory: vi.fn(() => {
          WorkerSpy();
          return () => fakeWorker;
        }),
      }));

      vi.doMock("@/features/chess/engine-controller", () => ({
        EngineController: vi.fn(function MockEngineController() {
          EngineControllerSpy();
          return fakeController;
        }),
      }));

      vi.doMock("@/features/chess/quick-pass-planner", () => ({
        planQuickPass: planQuickPassSpy,
      }));

      vi.doMock("@/features/chess/quick-pass-runner", () => ({
        QuickPassRunner: QuickPassRunnerSpy,
      }));
    });

    it("creates exactly one controller and initializes it on mount", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      renderHook(() => useQuickPassAnalysis());

      expect(WorkerSpy).toHaveBeenCalledTimes(1);
      expect(EngineControllerSpy).toHaveBeenCalledTimes(1);
      expect(fakeController.initialize).toHaveBeenCalledTimes(1);
      expect(fakeController.subscribe).toHaveBeenCalledTimes(1);
    });

    it("re-renders do not reconstruct or reinitialize the controller", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { rerender } = renderHook(() => useQuickPassAnalysis());

      expect(WorkerSpy).toHaveBeenCalledTimes(1);
      expect(fakeController.initialize).toHaveBeenCalledTimes(1);

      rerender();

      expect(WorkerSpy).toHaveBeenCalledTimes(1);
      expect(fakeController.initialize).toHaveBeenCalledTimes(1);
    });

    it("loading transitions to ready only after actual ready event", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result } = renderHook(() => useQuickPassAnalysis());

      expect(result.current.status).toBe("loading");

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      expect(result.current.status).toBe("ready");
    });

    it("start before ready is rejected", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result } = renderHook(() => useQuickPassAnalysis());

      const timeline = { analysisEligible: true, steps: [] } as ReviewTimeline;
      const limit = { kind: "depth", value: 14 } as EngineAnalysisLimit;

      const accepted = result.current.start(timeline, limit);
      expect(accepted).toBe(false);
      expect(QuickPassRunnerSpy).not.toHaveBeenCalled();
    });

    it("ineligible timeline exposes planner reason and makes no runner/engine calls", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result } = renderHook(() => useQuickPassAnalysis());

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      planQuickPassSpy.mockReturnValue({ ok: false, reason: "Timeline is not eligible.", jobs: [] });

      const timeline = { analysisEligible: false, steps: [] } as ReviewTimeline;
      const limit = { kind: "depth", value: 14 } as EngineAnalysisLimit;

      act(() => {
        result.current.start(timeline, limit);
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("Timeline is not eligible.");
      expect(QuickPassRunnerSpy).not.toHaveBeenCalled();
    });

    it("ready eligible start creates one fresh runner", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result } = renderHook(() => useQuickPassAnalysis());

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      const timeline = { analysisEligible: true, steps: [] } as ReviewTimeline;
      const limit = { kind: "depth", value: 14 } as EngineAnalysisLimit;

      act(() => {
        result.current.start(timeline, limit);
      });

      expect(QuickPassRunnerSpy).toHaveBeenCalledTimes(1);
      expect(fakeRunner.start).toHaveBeenCalledTimes(1);
    });

    it("forwards exact timeline, limit, and multiPv values", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result } = renderHook(() => useQuickPassAnalysis());

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      const timeline = { analysisEligible: true, steps: [] } as ReviewTimeline;
      const limit = { kind: "depth", value: 14 } as EngineAnalysisLimit;

      act(() => {
        result.current.start(timeline, limit, 3);
      });

      const runnerCall = (QuickPassRunnerSpy as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(runnerCall.multiPv).toBe(3);
    });

    it("default MultiPV is 3", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result } = renderHook(() => useQuickPassAnalysis());

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      const timeline = { analysisEligible: true, steps: [] } as ReviewTimeline;
      const limit = { kind: "depth", value: 14 } as EngineAnalysisLimit;

      act(() => {
        result.current.start(timeline, limit);
      });

      const runnerCall = (QuickPassRunnerSpy as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(runnerCall.multiPv).toBe(3);
    });

    it("invalid MultiPV is rejected", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result } = renderHook(() => useQuickPassAnalysis());

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      const timeline = { analysisEligible: true, steps: [] } as ReviewTimeline;
      const limit = { kind: "depth", value: 14 } as EngineAnalysisLimit;

      act(() => {
        result.current.start(timeline, limit, 0);
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("multiPv must be a positive integer.");
      expect(QuickPassRunnerSpy).not.toHaveBeenCalled();
    });

    it("running state and progress propagate", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result } = renderHook(() => useQuickPassAnalysis());

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      const timeline = { analysisEligible: true, steps: [] } as ReviewTimeline;
      const limit = { kind: "depth", value: 14 } as EngineAnalysisLimit;

      act(() => {
        result.current.start(timeline, limit);
      });

      act(() => {
        fakeRunner.emitState({
          status: "running",
          totalJobs: 2,
          completedJobs: 0,
          currentJobId: "quick-pass-0",
          results: [],
          error: null,
        });
      });

      expect(result.current.status).toBe("running");
      expect(result.current.totalJobs).toBe(2);
      expect(result.current.completedJobs).toBe(0);
      expect(result.current.currentJobId).toBe("quick-pass-0");
    });

    it("candidate results are preserved unchanged", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result } = renderHook(() => useQuickPassAnalysis());

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      const timeline = { analysisEligible: true, steps: [] } as ReviewTimeline;
      const limit = { kind: "depth", value: 14 } as EngineAnalysisLimit;

      act(() => {
        result.current.start(timeline, limit);
      });

      const mockResult = {
        job: { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit },
        info: { depth: 14, multipv: 1, pv: ["e2e4"] },
        bestMove: { move: "e2e4", ponder: null },
        candidateLines: [{ rank: 1, info: { depth: 14, multipv: 1, pv: ["e2e4"] } }],
      };

      act(() => {
        fakeRunner.emitState({
          status: "completed",
          totalJobs: 1,
          completedJobs: 1,
          currentJobId: null,
          results: [mockResult],
          error: null,
        });
      });

      expect(result.current.status).toBe("completed");
      expect(result.current.results).toHaveLength(1);
      expect(result.current.results[0]).toEqual(mockResult);
    });

    it("cancel delegates once and preserves partial results", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result } = renderHook(() => useQuickPassAnalysis());

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      const timeline = { analysisEligible: true, steps: [] } as ReviewTimeline;
      const limit = { kind: "depth", value: 14 } as EngineAnalysisLimit;

      act(() => {
        result.current.start(timeline, limit);
      });

      const mockResult = {
        job: { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit },
        info: { depth: 10, pv: ["e2e4"] },
        bestMove: null,
        candidateLines: [],
      };

      act(() => {
        fakeRunner.emitState({
          status: "running",
          totalJobs: 2,
          completedJobs: 0,
          currentJobId: "quick-pass-0",
          results: [mockResult],
          error: null,
        });
      });

      act(() => {
        result.current.cancel();
      });

      expect(fakeRunner.cancel).toHaveBeenCalledTimes(1);

      act(() => {
        fakeRunner.emitState({
          status: "cancelled",
          totalJobs: 2,
          completedJobs: 0,
          currentJobId: null,
          results: [mockResult],
          error: null,
        });
      });

      expect(result.current.status).toBe("cancelled");
      expect(result.current.results).toHaveLength(1);
    });

    it("repeated cancel is idempotent", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result } = renderHook(() => useQuickPassAnalysis());

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      const timeline = { analysisEligible: true, steps: [] } as ReviewTimeline;
      const limit = { kind: "depth", value: 14 } as EngineAnalysisLimit;

      act(() => {
        result.current.start(timeline, limit);
      });

      act(() => {
        result.current.cancel();
      });
      act(() => {
        result.current.cancel();
      });

      expect(fakeRunner.cancel).toHaveBeenCalledTimes(2);
    });

    it("start while running is rejected", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result } = renderHook(() => useQuickPassAnalysis());

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      const timeline = { analysisEligible: true, steps: [] } as ReviewTimeline;
      const limit = { kind: "depth", value: 14 } as EngineAnalysisLimit;

      act(() => {
        result.current.start(timeline, limit);
      });

      act(() => {
        fakeRunner.emitState({
          status: "running",
          totalJobs: 1,
          completedJobs: 0,
          currentJobId: "quick-pass-0",
          results: [],
          error: null,
        });
      });

      act(() => {
        const accepted = result.current.start(timeline, limit);
        expect(accepted).toBe(false);
      });

      expect(QuickPassRunnerSpy).toHaveBeenCalledTimes(1);
    });

    it("a new run after completion creates a fresh runner but reuses the same controller", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result } = renderHook(() => useQuickPassAnalysis());

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      const timeline = { analysisEligible: true, steps: [] } as ReviewTimeline;
      const limit = { kind: "depth", value: 14 } as EngineAnalysisLimit;

      act(() => {
        result.current.start(timeline, limit);
      });
      expect(QuickPassRunnerSpy).toHaveBeenCalledTimes(1);

      act(() => {
        fakeRunner.emitState({
          status: "completed",
          totalJobs: 1,
          completedJobs: 1,
          currentJobId: null,
          results: [],
          error: null,
        });
      });

      fakeRunner.dispose.mockClear();
      fakeRunner.cancel.mockClear();
      (fakeRunner.subscribe as ReturnType<typeof vi.fn>).mockClear();
      fakeRunner.start.mockClear();
      QuickPassRunnerSpy.mockClear();

      const newTimeline = { analysisEligible: true, steps: [] } as ReviewTimeline;
      act(() => {
        result.current.start(newTimeline, limit, 2);
      });

      expect(QuickPassRunnerSpy).toHaveBeenCalledTimes(1);
      expect(fakeRunner.dispose).toHaveBeenCalledTimes(0);
      expect(fakeController.dispose).toHaveBeenCalledTimes(0);
    });

    it("runner error propagates safely", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result } = renderHook(() => useQuickPassAnalysis());

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      const timeline = { analysisEligible: true, steps: [] } as ReviewTimeline;
      const limit = { kind: "depth", value: 14 } as EngineAnalysisLimit;

      act(() => {
        result.current.start(timeline, limit);
      });

      act(() => {
        fakeRunner.emitState({
          status: "error",
          totalJobs: 1,
          completedJobs: 0,
          currentJobId: null,
          results: [],
          error: "Engine failure.",
        });
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("Engine failure.");
    });

    it("controller error propagates safely", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result } = renderHook(() => useQuickPassAnalysis());

      act(() => {
        fakeController.emit({ type: "error", requestId: "init-1", message: "Controller failure." });
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("Controller failure.");
    });

    it("factory failure is contained and exposes error state", async () => {
      const failingFactory = vi.fn(() => {
        throw new Error("Web Workers are not available.");
      });

      vi.doMock("@/features/chess/engine-worker-factory", () => ({
        createStockfishWorkerFactory: failingFactory,
      }));

      vi.doMock("@/features/chess/engine-controller", () => ({
        EngineController: vi.fn(),
      }));

      vi.doMock("@/features/chess/quick-pass-planner", () => ({
        planQuickPass: vi.fn(),
      }));

      vi.doMock("@/features/chess/quick-pass-runner", () => ({
        QuickPassRunner: vi.fn(),
      }));

      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result } = renderHook(() => useQuickPassAnalysis());

      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("Web Workers are not available.");
    });

    it("unmount releases runner and controller resources exactly once", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result, unmount } = renderHook(() => useQuickPassAnalysis());

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      const timeline = { analysisEligible: true, steps: [] } as ReviewTimeline;
      const limit = { kind: "depth", value: 14 } as EngineAnalysisLimit;

      act(() => {
        result.current.start(timeline, limit);
      });

      expect(fakeController.subscribe).toHaveBeenCalledTimes(1);

      unmount();

      expect(fakeRunner.dispose).toHaveBeenCalledTimes(1);
      expect(fakeController.dispose).toHaveBeenCalledTimes(1);
    });

    it("late events after unmount do not update state", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result, unmount } = renderHook(() => useQuickPassAnalysis());

      act(() => {
        fakeController.emit({ type: "loading", requestId: "init-1" });
      });

      expect(result.current.status).toBe("loading");

      unmount();

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      expect(result.current.status).toBe("loading");
    });

    it("does not update state from runner events after unmount", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result, unmount } = renderHook(() => useQuickPassAnalysis());

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      const timeline = { analysisEligible: true, steps: [] } as ReviewTimeline;
      const limit = { kind: "depth", value: 14 } as EngineAnalysisLimit;

      act(() => {
        result.current.start(timeline, limit);
      });

      unmount();

      act(() => {
        fakeRunner.emitState({
          status: "completed",
          totalJobs: 1,
          completedJobs: 1,
          currentJobId: null,
          results: [],
          error: null,
        });
      });

      expect(result.current.status).toBe("ready");
    });

    it("subscription failure during setup disposes controller once", async () => {
      const failingSubscribe = vi.fn(() => {
        throw new Error("subscribe failed");
      });
      fakeController = createFakeController(fakeWorker);
      (fakeController.subscribe as ReturnType<typeof vi.fn>).mockImplementation(failingSubscribe);

      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      renderHook(() => useQuickPassAnalysis());

      expect(fakeController.dispose).toHaveBeenCalledTimes(1);
    });

    it("initialization failure during setup disposes controller once", async () => {
      fakeController = createFakeController(fakeWorker);
      (fakeController.initialize as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("initialize failed");
      });

      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      renderHook(() => useQuickPassAnalysis());

      expect(fakeController.dispose).toHaveBeenCalledTimes(1);
    });

    it("terminal completion unsubscribes runner listener exactly once", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result } = renderHook(() => useQuickPassAnalysis());

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      const timeline = { analysisEligible: true, steps: [] } as ReviewTimeline;
      const limit = { kind: "depth", value: 14 } as EngineAnalysisLimit;

      act(() => {
        result.current.start(timeline, limit);
      });

      expect(fakeRunner.subscribe).toHaveBeenCalledTimes(1);

      act(() => {
        fakeRunner.emitState({
          status: "completed",
          totalJobs: 1,
          completedJobs: 1,
          currentJobId: null,
          results: [],
          error: null,
        });
      });

      expect(result.current.status).toBe("completed");
      expect(fakeRunner.unsubCalls.size).toBe(1);
    });

    it("terminal cancellation unsubscribes exactly once", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result } = renderHook(() => useQuickPassAnalysis());

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      const timeline = { analysisEligible: true, steps: [] } as ReviewTimeline;
      const limit = { kind: "depth", value: 14 } as EngineAnalysisLimit;

      act(() => {
        result.current.start(timeline, limit);
      });

      expect(fakeRunner.subscribe).toHaveBeenCalledTimes(1);

      act(() => {
        fakeRunner.emitState({
          status: "running",
          totalJobs: 1,
          completedJobs: 0,
          currentJobId: "quick-pass-0",
          results: [],
          error: null,
        });
      });

      act(() => {
        result.current.cancel();
      });

      act(() => {
        fakeRunner.emitState({
          status: "cancelled",
          totalJobs: 1,
          completedJobs: 0,
          currentJobId: null,
          results: [],
          error: null,
        });
      });

      expect(result.current.status).toBe("cancelled");
      expect(fakeRunner.unsubCalls.size).toBe(1);
    });

    it("terminal error unsubscribes exactly once", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result } = renderHook(() => useQuickPassAnalysis());

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      const timeline = { analysisEligible: true, steps: [] } as ReviewTimeline;
      const limit = { kind: "depth", value: 14 } as EngineAnalysisLimit;

      act(() => {
        result.current.start(timeline, limit);
      });

      expect(fakeRunner.subscribe).toHaveBeenCalledTimes(1);

      act(() => {
        fakeRunner.emitState({
          status: "error",
          totalJobs: 1,
          completedJobs: 0,
          currentJobId: null,
          results: [],
          error: "Engine failure.",
        });
      });

      expect(result.current.status).toBe("error");
      expect(fakeRunner.unsubCalls.size).toBe(1);
    });

    it("late emission from a completed runner does not affect hook state", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result } = renderHook(() => useQuickPassAnalysis());

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      const timeline = { analysisEligible: true, steps: [] } as ReviewTimeline;
      const limit = { kind: "depth", value: 14 } as EngineAnalysisLimit;

      act(() => {
        result.current.start(timeline, limit);
      });

      act(() => {
        fakeRunner.emitState({
          status: "completed",
          totalJobs: 1,
          completedJobs: 1,
          currentJobId: null,
          results: [],
          error: null,
        });
      });

      expect(result.current.status).toBe("completed");

      act(() => {
        fakeRunner.emitState({
          status: "running",
          totalJobs: 1,
          completedJobs: 0,
          currentJobId: "quick-pass-0",
          results: [],
          error: null,
        });
      });

      expect(result.current.status).toBe("completed");
    });

    it("a second run is unaffected by emissions from the first runner", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result } = renderHook(() => useQuickPassAnalysis());

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      const timeline = { analysisEligible: true, steps: [] } as ReviewTimeline;
      const limit = { kind: "depth", value: 14 } as EngineAnalysisLimit;

      act(() => {
        result.current.start(timeline, limit);
      });

      act(() => {
        fakeRunner.emitState({
          status: "completed",
          totalJobs: 1,
          completedJobs: 1,
          currentJobId: null,
          results: [{ job: { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit }, info: null, bestMove: null, candidateLines: [] }],
          error: null,
        });
      });

      fakeRunner.dispose.mockClear();
      fakeRunner.cancel.mockClear();
      (fakeRunner.subscribe as ReturnType<typeof vi.fn>).mockClear();
      fakeRunner.start.mockClear();
      QuickPassRunnerSpy.mockClear();

      act(() => {
        result.current.start(timeline, limit, 2);
      });

      act(() => {
        fakeRunner.emitState({
          status: "running",
          totalJobs: 1,
          completedJobs: 0,
          currentJobId: "quick-pass-0",
          results: [],
          error: null,
        });
      });

      expect(result.current.status).toBe("running");
      expect(result.current.results).toHaveLength(0);
    });

    it("synchronous terminal emission during runner.start does not leave a stale runner", async () => {
      const terminalRunner = {
        start: vi.fn(() => {
          fakeRunner.emitState({
            status: "error",
            totalJobs: 0,
            completedJobs: 0,
            currentJobId: null,
            results: [],
            error: "Ineligible plan.",
          });
        }),
        cancel: vi.fn(),
        subscribe: fakeRunner.subscribe,
        dispose: vi.fn(),
      };
      QuickPassRunnerSpy.mockImplementation(function MockQuickPassRunner() {
        return terminalRunner;
      });

      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result } = renderHook(() => useQuickPassAnalysis());

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      const timeline = { analysisEligible: true, steps: [] } as ReviewTimeline;
      const limit = { kind: "depth", value: 14 } as EngineAnalysisLimit;

      act(() => {
        result.current.start(timeline, limit);
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("Ineligible plan.");
      expect(terminalRunner.subscribe).toHaveBeenCalledTimes(1);
    });

    it("controller ready/loading events during running do not overwrite running status", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result } = renderHook(() => useQuickPassAnalysis());

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      const timeline = { analysisEligible: true, steps: [] } as ReviewTimeline;
      const limit = { kind: "depth", value: 14 } as EngineAnalysisLimit;

      act(() => {
        result.current.start(timeline, limit);
      });

      act(() => {
        fakeRunner.emitState({
          status: "running",
          totalJobs: 1,
          completedJobs: 0,
          currentJobId: "quick-pass-0",
          results: [],
          error: null,
        });
      });

      expect(result.current.status).toBe("running");

      act(() => {
        fakeController.emit({ type: "ready", requestId: "req-1" });
      });

      expect(result.current.status).toBe("running");

      act(() => {
        fakeController.emit({ type: "loading", requestId: "req-2" });
      });

      expect(result.current.status).toBe("running");
    });

    it("cancel captures final partial results before clearing refs", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result } = renderHook(() => useQuickPassAnalysis());

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      const timeline = { analysisEligible: true, steps: [] } as ReviewTimeline;
      const limit = { kind: "depth", value: 14 } as EngineAnalysisLimit;

      act(() => {
        result.current.start(timeline, limit);
      });

      const partialResult = {
        job: { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit },
        info: { depth: 10, pv: ["e2e4"] },
        bestMove: null,
        candidateLines: [],
      };

      act(() => {
        fakeRunner.emitState({
          status: "running",
          totalJobs: 2,
          completedJobs: 0,
          currentJobId: "quick-pass-0",
          results: [partialResult],
          error: null,
        });
      });

      act(() => {
        result.current.cancel();
      });

      act(() => {
        fakeRunner.emitState({
          status: "cancelled",
          totalJobs: 2,
          completedJobs: 0,
          currentJobId: null,
          results: [partialResult],
          error: null,
        });
      });

      expect(result.current.status).toBe("cancelled");
      expect(result.current.results).toHaveLength(1);
      expect(result.current.results[0]).toEqual(partialResult);
      expect(fakeRunner.unsubCalls.size).toBe(1);
    });

    it("unmount after a terminal run does not unsubscribe/dispose the old runner twice", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result, unmount } = renderHook(() => useQuickPassAnalysis());

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      const timeline = { analysisEligible: true, steps: [] } as ReviewTimeline;
      const limit = { kind: "depth", value: 14 } as EngineAnalysisLimit;

      act(() => {
        result.current.start(timeline, limit);
      });

      act(() => {
        fakeRunner.emitState({
          status: "completed",
          totalJobs: 1,
          completedJobs: 1,
          currentJobId: null,
          results: [],
          error: null,
        });
      });

      expect(fakeRunner.unsubCalls.size).toBe(1);
      expect(fakeRunner.dispose).toHaveBeenCalledTimes(1);

      unmount();

      expect(fakeRunner.unsubCalls.size).toBe(1);
      expect(fakeRunner.dispose).toHaveBeenCalledTimes(1);
      expect(fakeController.dispose).toHaveBeenCalledTimes(1);
    });

    it("unmount during an active run releases every resource once", async () => {
      const mod = await import("@/features/chess/use-quick-pass-analysis");
      const { useQuickPassAnalysis } = mod;

      const { result, unmount } = renderHook(() => useQuickPassAnalysis());

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      const timeline = { analysisEligible: true, steps: [] } as ReviewTimeline;
      const limit = { kind: "depth", value: 14 } as EngineAnalysisLimit;

      act(() => {
        result.current.start(timeline, limit);
      });

      act(() => {
        fakeRunner.emitState({
          status: "running",
          totalJobs: 1,
          completedJobs: 0,
          currentJobId: "quick-pass-0",
          results: [],
          error: null,
        });
      });

      expect(fakeController.subscribe).toHaveBeenCalledTimes(1);

      unmount();

      expect(fakeRunner.unsubCalls.size).toBe(1);
      expect(fakeRunner.dispose).toHaveBeenCalledTimes(1);
      expect(fakeController.dispose).toHaveBeenCalledTimes(1);
    });
  });
});
