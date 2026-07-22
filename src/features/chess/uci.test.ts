import { describe, expect, it } from "vitest";
import {
  goDepth,
  goMovetime,
  goNodes,
  ISREADY,
  parseUciLine,
  positionFen,
  QUIT,
  setoptionHash,
  setoptionMultiPv,
  setoptionThreads,
  STOP,
  UCINEWGAME,
  UCI,
} from "@/features/chess/uci";
import { scoreToWhitePerspective } from "@/features/chess/engine";
import type { EngineScore } from "@/features/chess/engine";

describe("UCI command constants", () => {
  it("exposes expected command strings", () => {
    expect(UCI).toBe("uci");
    expect(ISREADY).toBe("isready");
    expect(UCINEWGAME).toBe("ucinewgame");
    expect(STOP).toBe("stop");
    expect(QUIT).toBe("quit");
  });
});

describe("setoption formatters", () => {
  it("formats Threads with a positive integer", () => {
    expect(setoptionThreads(1)).toEqual({
      ok: true,
      command: "setoption name Threads value 1",
    });
  });

  it("formats Hash with a positive integer", () => {
    expect(setoptionHash(16)).toEqual({
      ok: true,
      command: "setoption name Hash value 16",
    });
  });

  it("formats MultiPV with a positive integer", () => {
    expect(setoptionMultiPv(2)).toEqual({
      ok: true,
      command: "setoption name MultiPV value 2",
    });
  });

  it("rejects zero", () => {
    expect(setoptionThreads(0).ok).toBe(false);
  });

  it("rejects negative values", () => {
    expect(setoptionHash(-1).ok).toBe(false);
  });

  it("rejects non-integer values", () => {
    expect(setoptionMultiPv(2.5).ok).toBe(false);
  });

  it("rejects NaN", () => {
    expect(setoptionThreads(Number.NaN).ok).toBe(false);
  });

  it("rejects Infinity", () => {
    expect(setoptionHash(Infinity).ok).toBe(false);
  });
});

describe("positionFen formatter", () => {
  it("formats a valid FEN", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    expect(positionFen(fen)).toEqual({
      ok: true,
      command: `position fen ${fen}`,
    });
  });

  it("rejects a FEN containing a newline", () => {
    expect(positionFen("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1\n").ok).toBe(false);
  });

  it("rejects a FEN containing a carriage return", () => {
    expect(positionFen("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1\r").ok).toBe(false);
  });
});

describe("go command formatters", () => {
  it("formats go depth with a positive integer", () => {
    expect(goDepth(14)).toEqual({ ok: true, command: "go depth 14" });
  });

  it("formats go nodes with a positive integer", () => {
    expect(goNodes(500_000)).toEqual({ ok: true, command: "go nodes 500000" });
  });

  it("formats go movetime with a positive integer", () => {
    expect(goMovetime(1000)).toEqual({ ok: true, command: "go movetime 1000" });
  });

  it("rejects zero for depth", () => {
    expect(goDepth(0).ok).toBe(false);
  });

  it("rejects negative for nodes", () => {
    expect(goNodes(-1).ok).toBe(false);
  });

  it("rejects non-integer for movetime", () => {
    expect(goMovetime(500.5).ok).toBe(false);
  });

  it("rejects NaN", () => {
    expect(goDepth(Number.NaN).ok).toBe(false);
  });

  it("rejects Infinity", () => {
    expect(goNodes(Infinity).ok).toBe(false);
  });
});

describe("parseUciLine - basic messages", () => {
  it("parses uciok", () => {
    expect(parseUciLine("uciok")).toEqual({ type: "uciok" });
  });

  it("parses readyok", () => {
    expect(parseUciLine("readyok")).toEqual({ type: "readyok" });
  });

  it("parses id name", () => {
    expect(parseUciLine("id name Stockfish 18")).toEqual({
      type: "id",
      kind: "name",
      value: "Stockfish 18",
    });
  });

  it("parses id author", () => {
    expect(parseUciLine("id author the Stockfish developers")).toEqual({
      type: "id",
      kind: "author",
      value: "the Stockfish developers",
    });
  });

  it("ignores leading and trailing whitespace", () => {
    expect(parseUciLine("  uciok  ")).toEqual({ type: "uciok" });
  });

  it("returns null for unknown lines", () => {
    expect(parseUciLine("option name Hash value 16")).toBeNull();
  });

  it("returns null for empty lines", () => {
    expect(parseUciLine("")).toBeNull();
  });

  it("returns null for whitespace-only lines", () => {
    expect(parseUciLine("   \t  ")).toBeNull();
  });
});

