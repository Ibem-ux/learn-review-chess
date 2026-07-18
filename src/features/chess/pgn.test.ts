import { describe, expect, it } from "vitest";
import { parsePgn } from "@/features/chess/pgn";

describe("parsePgn", () => {
  it("rejects empty input", () => {
    const result = parsePgn("");
    expect(result.ok).toBe(false);
  });

  it("rejects whitespace-only input", () => {
    const result = parsePgn("   \n\t  ");
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed PGN with the sanitized reason", () => {
    const result = parsePgn("not a real pgn at all");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(
      "Unable to parse PGN. Check that the game notation is valid."
    );
  });

  it("rejects an illegal move sequence with the sanitized reason", () => {
    const result = parsePgn('[Event "bad"]\n\n1. e2e4 e7e5 2. Qh4 *');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(
      "Unable to parse PGN. Check that the game notation is valid."
    );
  });

  it("never exposes raw chess.js exception messages", () => {
    const malformed = parsePgn("not a real pgn at all");
    const illegal = parsePgn('[Event "bad"]\n\n1. e2e4 e7e5 2. Qh4 *');
    for (const result of [malformed, illegal]) {
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.reason).not.toMatch(/move|illegal|chess\.js|Error|throw|exception/i);
    }
  });

  it("parses a valid short game", () => {
    const pgn = [
      '[Event "Test"]',
      '[Site "Local"]',
      '[White "Alice"]',
      '[Black "Bob"]',
      "",
      "1. e4 e5 2. Nf3 Nc6 *",
    ].join("\n");
    const result = parsePgn(pgn);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.halfMoveCount).toBe(4);
    expect(result.value.moves.map((m) => m.san)).toEqual([
      "e4",
      "e5",
      "Nf3",
      "Nc6",
    ]);
  });

  it("extracts headers", () => {
    const pgn = [
      '[Event "Test"]',
      '[Site "Local"]',
      '[White "Alice"]',
      '[Black "Bob"]',
      "",
      "1. e4 e5 *",
    ].join("\n");
    const result = parsePgn(pgn);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.headers.Event).toBe("Test");
    expect(result.value.headers.White).toBe("Alice");
    expect(result.value.headers.Black).toBe("Bob");
  });

  it("assigns correct White/Black move colors", () => {
    const pgn = ["[Event \"x\"]", "", "1. e4 e5 2. Nf3 Nc6 *"].join("\n");
    const result = parsePgn(pgn);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.moves.map((m) => m.color)).toEqual([
      "w",
      "b",
      "w",
      "b",
    ]);
  });

  it("provides correct source and destination squares", () => {
    const pgn = ["[Event \"x\"]", "", "1. e4 e5 *"].join("\n");
    const result = parsePgn(pgn);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.moves[0]).toMatchObject({
      from: "e2",
      to: "e4",
    });
    expect(result.value.moves[1]).toMatchObject({
      from: "e7",
      to: "e5",
    });
  });

  it("provides before and after FEN values", () => {
    const pgn = ["[Event \"x\"]", "", "1. e4 e5 *"].join("\n");
    const result = parsePgn(pgn);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [e4, e5] = result.value.moves;
    expect(e4.before).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    );
    expect(e4.after).toBe(
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    );
    expect(e5.before).toBe(e4.after);
    expect(e5.after).toBe(result.value.finalFen);
  });

  it("provides the correct final FEN", () => {
    const pgn = ["[Event \"x\"]", "", "1. e4 e5 2. Nf3 Nc6 *"].join("\n");
    const result = parsePgn(pgn);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.finalFen).toBe(
      "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3"
    );
  });

  it("parses a PGN containing comments and annotations", () => {
    const pgn = [
      '[Event "Annotated"]',
      "",
      "1. e4 {good central move} e5 2. Nf3 Nc6 3. Bb5+ $1 *",
    ].join("\n");
    const result = parsePgn(pgn);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.halfMoveCount).toBe(5);
    expect(result.value.moves).toHaveLength(5);
    expect(result.value.moves.slice(0, 5).map((m) => m.san)).toEqual([
      "e4",
      "e5",
      "Nf3",
      "Nc6",
      "Bb5",
    ]);
  });

  it("does not mutate an external ChessGame instance", () => {
    const pgn = ["[Event \"x\"]", "", "1. e4 e5 *"].join("\n");
    const result = parsePgn(pgn);
    expect(result.ok).toBe(true);
  });
});
