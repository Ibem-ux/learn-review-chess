import { describe, expect, it } from "vitest";
import type { EngineScore } from "@/features/chess/engine";
import type { CachedAnalysis, CachedLine } from "@/features/chess/analysis-cache";
import { ARROW_COLORS, buildEngineArrows, parseUciSquares } from "@/features/chess/engine-arrows";

function cpScore(value: number): EngineScore {
  return { type: "cp", value, perspective: "white" };
}

function cachedLine(
  rank: number,
  moves: readonly string[],
  score: EngineScore | null = cpScore(100)
): CachedLine {
  return { rank, moves, score };
}

function cachedAnalysis(
  fen: string,
  lines: readonly CachedLine[],
  score: EngineScore | null = cpScore(100),
  depth: number | null = 10
): CachedAnalysis {
  return { fen, score, depth, lines };
}

describe("parseUciSquares", () => {
  it("parses a valid 4-character uci move", () => {
    expect(parseUciSquares("e2e4")).toEqual({ from: "e2", to: "e4" });
  });

  it("parses a valid 5-character promotion move ignoring the promotion piece", () => {
    expect(parseUciSquares("e7e8q")).toEqual({ from: "e7", to: "e8" });
  });

  it("returns null for an empty string", () => {
    expect(parseUciSquares("")).toBeNull();
  });

  it("returns null for a 3-character string", () => {
    expect(parseUciSquares("e2e")).toBeNull();
  });

  it("returns null for a 6-character string", () => {
    expect(parseUciSquares("e2e4xx")).toBeNull();
  });

  it("returns null for an invalid file character", () => {
    expect(parseUciSquares("z2z4")).toBeNull();
  });

  it("returns null for an invalid rank character", () => {
    expect(parseUciSquares("e0e9")).toBeNull();
  });
});

describe("buildEngineArrows", () => {
  it("returns an empty array for a null entry", () => {
    expect(buildEngineArrows(null)).toEqual([]);
  });

  it("returns an empty array for an entry with no lines", () => {
    const entry = cachedAnalysis("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", []);
    expect(buildEngineArrows(entry)).toEqual([]);
  });

  it("produces one green arrow for a single line", () => {
    const entry = cachedAnalysis("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", [
      cachedLine(1, ["e2e4"]),
    ]);
    const arrows = buildEngineArrows(entry);
    expect(arrows).toHaveLength(1);
    expect(arrows[0]).toEqual({
      startSquare: "e2",
      endSquare: "e4",
      color: ARROW_COLORS.first,
    });
  });

  it("produces three arrows in the declared colour order for three lines", () => {
    const entry = cachedAnalysis("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", [
      cachedLine(1, ["e2e4"]),
      cachedLine(2, ["d2d4"]),
      cachedLine(3, ["g1f3"]),
    ]);
    const arrows = buildEngineArrows(entry);
    expect(arrows).toHaveLength(3);
    expect(arrows[0].color).toBe(ARROW_COLORS.first);
    expect(arrows[1].color).toBe(ARROW_COLORS.second);
    expect(arrows[2].color).toBe(ARROW_COLORS.third);
  });

  it("caps the result at three lines when four are present", () => {
    const entry = cachedAnalysis("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", [
      cachedLine(1, ["e2e4"]),
      cachedLine(2, ["d2d4"]),
      cachedLine(3, ["g1f3"]),
      cachedLine(4, ["c2c4"]),
    ]);
    expect(buildEngineArrows(entry)).toHaveLength(3);
  });

  it("skips a line whose moves array is empty", () => {
    const entry = cachedAnalysis("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", [
      cachedLine(1, []),
      cachedLine(2, ["d2d4"]),
    ]);
    const arrows = buildEngineArrows(entry);
    expect(arrows).toHaveLength(1);
    expect(arrows[0].color).toBe(ARROW_COLORS.first);
  });

  it("skips a line whose first move is unparseable and assigns green to the next valid line", () => {
    const entry = cachedAnalysis("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", [
      cachedLine(1, ["invalid"]),
      cachedLine(2, ["d2d4"]),
    ]);
    const arrows = buildEngineArrows(entry);
    expect(arrows).toHaveLength(1);
    expect(arrows[0]).toEqual({
      startSquare: "d2",
      endSquare: "d4",
      color: ARROW_COLORS.first,
    });
  });

  it("uses only the first move of a multi-move pv", () => {
    const entry = cachedAnalysis("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", [
      cachedLine(1, ["e2e4", "e7e5", "g1f3"]),
    ]);
    const arrows = buildEngineArrows(entry);
    expect(arrows).toHaveLength(1);
    expect(arrows[0]).toEqual({
      startSquare: "e2",
      endSquare: "e4",
      color: ARROW_COLORS.first,
    });
  });

  it("preserves rank order when lines are supplied out of order", () => {
    const entry = cachedAnalysis("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", [
      cachedLine(3, ["g1f3"]),
      cachedLine(1, ["e2e4"]),
      cachedLine(2, ["d2d4"]),
    ]);
    const arrows = buildEngineArrows(entry);
    expect(arrows).toHaveLength(3);
    expect(arrows[0].startSquare).toBe("e2");
    expect(arrows[0].color).toBe(ARROW_COLORS.first);
    expect(arrows[1].startSquare).toBe("d2");
    expect(arrows[1].color).toBe(ARROW_COLORS.second);
    expect(arrows[2].startSquare).toBe("g1");
    expect(arrows[2].color).toBe(ARROW_COLORS.third);
  });
});
