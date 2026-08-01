import type { CachedAnalysis } from "./analysis-cache";

export type EngineArrow = {
  readonly startSquare: string;
  readonly endSquare: string;
  readonly color: string;
};

export const ARROW_COLORS = Object.freeze({
  first: "#22c55e",
  second: "#3b82f6",
  third: "#a855f7",
});

export function parseUciSquares(uci: string): { from: string; to: string } | null {
  if (uci.length < 4 || uci.length > 5) {
    return null;
  }

  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);

  const fileRegex = /^[a-h]$/;
  const rankRegex = /^[1-8]$/;

  if (!fileRegex.test(from[0]) || !rankRegex.test(from[1])) {
    return null;
  }
  if (!fileRegex.test(to[0]) || !rankRegex.test(to[1])) {
    return null;
  }

  return { from, to };
}

export function buildEngineArrows(
  entry: CachedAnalysis | null
): readonly EngineArrow[] {
  if (entry === null) {
    return [];
  }

  const colors = [ARROW_COLORS.first, ARROW_COLORS.second, ARROW_COLORS.third];
  const arrows: EngineArrow[] = [];

  const sortedLines = entry.lines.slice().sort((a, b) => a.rank - b.rank);

  for (const line of sortedLines) {
    if (line.moves.length === 0) {
      continue;
    }

    const parsed = parseUciSquares(line.moves[0]);
    if (parsed === null) {
      continue;
    }

    if (arrows.length >= 3) {
      break;
    }

    arrows.push({
      startSquare: parsed.from,
      endSquare: parsed.to,
      color: colors[arrows.length],
    });
  }

  return arrows;
}
