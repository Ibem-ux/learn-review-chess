import { describe, expect, it } from "vitest";
import type { EngineInfo, EngineScore } from "@/features/chess/engine";
import type { QuickPassCompletedJob, QuickPassCandidateLine } from "@/features/chess/quick-pass-runner";
import type { QuickPassJob } from "@/features/chess/quick-pass-planner";
import {
  bestMoveArrowSource,
  buildAnalysisCache,
  lookupAnalysis,
} from "@/features/chess/analysis-cache";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

function cpScore(value: number): EngineScore {
  return { type: "cp", value, perspective: "white" };
}

function engineInfo(overrides: Partial<EngineInfo> = {}): EngineInfo {
  return {
    depth: 10,
    seldepth: 12,
    multipv: 1,
    score: cpScore(100),
    nodes: 1000,
    nps: 100000,
    timeMs: 100,
    hashfull: 50,
    pv: ["e2e4", "e7e5"],
    ...overrides,
  };
}

function candidateLine(
  rank: number,
  overrides: Partial<EngineInfo> = {}
): QuickPassCandidateLine {
  return { rank, info: engineInfo(overrides) };
}

function quickPassJob(fen: string, ply: number): QuickPassJob {
  return {
    id: `qp-${ply}`,
    phase: "quick-pass",
    ply,
    fen,
    limit: { kind: "depth", value: 10 },
  };
}

function completedJob(
  job: QuickPassJob,
  overrides: {
    info?: EngineInfo | null;
    bestMove?: { move: string | null; ponder: string | null } | null;
    candidateLines?: readonly QuickPassCandidateLine[];
  } = {}
): QuickPassCompletedJob {
  return {
    job,
    info: overrides.info ?? engineInfo(),
    bestMove: overrides.bestMove ?? { move: "e2e4", ponder: null },
    candidateLines: overrides.candidateLines ?? [candidateLine(1)],
  };
}

describe("buildAnalysisCache", () => {
  it("returns an empty cache for empty input", () => {
    const cache = buildAnalysisCache([]);
    expect(cache.size).toBe(0);
  });

  it("stores a single result keyed by its job fen", () => {
    const job = quickPassJob(START_FEN, 0);
    const results = [completedJob(job)];
    const cache = buildAnalysisCache(results);
    expect(cache.size).toBe(1);
    expect(cache.has(START_FEN)).toBe(true);
  });

  it("extracts score from the entry info", () => {
    const job = quickPassJob(START_FEN, 0);
    const results = [
      completedJob(job, {
        info: engineInfo({ score: cpScore(150) }),
      }),
    ];
    const cache = buildAnalysisCache(results);
    const entry = cache.get(START_FEN);
    expect(entry?.score).toEqual(cpScore(150));
  });

  it("extracts depth from the entry info", () => {
    const job = quickPassJob(START_FEN, 0);
    const results = [
      completedJob(job, {
        info: engineInfo({ depth: 20 }),
      }),
    ];
    const cache = buildAnalysisCache(results);
    const entry = cache.get(START_FEN);
    expect(entry?.depth).toBe(20);
  });

  it("sorts lines by rank ascending when supplied out of order", () => {
    const job = quickPassJob(START_FEN, 0);
    const results = [
      completedJob(job, {
        candidateLines: [
          candidateLine(3, { multipv: 3, score: cpScore(50) }),
          candidateLine(1, { multipv: 1, score: cpScore(100) }),
          candidateLine(2, { multipv: 2, score: cpScore(75) }),
        ],
      }),
    ];
    const cache = buildAnalysisCache(results);
    const entry = cache.get(START_FEN);
    expect(entry?.lines.map((l) => l.rank)).toEqual([1, 2, 3]);
  });

  it("produces empty moves when pv is absent", () => {
    const job = quickPassJob(START_FEN, 0);
    const results = [
      completedJob(job, {
        info: engineInfo({ pv: undefined }),
        candidateLines: [candidateLine(1, { pv: undefined })],
      }),
    ];
    const cache = buildAnalysisCache(results);
    const entry = cache.get(START_FEN);
    expect(entry?.lines[0].moves).toEqual([]);
  });

  it("produces null score when info score is absent", () => {
    const job = quickPassJob(START_FEN, 0);
    const results = [
      completedJob(job, {
        info: engineInfo({ score: undefined }),
      }),
    ];
    const cache = buildAnalysisCache(results);
    const entry = cache.get(START_FEN);
    expect(entry?.score).toBeNull();
  });

  it("keeps the last entry when two results share the same fen", () => {
    const job1 = quickPassJob(START_FEN, 0);
    const job2 = quickPassJob(START_FEN, 0);
    const results = [
      completedJob(job1, {
        info: engineInfo({ score: cpScore(100), depth: 10 }),
      }),
      completedJob(job2, {
        info: engineInfo({ score: cpScore(200), depth: 20 }),
      }),
    ];
    const cache = buildAnalysisCache(results);
    const entry = cache.get(START_FEN);
    expect(entry?.score).toEqual(cpScore(200));
    expect(entry?.depth).toBe(20);
  });
});

