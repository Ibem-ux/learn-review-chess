import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { StrictMode, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { EngineWorkerEvent } from "@/features/chess/engine";
import type { AnalysisCache, CachedAnalysis } from "@/features/chess/analysis-cache";
import type { UsePositionAnalysis } from "@/features/chess/use-position-analysis";

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
      internalStatus = "analyzing";
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

const CACHED_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
const UNCACHED_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function buildCache(entries: [string, CachedAnalysis][]): AnalysisCache {
  return new Map(entries);
}

let fakeWorker: FakeWorker;
let fakeController: FakeController;

describe("use-position-analysis", () => {
  afterEach(() => {
    vi.resetModules();
  });

  beforeEach(async () => {
    const { resetEngineOwnership } = await import("@/features/chess/engine-ownership");
    resetEngineOwnership();
  });

  it("fen null returns null point, empty arrows, false isAnalyzing, and makes no engine request", async () => {
    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => () => fakeWorker),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        return fakeController;
      }),
    }));

    const mod = await import("@/features/chess/use-position-analysis");
    const { usePositionAnalysis } = mod;

    const cache = buildCache([]);
    const { result } = renderHook(() => usePositionAnalysis({ fen: null, cache, enabled: true }));

    expect(result.current.point).toBeNull();
    expect(result.current.arrows).toEqual([]);
    expect(result.current.isAnalyzing).toBe(false);
    expect(fakeController.analyze).not.toHaveBeenCalled();
  });

  it("enabled false with cache miss returns null point, empty arrows, false isAnalyzing, and makes no engine request", async () => {
    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => () => fakeWorker),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        return fakeController;
      }),
    }));

    const mod = await import("@/features/chess/use-position-analysis");
    const { usePositionAnalysis } = mod;

    const cache = buildCache([]);
    const { result } = renderHook(() => usePositionAnalysis({ fen: UNCACHED_FEN, cache, enabled: false }));

    expect(result.current.point).toBeNull();
    expect(result.current.arrows).toEqual([]);
    expect(result.current.isAnalyzing).toBe(false);
    expect(fakeController.analyze).not.toHaveBeenCalled();
  });

  it("enabled false with cache hit serves cache without engine request", async () => {
    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => () => fakeWorker),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        return fakeController;
      }),
    }));

    const mod = await import("@/features/chess/use-position-analysis");
    const { usePositionAnalysis } = mod;

    const cachedAnalysis: CachedAnalysis = {
      fen: CACHED_FEN,
      score: { type: "cp", value: 50, perspective: "white" },
      depth: 10,
      lines: [],
    };
    const cache = buildCache([[CACHED_FEN, cachedAnalysis]]);
    const { result } = renderHook(() => usePositionAnalysis({ fen: CACHED_FEN, cache, enabled: false }));

    expect(result.current.point).toEqual({
      ply: 0,
      hasValue: true,
      clampedCp: 50,
      advantage: 0.525,
      isMate: false,
      san: null,
    });
    expect(result.current.isAnalyzing).toBe(false);
    expect(fakeController.analyze).not.toHaveBeenCalled();
  });

  it("cache hit serves cache immediately with isAnalyzing false", async () => {
    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => () => fakeWorker),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        return fakeController;
      }),
    }));

    const mod = await import("@/features/chess/use-position-analysis");
    const { usePositionAnalysis } = mod;

    const cachedAnalysis: CachedAnalysis = {
      fen: CACHED_FEN,
      score: { type: "cp", value: 50, perspective: "white" },
      depth: 10,
      lines: [],
    };
    const cache = buildCache([[CACHED_FEN, cachedAnalysis]]);
    const { result } = renderHook(() => usePositionAnalysis({ fen: CACHED_FEN, cache, enabled: true }));

    expect(result.current.point).toEqual({
      ply: 0,
      hasValue: true,
      clampedCp: 50,
      advantage: 0.525,
      isMate: false,
      san: null,
    });
    expect(result.current.isAnalyzing).toBe(false);
    expect(fakeController.analyze).not.toHaveBeenCalled();
  });

  it("cache hit dispatches zero analyses", async () => {
    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => () => fakeWorker),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        return fakeController;
      }),
    }));

    const mod = await import("@/features/chess/use-position-analysis");
    const { usePositionAnalysis } = mod;

    const cachedAnalysis: CachedAnalysis = {
      fen: CACHED_FEN,
      score: { type: "cp", value: 50, perspective: "white" },
      depth: 10,
      lines: [],
    };
    const cache = buildCache([[CACHED_FEN, cachedAnalysis]]);
    const { result } = renderHook(() => usePositionAnalysis({ fen: CACHED_FEN, cache, enabled: true }));

    expect(result.current.point).not.toBeNull();
    expect(fakeController.analyze).not.toHaveBeenCalled();
  });

  it("cache miss with enabled true dispatches analysis after debounce and isAnalyzing toggles correctly", async () => {
    vi.useFakeTimers();
    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => () => fakeWorker),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        return fakeController;
      }),
    }));

    const mod = await import("@/features/chess/use-position-analysis");
    const { usePositionAnalysis } = mod;

    const cache = buildCache([]);
    const { result } = renderHook(() =>
      usePositionAnalysis({ fen: UNCACHED_FEN, cache, enabled: true, debounceMs: 300 })
    );

    expect(result.current.isAnalyzing).toBe(false);

    act(() => {
      fakeController.emit({ type: "ready", requestId: "init-1" });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.isAnalyzing).toBe(true);
    expect(fakeController.analyze).toHaveBeenCalledTimes(1);

    const analyzeRequestId = fakeController.analyze.mock.calls[0][0];

    act(() => {
      fakeController.emit({
        type: "analysis-info",
        requestId: analyzeRequestId,
        info: { depth: 10, multipv: 1, pv: ["e2e4"], score: { type: "cp", value: 30, perspective: "white" } },
      });
    });

    act(() => {
      fakeController.emit({
        type: "best-move",
        requestId: analyzeRequestId,
        move: { move: "e2e4", ponder: null },
      });
    });

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.point).toEqual({
      ply: 0,
      hasValue: true,
      clampedCp: 30,
      advantage: 0.515,
      isMate: false,
      san: null,
    });

    vi.useRealTimers();
  });

  it("isAnalyzing is false before, true during, and false after analysis", async () => {
    vi.useFakeTimers();
    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => () => fakeWorker),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        return fakeController;
      }),
    }));

    const mod = await import("@/features/chess/use-position-analysis");
    const { usePositionAnalysis } = mod;

    const cache = buildCache([]);
    const { result } = renderHook(() =>
      usePositionAnalysis({ fen: UNCACHED_FEN, cache, enabled: true, debounceMs: 300 })
    );

    expect(result.current.isAnalyzing).toBe(false);

    act(() => {
      fakeController.emit({ type: "ready", requestId: "init-1" });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.isAnalyzing).toBe(true);

    const analyzeRequestId = fakeController.analyze.mock.calls[0][0];

    act(() => {
      fakeController.emit({
        type: "analysis-info",
        requestId: analyzeRequestId,
        info: { depth: 10, multipv: 1, pv: ["e2e4"], score: { type: "cp", value: 30, perspective: "white" } },
      });
    });

    act(() => {
      fakeController.emit({
        type: "best-move",
        requestId: analyzeRequestId,
        move: { move: "e2e4", ponder: null },
      });
    });

    expect(result.current.isAnalyzing).toBe(false);

    vi.useRealTimers();
  });

  it("two rapid fen changes dispatch exactly one analysis and it is for the second fen", async () => {
    vi.useFakeTimers();
    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => () => fakeWorker),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        return fakeController;
      }),
    }));

    const mod = await import("@/features/chess/use-position-analysis");
    const { usePositionAnalysis } = mod;

    const cache = buildCache([]);
    const { rerender } = renderHook(
      ({ fen }) => usePositionAnalysis({ fen, cache, enabled: true, debounceMs: 300 }),
      { initialProps: { fen: UNCACHED_FEN } }
    );

    act(() => {
      fakeController.emit({ type: "ready", requestId: "init-1" });
    });

    act(() => {
      rerender({ fen: UNCACHED_FEN + "2" });
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    act(() => {
      rerender({ fen: UNCACHED_FEN + "3" });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(fakeController.analyze).toHaveBeenCalledTimes(1);
    expect(fakeController.analyze.mock.calls[0][1].fen).toBe(
      UNCACHED_FEN + "3"
    );

    vi.useRealTimers();
  });

  it("fen changing back to a cached position while a debounce is pending cancels the pending request and serves the cache", async () => {
    vi.useFakeTimers();
    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => () => fakeWorker),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        return fakeController;
      }),
    }));

    const mod = await import("@/features/chess/use-position-analysis");
    const { usePositionAnalysis } = mod;

    const cachedAnalysis: CachedAnalysis = {
      fen: CACHED_FEN,
      score: { type: "cp", value: 50, perspective: "white" },
      depth: 10,
      lines: [],
    };
    const cache = buildCache([[CACHED_FEN, cachedAnalysis]]);
    const { result, rerender } = renderHook(
      ({ fen }) => usePositionAnalysis({ fen, cache, enabled: true, debounceMs: 300 }),
      { initialProps: { fen: UNCACHED_FEN } }
    );

    act(() => {
      fakeController.emit({ type: "ready", requestId: "init-1" });
    });

    act(() => {
      vi.advanceTimersByTime(100);
      rerender({ fen: CACHED_FEN });
    });

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.point).toEqual({
      ply: 0,
      hasValue: true,
      clampedCp: 50,
      advantage: 0.525,
      isMate: false,
      san: null,
    });
    expect(fakeController.analyze).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(fakeController.analyze).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("unmount during a pending debounce clears the timer and dispatches nothing", async () => {
    vi.useFakeTimers();
    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => () => fakeWorker),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        return fakeController;
      }),
    }));

    const mod = await import("@/features/chess/use-position-analysis");
    const { usePositionAnalysis } = mod;

    const cache = buildCache([]);
    const { unmount } = renderHook(() =>
      usePositionAnalysis({ fen: UNCACHED_FEN, cache, enabled: true, debounceMs: 300 })
    );

    act(() => {
      fakeController.emit({ type: "ready", requestId: "init-1" });
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(fakeController.analyze).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("does not show stale data while analyzing", async () => {
    vi.useFakeTimers();
    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => () => fakeWorker),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        return fakeController;
      }),
    }));

    const mod = await import("@/features/chess/use-position-analysis");
    const { usePositionAnalysis } = mod;

    const cachedAnalysis: CachedAnalysis = {
      fen: CACHED_FEN,
      score: { type: "cp", value: 50, perspective: "white" },
      depth: 10,
      lines: [],
    };
    const cache = buildCache([[CACHED_FEN, cachedAnalysis]]);
    const { result, rerender } = renderHook(
      ({ fen }) => usePositionAnalysis({ fen, cache, enabled: true, debounceMs: 300 }),
      { initialProps: { fen: CACHED_FEN } }
    );

    expect(result.current.point).toEqual({
      ply: 0,
      hasValue: true,
      clampedCp: 50,
      advantage: 0.525,
      isMate: false,
      san: null,
    });

    act(() => {
      fakeController.emit({ type: "ready", requestId: "init-1" });
    });

    act(() => {
      rerender({ fen: UNCACHED_FEN });
    });

    act(() => {
      fakeController.emit({ type: "ready", requestId: "init-1" });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.isAnalyzing).toBe(true);
    expect(result.current.point).toBeNull();
    expect(result.current.arrows).toEqual([]);

    vi.useRealTimers();
  });

  it("fen changing to a cached position during analysis serves cache immediately", async () => {
    vi.useFakeTimers();
    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => () => fakeWorker),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        return fakeController;
      }),
    }));

    const mod = await import("@/features/chess/use-position-analysis");
    const { usePositionAnalysis } = mod;

    const cachedAnalysis: CachedAnalysis = {
      fen: CACHED_FEN,
      score: { type: "cp", value: 50, perspective: "white" },
      depth: 10,
      lines: [],
    };
    const cache = buildCache([[CACHED_FEN, cachedAnalysis]]);
    const { result, rerender } = renderHook(
      ({ fen }) => usePositionAnalysis({ fen, cache, enabled: true, debounceMs: 300 }),
      { initialProps: { fen: UNCACHED_FEN } }
    );

    act(() => {
      fakeController.emit({ type: "ready", requestId: "init-1" });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.isAnalyzing).toBe(true);

    act(() => {
      rerender({ fen: CACHED_FEN });
    });

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.point).toEqual({
      ply: 0,
      hasValue: true,
      clampedCp: 50,
      advantage: 0.525,
      isMate: false,
      san: null,
    });

    vi.useRealTimers();
  });

  it("engine error during analysis sets isAnalyzing to false", async () => {
    vi.useFakeTimers();
    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => () => fakeWorker),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        return fakeController;
      }),
    }));

    const mod = await import("@/features/chess/use-position-analysis");
    const { usePositionAnalysis } = mod;

    const cache = buildCache([]);
    const { result } = renderHook(() =>
      usePositionAnalysis({ fen: UNCACHED_FEN, cache, enabled: true, debounceMs: 300 })
    );

    act(() => {
      fakeController.emit({ type: "ready", requestId: "init-1" });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.isAnalyzing).toBe(true);

    const analyzeRequestId = fakeController.analyze.mock.calls[0][0];

    act(() => {
      fakeController.emit({
        type: "error",
        requestId: analyzeRequestId,
        message: "Analysis failed.",
      });
    });

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.point).toBeNull();
    expect(result.current.arrows).toEqual([]);

    vi.useRealTimers();
  });

  it("when engine lines arrive, build point and arrows from them and set isAnalyzing false", async () => {
    vi.useFakeTimers();
    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => () => fakeWorker),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        return fakeController;
      }),
    }));

    const mod = await import("@/features/chess/use-position-analysis");
    const { usePositionAnalysis } = mod;

    const cache = buildCache([]);
    const { result } = renderHook(() =>
      usePositionAnalysis({ fen: UNCACHED_FEN, cache, enabled: true, debounceMs: 300 })
    );

    act(() => {
      fakeController.emit({ type: "ready", requestId: "init-1" });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.isAnalyzing).toBe(true);

    const analyzeRequestId = fakeController.analyze.mock.calls[0][0];

    act(() => {
      fakeController.emit({
        type: "analysis-info",
        requestId: analyzeRequestId,
        info: { depth: 10, multipv: 1, pv: ["e2e4"], score: { type: "cp", value: 30, perspective: "white" } },
      });
    });

    act(() => {
      fakeController.emit({
        type: "analysis-info",
        requestId: analyzeRequestId,
        info: { depth: 10, multipv: 2, pv: ["d2d4"], score: { type: "cp", value: 20, perspective: "white" } },
      });
    });

    act(() => {
      fakeController.emit({
        type: "best-move",
        requestId: analyzeRequestId,
        move: { move: "e2e4", ponder: null },
      });
    });

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.point).toEqual({
      ply: 0,
      hasValue: true,
      clampedCp: 30,
      advantage: 0.515,
      isMate: false,
      san: null,
    });
    expect(result.current.arrows).toEqual([
      { startSquare: "e2", endSquare: "e4", color: "#22c55e" },
      { startSquare: "d2", endSquare: "d4", color: "#3b82f6" },
    ]);

    vi.useRealTimers();
  });

  it("while analyzing with no usable result yet, point is null and arrows are empty", async () => {
    vi.useFakeTimers();
    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => () => fakeWorker),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        return fakeController;
      }),
    }));

    const mod = await import("@/features/chess/use-position-analysis");
    const { usePositionAnalysis } = mod;

    const cache = buildCache([]);
    const { result } = renderHook(() =>
      usePositionAnalysis({ fen: UNCACHED_FEN, cache, enabled: true, debounceMs: 300 })
    );

    act(() => {
      fakeController.emit({ type: "ready", requestId: "init-1" });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.isAnalyzing).toBe(true);
    expect(result.current.point).toBeNull();
    expect(result.current.arrows).toEqual([]);

    vi.useRealTimers();
  });

  it("side-to-move score with white to move normalizes to white perspective", async () => {
    vi.useFakeTimers();
    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => () => fakeWorker),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        return fakeController;
      }),
    }));

    const mod = await import("@/features/chess/use-position-analysis");
    const { usePositionAnalysis } = mod;

    const cache = buildCache([]);
    const { result } = renderHook(() =>
      usePositionAnalysis({ fen: UNCACHED_FEN, cache, enabled: true, debounceMs: 300 })
    );

    act(() => {
      fakeController.emit({ type: "ready", requestId: "init-1" });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    const analyzeRequestId = fakeController.analyze.mock.calls[0][0];

    act(() => {
      fakeController.emit({
        type: "analysis-info",
        requestId: analyzeRequestId,
        info: {
          depth: 10,
          multipv: 1,
          pv: ["e2e4"],
          score: { type: "cp", value: 40, perspective: "side-to-move" },
        },
      });
    });

    act(() => {
      fakeController.emit({
        type: "best-move",
        requestId: analyzeRequestId,
        move: { move: "e2e4", ponder: null },
      });
    });

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.point).toEqual({
      ply: 0,
      hasValue: true,
      clampedCp: 40,
      advantage: 0.52,
      isMate: false,
      san: null,
    });

    vi.useRealTimers();
  });

  it("side-to-move score with black to move flips sign for white perspective", async () => {
    vi.useFakeTimers();
    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => () => fakeWorker),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        return fakeController;
      }),
    }));

    const mod = await import("@/features/chess/use-position-analysis");
    const { usePositionAnalysis } = mod;

    const cache = buildCache([]);
    const { result } = renderHook(() =>
      usePositionAnalysis({ fen: CACHED_FEN, cache, enabled: true, debounceMs: 300 })
    );

    act(() => {
      fakeController.emit({ type: "ready", requestId: "init-1" });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    const analyzeRequestId = fakeController.analyze.mock.calls[0][0];

    act(() => {
      fakeController.emit({
        type: "analysis-info",
        requestId: analyzeRequestId,
        info: {
          depth: 10,
          multipv: 1,
          pv: ["e7e5"],
          score: { type: "cp", value: 30, perspective: "side-to-move" },
        },
      });
    });

    act(() => {
      fakeController.emit({
        type: "best-move",
        requestId: analyzeRequestId,
        move: { move: "e7e5", ponder: null },
      });
    });

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.point).toEqual({
      ply: 0,
      hasValue: true,
      clampedCp: -30,
      advantage: 0.485,
      isMate: false,
      san: null,
    });

    vi.useRealTimers();
  });

  it("side-to-move mate score normalizes correctly for white perspective", async () => {
    vi.useFakeTimers();
    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => () => fakeWorker),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        return fakeController;
      }),
    }));

    const mod = await import("@/features/chess/use-position-analysis");
    const { usePositionAnalysis } = mod;

    const cache = buildCache([]);
    const { result } = renderHook(() =>
      usePositionAnalysis({ fen: CACHED_FEN, cache, enabled: true, debounceMs: 300 })
    );

    act(() => {
      fakeController.emit({ type: "ready", requestId: "init-1" });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    const analyzeRequestId = fakeController.analyze.mock.calls[0][0];

    act(() => {
      fakeController.emit({
        type: "analysis-info",
        requestId: analyzeRequestId,
        info: {
          depth: 10,
          multipv: 1,
          pv: ["e7e5"],
          score: { type: "mate", value: 2, perspective: "side-to-move" },
        },
      });
    });

    act(() => {
      fakeController.emit({
        type: "best-move",
        requestId: analyzeRequestId,
        move: { move: "e7e5", ponder: null },
      });
    });

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.point).toEqual({
      ply: 0,
      hasValue: true,
      clampedCp: -1000,
      advantage: 0,
      isMate: true,
      san: null,
    });

    vi.useRealTimers();
  });

  it("fen change during analysis calls stop and dispatches replacement exactly once", async () => {
    vi.useFakeTimers();
    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => () => fakeWorker),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        return fakeController;
      }),
    }));

    const mod = await import("@/features/chess/use-position-analysis");
    const { usePositionAnalysis } = mod;

    const cache = buildCache([]);
    const { rerender } = renderHook(
      ({ fen }) => usePositionAnalysis({ fen, cache, enabled: true, debounceMs: 300 }),
      { initialProps: { fen: UNCACHED_FEN } }
    );

    act(() => {
      fakeController.emit({ type: "ready", requestId: "init-1" });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(fakeController.analyze).toHaveBeenCalledTimes(1);
    expect(fakeController.stop).not.toHaveBeenCalled();

    act(() => {
      rerender({ fen: CACHED_FEN });
    });

    expect(fakeController.stop).toHaveBeenCalledTimes(1);

    act(() => {
      fakeController.emit({ type: "stopped", requestId: fakeController.analyze.mock.calls[0][0] });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(fakeController.analyze).toHaveBeenCalledTimes(2);
    expect(fakeController.analyze.mock.calls[1][1].fen).toBe(CACHED_FEN);

    vi.useRealTimers();
  });

  it("clearTimeout isolation: duplicate dispatch count increases when clearTimeout is absent", async () => {
    vi.useFakeTimers();
    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => () => fakeWorker),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        return fakeController;
      }),
    }));

    const mod = await import("@/features/chess/use-position-analysis");
    const { usePositionAnalysis } = mod;

    const cache = buildCache([]);
    const { rerender } = renderHook(
      ({ debounceMs }) => usePositionAnalysis({ fen: UNCACHED_FEN, cache, enabled: true, debounceMs }),
      { initialProps: { debounceMs: 300 } }
    );

    act(() => {
      fakeController.emit({ type: "ready", requestId: "init-1" });
    });

    rerender({ debounceMs: 301 });

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(fakeController.analyze).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("cold start does not dispatch while engine is loading", async () => {
    vi.useFakeTimers();
    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => () => fakeWorker),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        return fakeController;
      }),
    }));

    const mod = await import("@/features/chess/use-position-analysis");
    const { usePositionAnalysis } = mod;

    const cache = buildCache([]);
    const { result } = renderHook(() =>
      usePositionAnalysis({ fen: UNCACHED_FEN, cache, enabled: true, debounceMs: 300 })
    );

    expect(result.current.isAnalyzing).toBe(false);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(fakeController.analyze).not.toHaveBeenCalled();
    expect(fakeController.stop).not.toHaveBeenCalled();
    expect(result.current.isAnalyzing).toBe(false);

    act(() => {
      fakeController.emit({ type: "ready", requestId: "init-1" });
    });

    expect(fakeController.analyze).toHaveBeenCalledTimes(1);
    expect(fakeController.analyze.mock.calls[0][1].fen).toBe(UNCACHED_FEN);

    vi.useRealTimers();
  });

  it("remount after unmount restores mountedRef and dispatches correctly", async () => {
    vi.useFakeTimers();
    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => () => fakeWorker),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        return fakeController;
      }),
    }));

    const mod = await import("@/features/chess/use-position-analysis");
    const { usePositionAnalysis } = mod;

    const cache = buildCache([]);

    const capturedResultRef: { current: UsePositionAnalysis | null } = { current: null };

    function TestComponent() {
      capturedResultRef.current = usePositionAnalysis({ fen: UNCACHED_FEN, cache, enabled: true, debounceMs: 300 });
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    root.render(createElement(StrictMode, null, createElement(TestComponent)));

    await act(async () => {
      await Promise.resolve();
    });

    root.unmount();

    const container2 = document.createElement("div");
    document.body.appendChild(container2);
    const root2 = createRoot(container2);

    root2.render(createElement(StrictMode, null, createElement(TestComponent)));

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      fakeController.emit({ type: "ready", requestId: "init-1" });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(capturedResultRef.current?.isAnalyzing).toBe(true);

    const analyzeRequestId = fakeController.analyze.mock.calls[0][0];

    act(() => {
      fakeController.emit({
        type: "analysis-info",
        requestId: analyzeRequestId,
        info: { depth: 10, multipv: 1, pv: ["e2e4"], score: { type: "cp", value: 30, perspective: "white" } },
      });
    });

    act(() => {
      fakeController.emit({
        type: "best-move",
        requestId: analyzeRequestId,
        move: { move: "e2e4", ponder: null },
      });
    });

    expect(capturedResultRef.current?.isAnalyzing).toBe(false);
    expect(capturedResultRef.current?.point).toEqual({
      ply: 0,
      hasValue: true,
      clampedCp: 30,
      advantage: 0.515,
      isMate: false,
      san: null,
    });

    root2.unmount();
    document.body.removeChild(container);
    document.body.removeChild(container2);

    vi.useRealTimers();
  });

  it("unmount does not leak ownership when dispose throws", async () => {
    vi.useFakeTimers();
    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);
    fakeController.dispose.mockImplementation(() => {
      throw new Error("dispose failed");
    });

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => () => fakeWorker),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        return fakeController;
      }),
    }));

    const mod = await import("@/features/chess/use-position-analysis");
    const { usePositionAnalysis } = mod;

    const cache = buildCache([]);
    const { unmount } = renderHook(() =>
      usePositionAnalysis({ fen: UNCACHED_FEN, cache, enabled: true, debounceMs: 300 })
    );

    act(() => {
      fakeController.emit({ type: "ready", requestId: "init-1" });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    const { getEngineOwnerId } = await import("@/features/chess/engine-ownership");
    expect(getEngineOwnerId()).not.toBeNull();

    unmount();

    expect(getEngineOwnerId()).toBeNull();

    vi.useRealTimers();
  });

  it("acquireEngine is not called for a null fen", async () => {
    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => () => fakeWorker),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        return fakeController;
      }),
    }));

    const mod = await import("@/features/chess/use-position-analysis");
    const { usePositionAnalysis } = mod;

    const cache = buildCache([]);
    const { unmount } = renderHook(() => usePositionAnalysis({ fen: null, cache, enabled: true }));

    const { getEngineOwnerId } = await import("@/features/chess/engine-ownership");
    expect(getEngineOwnerId()).toBeNull();

    unmount();
    expect(getEngineOwnerId()).toBeNull();
  });

  it("acquireEngine is not called for a cache hit", async () => {
    fakeWorker = createFakeWorker();
    fakeController = createFakeController(fakeWorker);

    vi.doMock("@/features/chess/engine-worker-factory", () => ({
      createStockfishWorkerFactory: vi.fn(() => () => fakeWorker),
    }));

    vi.doMock("@/features/chess/engine-controller", () => ({
      EngineController: vi.fn(function MockEngineController() {
        return fakeController;
      }),
    }));

    const mod = await import("@/features/chess/use-position-analysis");
    const { usePositionAnalysis } = mod;

    const cachedAnalysis: CachedAnalysis = {
      fen: CACHED_FEN,
      score: { type: "cp", value: 50, perspective: "white" },
      depth: 10,
      lines: [],
    };
    const cache = buildCache([[CACHED_FEN, cachedAnalysis]]);
    const { unmount } = renderHook(() => usePositionAnalysis({ fen: CACHED_FEN, cache, enabled: true }));

    const { getEngineOwnerId } = await import("@/features/chess/engine-ownership");
    expect(getEngineOwnerId()).toBeNull();

    unmount();
    expect(getEngineOwnerId()).toBeNull();
  });
});
