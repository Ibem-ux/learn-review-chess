import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
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

function minimalTimeline(analysisEligible: boolean): ReviewTimeline {
  return {
    analysisEligible,
    steps: [],
    totalPlies: 0,
    initialFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    finalFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  };
}

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

describe("use-quick-pass-analysis factory failure", () => {
  afterEach(() => {
    vi.resetModules();
  });

  beforeEach(async () => {
    const { resetEngineOwnership } = await import("@/features/chess/engine-ownership");
    resetEngineOwnership();
  });

  it("a factory failure during start does not revoke the previous engine owner", async () => {
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

    vi.doMock("@/features/chess/quick-pass-planner", () => ({
      planQuickPass: vi.fn(() => ({ ok: true, jobs: [] })),
    }));

    vi.doMock("@/features/chess/quick-pass-runner", () => ({
      QuickPassRunner: vi.fn(function MockQuickPassRunner() {
        return createFakeRunner();
      }),
    }));

    const { acquireEngine } = await import("@/features/chess/engine-ownership");
    const priorOnRevoked = vi.fn();
    acquireEngine({ id: "other", onRevoked: priorOnRevoked });

    const mod = await import("@/features/chess/use-quick-pass-analysis");
    const { useQuickPassAnalysis } = mod;

    const { result } = renderHook(() => useQuickPassAnalysis());

    const timeline = minimalTimeline(true);
    const limit: EngineAnalysisLimit = { kind: "depth", value: 14 };

    act(() => {
      result.current.start(timeline, limit);
    });

    expect(priorOnRevoked).toHaveBeenCalledTimes(0);
  });
});
