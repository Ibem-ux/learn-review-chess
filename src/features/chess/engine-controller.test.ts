import { describe, expect, it } from "vitest";
import { EngineController, type WorkerFactory, type WorkerLike } from "@/features/chess/engine-controller";
import type { EngineWorkerEvent } from "@/features/chess/engine";

type ListenerSpy = {
  listener: (event: EngineWorkerEvent) => void;
  calls: EngineWorkerEvent[];
};

type FakeWorker = WorkerLike & {
  emitMessage(data: string): void;
  emitError(message: string): void;
  getPostedCommands(): string[];
  resetCommands(): void;
};

function createFakeWorker(): FakeWorker {
  const messageListeners = new Set<(data: string) => void>();
  const errorListeners = new Set<(message: string) => void>();
  const postedCommands: string[] = [];
  let errorCallback: ((message: string) => void) | null = null;

  const worker: FakeWorker = {
    postMessage(data: string): void {
      postedCommands.push(data);
    },
    terminate(): void {
      postedCommands.push("__terminate__");
    },
    addMessageListener(listener: (data: string) => void): void {
      messageListeners.add(listener);
    },
    removeMessageListener(listener: (data: string) => void): void {
      messageListeners.delete(listener);
    },
    addErrorListener(listener: (message: string) => void): void {
      errorListeners.add(listener);
      errorCallback = listener;
    },
    removeErrorListener(listener: (message: string) => void): void {
      errorListeners.delete(listener);
    },
    emitMessage(data: string): void {
      for (const listener of messageListeners) {
        listener(data);
      }
    },
    emitError(message: string): void {
      if (errorCallback) {
        errorCallback(message);
      }
    },
    getPostedCommands(): string[] {
      return postedCommands;
    },
    resetCommands(): void {
      postedCommands.length = 0;
    },
  };

  return worker;
}

function createController(factoryOrWorker: WorkerLike | WorkerFactory): { controller: EngineController; fake: FakeWorker } {
  const fake = typeof factoryOrWorker === "function" ? createFakeWorker() : (factoryOrWorker as FakeWorker);
  const controller = new EngineController(factoryOrWorker);
  return { controller, fake };
}

function subscribe(controller: EngineController): ListenerSpy {
  const spy: ListenerSpy = {
    listener: (event: EngineWorkerEvent) => {
      spy.calls.push(event);
    },
    calls: [],
  };
  controller.subscribe(spy.listener);
  return spy;
}

function waitForLoading(spy: ListenerSpy): void {
  expect(spy.calls.find((e) => e.type === "loading")).toBeTruthy();
}