describe("parseUciLine - partial info lines", () => {
  it("parses info with only depth", () => {
    const result = parseUciLine("info depth 1");
    expect(result?.type).toBe("info");
    if (result?.type !== "info") return;
    expect(result.info.depth).toBe(1);
    expect(result.info.pv).toBeUndefined();
    expect(result.info.multipv).toBeUndefined();
    expect(result.info.score).toBeUndefined();
  });

  it("parses info with only pv and no depth", () => {
    const result = parseUciLine("info pv e2e4 e7e5");
    expect(result?.type).toBe("info");
    if (result?.type !== "info") return;
    expect(result.info.pv).toEqual(["e2e4", "e7e5"]);
    expect(result.info.depth).toBeUndefined();
  });

  it("parses info with only score", () => {
    const result = parseUciLine("info score cp 20");
    expect(result?.type).toBe("info");
    if (result?.type !== "info") return;
    expect(result.info.score).toEqual({ type: "cp", value: 20, perspective: "side-to-move" });
  });

  it("parses info with nodes and time", () => {
    const result = parseUciLine("info nodes 1000 time 5");
    expect(result?.type).toBe("info");
    if (result?.type !== "info") return;
    expect(result.info.nodes).toBe(1000);
    expect(result.info.timeMs).toBe(5);
  });

  it("returns null for info with no supported or valid fields", () => {
    expect(parseUciLine("info string hello")).toBeNull();
  });

  it("returns null for completely malformed info lines", () => {
    expect(parseUciLine("info")).toBeNull();
  });
});

