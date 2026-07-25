import type { WorkerLike, WorkerFactory } from "./engine-controller";

export const STOCKFISH_WORKER_URL = "/engines/stockfish/18.0.0/stockfish-18-lite-single.js";

function isWorkerAvailable(): boolean {
  return typeof globalThis.Worker !== "undefined";
}

function createWorkerAdapter(worker: globalThis.Worker): WorkerLike {
  const messageListeners = new Set<(data: string) => void>();
  const errorListeners = new Set<(message: string) => void>();

  const handleMessage = (event: MessageEvent<string>): void => {
    const data = typeof event.data === "string" ? event.data : String(event.data);
    for (const listener of messageListeners) {
      listener(data);
    }
  };

  const handleError = (event: ErrorEvent): void => {
    const message = event.message ?? "Unknown worker error";
    for (const listener of errorListeners) {
      listener(message);
    }
  };

  worker.addEventListener("message", handleMessage);
  worker.addEventListener("error", handleError);

  return {
    postMessage(data: string): void {
      worker.postMessage(data);
    },
    terminate(): void {
      worker.terminate();
    },
    addMessageListener(listener: (data: string) => void): void {
      messageListeners.add(listener);
    },
    removeMessageListener(listener: (data: string) => void): void {
      messageListeners.delete(listener);
    },
    addErrorListener(listener: (message: string) => void): void {
      errorListeners.add(listener);
    },
    removeErrorListener(listener: (message: string) => void): void {
      errorListeners.delete(listener);
    },
  };
}

export function createStockfishWorkerFactory(): WorkerFactory {
  if (!isWorkerAvailable()) {
    throw new Error("Web Workers are not available in this environment.");
  }

  return (): WorkerLike => {
    const worker = new globalThis.Worker(STOCKFISH_WORKER_URL);
    return createWorkerAdapter(worker);
  };
}
