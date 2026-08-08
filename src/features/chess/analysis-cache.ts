import type { EngineScore } from "./engine";
import type { QuickPassCompletedJob } from "./quick-pass-runner";

export type CachedLine = {
  readonly rank: number;
  readonly moves: readonly string[];
  readonly score: EngineScore | null;
};

export type CachedAnalysis = {
  readonly fen: string;
  readonly score: EngineScore | null;
  readonly depth: number | null;
  readonly lines: readonly CachedLine[];
};

export type AnalysisCache = ReadonlyMap<string, CachedAnalysis>;

export function buildAnalysisCache(
  results: readonly QuickPassCompletedJob[]
): AnalysisCache {
  const entries = new Map<string, CachedAnalysis>();

  for (const result of results) {
    const fen = result.job.fen;
    const info = result.info;
    const score = info?.score ?? null;
    const depth = info?.depth ?? null;
    const lines = result.candidateLines
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .map((line) => ({
        rank: line.rank,
        moves: line.info.pv ?? [],
        score: line.info.score ?? null,
      }));

    const candidate: CachedAnalysis = { fen, score, depth, lines };
    const existing = entries.get(fen);

    // Prefer deeper analysis when caching duplicate positions.
    if (!existing) {
      entries.set(fen, candidate);
    } else if (depth !== null && existing.depth === null) {
      entries.set(fen, candidate);
    } else if (depth !== null && existing.depth !== null) {
      if (depth > existing.depth) {
        entries.set(fen, candidate);
      }
    } else if (depth === null && existing.depth === null) {
      entries.set(fen, candidate);
    }
  }

  return entries;
}

export function lookupAnalysis(
  cache: AnalysisCache,
  fen: string
): CachedAnalysis | null {
  return cache.get(fen) ?? null;
}

export function bestMoveArrowSource(
  entry: CachedAnalysis
): readonly CachedLine[] {
  return entry.lines
    .filter((line) => line.moves.length > 0)
    .slice(0, 3);
}
