import type {
  EngineStatus,
  EngineConfiguration,
  EngineAnalysisLimit,
  EngineWorkerEvent,
  EngineInfo,
} from "./engine";
import {
  UCI,
  ISREADY,
  STOP,
  QUIT,
  setoptionThreads,
  setoptionHash,
  setoptionMultiPv,
  positionFen,
  goDepth,
  goNodes,
  goMovetime,
  parseUciLine,
  type CommandResult,
} from "./uci";

export type WorkerLike = {
  postMessage(data: string): void;
  terminate(): void;
  addMessageListener(listener: (data: string) => void): void;
  removeMessageListener(listener: (data: string) => void): void;
  addErrorListener(listener: (message: string) => void): void;
  removeErrorListener(listener: (message: string) => void): void;
};

export type WorkerFactory = () => WorkerLike;

type InternalPhase = "idle" | "loading" | "ready" | "analyzing" | "error";

type ActivePayload = {
  fen: string;
  limit: EngineAnalysisLimit;
  multiPv?: number;
};

type QueuedRequest = {
  id: string;
  payload: ActivePayload;
};

type BaseState = {
  phase: InternalPhase;
  worker: WorkerLike | null;
  activeRequestId: string | null;
  canceling: boolean;
  queuedRequests: QueuedRequest[];
  listeners: Set<(event: EngineWorkerEvent) => void>;
  disposed: boolean;
  defaultConfiguration?: EngineConfiguration;
  initializationRequestId: string | null;
};

type IdleState = BaseState & { phase: "idle" };
type LoadingState = BaseState & { phase: "loading" };
type ReadyState = BaseState & { phase: "ready" };
type AnalyzingState = BaseState & { phase: "analyzing" };
type ErrorState = BaseState & { phase: "error" };

type State = IdleState | LoadingState | ReadyState | AnalyzingState | ErrorState;

function createInitialState(): BaseState {
  return {
    phase: "idle",
    worker: null,
    activeRequestId: null,
    canceling: false,
    queuedRequests: [],
    listeners: new Set(),
    disposed: false,
    initializationRequestId: null,
  };
}

export class EngineController {
  private state: State;
  private readonly workerFactory?: WorkerFactory;
  private workerLike?: WorkerLike;
  private idCounter = 0;

  constructor(workerLikeOrFactory: WorkerLike | WorkerFactory) {
    if (typeof (workerLikeOrFactory as WorkerLike).postMessage === "function") {
      this.workerLike = workerLikeOrFactory as WorkerLike;
    } else {
      this.workerFactory = workerLikeOrFactory as WorkerFactory;
    }
    this.state = createInitialState();
  }

  get status(): EngineStatus {
    return this.state.phase;
  }

  subscribe(listener: (event: EngineWorkerEvent) => void): () => void {
    this.state.listeners.add(listener);
    return () => {
      this.state.listeners.delete(listener);
    };
  }

  initialize(payload?: { configuration?: EngineConfiguration }): void {
    if (this.state.disposed) {
      this.emitError("Controller is disposed.", "");
      return;
    }

    if (this.state.phase === "loading" || this.state.phase === "ready") {
      return;
    }

    const requestId = `init-${++this.idCounter}`;
    const configuration = payload?.configuration;

    let worker: WorkerLike;
    if (this.workerLike) {
      worker = this.workerLike;
    } else if (this.workerFactory) {
      worker = this.workerFactory();
    } else {
      this.emitError("No worker source available.", null);
      return;
    }

    worker.addMessageListener(this.handleMessage);
    worker.addErrorListener(this.handleError);

    this.state = {
      ...this.state,
      phase: "loading",
      worker,
      defaultConfiguration: configuration,
      initializationRequestId: requestId,
    };

    this.emit({ type: "loading", requestId });

    worker.postMessage(UCI);
  }

  analyze(id: string, payload: { fen: string; limit: EngineAnalysisLimit; multiPv?: number }): void {
    if (this.state.disposed) {
      this.emitError("Controller is disposed.", id);
      return;
    }

    if (this.state.phase === "idle" || this.state.phase === "error") {
      this.emitError("Engine is not initialized. Call initialize first.", id);
      return;
    }

    const fenResult = positionFen(payload.fen);
    if (!fenResult.ok) {
      this.emitError(`Invalid FEN: ${fenResult.reason}`, id);
      return;
    }

    const limitCommand = this.formatLimit(payload.limit);
    if (!limitCommand.ok) {
      this.emitError(`Invalid analysis limit: ${limitCommand.reason}`, id);
      return;
    }

    const queued: QueuedRequest = { id, payload };

    if (this.state.phase === "ready") {
      this.startAnalysis(queued);
      return;
    }

    if (this.state.phase === "analyzing" || this.state.phase === "loading") {
      const superseded = this.state.queuedRequests.filter((r) => r.id !== id);
      for (const request of superseded) {
        this.emit({ type: "stopped", requestId: request.id });
      }

      this.state = {
        ...this.state,
        queuedRequests: [queued],
      };
      if (this.state.phase === "analyzing" && !this.state.canceling && this.state.activeRequestId !== id) {
        this.sendStop();
        this.state = { ...this.state, canceling: true };
      }
      return;
    }
  }

  stop(): void {
    if (this.state.disposed) return;
    if (this.state.phase !== "analyzing") return;

    if (this.state.canceling) {
      const queuedRequest = this.state.queuedRequests[0];
      if (queuedRequest) {
        this.emit({ type: "stopped", requestId: queuedRequest.id });
      }
      this.state = {
        ...this.state,
        queuedRequests: [],
      };
      return;
    }

    this.sendStop();
    this.state = { ...this.state, canceling: true };
  }

