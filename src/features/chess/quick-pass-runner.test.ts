import { describe, expect, it } from "vitest";
import type { EngineWorkerEvent } from "@/features/chess/engine";
import type { QuickPassJob, QuickPassPlan } from "@/features/chess/quick-pass-planner";
import { QuickPassRunner } from "@/features/chess/quick-pass-runner";
import type { QuickPassEngine, QuickPassRunnerState } from "@/features/chess/quick-pass-runner";

type FakeEngine = QuickPassEngine & {
  recordedCalls: { method: string; args: unknown[] }[];
  emit(event: EngineWorkerEvent): void;
  reset(): void;
  makeStopThrow(shouldThrow: boolean): void;
  makeUnsubscribeThrow(shouldThrow: boolean): void;
};

function createFakeEngine(): FakeEngine {
  const listeners = new Set<(event: EngineWorkerEvent) => void>();
  const recordedCalls: { method: string; args: unknown[] }[] = [];
  let stopShouldThrow = false;
  let unsubShouldThrow = false;

  const engine: FakeEngine = {
    analyze(id: string, payload: unknown): void {
      recordedCalls.push({ method: "analyze", args: [id, payload] });
    },
    stop(): void {
      recordedCalls.push({ method: "stop", args: [] });
      if (stopShouldThrow) {
        throw new Error("stop failed");
      }
    },
    subscribe(listener: (event: EngineWorkerEvent) => void): () => void {
      recordedCalls.push({ method: "subscribe", args: [listener] });
      listeners.add(listener);
      return () => {
        recordedCalls.push({ method: "unsubscribe", args: [] });
        if (unsubShouldThrow) {
          throw new Error("unsubscribe failed");
        }
        listeners.delete(listener);
      };
    },
    get recordedCalls(): { method: string; args: unknown[] }[] {
      return recordedCalls;
    },
    emit(event: EngineWorkerEvent): void {
      for (const listener of listeners) {
        listener(event);
      }
    },
    reset(): void {
      recordedCalls.length = 0;
    },
    makeStopThrow(shouldThrow: boolean): void {
      stopShouldThrow = shouldThrow;
    },
    makeUnsubscribeThrow(shouldThrow: boolean): void {
      unsubShouldThrow = shouldThrow;
    },
  };

  return engine;
}

function completedPlan(jobs: QuickPassJob[]): QuickPassPlan {
  return { ok: true, jobs };
}

function ineligiblePlan(): QuickPassPlan {
  return { ok: false, reason: "Timeline is not eligible for analysis.", jobs: [] };
}

