import { describe, expect, it } from "vitest";
import {
  MIN_RATED_MOVES,
  estimateRatingFromAccuracy,
} from "./rating-estimate";

describe("estimateRatingFromAccuracy", () => {
  it("returns null when accuracy is null", () => {
    expect(estimateRatingFromAccuracy(null, 10)).toBeNull();
  });

  it("returns null when moves are below MIN_RATED_MOVES with valid accuracy", () => {
    expect(estimateRatingFromAccuracy(75, MIN_RATED_MOVES - 1)).toBeNull();
  });

  it("returns a number when moves equal MIN_RATED_MOVES exactly", () => {
    const result = estimateRatingFromAccuracy(75, MIN_RATED_MOVES);
    expect(result).toBe(2050);
  });

  it("returns 2600 for 100 accuracy with 10 moves", () => {
    expect(estimateRatingFromAccuracy(100, 10)).toBe(2600);
  });

  it("returns 400 for 0 accuracy with 10 moves", () => {
    expect(estimateRatingFromAccuracy(0, 10)).toBe(400);
  });

  it("returns 1500 for 50 accuracy with 10 moves", () => {
    expect(estimateRatingFromAccuracy(50, 10)).toBe(1500);
  });

  it("rounds mid-value accuracy 87.3 to an exact integer", () => {
    const result = estimateRatingFromAccuracy(87.3, 10);
    expect(result).toBe(2321);
    expect(Number.isInteger(result ?? NaN)).toBe(true);
  });

  it("is strictly monotonic as accuracy increases", () => {
    const r60 = estimateRatingFromAccuracy(60, 10);
    const r59 = estimateRatingFromAccuracy(59, 10);
    expect(r60 ?? 0).toBeGreaterThan(r59 ?? 0);
  });

  it("throws RangeError for infinite accuracy", () => {
    expect(() => estimateRatingFromAccuracy(Infinity, 10)).toThrow(
      RangeError,
    );
    expect(() => estimateRatingFromAccuracy(Infinity, 10)).toThrow(
      "Accuracy must be a finite number.",
    );
  });

  it("throws RangeError for negative accuracy -1", () => {
    expect(() => estimateRatingFromAccuracy(-1, 10)).toThrow(RangeError);
    expect(() => estimateRatingFromAccuracy(-1, 10)).toThrow(
      "Accuracy must be between 0 and 100.",
    );
  });

  it("throws RangeError for accuracy exceeding 100", () => {
    expect(() => estimateRatingFromAccuracy(101, 10)).toThrow(RangeError);
    expect(() => estimateRatingFromAccuracy(101, 10)).toThrow(
      "Accuracy must be between 0 and 100.",
    );
  });

  it("throws RangeError for negative move count -1", () => {
    expect(() => estimateRatingFromAccuracy(50, -1)).toThrow(RangeError);
    expect(() => estimateRatingFromAccuracy(50, -1)).toThrow(
      "Move count must be a finite non-negative number.",
    );
  });
});
