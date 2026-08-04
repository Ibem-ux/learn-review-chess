import { describe, expect, it } from "vitest";
import { moveAccuracyPercent, winPercentFromCentipawns, winPercentFromMate } from "@/features/chess/accuracy-model";

describe("winPercentFromCentipawns", () => {
  it("is exactly 50 at zero", () => {
    expect(winPercentFromCentipawns(0)).toBe(50);
  });

  it("approaches 100 for large positive cp", () => {
    expect(winPercentFromCentipawns(10000)).toBeGreaterThan(99);
  });

  it("approaches 0 for large negative cp", () => {
    expect(winPercentFromCentipawns(-10000)).toBeLessThan(1);
  });

  it("is monotonic", () => {
    expect(winPercentFromCentipawns(100)).toBeGreaterThan(winPercentFromCentipawns(50));
  });

  it("throws for non-finite input", () => {
    expect(() => winPercentFromCentipawns(NaN)).toThrow(RangeError);
    expect(() => winPercentFromCentipawns(Infinity)).toThrow(RangeError);
  });
});

describe("winPercentFromMate", () => {
  it("returns 100 for positive mate distance", () => {
    expect(winPercentFromMate(3)).toBe(100);
  });

  it("returns 0 for negative mate distance", () => {
    expect(winPercentFromMate(-3)).toBe(0);
  });

  it("returns 0 for zero mate distance", () => {
    expect(winPercentFromMate(0)).toBe(0);
  });

  it("throws for non-finite input", () => {
    expect(() => winPercentFromMate(NaN)).toThrow(RangeError);
    expect(() => winPercentFromMate(Infinity)).toThrow(RangeError);
  });
});

describe("moveAccuracyPercent", () => {
  it("returns roughly 100 for unchanged win percent", () => {
    expect(moveAccuracyPercent(50, 50)).toBeCloseTo(100, 0);
  });

  it("scores a small drop higher than a large drop", () => {
    const smallDrop = moveAccuracyPercent(50, 49);
    const largeDrop = moveAccuracyPercent(50, 30);
    expect(smallDrop).toBeGreaterThan(largeDrop);
  });

  it("clamps improvement to 100", () => {
    expect(moveAccuracyPercent(30, 80)).toBe(100);
  });

  it("clamps catastrophic drop to 0", () => {
    expect(moveAccuracyPercent(100, 0)).toBe(0);
  });

  it("throws for non-finite win percentages", () => {
    expect(() => moveAccuracyPercent(NaN, 50)).toThrow(RangeError);
    expect(() => moveAccuracyPercent(50, NaN)).toThrow(RangeError);
    expect(() => moveAccuracyPercent(Infinity, 50)).toThrow(RangeError);
    expect(() => moveAccuracyPercent(50, Infinity)).toThrow(RangeError);
  });
});