describe("EngineController", () => {
  it("starts in idle status", () => {
    const { controller } = createController(createFakeWorker());
    expect(controller.status).toBe("idle");
  });

  it("emits loading and sends uci on initialize", () => {
    const { controller, fake } = createController(createFakeWorker());
    const spy = subscribe(controller);

    controller.initialize();

    waitForLoading(spy);
    expect(fake.getPostedCommands()).toEqual(["uci"]);
    expect(controller.status).toBe("loading");
  });

  it("sends option commands in deterministic order after uciok", () => {
    const { controller, fake } = createController(createFakeWorker());
    subscribe(controller);
    controller.initialize();

    fake.emitMessage("uciok");

    expect(fake.getPostedCommands()).toEqual([
      "uci",
      "setoption name Threads value 1",
      "setoption name Hash value 16",
      "setoption name MultiPV value 1",
      "isready",
    ]);
  });

  it("transitions to ready after readyok", () => {
    const { controller, fake } = createController(createFakeWorker());
    const spy = subscribe(controller);
    controller.initialize();

    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    expect(controller.status).toBe("ready");
    expect(spy.calls.find((e) => e.type === "ready")).toBeTruthy();
  });

  it("rejects analyze before ready with sanitized error", () => {
    const { controller } = createController(createFakeWorker());
    const spy = subscribe(controller);

    controller.analyze("req-1", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      limit: { kind: "depth", value: 14 },
    });

    const errorEvent = spy.calls.find((e) => e.type === "error");
    expect(errorEvent).toBeTruthy();
    expect(errorEvent?.message).toContain("not initialized");
    expect(errorEvent?.requestId).toBe("req-1");
  });

  it("sends position fen and go depth on analyze", () => {
    const { controller, fake } = createController(createFakeWorker());
    subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.analyze("req-1", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      limit: { kind: "depth", value: 14 },
    });

    const commands = fake.getPostedCommands();
    expect(commands).toContain("position fen rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1");
    expect(commands).toContain("go depth 14");
    expect(controller.status).toBe("analyzing");
  });

  it("sends go nodes on analyze with nodes limit", () => {
    const { controller, fake } = createController(createFakeWorker());
    subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.analyze("req-1", {
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      limit: { kind: "nodes", value: 500000 },
    });

    expect(fake.getPostedCommands()).toContain("go nodes 500000");
  });

  it("sends go movetime on analyze with movetime limit", () => {
    const { controller, fake } = createController(createFakeWorker());
    subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.analyze("req-1", {
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      limit: { kind: "movetime", value: 1000 },
    });

    expect(fake.getPostedCommands()).toContain("go movetime 1000");
  });

  it("emits analysis-info with correct request ID for partial info", () => {
    const { controller, fake } = createController(createFakeWorker());
    const spy = subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.analyze("req-1", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      limit: { kind: "depth", value: 14 },
    });

    fake.emitMessage("info depth 1 score cp 18 nodes 20 time 2 pv e2e4");

    const infoEvent = spy.calls.find((e) => e.type === "analysis-info");
    expect(infoEvent).toBeTruthy();
    expect(infoEvent?.requestId).toBe("req-1");
    expect((infoEvent as { type: "analysis-info"; info: { depth: number } }).info.depth).toBe(1);
  });

  it("emits best-move and returns to ready", () => {
    const { controller, fake } = createController(createFakeWorker());
    const spy = subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.analyze("req-1", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      limit: { kind: "depth", value: 14 },
    });

    fake.emitMessage("bestmove e2e4 ponder e7e5");

    expect(controller.status).toBe("ready");
    const bestMoveEvent = spy.calls.find((e) => e.type === "best-move");
    expect(bestMoveEvent).toBeTruthy();
    expect((bestMoveEvent as { type: "best-move"; move: { move: string | null } }).move.move).toBe("e2e4");
  });

  it("handles multiline messages", () => {
    const { controller, fake } = createController(createFakeWorker());
    const spy = subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok\nreadyok");

    expect(controller.status).toBe("ready");
    expect(spy.calls.find((e) => e.type === "ready")).toBeTruthy();
  });
});

describe("EngineController - repeated initialize", () => {
  it("does not create duplicate workers or duplicate handshakes", () => {
    const { controller, fake } = createController(createFakeWorker());
    subscribe(controller);

    controller.initialize();
    controller.initialize();

    const commands = fake.getPostedCommands();
    const uciCount = commands.filter((c) => c === "uci").length;
    expect(uciCount).toBe(1);
  });
});

describe("EngineController - analyze before ready", () => {
  it("emits sanitized error without exposing raw worker details", () => {
    const { controller } = createController(createFakeWorker());
    const spy = subscribe(controller);

    controller.analyze("req-1", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      limit: { kind: "depth", value: 14 },
    });

    const errorEvent = spy.calls.find((e) => e.type === "error");
    expect(errorEvent?.message).not.toContain("Error");
    expect(errorEvent?.message).not.toContain("undefined");
  });
});