describe("parseUciLine - complete info lines", () => {
  it("parses a complete centipawn info line", () => {
    const line =
      "info depth 1 seldepth 1 multipv 1 score cp 18 nodes 20 nps 10000 hashfull 0 tbhits 0 time 2 pv e2e4";
    const result = parseUciLine(line);
    expect(result?.type).toBe("info");
    if (result?.type !== "info") return;
    expect(result.info.depth).toBe(1);
    expect(result.info.seldepth).toBe(1);
    expect(result.info.multipv).toBe(1);
    expect(result.info.score).toEqual({ type: "cp", value: 18, perspective: "side-to-move" });
    expect(result.info.nodes).toBe(20);
    expect(result.info.nps).toBe(10000);
    expect(result.info.timeMs).toBe(2);
    expect(result.info.hashfull).toBe(0);
    expect(result.info.pv).toEqual(["e2e4"]);
  });

  it("parses positive and negative centipawn scores", () => {
    const positive = parseUciLine(
      "info depth 5 multipv 1 score cp 120 nodes 1000 time 10 pv e2e4"
    );
    const negative = parseUciLine(
      "info depth 5 multipv 1 score cp -250 nodes 1000 time 10 pv e2e4"
    );
    if (positive?.type !== "info" || negative?.type !== "info") return;
    expect(positive.info.score).toEqual({ type: "cp", value: 120, perspective: "side-to-move" });
    expect(negative.info.score).toEqual({ type: "cp", value: -250, perspective: "side-to-move" });
  });

  it("parses positive and negative mate scores", () => {
    const positive = parseUciLine(
      "info depth 10 multipv 1 score mate 3 nodes 5000 time 50 pv e8h8"
    );
    const negative = parseUciLine(
      "info depth 10 multipv 1 score mate -5 nodes 5000 time 50 pv e8h8"
    );
    if (positive?.type !== "info" || negative?.type !== "info") return;
    expect(positive.info.score).toEqual({ type: "mate", value: 3, perspective: "side-to-move" });
    expect(negative.info.score).toEqual({ type: "mate", value: -5, perspective: "side-to-move" });
  });

  it("parses multiPV lines", () => {
    const line1 =
      "info depth 1 multipv 1 score cp 18 nodes 20 time 2 pv e2e4";
    const line2 =
      "info depth 1 multipv 2 score cp 12 nodes 20 time 2 pv g1f3";
    const result1 = parseUciLine(line1);
    const result2 = parseUciLine(line2);
    if (result1?.type !== "info" || result2?.type !== "info") return;
    expect(result1.info.multipv).toBe(1);
    expect(result2.info.multipv).toBe(2);
  });

  it("parses lowerbound and upperbound", () => {
    const lower = parseUciLine(
      "info depth 5 multipv 1 score cp 50 lowerbound nodes 1000 time 10 pv e2e4"
    );
    const upper = parseUciLine(
      "info depth 5 multipv 1 score cp 80 upperbound nodes 1000 time 10 pv e2e4"
    );
    if (lower?.type !== "info" || upper?.type !== "info") return;
    expect(lower.info.score).toEqual({ type: "cp", value: 50, bound: "lowerbound", perspective: "side-to-move" });
    expect(upper.info.score).toEqual({ type: "cp", value: 80, bound: "upperbound", perspective: "side-to-move" });
  });

  it("tolerates repeated internal whitespace", () => {
    const line =
      "info   depth   1   seldepth   1   multipv   1   score   cp   18   nodes   20   time   2   pv   e2e4";
    const result = parseUciLine(line);
    expect(result?.type).toBe("info");
    if (result?.type !== "info") return;
    expect(result.info.depth).toBe(1);
    expect(result.info.pv).toEqual(["e2e4"]);
  });

  it("parses info lines with different valid field orders", () => {
    const line =
      "info score cp 25 multipv 1 time 5 nodes 500 depth 4 pv d2d4";
    const result = parseUciLine(line);
    expect(result?.type).toBe("info");
    if (result?.type !== "info") return;
    expect(result.info.depth).toBe(4);
    expect(result.info.multipv).toBe(1);
    expect(result.info.nodes).toBe(500);
    expect(result.info.timeMs).toBe(5);
    expect(result.info.pv).toEqual(["d2d4"]);
    expect(result.info.score).toEqual({ type: "cp", value: 25, perspective: "side-to-move" });
  });

  it("parses PV containing promotion UCI moves", () => {
    const line =
      "info depth 1 multipv 1 score cp 0 nodes 10 time 1 pv e7e8q";
    const result = parseUciLine(line);
    expect(result?.type).toBe("info");
    if (result?.type !== "info") return;
    expect(result.info.pv).toEqual(["e7e8q"]);
  });

  it("preserves optional fields when absent", () => {
    const line =
      "info depth 1 multipv 1 score cp 0 nodes 10 time 1 pv e2e4";
    const result = parseUciLine(line);
    expect(result?.type).toBe("info");
    if (result?.type !== "info") return;
    expect(result.info.nps).toBeUndefined();
    expect(result.info.hashfull).toBeUndefined();
    expect(result.info.seldepth).toBeUndefined();
  });
});

describe("parseUciLine - malformed fields", () => {
  it("omits malformed optional numeric fields but preserves valid ones", () => {
    const line =
      "info depth notanumber score cp 20 nodes 1000 pv e2e4";
    const result = parseUciLine(line);
    expect(result?.type).toBe("info");
    if (result?.type !== "info") return;
    expect(result.info.depth).toBeUndefined();
    expect(result.info.score).toEqual({ type: "cp", value: 20, perspective: "side-to-move" });
    expect(result.info.nodes).toBe(1000);
    expect(result.info.pv).toEqual(["e2e4"]);
  });

  it("returns partial info when some optional numeric fields are malformed but pv is valid", () => {
    const line =
      "info depth notanumber score nottype nodes notnodes time nottime pv e2e4";
    const result = parseUciLine(line);
    expect(result?.type).toBe("info");
    if (result?.type !== "info") return;
    expect(result.info.pv).toEqual(["e2e4"]);
    expect(result.info.depth).toBeUndefined();
    expect(result.info.score).toBeUndefined();
    expect(result.info.nodes).toBeUndefined();
    expect(result.info.timeMs).toBeUndefined();
  });
});

