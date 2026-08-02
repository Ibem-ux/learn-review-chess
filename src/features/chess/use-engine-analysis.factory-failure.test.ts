import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { EngineWorkerEvent } from "@/features/chess/engine";

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

describe("use-engine-analysis factory failure", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/features/chess/engine-worker-factory");
    vi.doUnmock("@/features/chess/engine-controller");
    vi.restoreAllMocks();
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

    expect(failingFactory).toHaveBeenCalledTimes(1);

    unmount();

    expect(failingFactory).toHaveBeenCalledTimes(1);
  });
});
