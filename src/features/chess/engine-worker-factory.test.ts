import { describe, expect, it, vi, afterEach } from "vitest";
import { createStockfishWorkerFactory, STOCKFISH_WORKER_URL } from "@/features/chess/engine-worker-factory";
import { EngineController } from "@/features/chess/engine-controller";

describe("engine-worker-factory", () => {
  const originalWorker = globalThis.Worker;

  afterEach(() => {
    Object.defineProperty(globalThis, "Worker", {
      value: originalWorker,
      writable: true,
      configurable: true,
    });
  });

  it("exports the canonical stockfish worker URL", () => {
    expect(STOCKFISH_WORKER_URL).toBe("/engines/stockfish/18.0.0/stockfish-18-lite-single.js");
  });

  describe("when Worker is unavailable", () => {
    it("throws a deterministic error", () => {
      Object.defineProperty(globalThis, "Worker", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      expect(() => createStockfishWorkerFactory()).toThrow("Web Workers are not available in this environment.");
    });
  });

  describe("when Worker is available", () => {
    let WorkerSpy: ReturnType<typeof vi.fn>;
    let workerInstances: Array<{
      postMessage: ReturnType<typeof vi.fn>;
      terminate: ReturnType<typeof vi.fn>;
      dispatch: (data: string) => void;
      dispatchError: (message: string) => void;
    }>;

    beforeEach(() => {
      workerInstances = [];
      WorkerSpy = vi.fn(function MockWorker() {
        const listeners: {
          message: Set<(event: MessageEvent<string>) => void>;
          error: Set<(event: ErrorEvent) => void>;
        } = {
          message: new Set(),
          error: new Set(),
        };
        const instance = {
          postMessage: vi.fn(),
          terminate: vi.fn(),
          addEventListener: vi.fn((type: string, handler: (event: MessageEvent<string> | ErrorEvent) => void) => {
            if (type === "message") listeners.message.add(handler);
            if (type === "error") listeners.error.add(handler);
          }),
          removeEventListener: vi.fn((type: string, handler: (event: MessageEvent<string> | ErrorEvent) => void) => {
            if (type === "message") listeners.message.delete(handler);
            if (type === "error") listeners.error.delete(handler);
          }),
          dispatch(data: string): void {
            for (const handler of listeners.message) {
              handler(new MessageEvent("message", { data }));
            }
          },
          dispatchError(message: string): void {
            for (const handler of listeners.error) {
              handler(new ErrorEvent("error", { message }));
            }
          },
        };
        workerInstances.push(instance);
        return instance;
      });

      Object.defineProperty(globalThis, "Worker", {
        value: WorkerSpy,
        writable: true,
        configurable: true,
      });
    });

    it("produces a fresh worker on each factory invocation", () => {
      const factory = createStockfishWorkerFactory();
      const first = factory();
      const second = factory();

      expect(first).not.toBe(second);
      expect(WorkerSpy).toHaveBeenCalledTimes(2);
      expect(WorkerSpy).toHaveBeenNthCalledWith(1, STOCKFISH_WORKER_URL);
      expect(WorkerSpy).toHaveBeenNthCalledWith(2, STOCKFISH_WORKER_URL);
    });

    it("forwards postMessage to the native worker", () => {
      const factory = createStockfishWorkerFactory();
      const worker = factory();

      worker.postMessage("uci");

      expect(workerInstances[0].postMessage).toHaveBeenCalledWith("uci");
    });

    it("forwards terminate to the native worker", () => {
      const factory = createStockfishWorkerFactory();
      const worker = factory();

      worker.terminate();

      expect(workerInstances[0].terminate).toHaveBeenCalledOnce();
    });

    it("bridges native message events to addMessageListener", () => {
      const factory = createStockfishWorkerFactory();
      const worker = factory();
      const listener = vi.fn();

      worker.addMessageListener(listener);
      workerInstances[0].dispatch("uciok");

      expect(listener).toHaveBeenCalledWith("uciok");
    });

    it("bridges native error events to addErrorListener", () => {
      const factory = createStockfishWorkerFactory();
      const worker = factory();
      const listener = vi.fn();

      worker.addErrorListener(listener);
      workerInstances[0].dispatchError("something went wrong");

      expect(listener).toHaveBeenCalledWith("something went wrong");
    });

    it("removes message listeners", () => {
      const factory = createStockfishWorkerFactory();
      const worker = factory();
      const listener = vi.fn();

      worker.addMessageListener(listener);
      worker.removeMessageListener(listener);
      workerInstances[0].dispatch("uciok");

      expect(listener).not.toHaveBeenCalled();
    });

    it("removes error listeners", () => {
      const factory = createStockfishWorkerFactory();
      const worker = factory();
      const listener = vi.fn();

      worker.addErrorListener(listener);
      worker.removeErrorListener(listener);
      workerInstances[0].dispatchError("boom");

      expect(listener).not.toHaveBeenCalled();
    });

    it("composes with EngineController via its WorkerFactory path", () => {
      const factory = createStockfishWorkerFactory();
      const controller = new EngineController(factory);
      const events: unknown[] = [];

      const unsub = controller.subscribe((event) => {
        events.push(event);
      });

      controller.initialize();
      expect(events.some((e) => (e as { type: string }).type === "loading")).toBe(true);

      unsub();
    });
  });
});