describe("parseUciLine - bestmove", () => {
  it("parses bestmove with ponder", () => {
    expect(parseUciLine("bestmove e2e4 ponder e7e5")).toEqual({
      type: "bestmove",
      move: "e2e4",
      ponder: "e7e5",
    });
  });

  it("parses bestmove without ponder", () => {
    expect(parseUciLine("bestmove e2e4")).toEqual({
      type: "bestmove",
      move: "e2e4",
      ponder: null,
    });
  });

  it("parses bestmove 0000 as null move", () => {
    expect(parseUciLine("bestmove 0000")).toEqual({
      type: "bestmove",
      move: null,
      ponder: null,
    });
  });

  it("parses bestmove (none) as null move", () => {
    expect(parseUciLine("bestmove (none)")).toEqual({
      type: "bestmove",
      move: null,
      ponder: null,
    });
  });

  it("returns null for malformed bestmove lines", () => {
    expect(parseUciLine("bestmove")).toBeNull();
    expect(parseUciLine("bestmove unknown")).toBeNull();
    expect(parseUciLine("bestmove e2e4 ponder unknown")).toBeNull();
  });
});

describe("parseUciLine - edge cases", () => {
  it("tolerates leading whitespace on all messages", () => {
    expect(parseUciLine("  info depth 1 multipv 1 score cp 0 nodes 10 time 1 pv e2e4  ")?.type).toBe("info");
    expect(parseUciLine("  bestmove e2e4  ")?.type).toBe("bestmove");
  });

  it("returns null for info line with no recognized fields", () => {
    expect(parseUciLine("info foo bar")).toBeNull();
  });
});

describe("scoreToWhitePerspective", () => {
  const cpScore: EngineScore = { type: "cp", value: 120, perspective: "side-to-move" };
  const mateScore: EngineScore = { type: "mate", value: 3, perspective: "side-to-move" };

  it("preserves unbounded centipawn score when White is to move", () => {
    const result = scoreToWhitePerspective(cpScore, "w");
    expect(result).toEqual({ type: "cp", value: 120, perspective: "white" });
  });

  it("negates unbounded centipawn score when Black is to move", () => {
    const result = scoreToWhitePerspective(cpScore, "b");
    expect(result).toEqual({ type: "cp", value: -120, perspective: "white" });
  });

  it("preserves unbounded mate score when White is to move", () => {
    const result = scoreToWhitePerspective(mateScore, "w");
    expect(result).toEqual({ type: "mate", value: 3, perspective: "white" });
  });

  it("negates unbounded mate score when Black is to move", () => {
    const result = scoreToWhitePerspective(mateScore, "b");
    expect(result).toEqual({ type: "mate", value: -3, perspective: "white" });
  });

  it("preserves lowerbound for White to move", () => {
    const score: EngineScore = {
      type: "cp",
      value: 50,
      bound: "lowerbound",
      perspective: "side-to-move",
    };
    const result = scoreToWhitePerspective(score, "w");
    expect(result).toEqual({
      type: "cp",
      value: 50,
      bound: "lowerbound",
      perspective: "white",
    });
  });

  it("preserves upperbound for White to move", () => {
    const score: EngineScore = {
      type: "cp",
      value: 80,
      bound: "upperbound",
      perspective: "side-to-move",
    };
    const result = scoreToWhitePerspective(score, "w");
    expect(result).toEqual({
      type: "cp",
      value: 80,
      bound: "upperbound",
      perspective: "white",
    });
  });

  it("swaps lowerbound to upperbound for Black to move", () => {
    const score: EngineScore = {
      type: "cp",
      value: 50,
      bound: "lowerbound",
      perspective: "side-to-move",
    };
    const result = scoreToWhitePerspective(score, "b");
    expect(result).toEqual({
      type: "cp",
      value: -50,
      bound: "upperbound",
      perspective: "white",
    });
  });

  it("swaps upperbound to lowerbound for Black to move", () => {
    const score: EngineScore = {
      type: "cp",
      value: 80,
      bound: "upperbound",
      perspective: "side-to-move",
    };
    const result = scoreToWhitePerspective(score, "b");
    expect(result).toEqual({
      type: "cp",
      value: -80,
      bound: "lowerbound",
      perspective: "white",
    });
  });

  it("preserves unbounded mate score for Black to move", () => {
    const score: EngineScore = {
      type: "mate",
      value: -2,
      perspective: "side-to-move",
    };
    const result = scoreToWhitePerspective(score, "b");
    expect(result).toEqual({ type: "mate", value: 2, perspective: "white" });
  });
});