  dispose(): void {
    if (this.state.disposed) return;

    const worker = this.state.worker;
    if (worker && this.state.phase === "analyzing") {
      worker.postMessage(STOP);
      worker.postMessage(QUIT);
    }

    if (worker) {
      worker.removeMessageListener(this.handleMessage);
      worker.removeErrorListener(this.handleError);
      worker.terminate();
    }

    this.state = {
      ...createInitialState(),
      disposed: true,
      worker: null,
      listeners: new Set(),
    };
  }

  private readonly handleMessage = (data: string): void => {
    if (this.state.disposed) return;

    const lines = data.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
    for (const line of lines) {
      this.processLine(line);
    }
  };

  private readonly handleError = (message: string): void => {
    if (this.state.disposed) return;
    this.emitError("A worker error occurred.", this.state.activeRequestId);
    this.transitionToError();
    void message;
  };

  private processLine(line: string): void {
    const message = parseUciLine(line);
    if (!message) return;

    switch (message.type) {
      case "uciok":
        this.handleUciOk();
        break;
      case "readyok":
        this.handleReadyOk();
        break;
      case "info":
        this.handleInfo(message.info);
        break;
      case "bestmove":
        this.handleBestmove(message.move, message.ponder);
        break;
    }
  }

  private handleUciOk(): void {
    if (this.state.phase !== "loading") return;

    const worker = this.state.worker;
    if (!worker) return;

    const setoptionCommands: CommandResult[] = [
      setoptionThreads(this.state.defaultConfiguration?.threads ?? 1),
      setoptionHash(this.state.defaultConfiguration?.hashMb ?? 16),
      setoptionMultiPv(this.state.defaultConfiguration?.multiPv ?? 1),
    ];

    for (const command of setoptionCommands) {
      if (command.ok) {
        worker.postMessage(command.command);
      }
    }

    worker.postMessage(ISREADY);
  }

  private handleReadyOk(): void {
    if (this.state.phase !== "loading") return;

    const requestId = this.state.initializationRequestId;
    this.state = {
      ...this.state,
      phase: "ready",
      initializationRequestId: null,
    };

    this.emit({ type: "ready", requestId: requestId ?? "" });
  }

  private handleInfo(info: EngineInfo): void {
    if (this.state.phase !== "analyzing") return;
    if (!this.state.activeRequestId) return;

    const requestId = this.state.activeRequestId;
    
    if (this.state.canceling) {
      return;
    }

    const queuedRequest = this.state.queuedRequests[0];
    if (queuedRequest && queuedRequest.id !== requestId) {
      return;
    }

    this.emit({ type: "analysis-info", requestId, info });
  }

  private handleBestmove(move: string | null, _ponder: string | null): void {
    if (this.state.phase !== "analyzing") return;

    const activeRequestId = this.state.activeRequestId;

    if (this.state.canceling) {
      this.state = {
        ...this.state,
        phase: "ready",
        activeRequestId: null,
        canceling: false,
      };
      if (activeRequestId) {
        this.emit({ type: "stopped", requestId: activeRequestId });
      }
      this.processQueuedRequests();
      return;
    }

    if (activeRequestId) {
      this.emit({
        type: "best-move",
        requestId: activeRequestId,
        move: { move, ponder: _ponder },
      });
    }

    this.state = {
      ...this.state,
      phase: "ready",
      activeRequestId: null,
    };

    this.processQueuedRequests();
  }

  private processQueuedRequests(): void {
    if (this.state.queuedRequests.length === 0) {
      return;
    }

    const next = this.state.queuedRequests[0];
    this.state = {
      ...this.state,
      queuedRequests: this.state.queuedRequests.filter((r) => r.id !== next.id),
    };
    this.startAnalysis(next);
  }

  private startAnalysis(request: QueuedRequest): void {
    const worker = this.state.worker;
    if (!worker) return;

    const fenCommand = positionFen(request.payload.fen);
    if (!fenCommand.ok) {
      this.emitError(`Invalid FEN: ${fenCommand.reason}`, request.id);
      return;
    }

    const limitCommand = this.formatLimit(request.payload.limit);
    if (!limitCommand.ok) {
      this.emitError(`Invalid analysis limit: ${limitCommand.reason}`, request.id);
      return;
    }

    if (request.payload.multiPv !== undefined) {
      const multiPvResult = setoptionMultiPv(request.payload.multiPv);
      if (multiPvResult.ok) {
        worker.postMessage(multiPvResult.command);
      }
    }

    this.state = {
      ...this.state,
      phase: "analyzing",
      activeRequestId: request.id,
      canceling: false,
    };

    worker.postMessage(fenCommand.command);
    worker.postMessage(limitCommand.command);
  }

  private sendStop(): void {
    const worker = this.state.worker;
    if (!worker) return;
    worker.postMessage(STOP);
  }

  private formatLimit(limit: EngineAnalysisLimit): CommandResult {
    switch (limit.kind) {
      case "depth":
        return goDepth(limit.value);
      case "nodes":
        return goNodes(limit.value);
      case "movetime":
        return goMovetime(limit.value);
    }
  }

  private transitionToError(): void {
    const requestId = this.state.activeRequestId;
    this.state = {
      ...createInitialState(),
      phase: "error",
      disposed: false,
      listeners: this.state.listeners,
    };
    if (requestId) {
      this.emitError("A fatal worker error occurred.", requestId);
    }
  }

  private emitError(message: string, requestId: string | null): void {
    this.emit({
      type: "error",
      requestId: requestId ?? "",
      message,
    });
  }

  private emit(event: EngineWorkerEvent): void {
    for (const listener of this.state.listeners) {
      try {
        listener(event);
      } catch {
        // Subscriber errors must not prevent delivery to other subscribers.
      }
    }
  }
}