describe("lookupAnalysis", () => {
  it("returns the entry on hit", () => {
    const job = quickPassJob(START_FEN, 0);
    const cache = buildAnalysisCache([completedJob(job)]);
    const entry = lookupAnalysis(cache, START_FEN);
    expect(entry).not.toBeNull();
    expect(entry?.fen).toBe(START_FEN);
  });

  it("returns null on miss", () => {
    const cache = buildAnalysisCache([]);
    const entry = lookupAnalysis(cache, AFTER_E4_FEN);
    expect(entry).toBeNull();
  });

  it("returns null for a near-miss fen differing only in move counters", () => {
    const nearMiss = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 1 1";
    const job = quickPassJob(START_FEN, 0);
    const cache = buildAnalysisCache([completedJob(job)]);
    const entry = lookupAnalysis(cache, nearMiss);
    expect(entry).toBeNull();
  });
});

describe("bestMoveArrowSource", () => {
  it("caps the result at three lines", () => {
    const job = quickPassJob(START_FEN, 0);
    const results = [
      completedJob(job, {
        candidateLines: [
          candidateLine(1, { pv: ["e2e4"] }),
          candidateLine(2, { pv: ["d2d4"] }),
          candidateLine(3, { pv: ["g1f3"] }),
          candidateLine(4, { pv: ["c2c4"] }),
        ],
      }),
    ];
    const cache = buildAnalysisCache(results);
    const entry = cache.get(START_FEN);
    if (entry == null) {
      throw new Error("expected cache entry");
    }
    const source = bestMoveArrowSource(entry);
    expect(source).toHaveLength(3);
    expect(source.map((l) => l.rank)).toEqual([1, 2, 3]);
  });

  it("skips lines whose moves array is empty", () => {
    const job = quickPassJob(START_FEN, 0);
    const results = [
      completedJob(job, {
        candidateLines: [
          candidateLine(1, { pv: [] }),
          candidateLine(2, { pv: ["d2d4"] }),
          candidateLine(3, { pv: [] }),
        ],
      }),
    ];
    const cache = buildAnalysisCache(results);
    const entry = cache.get(START_FEN);
    if (entry == null) {
      throw new Error("expected cache entry");
    }
    const source = bestMoveArrowSource(entry);
    expect(source).toHaveLength(1);
    expect(source[0].rank).toBe(2);
  });

  it("returns an empty array for an entry with no lines", () => {
    const job = quickPassJob(START_FEN, 0);
    const results = [
      completedJob(job, {
        candidateLines: [],
      }),
    ];
    const cache = buildAnalysisCache(results);
    const entry = cache.get(START_FEN);
    if (entry == null) {
      throw new Error("expected cache entry");
    }
    const source = bestMoveArrowSource(entry);
    expect(source).toEqual([]);
  });
});