describe("EngineController - cancellation", () => {
  it("new analyze cancels active request and starts after bestmove", () => {
    const { controller, fake } = createController(createFakeWorker());
    const spy = subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.analyze("req-1", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      limit: { kind: "depth", value: 14 },
    });

    fake.emitMessage("info depth 1 score cp 10 nodes 10 time 1 pv e2e4");

    expect(spy.calls.find((e) => e.type === "analysis-info" && e.requestId === "req-1")).toBeTruthy();

    controller.analyze("req-2", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      limit: { kind: "depth", value: 16 },
    });

    expect(fake.getPostedCommands()).toContain("stop");

    fake.emitMessage("bestmove e2e4");

    expect(spy.calls.find((e) => e.type === "stopped" && e.requestId === "req-1")).toBeTruthy();

    const finalCommands = fake.getPostedCommands();
    expect(finalCommands).toContain("position fen rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1");
    expect(finalCommands).toContain("go depth 16");
  });

  it("ignores stale info from canceling request", () => {
    const { controller, fake } = createController(createFakeWorker());
    const spy = subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.analyze("req-1", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      limit: { kind: "depth", value: 14 },
    });

    controller.analyze("req-2", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      limit: { kind: "depth", value: 16 },
    });

    fake.emitMessage("info depth 3 score cp 25 nodes 100 time 5 pv d2d4");

    const staleInfo = spy.calls.find((e) => e.type === "analysis-info" && e.requestId === "req-1");
    expect(staleInfo).toBeUndefined();
  });

  it("keeps only the newest queued request when multiple rapid analyze calls arrive", () => {
    const { controller, fake } = createController(createFakeWorker());
    const spy = subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.analyze("req-1", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      limit: { kind: "depth", value: 14 },
    });
    controller.analyze("req-2", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      limit: { kind: "depth", value: 16 },
    });
    controller.analyze("req-3", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      limit: { kind: "depth", value: 18 },
    });

    expect(fake.getPostedCommands()).toContain("stop");

    expect(spy.calls.find((e) => e.type === "stopped" && e.requestId === "req-2")).toBeTruthy();

    fake.emitMessage("bestmove e2e4");

    expect(spy.calls.find((e) => e.type === "stopped" && e.requestId === "req-1")).toBeTruthy();

    const commands = fake.getPostedCommands();
    expect(commands).toContain("position fen rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1");
    expect(commands).toContain("go depth 18");
  });
});

describe("EngineController - explicit stop", () => {
  it("sends stop once and transitions to ready", () => {
    const { controller, fake } = createController(createFakeWorker());
    const spy = subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.analyze("req-1", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      limit: { kind: "depth", value: 14 },
    });

    controller.stop();
    controller.stop();

    const stopCount = fake.getPostedCommands().filter((c) => c === "stop").length;
    expect(stopCount).toBe(1);

    fake.emitMessage("bestmove e2e4");

    expect(controller.status).toBe("ready");
    expect(spy.calls.find((e) => e.type === "stopped" && e.requestId === "req-1")).toBeTruthy();
  });

  it("is a no-op when ready", () => {
    const { controller, fake } = createController(createFakeWorker());
    subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.stop();

    expect(fake.getPostedCommands()).not.toContain("stop");
    expect(controller.status).toBe("ready");
  });
});

describe("EngineController - worker errors", () => {
  it("emits sanitized error and transitions to error", () => {
    const { controller, fake } = createController(createFakeWorker());
    const spy = subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.analyze("req-1", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      limit: { kind: "depth", value: 14 },
    });

    fake.emitError("Some browser error");

    expect(controller.status).toBe("error");
    const errorEvent = spy.calls.find((e) => e.type === "error");
    expect(errorEvent?.message).toBe("A worker error occurred.");
    expect(errorEvent?.message).not.toContain("Some browser error");
  });
});

describe("EngineController - subscriptions", () => {
  it("supports multiple subscribers", () => {
    const { controller } = createController(createFakeWorker());
    const spy1 = subscribe(controller);
    const spy2 = subscribe(controller);

    controller.initialize();

    expect(spy1.calls.find((e) => e.type === "loading")).toBeTruthy();
    expect(spy2.calls.find((e) => e.type === "loading")).toBeTruthy();
  });

  it("supports unsubscribe", () => {
    const { controller } = createController(createFakeWorker());
    const spy1 = subscribe(controller);
    const unsub = subscribe(controller);
    unsub.listener({ type: "loading", requestId: "" });
    expect(unsub.calls).toHaveLength(1);

    spy1.listener({ type: "loading", requestId: "" });
    expect(spy1.calls).toHaveLength(1);
  });
});

