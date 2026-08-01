import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { EngineWorkerEvent, EngineAnalysisLimit } from "@/features/chess/engine";

type FakeWorker = {
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
  addMessageListener: ReturnType<typeof vi.fn>;
  removeMessageListener: ReturnType<typeof vi.fn>;
  addErrorListener: ReturnType<typeof vi.fn>;
  removeErrorListener: ReturnType<typeof vi.fn>;
  dispatch(data: string): void;
  dispatchError(message: string): void;
};

function createFakeWorker(): FakeWorker {
  const messageListeners = new Set<(data: string) => void>();
  const errorListeners = new Set<(message: string) => void>();

  return {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addMessageListener: vi.fn((listener: (data: string) => void) => {
      messageListeners.add(listener);
    }),
    removeMessageListener: vi.fn((listener: (data: string) => void) => {
      messageListeners.delete(listener);
    }),
    addErrorListener: vi.fn((listener: (message: string) => void) => {
      errorListeners.add(listener);
    }),
    removeErrorListener: vi.fn((listener: (message: string) => void) => {
      errorListeners.delete(listener);
    }),
    dispatch(data: string) {
      for (const listener of messageListeners) {
        listener(data);
      }
    },
    dispatchError(message: string) {
      for (const listener of errorListeners) {
        listener(message);
      }
    },
  };
}