describe("QuickPassRunner", () => {
  describe("ineligible plan", () => {
    it("performs no engine calls and enters error state", () => {
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      runner.start(ineligiblePlan());

      const state = runner.getState();
      expect(state.status).toBe("error");
      expect(state.error).toBe("Timeline is not eligible for analysis.");
      expect(state.totalJobs).toBe(0);
      expect(state.completedJobs).toBe(0);
      expect(state.currentJobId).toBeNull();
      expect(engine.recordedCalls).toHaveLength(0);
    });

    it("is a no-op to cancel or dispose from idle", () => {
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      runner.cancel();
      runner.dispose();

      const state = runner.getState();
      expect(state.status).toBe("idle");
      expect(state.currentJobId).toBeNull();
    });
  });

  describe("eligible plan", () => {
    it("starts only the first job with exact id, fen, and limit", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
        { id: "quick-pass-1", phase: "quick-pass", ply: 1, fen: "fen-1", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      runner.start(completedPlan(jobs));

      expect(engine.recordedCalls).toHaveLength(2);
      expect(engine.recordedCalls[0]).toEqual({ method: "subscribe", args: [expect.any(Function)] });
      expect(engine.recordedCalls[1]).toEqual({
        method: "analyze",
        args: ["quick-pass-0", { fen: "fen-0", limit: { kind: "depth", value: 14 }, multiPv: 1 }],
      });
    });

    it("stores the latest matching info and ignores mismatched info", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      runner.start(completedPlan(jobs));

      engine.emit({ type: "analysis-info", requestId: "quick-pass-0", info: { depth: 5, nodes: 100 } });
      engine.emit({ type: "analysis-info", requestId: "other", info: { depth: 10, nodes: 200 } });
      engine.emit({ type: "analysis-info", requestId: "quick-pass-0", info: { depth: 14, nodes: 300 } });
      engine.emit({ type: "best-move", requestId: "quick-pass-0", move: { move: "e2e4", ponder: "e7e5" } });

      const finalState = runner.getState();
      expect(finalState.status).toBe("completed");
      expect(finalState.completedJobs).toBe(1);
      expect(finalState.results[0].info?.depth).toBe(14);
      expect(finalState.results[0].info?.nodes).toBe(300);
      expect(finalState.results[0].bestMove?.move).toBe("e2e4");
      expect(finalState.currentJobId).toBeNull();
    });

    it("completes one job and starts exactly the next on matching best-move", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
        { id: "quick-pass-1", phase: "quick-pass", ply: 1, fen: "fen-1", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      runner.start(completedPlan(jobs));

      engine.emit({ type: "best-move", requestId: "quick-pass-0", move: { move: "e2e4", ponder: "e7e5" } });

      expect(engine.recordedCalls).toHaveLength(3);
      expect(engine.recordedCalls[2]).toEqual({
        method: "analyze",
        args: ["quick-pass-1", { fen: "fen-1", limit: { kind: "depth", value: 14 }, multiPv: 1 }],
      });

      const state = runner.getState();
      expect(state.completedJobs).toBe(1);
      expect(state.currentJobId).toBe("quick-pass-1");
    });

    it("ignores mismatched and duplicate best-move events", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      runner.start(completedPlan(jobs));

      engine.emit({ type: "best-move", requestId: "other", move: { move: "e2e4", ponder: "e7e5" } });
      engine.emit({ type: "best-move", requestId: "quick-pass-0", move: { move: "e2e4", ponder: "e7e5" } });
      engine.emit({ type: "best-move", requestId: "quick-pass-0", move: { move: "d2d4", ponder: "d7d5" } });

      expect(runner.getState().status).toBe("completed");
      expect(runner.getState().completedJobs).toBe(1);
      expect(runner.getState().results[0].bestMove?.move).toBe("e2e4");
      expect(runner.getState().currentJobId).toBeNull();
    });

    it("completes the entire plan in order", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
        { id: "quick-pass-1", phase: "quick-pass", ply: 1, fen: "fen-1", limit: { kind: "depth", value: 14 } },
        { id: "quick-pass-2", phase: "quick-pass", ply: 2, fen: "fen-2", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      runner.start(completedPlan(jobs));

      engine.emit({ type: "best-move", requestId: "quick-pass-0", move: { move: "e2e4", ponder: null } });
      engine.emit({ type: "best-move", requestId: "quick-pass-1", move: { move: "e7e5", ponder: null } });
      engine.emit({ type: "best-move", requestId: "quick-pass-2", move: { move: "g1f3", ponder: null } });

      const state = runner.getState();
      expect(state.status).toBe("completed");
      expect(state.completedJobs).toBe(3);
      expect(state.results).toHaveLength(3);
      expect(state.results[0].job.ply).toBe(0);
      expect(state.results[1].job.ply).toBe(1);
      expect(state.results[2].job.ply).toBe(2);
      expect(state.currentJobId).toBeNull();
    });

    it("reports correct progress counts at every transition", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
        { id: "quick-pass-1", phase: "quick-pass", ply: 1, fen: "fen-1", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      const states: QuickPassRunnerState[] = [];
      runner.subscribe(() => states.push(runner.getState()));
      runner.start(completedPlan(jobs));

      expect(states[states.length - 1]).toMatchObject({ status: "running", completedJobs: 0, currentJobId: "quick-pass-0" });

      engine.emit({ type: "best-move", requestId: "quick-pass-0", move: { move: "e2e4", ponder: null } });
      expect(states[states.length - 1]).toMatchObject({ status: "running", completedJobs: 1, currentJobId: "quick-pass-1" });

      engine.emit({ type: "best-move", requestId: "quick-pass-1", move: { move: "e7e5", ponder: null } });
      expect(states[states.length - 1]).toMatchObject({ status: "completed", completedJobs: 2, currentJobId: null });
    });

    it("emits exactly one terminal snapshot on successful completion", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      const snapshots: QuickPassRunnerState[] = [];
      runner.subscribe((state) => snapshots.push(state));
      runner.start(completedPlan(jobs));

      engine.emit({ type: "best-move", requestId: "quick-pass-0", move: { move: "e2e4", ponder: null } });

      const terminalSnapshots = snapshots.filter((s) => s.status === "completed");
      expect(terminalSnapshots).toHaveLength(1);
      expect(terminalSnapshots[0].currentJobId).toBeNull();
    });

    it("terminates on matching error and preserves prior results", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
        { id: "quick-pass-1", phase: "quick-pass", ply: 1, fen: "fen-1", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      runner.start(completedPlan(jobs));

      engine.emit({ type: "best-move", requestId: "quick-pass-0", move: { move: "e2e4", ponder: null } });
      engine.emit({ type: "error", requestId: "quick-pass-1", message: "Engine failure." });

      const state = runner.getState();
      expect(state.status).toBe("error");
      expect(state.error).toBe("Engine failure.");
      expect(state.completedJobs).toBe(1);
      expect(state.results[0].job.ply).toBe(0);
      expect(engine.recordedCalls.filter((c) => c.method === "analyze")).toHaveLength(2);
      expect(state.currentJobId).toBeNull();
    });

    it("emits exactly one terminal snapshot on matching engine error", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      const snapshots: QuickPassRunnerState[] = [];
      runner.subscribe((state) => snapshots.push(state));
      runner.start(completedPlan(jobs));

      engine.emit({ type: "error", requestId: "quick-pass-0", message: "Engine failure." });

      const terminalSnapshots = snapshots.filter((s) => s.status === "error");
      expect(terminalSnapshots).toHaveLength(1);
      expect(terminalSnapshots[0].currentJobId).toBeNull();
      expect(terminalSnapshots[0].error).toBe("Engine failure.");
    });

    it("ignores mismatched error events", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      runner.start(completedPlan(jobs));

      engine.emit({ type: "error", requestId: "other", message: "Ignored error." });
      engine.emit({ type: "best-move", requestId: "quick-pass-0", move: { move: "e2e4", ponder: null } });

      expect(runner.getState().status).toBe("completed");
      expect(runner.getState().currentJobId).toBeNull();
    });

    it("matching stopped enters error without appending or advancing", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
        { id: "quick-pass-1", phase: "quick-pass", ply: 1, fen: "fen-1", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      runner.start(completedPlan(jobs));

      engine.emit({ type: "stopped", requestId: "quick-pass-0" });

      const state = runner.getState();
      expect(state.status).toBe("error");
      expect(state.error).toBe("Engine analysis stopped before producing a best move.");
      expect(state.completedJobs).toBe(0);
      expect(state.results).toHaveLength(0);
      expect(state.currentJobId).toBeNull();
      expect(engine.recordedCalls.filter((c) => c.method === "analyze")).toHaveLength(1);
    });

    it("emits exactly one terminal snapshot on matching stopped", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      const snapshots: QuickPassRunnerState[] = [];
      runner.subscribe((state) => snapshots.push(state));
      runner.start(completedPlan(jobs));

      engine.emit({ type: "stopped", requestId: "quick-pass-0" });

      const terminalSnapshots = snapshots.filter((s) => s.status === "error");
      expect(terminalSnapshots).toHaveLength(1);
      expect(terminalSnapshots[0].currentJobId).toBeNull();
    });

    it("ignores mismatched stopped events", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      runner.start(completedPlan(jobs));

      engine.emit({ type: "stopped", requestId: "other" });
      engine.emit({ type: "best-move", requestId: "quick-pass-0", move: { move: "e2e4", ponder: null } });

      expect(runner.getState().status).toBe("completed");
      expect(runner.getState().currentJobId).toBeNull();
    });

    it("stops and unsubscribes exactly once on cancellation", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      runner.start(completedPlan(jobs));

      runner.cancel();
      runner.cancel();

      expect(engine.recordedCalls.filter((c) => c.method === "stop")).toHaveLength(1);
      expect(engine.recordedCalls.filter((c) => c.method === "unsubscribe")).toHaveLength(1);
    });

    it("successful cancellation clears current job and emits one terminal snapshot", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      const snapshots: QuickPassRunnerState[] = [];
      runner.subscribe((state) => snapshots.push(state));
      runner.start(completedPlan(jobs));

      runner.cancel();

      const terminalSnapshots = snapshots.filter((s) => s.status === "cancelled");
      expect(terminalSnapshots).toHaveLength(1);
      expect(terminalSnapshots[0].currentJobId).toBeNull();
      expect(runner.getState().currentJobId).toBeNull();
    });

    it("repeated cancellation is idempotent", () => {
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      runner.start(ineligiblePlan());

      runner.cancel();
      runner.cancel();

      expect(engine.recordedCalls.filter((c) => c.method === "stop")).toHaveLength(0);
      expect(runner.getState().status).toBe("error");
      expect(runner.getState().currentJobId).toBeNull();
    });

    it("stop failure during cancellation enters error and still unsubscribes", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      engine.makeStopThrow(true);
      const runner = new QuickPassRunner({ engine });
      runner.start(completedPlan(jobs));

      runner.cancel();

      const state = runner.getState();
      expect(state.status).toBe("error");
      expect(state.error).toBe("stop failed");
      expect(state.currentJobId).toBeNull();
      expect(engine.recordedCalls.filter((c) => c.method === "unsubscribe")).toHaveLength(1);
    });

    it("emits exactly one terminal snapshot on cancellation stop failure", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      engine.makeStopThrow(true);
      const runner = new QuickPassRunner({ engine });
      const snapshots: QuickPassRunnerState[] = [];
      runner.subscribe((state) => snapshots.push(state));
      runner.start(completedPlan(jobs));

      runner.cancel();

      const terminalSnapshots = snapshots.filter((s) => s.status === "error");
      expect(terminalSnapshots).toHaveLength(1);
      expect(terminalSnapshots[0].currentJobId).toBeNull();
    });

    it("stop failure during disposal enters error and remains idempotent", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      engine.makeStopThrow(true);
      const runner = new QuickPassRunner({ engine });
      runner.start(completedPlan(jobs));

      runner.dispose();
      runner.dispose();

      const state = runner.getState();
      expect(state.status).toBe("error");
      expect(state.error).toBe("stop failed");
      expect(state.currentJobId).toBeNull();
      expect(engine.recordedCalls.filter((c) => c.method === "stop")).toHaveLength(1);
      expect(engine.recordedCalls.filter((c) => c.method === "unsubscribe")).toHaveLength(1);
    });

    it("successful running disposal clears current job and emits one terminal snapshot", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      const snapshots: QuickPassRunnerState[] = [];
      runner.subscribe((state) => snapshots.push(state));
      runner.start(completedPlan(jobs));

      runner.dispose();

      const terminalSnapshots = snapshots.filter((s) => s.status === "cancelled");
      expect(terminalSnapshots).toHaveLength(1);
      expect(terminalSnapshots[0].currentJobId).toBeNull();
      expect(runner.getState().currentJobId).toBeNull();
    });

    it("dispose from non-running state does not emit duplicate snapshot", () => {
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      const snapshots: QuickPassRunnerState[] = [];
      runner.subscribe((state) => snapshots.push(state));
      runner.start(ineligiblePlan());

      const beforeCount = snapshots.length;
      runner.dispose();

      expect(snapshots).toHaveLength(beforeCount);
      expect(runner.getState().status).toBe("error");
      expect(runner.getState().currentJobId).toBeNull();
    });

    it("throwing unsubscribe during completion produces deterministic error without duplicating results", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      engine.makeUnsubscribeThrow(true);
      const runner = new QuickPassRunner({ engine });
      runner.start(completedPlan(jobs));

      engine.emit({ type: "best-move", requestId: "quick-pass-0", move: { move: "e2e4", ponder: null } });

      const state = runner.getState();
      expect(state.status).toBe("error");
      expect(state.error).toBe("unsubscribe failed");
      expect(state.results).toHaveLength(1);
      expect(state.results[0].bestMove?.move).toBe("e2e4");
      expect(state.currentJobId).toBeNull();
      expect(engine.recordedCalls.filter((c) => c.method === "unsubscribe")).toHaveLength(1);
    });

    it("throwing unsubscribe during cancellation is attempted only once", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      engine.makeUnsubscribeThrow(true);
      const runner = new QuickPassRunner({ engine });
      runner.start(completedPlan(jobs));

      runner.cancel();
      runner.cancel();

      expect(engine.recordedCalls.filter((c) => c.method === "stop")).toHaveLength(1);
      expect(engine.recordedCalls.filter((c) => c.method === "unsubscribe")).toHaveLength(1);
    });

    it("matching engine error clears current job and unsubscribes once", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      runner.start(completedPlan(jobs));

      engine.emit({ type: "error", requestId: "quick-pass-0", message: "Engine failure." });

      const state = runner.getState();
      expect(state.status).toBe("error");
      expect(state.error).toBe("Engine failure.");
      expect(state.currentJobId).toBeNull();
      expect(engine.recordedCalls.filter((c) => c.method === "unsubscribe")).toHaveLength(1);
    });

    it("analyze failure clears current job and unsubscribes once", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      const saved = engine.analyze;
      engine.analyze = () => {
        throw new Error("analyze failed");
      };

      runner.start(completedPlan(jobs));

      const state = runner.getState();
      expect(state.status).toBe("error");
      expect(state.error).toBe("analyze failed");
      expect(state.currentJobId).toBeNull();
      expect(engine.recordedCalls.filter((c) => c.method === "unsubscribe")).toHaveLength(1);

      engine.analyze = saved;
    });

    it("successful final completion clears current job and unsubscribes once", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      runner.start(completedPlan(jobs));

      engine.emit({ type: "best-move", requestId: "quick-pass-0", move: { move: "e2e4", ponder: null } });

      const state = runner.getState();
      expect(state.status).toBe("completed");
      expect(state.completedJobs).toBe(1);
      expect(state.currentJobId).toBeNull();
      expect(engine.recordedCalls.filter((c) => c.method === "unsubscribe")).toHaveLength(1);
    });

    it("events after every terminal path are ignored", () => {
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });

      runner.start(ineligiblePlan());
      engine.emit({ type: "best-move", requestId: "quick-pass-0", move: { move: "e2e4", ponder: null } });
      expect(runner.getState().completedJobs).toBe(0);
      expect(runner.getState().currentJobId).toBeNull();
    });

    it("prevents further jobs after cancellation", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      runner.start(completedPlan(jobs));

      runner.cancel();
      engine.emit({ type: "best-move", requestId: "quick-pass-0", move: { move: "e2e4", ponder: null } });

      expect(runner.getState().completedJobs).toBe(0);
      expect(engine.recordedCalls.filter((c) => c.method === "analyze")).toHaveLength(1);
      expect(runner.getState().currentJobId).toBeNull();
    });

    it("is idempotent on dispose and maps running to cancelled", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      runner.start(completedPlan(jobs));

      runner.dispose();
      runner.dispose();

      const state = runner.getState();
      expect(state.status).toBe("cancelled");
      expect(engine.recordedCalls.filter((c) => c.method === "stop")).toHaveLength(1);
      expect(engine.recordedCalls.filter((c) => c.method === "unsubscribe")).toHaveLength(1);
      expect(state.currentJobId).toBeNull();
    });

    it("prevents a second start from duplicating execution", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      runner.start(completedPlan(jobs));
      runner.start({
        ok: true,
        jobs: [
          { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-other", limit: { kind: "depth", value: 16 } },
        ],
      });

      expect(engine.recordedCalls.filter((c) => c.method === "analyze")).toHaveLength(1);
      expect(engine.recordedCalls[1]?.args[0]).toBe("quick-pass-0");
    });

    it("exposes immutable state snapshots and supports unsubscribe", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      const snapshots: QuickPassRunnerState[] = [];
      const unsub = runner.subscribe((state) => snapshots.push({ ...state, results: [...state.results] }));
      runner.start(completedPlan(jobs));

      engine.emit({ type: "best-move", requestId: "quick-pass-0", move: { move: "e2e4", ponder: null } });
      unsub();
      engine.emit({ type: "analysis-info", requestId: "quick-pass-0", info: { depth: 20 } });

      const last = snapshots[snapshots.length - 1];
      expect(last.status).toBe("completed");
      expect(last.results).toHaveLength(1);
      expect(last.results[0].bestMove?.move).toBe("e2e4");
      expect(last.currentJobId).toBeNull();
    });

    it("contains synchronous subscribe failure as deterministic error", () => {
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      const failingSubscribe = () => {
        throw new Error("subscribe failed");
      };
      const saved = engine.subscribe;
      engine.subscribe = failingSubscribe as unknown as QuickPassEngine["subscribe"];

      runner.start({
        ok: true,
        jobs: [
          { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
        ],
      });

      const state = runner.getState();
      expect(state.status).toBe("error");
      expect(state.error).toBe("subscribe failed");
      expect(state.currentJobId).toBeNull();

      engine.subscribe = saved;
    });

    it("contains synchronous analyze failure as deterministic error and unsubscribes", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      const saved = engine.analyze;
      engine.analyze = () => {
        throw new Error("analyze failed");
      };

      runner.start(completedPlan(jobs));

      const state = runner.getState();
      expect(state.status).toBe("error");
      expect(state.error).toBe("analyze failed");
      expect(state.currentJobId).toBeNull();
      expect(engine.recordedCalls.filter((c) => c.method === "unsubscribe")).toHaveLength(1);

      engine.analyze = saved;
    });
  });

  describe("multiPv candidate lines", () => {
    it("defaults to multiPv 1 when option is omitted", () => {
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      expect(runner.getState().status).toBe("idle");
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      runner.start(completedPlan(jobs));
      expect(engine.recordedCalls[1]).toEqual({
        method: "analyze",
        args: ["quick-pass-0", { fen: "fen-0", limit: { kind: "depth", value: 14 }, multiPv: 1 }],
      });
    });

    it("forwards configured multiPv to every analyze call", () => {
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine, multiPv: 3 });
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
        { id: "quick-pass-1", phase: "quick-pass", ply: 1, fen: "fen-1", limit: { kind: "depth", value: 14 } },
      ];
      runner.start(completedPlan(jobs));
      expect(engine.recordedCalls).toHaveLength(2);
      expect(engine.recordedCalls[1]).toEqual({
        method: "analyze",
        args: ["quick-pass-0", { fen: "fen-0", limit: { kind: "depth", value: 14 }, multiPv: 3 }],
      });
      engine.emit({ type: "best-move", requestId: "quick-pass-0", move: { move: "e2e4", ponder: null } });
      expect(engine.recordedCalls).toHaveLength(3);
      expect(engine.recordedCalls[2]).toEqual({
        method: "analyze",
        args: ["quick-pass-1", { fen: "fen-1", limit: { kind: "depth", value: 14 }, multiPv: 3 }],
      });
    });

    it("default no-rank info becomes rank 1 without adding multipv", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine });
      runner.start(completedPlan(jobs));

      engine.emit({ type: "analysis-info", requestId: "quick-pass-0", info: { depth: 5, nodes: 100, pv: ["e2e4"] } });
      engine.emit({ type: "best-move", requestId: "quick-pass-0", move: { move: "e2e4", ponder: null } });

      const state = runner.getState();
      expect(state.status).toBe("completed");
      expect(state.results).toHaveLength(1);
      expect(state.results[0].info?.depth).toBe(5);
      expect(state.results[0].candidateLines).toHaveLength(1);
      expect(state.results[0].candidateLines[0].rank).toBe(1);
      expect(state.results[0].candidateLines[0].info.depth).toBe(5);
      expect(state.results[0].candidateLines[0].info.pv).toEqual(["e2e4"]);
      expect(state.results[0].candidateLines[0].info).not.toHaveProperty("multipv");
      expect(state.results[0].info).toEqual({ depth: 5, nodes: 100, pv: ["e2e4"] });
    });

    it("retains explicit rank 1, 2, and 3 lines", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine, multiPv: 3 });
      runner.start(completedPlan(jobs));

      engine.emit({ type: "analysis-info", requestId: "quick-pass-0", info: { depth: 14, multipv: 1, score: { type: "cp", value: 30, perspective: "side-to-move" }, pv: ["e2e4", "e7e5"] } });
      engine.emit({ type: "analysis-info", requestId: "quick-pass-0", info: { depth: 14, multipv: 2, score: { type: "cp", value: 18, perspective: "side-to-move" }, pv: ["d2d4", "d7d5"] } });
      engine.emit({ type: "analysis-info", requestId: "quick-pass-0", info: { depth: 14, multipv: 3, score: { type: "cp", value: 10, perspective: "side-to-move" }, pv: ["g1f3"] } });
      engine.emit({ type: "best-move", requestId: "quick-pass-0", move: { move: "e2e4", ponder: null } });

      const state = runner.getState();
      expect(state.results[0].candidateLines).toHaveLength(3);
      expect(state.results[0].candidateLines[0].rank).toBe(1);
      expect(state.results[0].candidateLines[0].info.score).toEqual({ type: "cp", value: 30, perspective: "side-to-move" });
      expect(state.results[0].candidateLines[0].info.pv).toEqual(["e2e4", "e7e5"]);
      expect(state.results[0].candidateLines[1].rank).toBe(2);
      expect(state.results[0].candidateLines[1].info.score).toEqual({ type: "cp", value: 18, perspective: "side-to-move" });
      expect(state.results[0].candidateLines[1].info.pv).toEqual(["d2d4", "d7d5"]);
      expect(state.results[0].candidateLines[2].rank).toBe(3);
      expect(state.results[0].candidateLines[2].info.score).toEqual({ type: "cp", value: 10, perspective: "side-to-move" });
      expect(state.results[0].candidateLines[2].info.pv).toEqual(["g1f3"]);
    });

    it("sorts candidate lines by rank even when events arrive out of order", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine, multiPv: 3 });
      runner.start(completedPlan(jobs));

      engine.emit({ type: "analysis-info", requestId: "quick-pass-0", info: { depth: 14, multipv: 3, pv: ["g1f3"] } });
      engine.emit({ type: "analysis-info", requestId: "quick-pass-0", info: { depth: 14, multipv: 1, pv: ["e2e4"] } });
      engine.emit({ type: "analysis-info", requestId: "quick-pass-0", info: { depth: 14, multipv: 2, pv: ["d2d4"] } });
      engine.emit({ type: "best-move", requestId: "quick-pass-0", move: { move: "e2e4", ponder: null } });

      const state = runner.getState();
      expect(state.results[0].candidateLines).toHaveLength(3);
      expect(state.results[0].candidateLines[0].rank).toBe(1);
      expect(state.results[0].candidateLines[1].rank).toBe(2);
      expect(state.results[0].candidateLines[2].rank).toBe(3);
    });

    it("repeated information updates only its matching rank", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine, multiPv: 3 });
      runner.start(completedPlan(jobs));

      engine.emit({ type: "analysis-info", requestId: "quick-pass-0", info: { depth: 10, multipv: 1, nodes: 100, pv: ["e2e4"] } });
      engine.emit({ type: "analysis-info", requestId: "quick-pass-0", info: { depth: 12, multipv: 2, nodes: 200, pv: ["d2d4"] } });
      engine.emit({ type: "analysis-info", requestId: "quick-pass-0", info: { depth: 14, multipv: 1, nodes: 300, pv: ["e2e4", "e7e5"] } });
      engine.emit({ type: "best-move", requestId: "quick-pass-0", move: { move: "e2e4", ponder: null } });

      const state = runner.getState();
      expect(state.results[0].candidateLines).toHaveLength(2);
      expect(state.results[0].candidateLines[0].rank).toBe(1);
      expect(state.results[0].candidateLines[0].info.depth).toBe(14);
      expect(state.results[0].candidateLines[0].info.nodes).toBe(300);
      expect(state.results[0].candidateLines[0].info.pv).toEqual(["e2e4", "e7e5"]);
      expect(state.results[0].candidateLines[1].rank).toBe(2);
      expect(state.results[0].candidateLines[1].info.depth).toBe(12);
      expect(state.results[0].candidateLines[1].info.nodes).toBe(200);
    });

    it("rank-1 compatibility info is correct", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine, multiPv: 3 });
      runner.start(completedPlan(jobs));

      engine.emit({ type: "analysis-info", requestId: "quick-pass-0", info: { depth: 14, multipv: 1, score: { type: "mate", value: 3, perspective: "side-to-move" }, pv: ["e8h8"] } });
      engine.emit({ type: "analysis-info", requestId: "quick-pass-0", info: { depth: 14, multipv: 2, score: { type: "cp", value: 50, perspective: "side-to-move" }, pv: ["g1f3"] } });
      engine.emit({ type: "best-move", requestId: "quick-pass-0", move: { move: "e2e4", ponder: null } });

      const state = runner.getState();
      expect(state.results[0].info?.depth).toBe(14);
      expect(state.results[0].info?.score).toEqual({ type: "mate", value: 3, perspective: "side-to-move" });
      expect(state.results[0].info?.pv).toEqual(["e8h8"]);
    });

    it("missing rank 1 produces info null", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine, multiPv: 3 });
      runner.start(completedPlan(jobs));

      engine.emit({ type: "analysis-info", requestId: "quick-pass-0", info: { depth: 14, multipv: 2, pv: ["d2d4"] } });
      engine.emit({ type: "best-move", requestId: "quick-pass-0", move: { move: "e2e4", ponder: null } });

      const state = runner.getState();
      expect(state.results[0].info).toBeNull();
      expect(state.results[0].candidateLines).toHaveLength(1);
      expect(state.results[0].candidateLines[0].rank).toBe(2);
    });

    it("missing rank 2 or 3 is not fabricated", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine, multiPv: 3 });
      runner.start(completedPlan(jobs));

      engine.emit({ type: "analysis-info", requestId: "quick-pass-0", info: { depth: 14, multipv: 1, pv: ["e2e4"] } });
      engine.emit({ type: "analysis-info", requestId: "quick-pass-0", info: { depth: 14, multipv: 3, pv: ["g1f3"] } });
      engine.emit({ type: "best-move", requestId: "quick-pass-0", move: { move: "e2e4", ponder: null } });

      const state = runner.getState();
      expect(state.results[0].candidateLines).toHaveLength(2);
      expect(state.results[0].candidateLines[0].rank).toBe(1);
      expect(state.results[0].candidateLines[1].rank).toBe(3);
    });

    it("ignores mismatched request IDs", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine, multiPv: 3 });
      runner.start(completedPlan(jobs));

      engine.emit({ type: "analysis-info", requestId: "other", info: { depth: 14, multipv: 1, pv: ["e2e4"] } });
      engine.emit({ type: "analysis-info", requestId: "quick-pass-0", info: { depth: 14, multipv: 2, pv: ["d2d4"] } });
      engine.emit({ type: "best-move", requestId: "quick-pass-0", move: { move: "e2e4", ponder: null } });

      const state = runner.getState();
      expect(state.results[0].candidateLines).toHaveLength(1);
      expect(state.results[0].candidateLines[0].rank).toBe(2);
    });

    it("candidate lines reset between jobs", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
        { id: "quick-pass-1", phase: "quick-pass", ply: 1, fen: "fen-1", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine, multiPv: 3 });
      runner.start(completedPlan(jobs));

      engine.emit({ type: "analysis-info", requestId: "quick-pass-0", info: { depth: 14, multipv: 1, pv: ["e2e4"] } });
      engine.emit({ type: "best-move", requestId: "quick-pass-0", move: { move: "e2e4", ponder: null } });
      engine.emit({ type: "analysis-info", requestId: "quick-pass-1", info: { depth: 14, multipv: 2, pv: ["d2d4"] } });
      engine.emit({ type: "best-move", requestId: "quick-pass-1", move: { move: "e7e5", ponder: null } });

      const state = runner.getState();
      expect(state.results).toHaveLength(2);
      expect(state.results[0].candidateLines).toHaveLength(1);
      expect(state.results[0].candidateLines[0].rank).toBe(1);
      expect(state.results[1].candidateLines).toHaveLength(1);
      expect(state.results[1].candidateLines[0].rank).toBe(2);
    });

    it("candidate objects preserve exact PV and scores", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine, multiPv: 3 });
      runner.start(completedPlan(jobs));

      const info1 = { depth: 14, multipv: 1, score: { type: "cp", value: 30, perspective: "side-to-move" } as const, nodes: 1000, nps: 100000, timeMs: 100, hashfull: 50, pv: ["e2e4", "e7e5"] };
      const info2 = { depth: 14, multipv: 2, score: { type: "mate", value: -2, perspective: "side-to-move" } as const, nodes: 500, pv: ["d2d4"] };
      engine.emit({ type: "analysis-info", requestId: "quick-pass-0", info: info1 });
      engine.emit({ type: "analysis-info", requestId: "quick-pass-0", info: info2 });
      engine.emit({ type: "best-move", requestId: "quick-pass-0", move: { move: "e2e4", ponder: null } });

      const state = runner.getState();
      expect(state.results[0].candidateLines[0].info).toEqual(info1);
      expect(state.results[0].candidateLines[1].info).toEqual(info2);
    });

    it("cancellation does not create a partial completed result", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine, multiPv: 3 });
      runner.start(completedPlan(jobs));

      engine.emit({ type: "analysis-info", requestId: "quick-pass-0", info: { depth: 10, multipv: 1, pv: ["e2e4"] } });
      runner.cancel();

      const state = runner.getState();
      expect(state.status).toBe("cancelled");
      expect(state.results).toHaveLength(0);
      expect(state.currentJobId).toBeNull();
    });

    it("engine error does not create a partial completed result", () => {
      const jobs: QuickPassJob[] = [
        { id: "quick-pass-0", phase: "quick-pass", ply: 0, fen: "fen-0", limit: { kind: "depth", value: 14 } },
      ];
      const engine = createFakeEngine();
      const runner = new QuickPassRunner({ engine, multiPv: 3 });
      runner.start(completedPlan(jobs));

      engine.emit({ type: "analysis-info", requestId: "quick-pass-0", info: { depth: 10, multipv: 1, pv: ["e2e4"] } });
      engine.emit({ type: "error", requestId: "quick-pass-0", message: "Engine failure." });

      const state = runner.getState();
      expect(state.status).toBe("error");
      expect(state.results).toHaveLength(0);
      expect(state.currentJobId).toBeNull();
    });

    it("rejects invalid multiPv values deterministically", () => {
      expect(() => new QuickPassRunner({ engine: createFakeEngine(), multiPv: 0 })).toThrow("multiPv must be a positive integer.");
      expect(() => new QuickPassRunner({ engine: createFakeEngine(), multiPv: -1 })).toThrow("multiPv must be a positive integer.");
      expect(() => new QuickPassRunner({ engine: createFakeEngine(), multiPv: 1.5 })).toThrow("multiPv must be a positive integer.");
    });
  });
});
