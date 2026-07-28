import type { EngineAnalysisLimit, EngineBestMove, EngineInfo, EngineWorkerEvent } from "./engine";
import type { QuickPassJob, QuickPassPlan } from "./quick-pass-planner";

export type QuickPassEngine = {
  analyze(id: string, payload: { fen: string; limit: EngineAnalysisLimit; multiPv?: number }): void;
  stop(): void;
  subscribe(listener: (event: EngineWorkerEvent) => void): () => void;
};

export type QuickPassCandidateLine = {
  readonly rank: number;
  readonly info: EngineInfo;
};

export type QuickPassCompletedJob = {
  readonly job: QuickPassJob;
  readonly info: EngineInfo | null;
  readonly bestMove: EngineBestMove | null;
  readonly candidateLines: readonly QuickPassCandidateLine[];
};

export type QuickPassRunnerState = {
  readonly status: "idle" | "running" | "completed" | "cancelled" | "error";
  readonly totalJobs: number;
  readonly completedJobs: number;
  readonly results: readonly QuickPassCompletedJob[];
  readonly currentJobId: string | null;
  readonly error: string | null;
};

export type QuickPassRunnerOptions = {
  readonly engine: QuickPassEngine;
  readonly multiPv?: number;
};

export class QuickPassRunner {
  private readonly engine: QuickPassEngine;
  private readonly multiPv: number;
  private plan: QuickPassPlan | null = null;
  private currentIndex = 0;
  private activeJobId: string | null = null;
  private latestInfo: EngineInfo | null = null;
  private candidateLines: Map<number, EngineInfo> = new Map();
  private results: QuickPassCompletedJob[] = [];
  private status: QuickPassRunnerState["status"] = "idle";
  private error: string | null = null;
  private disposed = false;
  private unsub: (() => void) | null = null;
  private started = false;
  private readonly listeners = new Set<(state: QuickPassRunnerState) => void>();

  constructor(options: QuickPassRunnerOptions) {
    this.engine = options.engine;
    const multiPv = options.multiPv ?? 1;
    if (!Number.isInteger(multiPv) || multiPv < 1) {
      throw new Error("multiPv must be a positive integer.");
    }
    this.multiPv = multiPv;
  }

  getState(): QuickPassRunnerState {
    return {
      status: this.status,
      totalJobs: this.plan && this.plan.ok ? this.plan.jobs.length : 0,
      completedJobs: this.results.length,
      results: [...this.results],
      currentJobId: this.activeJobId,
      error: this.error,
    };
  }

  subscribe(listener: (state: QuickPassRunnerState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(plan: QuickPassPlan): void {
    if (this.started) return;
    this.started = true;
    this.plan = plan;

    if (!plan.ok) {
      this.status = "error";
      this.error = plan.reason;
      this.emitState();
      return;
    }

    this.status = "running";
    this.emitState();

    try {
      this.unsub = this.engine.subscribe(this.handleEvent);
    } catch (error) {
      this.status = "error";
      this.error = error instanceof Error ? error.message : "Failed to subscribe to engine events.";
      this.emitState();
      return;
    }

    this.scheduleNext();
  }

  cancel(): void {
    if (this.status !== "running") return;
    try {
      this.engine.stop();
      this.enterTerminal("cancelled", null);
    } catch (error) {
      this.enterTerminal("error", error instanceof Error ? error.message : "Failed to stop engine analysis.");
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.status === "running") {
      try {
        this.engine.stop();
        this.enterTerminal("cancelled", null);
      } catch (error) {
        this.enterTerminal("error", error instanceof Error ? error.message : "Failed to stop engine analysis during disposal.");
      }
    } else {
      this.cleanup();
    }
  }

  private scheduleNext(): void {
    if (this.disposed || this.status !== "running") return;
    if (this.currentIndex >= (this.plan!.jobs.length)) {
      this.enterTerminal("completed", null);
      return;
    }

    const job = this.plan!.jobs[this.currentIndex];
    this.activeJobId = job.id;
    this.latestInfo = null;
    this.candidateLines = new Map();
    this.emitState();

    try {
      this.engine.analyze(job.id, {
        fen: job.fen,
        limit: job.limit,
        multiPv: this.multiPv,
      });
    } catch (error) {
      this.enterTerminal("error", error instanceof Error ? error.message : "Engine analysis failed.");
    }
  }

  private readonly handleEvent = (event: EngineWorkerEvent): void => {
    if (this.status !== "running" || this.disposed) return;
    if (this.activeJobId === null) return;

    switch (event.type) {
      case "analysis-info":
        if (event.requestId === this.activeJobId) {
          const rawRank = event.info.multipv;
          const effectiveRank = typeof rawRank === "number" ? rawRank : 1;

          if (
            !Number.isInteger(effectiveRank) ||
            effectiveRank < 1 ||
            effectiveRank > this.multiPv
          ) {
            break;
          }

          if (effectiveRank === 1) {
            this.latestInfo = event.info;
          }
          this.candidateLines = new Map(this.candidateLines);
          this.candidateLines.set(effectiveRank, event.info);
        }
        break;
      case "best-move":
        if (event.requestId === this.activeJobId) {
          const job = this.plan!.jobs[this.currentIndex];
          const sortedCandidates = Array.from(this.candidateLines.entries())
            .sort(([a], [b]) => a - b)
            .map(([rank, info]) => ({ rank, info }));
          this.results.push({
            job,
            info: this.latestInfo,
            bestMove: event.move,
            candidateLines: sortedCandidates,
          });
          this.currentIndex += 1;
          this.scheduleNext();
        }
        break;
      case "stopped":
        if (event.requestId === this.activeJobId) {
          this.enterTerminal("error", "Engine analysis stopped before producing a best move.");
        }
        break;
      case "error":
        if (event.requestId === this.activeJobId) {
          this.enterTerminal("error", event.message);
        }
        break;
    }
  };

  private enterTerminal(status: "completed" | "cancelled" | "error", error: string | null): void {
    this.status = status;
    this.error = error;
    this.activeJobId = null;
    this.cleanup();
    this.emitState();
  }

  private cleanup(): void {
    const unsub = this.unsub;
    this.unsub = null;
    if (unsub) {
      try {
        unsub();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to unsubscribe from engine events.";
        if (this.status === "completed" || this.status === "cancelled") {
          this.status = "error";
          this.error = message;
        } else if (this.error) {
          this.error = `${this.error}; cleanup failed: ${message}`;
        } else {
          this.error = message;
        }
      }
    }
  }

  private emitState(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch {
        // Subscriber errors must not prevent delivery to other subscribers.
      }
    }
  }
}