function createFakeController(fake: FakeWorker) {
  const eventListeners = new Set<(event: EngineWorkerEvent) => void>();
  let internalStatus: string = "idle";

  return {
    postMessage: fake.postMessage,
    terminate: fake.terminate,
    addMessageListener: fake.addMessageListener,
    removeMessageListener: fake.removeMessageListener,
    addErrorListener: fake.addErrorListener,
    removeErrorListener: fake.removeErrorListener,
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
      } else if (internalStatus === "loading") {
        internalStatus = "loading";
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

let fakeController: ReturnType<typeof createFakeController>;
let fakeWorker: FakeWorker;

describe("use-engine-analysis", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/features/chess/engine-worker-factory");
    vi.doUnmock("@/features/chess/engine-controller");
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    const { resetEngineOwnership } = await import("@/features/chess/engine-ownership");
    resetEngineOwnership();
  });

  it("does not construct a Worker or EngineController on module import", async () => {
    const WorkerSpy = vi.fn();
    const EngineControllerSpy = vi.fn();

    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => {
        WorkerSpy();
        return () => {
          EngineControllerSpy();
          return fakeWorker;
        };
      }),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        EngineControllerSpy();
        return fakeController;
      }),
    }));

    await import("@/features/chess/use-engine-analysis");

    expect(WorkerSpy).not.toHaveBeenCalled();
    expect(EngineControllerSpy).not.toHaveBeenCalled();
  });

  describe("when Worker is available", () => {
    let WorkerSpy: ReturnType<typeof vi.fn>;
    let EngineControllerSpy: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      vi.resetModules();

      fakeWorker = createFakeWorker();
      fakeController = createFakeController(fakeWorker);

      WorkerSpy = vi.fn();
      EngineControllerSpy = vi.fn();

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
    });

    it("creates exactly one controller and initializes it on mount", async () => {
      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;

      renderHook(() => useEngineAnalysis());

      expect(WorkerSpy).toHaveBeenCalledTimes(1);
      expect(EngineControllerSpy).toHaveBeenCalledTimes(1);
      expect(fakeController.initialize).toHaveBeenCalledTimes(1);
      expect(fakeController.subscribe).toHaveBeenCalledTimes(1);
    });

    it("re-renders do not reconstruct or reinitialize the controller", async () => {
      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;

      const { rerender } = renderHook(() => useEngineAnalysis());

      expect(WorkerSpy).toHaveBeenCalledTimes(1);
      expect(fakeController.initialize).toHaveBeenCalledTimes(1);

      rerender();

      expect(WorkerSpy).toHaveBeenCalledTimes(1);
      expect(fakeController.initialize).toHaveBeenCalledTimes(1);
    });

    it("reflects controller events in hook state", async () => {
      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;

      const { result } = renderHook(() => useEngineAnalysis());

      await waitFor(() => expect(fakeController.initialize).toHaveBeenCalledTimes(1));

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      expect(result.current.status).toBe("ready");

      act(() => {
        fakeController.emit({
          type: "analysis-info",
          requestId: "req-1",
          info: { depth: 10, nodes: 1000, timeMs: 50, pv: ["e2e4", "e7e5"] },
        });
      });

      expect(result.current.lastInfo).toEqual({ depth: 10, nodes: 1000, timeMs: 50, pv: ["e2e4", "e7e5"] });

      act(() => {
        fakeController.emit({
          type: "best-move",
          requestId: "req-1",
          move: { move: "e2e4", ponder: "e7e5" },
        });
      });

      expect(result.current.status).toBe("ready");
      expect(result.current.bestMove).toEqual({ move: "e2e4", ponder: "e7e5" });
    });

    it("immediate analysis from ready changes hook status to analyzing", async () => {
      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;

      const { result } = renderHook(() => useEngineAnalysis());

      await waitFor(() => expect(fakeController.initialize).toHaveBeenCalledTimes(1));

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      expect(result.current.status).toBe("ready");

      const limit: EngineAnalysisLimit = { kind: "depth", value: 14 };
      const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

      act(() => {
        result.current.analyze(fen, limit);
      });

      expect(result.current.status).toBe("analyzing");
    });

    it("queued analysis during loading preserves loading status", async () => {
      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;

      const { result } = renderHook(() => useEngineAnalysis());

      await waitFor(() => expect(fakeController.initialize).toHaveBeenCalledTimes(1));

      expect(result.current.status).toBe("loading");

      const limit: EngineAnalysisLimit = { kind: "depth", value: 14 };
      const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

      act(() => {
        result.current.analyze(fen, limit);
      });

      expect(result.current.status).toBe("loading");
    });

    it("forwards analysis request with exact FEN and limit", async () => {
      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;

      const { result } = renderHook(() => useEngineAnalysis());

      await waitFor(() => expect(fakeController.initialize).toHaveBeenCalledTimes(1));

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      const limit: EngineAnalysisLimit = { kind: "depth", value: 14 };
      const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

      act(() => {
        result.current.analyze(fen, limit, 2);
      });

      expect(fakeController.analyze).toHaveBeenCalledTimes(1);
      const call = (fakeController.analyze as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[1].fen).toBe(fen);
      expect(call[1].limit).toEqual(limit);
      expect(call[1].multiPv).toBe(2);
    });

    it("forwards stop to controller", async () => {
      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;

      const { result } = renderHook(() => useEngineAnalysis());

      await waitFor(() => expect(fakeController.initialize).toHaveBeenCalledTimes(1));

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      act(() => {
        result.current.stop();
      });

      expect(fakeController.stop).toHaveBeenCalledTimes(1);
    });

    it("unsubscribes and disposes exactly once on unmount", async () => {
      const unsubscribeSpy = vi.fn(() => {});
      fakeController = createFakeController(fakeWorker);
      (fakeController.subscribe as ReturnType<typeof vi.fn>).mockReturnValue(unsubscribeSpy);

      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;

      const { unmount } = renderHook(() => useEngineAnalysis());

      expect(fakeController.subscribe).toHaveBeenCalledTimes(1);

      unmount();

      expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
      expect(fakeController.dispose).toHaveBeenCalledTimes(1);
    });

    it("does not update state from events emitted after unmount", async () => {
      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;

      const { result, unmount } = renderHook(() => useEngineAnalysis());

      await waitFor(() => expect(fakeController.initialize).toHaveBeenCalledTimes(1));

      act(() => {
        fakeController.emit({ type: "loading", requestId: "init-1" });
      });

      expect(result.current.status).toBe("loading");

      unmount();

      act(() => {
        fakeController.emit({ type: "error", requestId: "late", message: "late event" });
      });

      expect(result.current.status).toBe("loading");
      expect(result.current.error).toBeNull();
    });

    it("exposes error message from error events", async () => {
      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;

      const { result } = renderHook(() => useEngineAnalysis());

      await waitFor(() => expect(fakeController.initialize).toHaveBeenCalledTimes(1));

      act(() => {
        fakeController.emit({ type: "error", requestId: "req-1", message: "worker error" });
      });

      expect(result.current.error).toBe("worker error");
      expect(result.current.status).toBe("error");
    });

    it("handles missing Worker support deterministically without an unhandled effect error", async () => {
      vi.doUnmock("@/features/chess/engine-worker-factory");
      vi.doUnmock("@/features/chess/engine-controller");

      fakeWorker = createFakeWorker();
      const failingFactory = vi.fn(() => {
        throw new Error("Web Workers are not available in this environment.");
      });

      vi.doMock("@/features/chess/engine-worker-factory", () => ({
        createStockfishWorkerFactory: failingFactory,
      }));

      vi.doMock("@/features/chess/engine-controller", () => ({
        EngineController: vi.fn(function MockEngineController() {
          return createFakeController(fakeWorker);
        }),
      }));

      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;

      const { result } = renderHook(() => useEngineAnalysis());

      await waitFor(() => expect(result.current.status).toBe("error"));
      expect(result.current.error).toBe("Web Workers are not available in this environment.");
      expect(failingFactory).toHaveBeenCalledTimes(1);
    });

    it("cleans up partial setup when subscription fails", async () => {
      fakeWorker = createFakeWorker();
      fakeController = createFakeController(fakeWorker);
      const subscribeSpy = vi.fn(() => {
        throw new Error("subscribe failed");
      });
      (fakeController.subscribe as ReturnType<typeof vi.fn>).mockImplementation(subscribeSpy);

      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;

      renderHook(() => useEngineAnalysis());

      expect(fakeController.dispose).toHaveBeenCalledTimes(1);
    });

    it("cleans up partial setup when initialization fails", async () => {
      fakeWorker = createFakeWorker();
      fakeController = createFakeController(fakeWorker);
      (fakeController.initialize as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("initialize failed");
      });

      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;

      renderHook(() => useEngineAnalysis());

      expect(fakeController.dispose).toHaveBeenCalledTimes(1);
    });

    it("unmount after factory failure is safe and does not cause an additional disposal", async () => {
      vi.resetModules();

      const failingFactory = vi.fn(() => {
        throw new Error("Web Workers are not available in this environment.");
      });

      vi.doMock("@/features/chess/engine-worker-factory", () => ({
        createStockfishWorkerFactory: failingFactory,
      }));

      vi.doMock("@/features/chess/engine-controller", () => ({
        EngineController: vi.fn(function MockEngineController() {
          return createFakeController(createFakeWorker());
        }),
      }));

      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;

      const { unmount } = renderHook(() => useEngineAnalysis());

      await waitFor(() => expect(failingFactory).toHaveBeenCalledTimes(1));

      unmount();

      expect(failingFactory).toHaveBeenCalledTimes(1);
    });

    it("unmount after initialization failure does not dispose twice", async () => {
      fakeWorker = createFakeWorker();
      fakeController = createFakeController(fakeWorker);
      (fakeController.initialize as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("initialize failed");
      });

      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;

      const { unmount } = renderHook(() => useEngineAnalysis());

      expect(fakeController.dispose).toHaveBeenCalledTimes(1);

      unmount();

      expect(fakeController.dispose).toHaveBeenCalledTimes(1);
    });

    it("if unsubscribe throws during normal unmount, controller disposal still occurs once and refs make saved callbacks inert", async () => {
      const unsubscribeSpy = vi.fn(() => {
        throw new Error("unsubscribe failed");
      });
      fakeController = createFakeController(fakeWorker);
      (fakeController.subscribe as ReturnType<typeof vi.fn>).mockReturnValue(unsubscribeSpy);

      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;

      const { result, unmount } = renderHook(() => useEngineAnalysis());

      await waitFor(() => expect(fakeController.initialize).toHaveBeenCalledTimes(1));

      unmount();

      expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
      expect(fakeController.dispose).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.stop();
      });
      act(() => {
        result.current.analyze("fen", { kind: "depth", value: 10 });
      });

      expect(fakeController.stop).toHaveBeenCalledTimes(0);
      expect(fakeController.analyze).toHaveBeenCalledTimes(0);
    });

    it("saved analyze and stop callbacks invoked after unmount do not call the controller", async () => {
      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;

      const { result, unmount } = renderHook(() => useEngineAnalysis());

      await waitFor(() => expect(fakeController.initialize).toHaveBeenCalledTimes(1));

      unmount();

      act(() => {
        result.current.stop();
      });
      act(() => {
        result.current.analyze("fen", { kind: "depth", value: 10 });
      });

      expect(fakeController.stop).toHaveBeenCalledTimes(0);
      expect(fakeController.analyze).toHaveBeenCalledTimes(0);
    });

    it("repeated React cleanup behavior does not release the same resources twice", async () => {
      const unsubscribeSpy = vi.fn(() => {});
      fakeController = createFakeController(fakeWorker);
      (fakeController.subscribe as ReturnType<typeof vi.fn>).mockReturnValue(unsubscribeSpy);

      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;

      const { unmount } = renderHook(() => useEngineAnalysis());

      expect(fakeController.subscribe).toHaveBeenCalledTimes(1);

      unmount();
      unmount();

      expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
      expect(fakeController.dispose).toHaveBeenCalledTimes(1);
    });

    it("analyze returns the request ID passed to controller.analyze", async () => {
      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;

      const { result } = renderHook(() => useEngineAnalysis());

      await waitFor(() => expect(fakeController.initialize).toHaveBeenCalledTimes(1));
      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      const limit: EngineAnalysisLimit = { kind: "depth", value: 14 };
      const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

      let returnedId: string | null = null;
      act(() => {
        returnedId = result.current.analyze(fen, limit);
      });

      const call = (fakeController.analyze as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(returnedId);
      expect(returnedId).toMatch(/^req-\d+-\d+\.\d+$/);
    });

    it("analyze returns null when unmounted", async () => {
      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;

      const { result, unmount } = renderHook(() => useEngineAnalysis());

      await waitFor(() => expect(fakeController.initialize).toHaveBeenCalledTimes(1));
      unmount();

      let returned: string | null = "not-null";
      act(() => {
        returned = result.current.analyze("fen", { kind: "depth", value: 10 });
      });

      expect(returned).toBeNull();
    });

    it("analysis-info event stores its request ID", async () => {
      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;

      const { result } = renderHook(() => useEngineAnalysis());

      await waitFor(() => expect(fakeController.initialize).toHaveBeenCalledTimes(1));
      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      act(() => {
        result.current.analyze("fen", { kind: "depth", value: 10 });
      });

      act(() => {
        fakeController.emit({
          type: "analysis-info",
          requestId: "req-abc",
          info: { depth: 10, nodes: 1000, timeMs: 50 },
        });
      });

      expect(result.current.lastInfo).toEqual({ depth: 10, nodes: 1000, timeMs: 50 });
      expect(result.current.lastInfoRequestId).toBe("req-abc");
    });

    it("best-move event stores its request ID", async () => {
      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;

      const { result } = renderHook(() => useEngineAnalysis());

      await waitFor(() => expect(fakeController.initialize).toHaveBeenCalledTimes(1));
      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      act(() => {
        result.current.analyze("fen", { kind: "depth", value: 10 });
      });

      act(() => {
        fakeController.emit({
          type: "best-move",
          requestId: "req-xyz",
          move: { move: "e2e4", ponder: "e7e5" },
        });
      });

      expect(result.current.bestMove).toEqual({ move: "e2e4", ponder: "e7e5" });
      expect(result.current.bestMoveRequestId).toBe("req-xyz");
    });

    it("events from two different request IDs update corresponding fields correctly", async () => {
      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;

      const { result } = renderHook(() => useEngineAnalysis());

      await waitFor(() => expect(fakeController.initialize).toHaveBeenCalledTimes(1));
      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      act(() => {
        result.current.analyze("fen", { kind: "depth", value: 10 });
      });

      act(() => {
        fakeController.emit({
          type: "analysis-info",
          requestId: "req-1",
          info: { depth: 10, nodes: 1000, timeMs: 50 },
        });
      });

      act(() => {
        fakeController.emit({
          type: "analysis-info",
          requestId: "req-2",
          info: { depth: 20, nodes: 2000, timeMs: 100 },
        });
      });

      expect(result.current.lastInfo).toEqual({ depth: 20, nodes: 2000, timeMs: 100 });
      expect(result.current.lastInfoRequestId).toBe("req-2");

      act(() => {
        fakeController.emit({
          type: "best-move",
          requestId: "req-1",
          move: { move: "e2e4", ponder: null },
        });
      });

      expect(result.current.bestMove).toEqual({ move: "e2e4", ponder: null });
      expect(result.current.bestMoveRequestId).toBe("req-1");
    });

    it("queued request returns an ID and later correlated events expose the same ID", async () => {
      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;

      const { result } = renderHook(() => useEngineAnalysis());

      await waitFor(() => expect(fakeController.initialize).toHaveBeenCalledTimes(1));
      expect(result.current.status).toBe("loading");

      const id = result.current.analyze("fen", { kind: "depth", value: 10 });
      expect(id).not.toBeNull();

      act(() => {
        fakeController.emit({ type: "ready", requestId: "init-1" });
      });

      act(() => {
        fakeController.emit({
          type: "analysis-info",
          requestId: id as string,
          info: { depth: 10, nodes: 1000, timeMs: 50 },
        });
      });

      act(() => {
        fakeController.emit({
          type: "best-move",
          requestId: id as string,
          move: { move: "e2e4", ponder: "e7e5" },
        });
      });

      expect(result.current.lastInfoRequestId).toBe(id);
      expect(result.current.bestMoveRequestId).toBe(id);
    });
  });

  describe("engine ownership", () => {
    beforeEach(async () => {
      vi.resetModules();

      fakeWorker = createFakeWorker();
      fakeController = createFakeController(fakeWorker);

      vi.doMock("@/features/chess/engine-worker-factory", () => ({
        createStockfishWorkerFactory: vi.fn(() => {
          return () => fakeWorker;
        }),
      }));

      vi.doMock("@/features/chess/engine-controller", () => ({
        EngineController: vi.fn(function MockEngineController() {
          return fakeController;
        }),
      }));
    });
    it("claims engine ownership with id starting with engine-analysis-", async () => {
      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;
      const { getEngineOwnerId } = await import("@/features/chess/engine-ownership");

      renderHook(() => useEngineAnalysis());

      const ownerId = getEngineOwnerId();
      expect(ownerId).not.toBeNull();
      expect(ownerId?.startsWith("engine-analysis-")).toBe(true);
    });

    it("releases engine ownership on unmount", async () => {
      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;
      const { getEngineOwnerId } = await import("@/features/chess/engine-ownership");

      const { unmount } = renderHook(() => useEngineAnalysis());

      expect(getEngineOwnerId()).not.toBeNull();

      unmount();

      expect(getEngineOwnerId()).toBeNull();
    });

    it("disposes controller when another owner revokes it", async () => {
      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;
      const { acquireEngine } = await import("@/features/chess/engine-ownership");

      renderHook(() => useEngineAnalysis());

      expect(fakeController.dispose).not.toHaveBeenCalled();

      acquireEngine({ id: "other", onRevoked: () => {} });

      expect(fakeController.dispose).toHaveBeenCalledTimes(1);
    });

    it("two hook instances produce different owner ids", async () => {
      const mod = await import("@/features/chess/use-engine-analysis");
      const { useEngineAnalysis } = mod;
      const { getEngineOwnerId } = await import("@/features/chess/engine-ownership");

      const { unmount: unmountA } = renderHook(() => useEngineAnalysis());
      const idA = getEngineOwnerId();

      unmountA();

      const { unmount: unmountB } = renderHook(() => useEngineAnalysis());
      const idB = getEngineOwnerId();

      expect(idA).not.toBeNull();
      expect(idB).not.toBeNull();
      expect(idA).not.toEqual(idB);

      unmountB();
    });
  });
});
