import { describe, expect, it } from "vitest";
import {
  MINOR_PIECE_VALUE,
  PIECE_VALUES,
  materialBalanceFromFen,
} from "./material";

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

describe("materialBalanceFromFen", () => {
  it("returns 0 for the standard opening position", () => {
    expect(materialBalanceFromFen(INITIAL_FEN)).toBe(0);
  });

  it("returns 0 after 1.e4 where a pawn moved without captures", () => {
    expect(materialBalanceFromFen(AFTER_E4_FEN)).toBe(0);
  });

  it("returns 900 when White is up a queen", () => {
    const fen = "rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(materialBalanceFromFen(fen)).toBe(900);
  });

  it("returns -500 when Black is up a rook", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/1NBQKBNR w Kkq - 0 1";
    expect(materialBalanceFromFen(fen)).toBe(-500);
  });

  it("returns 0 for a kings-only position", () => {
    const fen = "8/8/8/4k3/4K3/8/8/8 w - - 0 1";
    expect(materialBalanceFromFen(fen)).toBe(0);
  });

  it.each([
    ["p", "P", 100],
    ["n", "N", 320],
    ["b", "B", 330],
    ["r", "R", 500],
    ["q", "Q", 900],
  ])("returns exact piece value %s (%d) when White has piece plus kings", (_name, pieceChar, expectedValue) => {
    const fen = `4k3/8/8/8/8/8/8/4K2${pieceChar} w - - 0 1`;
    expect(materialBalanceFromFen(fen)).toBe(expectedValue);
  });

  it("throws RangeError when placement has seven ranks", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP w KQkq - 0 1";
    expect(() => materialBalanceFromFen(fen)).toThrow(RangeError);
    expect(() => materialBalanceFromFen(fen)).toThrow("FEN must contain eight ranks.");
  });

  it("throws RangeError when placement has nine ranks", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR/8 w KQkq - 0 1";
    expect(() => materialBalanceFromFen(fen)).toThrow(RangeError);
    expect(() => materialBalanceFromFen(fen)).toThrow("FEN must contain eight ranks.");
  });

  it("throws RangeError when placement contains an unsupported piece character 'x'", () => {
    const fen = "rnbqkbnx/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(() => materialBalanceFromFen(fen)).toThrow(RangeError);
    expect(() => materialBalanceFromFen(fen)).toThrow("FEN contains an unsupported piece character.");
  });

  it("parses full FEN with extra fields identically to placement string alone", () => {
    const placement = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR";
    const fullFen = `${placement} b KQkq e3 0 1`;
    expect(materialBalanceFromFen(fullFen)).toBe(materialBalanceFromFen(placement));
  });

  it("has no king entry in PIECE_VALUES and contains exactly five piece keys", () => {
    const keys = Object.keys(PIECE_VALUES);
    expect(keys.sort()).toEqual(["b", "n", "p", "q", "r"]);
    expect("k" in PIECE_VALUES).toBe(false);
  });

  it("ensures MINOR_PIECE_VALUE is strictly less than both knight and bishop values", () => {
    expect(MINOR_PIECE_VALUE).toBeLessThan(PIECE_VALUES.n);
    expect(MINOR_PIECE_VALUE).toBeLessThan(PIECE_VALUES.b);
  });
});