describe("EngineController - disposal", () => {
  it("disposes while ready without error", () => {
    const { controller, fake } = createController(createFakeWorker());
    subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.dispose();

    expect(controller.status).toBe("idle");
    expect(fake.getPostedCommands()).toContain("__terminate__");
  });

  it("disposes while analyzing and sends stop then quit", () => {
    const { controller, fake } = createController(createFakeWorker());
    subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.analyze("req-1", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      limit: { kind: "depth", value: 14 },
    });

    controller.dispose();

    const commands = fake.getPostedCommands();
    expect(commands).toContain("stop");
    expect(commands).toContain("quit");
    expect(commands).toContain("__terminate__");
    expect(controller.status).toBe("idle");
  });

  it("is idempotent", () => {
    const { controller, fake } = createController(createFakeWorker());
    subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.dispose();
    controller.dispose();

    const commands = fake.getPostedCommands();
    const terminateCount = commands.filter((c) => c === "__terminate__").length;
    expect(terminateCount).toBe(1);
  });

  it("ignores messages after dispose", () => {
    const { controller, fake } = createController(createFakeWorker());
    const spy = subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.dispose();

    fake.emitMessage("info depth 1 score cp 10 nodes 10 time 1 pv e2e4");
    fake.emitError("late error");

    const infoEvents = spy.calls.filter((e) => e.type === "analysis-info");
    const errorEvents = spy.calls.filter((e) => e.type === "error");
    expect(infoEvents).toHaveLength(0);
    expect(errorEvents).toHaveLength(0);
  });
});

describe("EngineController - invalid analysis input", () => {
  it("rejects FEN with newline without sending commands", () => {
    const { controller, fake } = createController(createFakeWorker());
    subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.analyze("req-1", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1\n",
      limit: { kind: "depth", value: 14 },
    });

    expect(fake.getPostedCommands()).not.toContain("position fen");
    expect(fake.getPostedCommands()).not.toContain("go depth 14");
    expect(controller.status).toBe("ready");
  });

  it("rejects FEN with carriage return without sending commands", () => {
    const { controller, fake } = createController(createFakeWorker());
    subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.analyze("req-1", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1\r",
      limit: { kind: "depth", value: 14 },
    });

    expect(fake.getPostedCommands()).not.toContain("position fen");
    expect(fake.getPostedCommands()).not.toContain("go depth 14");
    expect(controller.status).toBe("ready");
  });

  it("rejects invalid depth without sending commands", () => {
    const { controller, fake } = createController(createFakeWorker());
    subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.analyze("req-1", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      limit: { kind: "depth", value: 0 },
    });

    expect(fake.getPostedCommands()).not.toContain("go depth 0");
    expect(controller.status).toBe("ready");
  });

  it("rejects invalid nodes without sending commands", () => {
    const { controller, fake } = createController(createFakeWorker());
    subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.analyze("req-1", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      limit: { kind: "nodes", value: -1 },
    });

    expect(fake.getPostedCommands()).not.toContain("go nodes -1");
    expect(controller.status).toBe("ready");
  });

  it("rejects invalid movetime without sending commands", () => {
    const { controller, fake } = createController(createFakeWorker());
    subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.analyze("req-1", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      limit: { kind: "movetime", value: 500.5 },
    });

    expect(fake.getPostedCommands()).not.toContain("go movetime 500.5");
    expect(controller.status).toBe("ready");
  });
});

describe("EngineController - repeated initialize after ready", () => {
  it("does not send another uci after ready", () => {
    const { controller, fake } = createController(createFakeWorker());
    subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    expect(controller.status).toBe("ready");

    controller.initialize();

    const commands = fake.getPostedCommands();
    const uciCount = commands.filter((c) => c === "uci").length;
    expect(uciCount).toBe(1);
  });
});

describe("EngineController - explicit stop timing", () => {
  it("does not emit stopped before terminal bestmove", () => {
    const { controller, fake } = createController(createFakeWorker());
    const spy = subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.analyze("req-1", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      limit: { kind: "depth", value: 14 },
    });

    controller.stop();

    expect(spy.calls.find((e) => e.type === "stopped")).toBeUndefined();

    fake.emitMessage("info depth 5 score cp 30 nodes 500 time 10 pv e2e4");
    expect(spy.calls.find((e) => e.type === "stopped")).toBeUndefined();

    fake.emitMessage("bestmove e2e4");

    expect(spy.calls.find((e) => e.type === "stopped" && e.requestId === "req-1")).toBeTruthy();
  });

  it("sends stop only once on repeated stop", () => {
    const { controller, fake } = createController(createFakeWorker());
    subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.analyze("req-1", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      limit: { kind: "depth", value: 14 },
    });

    controller.stop();
    controller.stop();
    controller.stop();

    const stopCount = fake.getPostedCommands().filter((c) => c === "stop").length;
    expect(stopCount).toBe(1);
  });

  it("emits stopped for queued request and active request", () => {
    const { controller, fake } = createController(createFakeWorker());
    const spy = subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.analyze("req-1", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      limit: { kind: "depth", value: 14 },
    });

    controller.analyze("req-2", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1",
      limit: { kind: "depth", value: 16 },
    });

    controller.stop();

    expect(spy.calls.find((e) => e.type === "stopped" && e.requestId === "req-2")).toBeTruthy();
    expect(fake.getPostedCommands()).not.toContain("position fen rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1");
    expect(fake.getPostedCommands()).not.toContain("go depth 16");

    fake.emitMessage("bestmove e2e4");

    expect(spy.calls.find((e) => e.type === "stopped" && e.requestId === "req-1")).toBeTruthy();
    expect(controller.status).toBe("ready");
  });
});

