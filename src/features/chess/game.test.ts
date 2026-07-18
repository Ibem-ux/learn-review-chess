import { describe, expect, it } from "vitest";
import {
  createGame,
  type ChessMoveFailure,
  type ChessMoveSuccess,
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
});
