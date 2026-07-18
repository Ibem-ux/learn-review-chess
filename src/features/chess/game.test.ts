import { describe, expect, it } from "vitest";
import {
  createGame,
  type ChessMoveFailure,
  type ChessMoveSuccess,
  type ChessUndoFailure,
} from "@/features/chess/game";

describe("chess game module", () => {
  it("creates a standard starting position", () => {
    const game = createGame();
    expect(game.fen()).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    );
    expect(game.turn()).toBe("w");
  });

  it("creates a game from a valid FEN", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const game = createGame(fen);
    expect(game.fen()).toBe(fen);
  });

  it("applies a legal move such as e2 to e4", () => {
    const game = createGame();
    const result = game.move({ from: "e2", to: "e4" });
    expect(result.ok).toBe(true);
    const success = result as ChessMoveSuccess;
    expect(success.from).toBe("e2");
    expect(success.to).toBe("e4");
    expect(success.fen).toBe(
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    );
  });

  it("changes the turn after a legal move", () => {
    const game = createGame();
    expect(game.turn()).toBe("w");
    const result = game.move({ from: "e2", to: "e4" });
    expect(result.ok).toBe(true);
    expect(game.turn()).toBe("b");
  });

  it("rejects an illegal move such as e2 to e5", () => {
    const game = createGame();
    const result = game.move({ from: "e2", to: "e5" });
    expect(result.ok).toBe(false);
    const failure = result as ChessMoveFailure;
    expect(failure.reason).toBeTruthy();
  });

  it("keeps the position unchanged after an illegal move", () => {
    const game = createGame();
    const before = game.fen();
    const result = game.move({ from: "e2", to: "e5" });
    expect(result.ok).toBe(false);
    const failure = result as ChessMoveFailure;
    expect(failure.fen).toBe(before);
    expect(game.fen()).toBe(before);
    expect(game.turn()).toBe("w");
  });

  it("starts with an empty history", () => {
    const game = createGame();
    expect(game.history()).toEqual([]);
  });

  it("records legal moves in history in played order", () => {
    const game = createGame();
    game.move({ from: "e2", to: "e4" });
    game.move({ from: "e7", to: "e5" });
    const history = game.history();
    expect(history.map((entry) => entry.san)).toEqual(["e4", "e5"]);
    expect(history[0].color).toBe("w");
    expect(history[1].color).toBe("b");
  });

  it("produces correct SAN for a short sequence", () => {
    const game = createGame();
    game.move({ from: "e2", to: "e4" });
    game.move({ from: "e7", to: "e5" });
    expect(game.history().map((entry) => entry.san)).toEqual(["e4", "e5"]);
  });

  it("does not record illegal moves in history", () => {
    const game = createGame();
    game.move({ from: "e2", to: "e4" });
    game.move({ from: "e2", to: "e5" });
    expect(game.history().map((entry) => entry.san)).toEqual(["e4"]);
  });

  it("undoes exactly the latest half-move", () => {
    const game = createGame();
    game.move({ from: "e2", to: "e4" });
    game.move({ from: "e7", to: "e5" });
    const result = game.undo();
    expect(result.ok).toBe(true);
    const success = result as Extract<typeof result, { ok: true }>;
    expect(success.undone.san).toBe("e5");
    expect(success.undone.color).toBe("b");
    expect(game.history().map((entry) => entry.san)).toEqual(["e4"]);
  });

  it("restores the previous position and side to move on undo", () => {
    const game = createGame();
    game.move({ from: "e2", to: "e4" });
    const beforeFen = game.fen();
    game.move({ from: "e7", to: "e5" });
    expect(game.turn()).toBe("w");
    const result = game.undo();
    expect(result.ok).toBe(true);
    const success = result as Extract<typeof result, { ok: true }>;
    expect(success.fen).toBe(beforeFen);
    expect(game.fen()).toBe(beforeFen);
    expect(game.turn()).toBe("b");
  });

  it("returns a controlled failure when undoing an empty history", () => {
    const game = createGame();
    const result = game.undo();
    expect(result.ok).toBe(false);
    const failure = result as ChessUndoFailure;
    expect(failure.reason).toBe("No move to undo");
    expect(game.history()).toEqual([]);
  });

  it("supports multiple undos until history is empty", () => {
    const game = createGame();
    game.move({ from: "e2", to: "e4" });
    game.move({ from: "e7", to: "e5" });
    const firstUndo = game.undo();
    expect(firstUndo.ok).toBe(true);
    const secondUndo = game.undo();
    expect(secondUndo.ok).toBe(true);
    const thirdUndo = game.undo();
    expect(thirdUndo.ok).toBe(false);
    expect(game.history()).toEqual([]);
    expect(game.fen()).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    );
    expect(game.turn()).toBe("w");
  });
});
