import { describe, expect, it } from "vitest";
import { applyExplorerMove } from "./explorer-move";

const p4Fen = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
const p5Fen = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3";
const promotionFen = "8/P7/8/8/8/8/8/K6k w - - 0 1";

describe("explorer-move", () => {
  it("legal move f1c4 from P4 returns ok true", () => {
    const result = applyExplorerMove(p4Fen, { from: "f1", to: "c4" });
    expect(result.ok).toBe(true);
  });

  it("that move returns san Bc4", () => {
    const result = applyExplorerMove(p4Fen, { from: "f1", to: "c4" });
    expect(result).toEqual({
      ok: true,
      fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
      san: "Bc4",
    });
  });

  it("that move returns a fen with black to move", () => {
    const result = applyExplorerMove(p4Fen, { from: "f1", to: "c4" });
    expect(result).toEqual({
      ok: true,
      fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
      san: "Bc4",
    });
    expect(result.ok && result.fen.split(" ")[1]).toBe("b");
  });

  it("legal move f8c5 from P5 returns ok true with san Bc5", () => {
    const result = applyExplorerMove(p5Fen, { from: "f8", to: "c5" });
    expect(result).toEqual({
      ok: true,
      fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
      san: "Bc5",
    });
  });

  it("illegal move e1e3 from P4 returns ok false with reason illegal", () => {
    const result = applyExplorerMove(p4Fen, { from: "e1", to: "e3" });
    expect(result).toEqual({ ok: false, reason: "illegal" });
  });

  it("moving from an empty square returns ok false with reason illegal", () => {
    const result = applyExplorerMove(p4Fen, { from: "e3", to: "e4" });
    expect(result).toEqual({ ok: false, reason: "illegal" });
  });

  it("moving an opponent piece returns ok false with reason illegal", () => {
    const result = applyExplorerMove(p4Fen, { from: "e7", to: "e6" });
    expect(result).toEqual({ ok: false, reason: "illegal" });
  });

  it("a malformed fen string returns ok false with reason invalid-fen", () => {
    const result = applyExplorerMove("not a fen", { from: "e2", to: "e4" });
    expect(result).toEqual({ ok: false, reason: "invalid-fen" });
  });

  it("an empty fen string returns ok false with reason invalid-fen", () => {
    const result = applyExplorerMove("", { from: "e2", to: "e4" });
    expect(result).toEqual({ ok: false, reason: "invalid-fen" });
  });

  it("a legal move does not throw and a wildly malformed input does not throw", () => {
    expect(() => applyExplorerMove(p4Fen, { from: "f1", to: "c4" })).not.toThrow();
    expect(() => applyExplorerMove("not a fen", { from: "e2", to: "e4" })).not.toThrow();
  });

  it("two successive calls with the same fen give identical results", () => {
    const first = applyExplorerMove(p4Fen, { from: "f1", to: "c4" });
    const second = applyExplorerMove(p4Fen, { from: "f1", to: "c4" });
    expect(first).toEqual(second);
  });

  it("a promotion move returns ok true and a san containing the promoted piece", () => {
    const result = applyExplorerMove(promotionFen, { from: "a7", to: "a8", promotion: "q" });
    expect(result).toEqual({
      ok: true,
      fen: "Q7/8/8/8/8/8/8/K6k b - - 0 1",
      san: "a8=Q+",
    });
  });
});