describe("EngineController - subscriber error isolation", () => {
  it("continues delivering events after a subscriber throws", () => {
    const { controller } = createController(createFakeWorker());
    const spy1 = subscribe(controller);
    const spy2 = subscribe(controller);

    spy1.listener = () => {
      throw new Error("Subscriber failure");
    };

    controller.initialize();

    expect(spy2.calls.find((e) => e.type === "loading")).toBeTruthy();
  });
});

describe("EngineController - worker error recovery", () => {
  it("does not emit successful analysis events after fatal worker error", () => {
    const { controller, fake } = createController(createFakeWorker());
    const spy = subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.analyze("req-1", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      limit: { kind: "depth", value: 14 },
    });

    fake.emitError("fatal");

    fake.emitMessage("info depth 1 score cp 10 nodes 10 time 1 pv e2e4");
    fake.emitMessage("bestmove e2e4");

    const analysisEvents = spy.calls.filter((e) => e.type === "analysis-info" || e.type === "best-move");
    expect(analysisEvents).toHaveLength(0);
  });

  it("rejects analyze after fatal worker error", () => {
    const { controller, fake } = createController(createFakeWorker());
    const spy = subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.analyze("req-1", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      limit: { kind: "depth", value: 14 },
    });

    fake.emitError("fatal");

    controller.analyze("req-2", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      limit: { kind: "depth", value: 16 },
    });

    const commands = fake.getPostedCommands();
    expect(commands).not.toContain("go depth 16");
    const errorEvent = spy.calls.find((e) => e.type === "error" && e.requestId === "req-2");
    expect(errorEvent).toBeTruthy();
  });
});

describe("EngineController - multiline messages", () => {
  it("parses LF-separated multiline messages", () => {
    const { controller, fake } = createController(createFakeWorker());
    const spy = subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok\nreadyok");

    expect(controller.status).toBe("ready");
    expect(spy.calls.find((e) => e.type === "ready")).toBeTruthy();
  });

  it("parses CRLF-separated multiline messages", () => {
    const { controller, fake } = createController(createFakeWorker());
    const spy = subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok\r\nreadyok");

    expect(controller.status).toBe("ready");
    expect(spy.calls.find((e) => e.type === "ready")).toBeTruthy();
  });

  it("ignores empty lines inside multiline messages", () => {
    const { controller, fake } = createController(createFakeWorker());
    const spy = subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok\n\nreadyok");

    expect(controller.status).toBe("ready");
    expect(spy.calls.find((e) => e.type === "ready")).toBeTruthy();
  });
});

describe("EngineController - MultiPV", () => {
  it("sends MultiPV option before position and go when specified", () => {
    const { controller, fake } = createController(createFakeWorker());
    subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.analyze("req-1", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      limit: { kind: "depth", value: 14 },
      multiPv: 3,
    });

    const commands = fake.getPostedCommands();
    expect(commands).toContain("setoption name MultiPV value 3");
    expect(commands).toContain("position fen rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1");
    expect(commands).toContain("go depth 14");
  });

  it("does not send MultiPV when not specified", () => {
    const { controller, fake } = createController(createFakeWorker());
    subscribe(controller);
    controller.initialize();
    fake.emitMessage("uciok");
    fake.emitMessage("readyok");

    controller.analyze("req-1", {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      limit: { kind: "depth", value: 14 },
    });

    const commands = fake.getPostedCommands();
    expect(commands).not.toContain("setoption name MultiPV value 3");
  });
});
