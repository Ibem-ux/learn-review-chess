import { describe, expect, it } from "vitest";
import type { EngineScore, EngineInfo, ScoreBound } from "@/features/chess/engine";
import type { ReviewTimeline } from "@/features/chess/timeline";
import type { QuickPassCompletedJob } from "@/features/chess/quick-pass-runner";
import type { QuickPassJob } from "@/features/chess/quick-pass-planner";
import {
  buildQuickPassEvaluationSeries,
  normalizeScore,
  parseSideToMove,
  validateResultPly,
  getTimelineStepSafe,
} from "@/features/chess/quick-pass-evaluation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const AFTER_E5 = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
const AFTER_NF3 = "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2";

type TimelinePly = { readonly ply: number; readonly fen: string; readonly move: null };

function makeTimeline(steps: TimelinePly[]): ReviewTimeline {
  return {
    steps,
    totalPlies: steps.length - 1,
    initialFen: steps[0].fen,
    finalFen: steps[steps.length - 1].fen,
    analysisEligible: true,
  };
}

function makeJob(ply: number, fen: string): QuickPassJob {
  return {
    id: `quick-pass-${ply}`,
    phase: "quick-pass",
    ply,
    fen,
    limit: { kind: "depth", value: 14 },
  };
}

function makeResult(
  job: QuickPassJob,
  info: EngineInfo | null,
): QuickPassCompletedJob {
  return {
    job,
    info,
    bestMove: info ? { move: "e2e4", ponder: null } : null,
    candidateLines: info ? [{ rank: 1, info }] : [],
  };
}

function twoStepTimeline(): ReviewTimeline {
  return makeTimeline([
    { ply: 0, fen: INITIAL_FEN, move: null },
    { ply: 1, fen: AFTER_E4, move: null },
  ]);
}

function threeStepTimeline(): ReviewTimeline {
  return makeTimeline([
    { ply: 0, fen: INITIAL_FEN, move: null },
    { ply: 1, fen: AFTER_E4, move: null },
    { ply: 2, fen: AFTER_E5, move: null },
  ]);
}

// ---------------------------------------------------------------------------
// parseSideToMove
// ---------------------------------------------------------------------------

describe("parseSideToMove", () => {
  it("parses 'w' from a standard initial FEN", () => {
    expect(parseSideToMove(INITIAL_FEN)).toBe("w");
  });

  it("parses 'b' from a FEN after White's move", () => {
    expect(parseSideToMove(AFTER_E4)).toBe("b");
  });

  it("returns null for an empty string", () => {
    expect(parseSideToMove("")).toBeNull();
  });

  it("returns null for a FEN with missing active-color field", () => {
    expect(parseSideToMove("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR")).toBeNull();
  });

  it("returns null for a FEN with unsupported active-color token", () => {
    expect(parseSideToMove("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1")).toBeNull();
  });

  it("returns null for invalid board layout with active token 'w'", () => {
    expect(parseSideToMove("not-a-valid-board w KQkq - 0 1")).toBeNull();
  });

  it("returns null for invalid board layout with active token 'b'", () => {
    expect(parseSideToMove("not-a-valid-board b KQkq - 0 1")).toBeNull();
  });

  it("returns null for FEN with wrong rank count", () => {
    expect(parseSideToMove("rnbqkbnr/pppppppp/8/8/4P3/PPPP1PPP/RNBQKBNR w KQkq - 0 1")).toBeNull();
  });

  it("returns null for FEN with invalid piece placement", () => {
    expect(parseSideToMove("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPPP/RNBQKBNR w KQkq - 0 1")).toBeNull();
  });

  it("parses 'w' from a valid non-starting FEN", () => {
    expect(parseSideToMove(AFTER_E5)).toBe("w");
  });

  it("parses 'b' from a valid non-starting FEN", () => {
    expect(parseSideToMove(AFTER_NF3)).toBe("b");
  });
});

// ---------------------------------------------------------------------------
// validateResultPly
// ---------------------------------------------------------------------------

describe("validateResultPly", () => {
  it("accepts zero", () => {
    expect(validateResultPly(0)).toBeNull();
  });

  it("accepts positive integers", () => {
    expect(validateResultPly(1)).toBeNull();
    expect(validateResultPly(99)).toBeNull();
  });

  it("rejects NaN", () => {
    expect(validateResultPly(NaN)).toContain("finite integer");
  });

  it("rejects positive Infinity", () => {
    expect(validateResultPly(Infinity)).toContain("finite integer");
  });

  it("rejects negative Infinity", () => {
    expect(validateResultPly(-Infinity)).toContain("finite integer");
  });

  it("rejects fractional ply", () => {
    expect(validateResultPly(1.5)).toContain("integer");
    expect(validateResultPly(0.1)).toContain("integer");
  });

  it("rejects negative integers", () => {
    expect(validateResultPly(-1)).toContain("negative");
  });
});

// ---------------------------------------------------------------------------
// getTimelineStepSafe
// ---------------------------------------------------------------------------

describe("getTimelineStepSafe", () => {
  it("returns the requested in-range step", () => {
    const timeline = threeStepTimeline();
    const step = getTimelineStepSafe(timeline, 1);
    expect(step).not.toBeNull();
    if (step) {
      expect(step.ply).toBe(1);
    }
  });

  it("returns null for negative ply", () => {
    const timeline = threeStepTimeline();
    expect(getTimelineStepSafe(timeline, -1)).toBeNull();
  });

  it("returns null for out-of-range ply", () => {
    const timeline = threeStepTimeline();
    expect(getTimelineStepSafe(timeline, 99)).toBeNull();
  });

  it("returns null when step ply does not match requested ply", () => {
    const badTimeline: ReviewTimeline = {
      ...threeStepTimeline(),
      steps: [
        { ply: 0, fen: INITIAL_FEN, move: null },
        { ply: 2, fen: AFTER_E4, move: null },
      ],
      totalPlies: 1,
    };
    expect(getTimelineStepSafe(badTimeline, 0)).not.toBeNull();
    if (getTimelineStepSafe(badTimeline, 0)) {
      expect(getTimelineStepSafe(badTimeline, 0)!.ply).toBe(0);
    }
    expect(getTimelineStepSafe(badTimeline, 1)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// normalizeScore
// ---------------------------------------------------------------------------

describe("normalizeScore", () => {
  it("returns null for undefined input", () => {
    expect(normalizeScore(undefined, "w")).toBeNull();
  });

  it("preserves positive cp score for White to move", () => {
    const score: EngineScore = { type: "cp", value: 50, perspective: "side-to-move" };
    const result = normalizeScore(score, "w");
    expect(result).toEqual({ type: "cp", value: 50, perspective: "white" });
  });

  it("negates positive cp score for Black to move", () => {
    const score: EngineScore = { type: "cp", value: 50, perspective: "side-to-move" };
    const result = normalizeScore(score, "b");
    expect(result).toEqual({ type: "cp", value: -50, perspective: "white" });
  });

  it("preserves negative cp score for White to move", () => {
    const score: EngineScore = { type: "cp", value: -30, perspective: "side-to-move" };
    const result = normalizeScore(score, "w");
    expect(result).toEqual({ type: "cp", value: -30, perspective: "white" });
  });

  it("negates negative cp score for Black to move", () => {
    const score: EngineScore = { type: "cp", value: -30, perspective: "side-to-move" };
    const result = normalizeScore(score, "b");
    expect(result).toEqual({ type: "cp", value: 30, perspective: "white" });
  });

  it("preserves zero cp for White to move", () => {
    const score: EngineScore = { type: "cp", value: 0, perspective: "side-to-move" };
    const result = normalizeScore(score, "w");
    expect(result).toEqual({ type: "cp", value: 0, perspective: "white" });
  });

  it("preserves zero cp for Black to move (negation of zero is zero)", () => {
    const score: EngineScore = { type: "cp", value: 0, perspective: "side-to-move" };
    const result = normalizeScore(score, "b");
    expect(result).toEqual({ type: "cp", value: -0, perspective: "white" });
  });

  it("preserves positive mate score for White to move", () => {
    const score: EngineScore = { type: "mate", value: 3, perspective: "side-to-move" };
    const result = normalizeScore(score, "w");
    expect(result).toEqual({ type: "mate", value: 3, perspective: "white" });
  });

  it("negates positive mate score for Black to move", () => {
    const score: EngineScore = { type: "mate", value: 3, perspective: "side-to-move" };
    const result = normalizeScore(score, "b");
    expect(result).toEqual({ type: "mate", value: -3, perspective: "white" });
  });

  it("preserves negative mate score for White to move", () => {
    const score: EngineScore = { type: "mate", value: -2, perspective: "side-to-move" };
    const result = normalizeScore(score, "w");
    expect(result).toEqual({ type: "mate", value: -2, perspective: "white" });
  });

  it("negates negative mate score for Black to move", () => {
    const score: EngineScore = { type: "mate", value: -2, perspective: "side-to-move" };
    const result = normalizeScore(score, "b");
    expect(result).toEqual({ type: "mate", value: 2, perspective: "white" });
  });

  it("preserves mate zero for White to move", () => {
    const score: EngineScore = { type: "mate", value: 0, perspective: "side-to-move" };
    const result = normalizeScore(score, "w");
    expect(result).toEqual({ type: "mate", value: 0, perspective: "white" });
  });

  it("does not mutate the source EngineScore", () => {
    const score: EngineScore = { type: "cp", value: 50, perspective: "side-to-move" };
    normalizeScore(score, "b");
    expect(score).toEqual({ type: "cp", value: 50, perspective: "side-to-move" });
  });

  it("preserves already White-perspective cp score regardless of side to move", () => {
    const score: EngineScore = { type: "cp", value: 40, perspective: "white", bound: "upperbound" as ScoreBound };
    expect(normalizeScore(score, "b")).toEqual({
      type: "cp", value: 40, perspective: "white", bound: "upperbound",
    });
  });

  it("preserves already White-perspective mate score regardless of side to move", () => {
    const score: EngineScore = { type: "mate", value: -3, perspective: "white", bound: "lowerbound" as ScoreBound };
    expect(normalizeScore(score, "w")).toEqual({
      type: "mate", value: -3, perspective: "white", bound: "lowerbound",
    });
  });

  it("swaps lowerbound to upperbound when inverting side-to-move cp for Black", () => {
    const score: EngineScore = { type: "cp", value: 20, perspective: "side-to-move", bound: "lowerbound" as ScoreBound };
    const result = normalizeScore(score, "b");
    expect(result).toEqual({
      type: "cp", value: -20, perspective: "white", bound: "upperbound",
    });
  });

  it("swaps upperbound to lowerbound when inverting side-to-move cp for Black", () => {
    const score: EngineScore = { type: "cp", value: 20, perspective: "side-to-move", bound: "upperbound" as ScoreBound };
    const result = normalizeScore(score, "b");
    expect(result).toEqual({
      type: "cp", value: -20, perspective: "white", bound: "lowerbound",
    });
  });
});

// ---------------------------------------------------------------------------
// buildQuickPassEvaluationSeries
// ---------------------------------------------------------------------------

describe("buildQuickPassEvaluationSeries", () => {
  describe("timeline coverage", () => {
    it("returns one point for every timeline step including ply 0", () => {
      const timeline = threeStepTimeline();
      const series = buildQuickPassEvaluationSeries(timeline, []);
      expect(series.ok).toBe(true);
      if (!series.ok) return;
      expect(series.points).toHaveLength(3);
      expect(series.points[0].ply).toBe(0);
      expect(series.points[1].ply).toBe(1);
      expect(series.points[2].ply).toBe(2);
    });

    it("preserves the FEN for each point from the timeline", () => {
      const timeline = threeStepTimeline();
      const series = buildQuickPassEvaluationSeries(timeline, []);
      expect(series.ok).toBe(true);
      if (!series.ok) return;
      expect(series.points[0].fen).toBe(INITIAL_FEN);
      expect(series.points[1].fen).toBe(AFTER_E4);
      expect(series.points[2].fen).toBe(AFTER_E5);
    });

    it("parses sideToMove from the FEN active-color field", () => {
      const timeline = threeStepTimeline();
      const series = buildQuickPassEvaluationSeries(timeline, []);
      expect(series.ok).toBe(true);
      if (!series.ok) return;
      expect(series.points[0].sideToMove).toBe("w");
      expect(series.points[1].sideToMove).toBe("b");
      expect(series.points[2].sideToMove).toBe("w");
    });
  });

  describe("empty and partial results", () => {
    it("marks all points as incomplete when results are empty", () => {
      const timeline = twoStepTimeline();
      const series = buildQuickPassEvaluationSeries(timeline, []);
      expect(series.ok).toBe(true);
      if (!series.ok) return;
      for (const point of series.points) {
        expect(point.completed).toBe(false);
        expect(point.score).toBeNull();
        expect(point.depth).toBeNull();
        expect(point.nodes).toBeNull();
        expect(point.timeMs).toBeNull();
        expect(point.pv).toBeNull();
      }
    });

    it("marks only matched plies as completed for partial results", () => {
      const timeline = threeStepTimeline();
      const job1 = makeJob(1, AFTER_E4);
      const info1: EngineInfo = { depth: 14, score: { type: "cp", value: 30, perspective: "side-to-move" } };
      const result1 = makeResult(job1, info1);

      const series = buildQuickPassEvaluationSeries(timeline, [result1]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;

      expect(series.points[0].completed).toBe(false);
      expect(series.points[0].score).toBeNull();

      expect(series.points[1].completed).toBe(true);
      expect(series.points[1].score).not.toBeNull();

      expect(series.points[2].completed).toBe(false);
      expect(series.points[2].score).toBeNull();
    });

    it("handles completed result without a score", () => {
      const timeline = twoStepTimeline();
      const job0 = makeJob(0, INITIAL_FEN);
      const infoNoScore: EngineInfo = { depth: 14 };
      const result0 = makeResult(job0, infoNoScore);

      const series = buildQuickPassEvaluationSeries(timeline, [result0]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;

      expect(series.points[0].completed).toBe(true);
      expect(series.points[0].score).toBeNull();
      expect(series.points[0].depth).toBe(14);
    });

    it("handles completed result with null info", () => {
      const timeline = twoStepTimeline();
      const job0 = makeJob(0, INITIAL_FEN);
      const result0 = makeResult(job0, null);

      const series = buildQuickPassEvaluationSeries(timeline, [result0]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;

      expect(series.points[0].completed).toBe(true);
      expect(series.points[0].score).toBeNull();
      expect(series.points[0].depth).toBeNull();
      expect(series.points[0].nodes).toBeNull();
      expect(series.points[0].timeMs).toBeNull();
      expect(series.points[0].pv).toBeNull();
    });
  });

  describe("score normalization in context", () => {
    it("normalizes positive cp score at White-to-move position", () => {
      const timeline = twoStepTimeline();
      const job0 = makeJob(0, INITIAL_FEN);
      const info: EngineInfo = {
        depth: 14,
        score: { type: "cp", value: 30, perspective: "side-to-move" },
      };
      const series = buildQuickPassEvaluationSeries(timeline, [makeResult(job0, info)]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;

      expect(series.points[0].score).toEqual({
        type: "cp", value: 30, perspective: "white",
      });
    });

    it("negates positive cp score at Black-to-move position", () => {
      const timeline = twoStepTimeline();
      const job1 = makeJob(1, AFTER_E4);
      const info: EngineInfo = {
        depth: 14,
        score: { type: "cp", value: 30, perspective: "side-to-move" },
      };
      const series = buildQuickPassEvaluationSeries(timeline, [makeResult(job1, info)]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;

      expect(series.points[1].score).toEqual({
        type: "cp", value: -30, perspective: "white",
      });
    });

    it("preserves negative cp score at White-to-move position", () => {
      const timeline = threeStepTimeline();
      const job2 = makeJob(2, AFTER_E5);
      const info: EngineInfo = {
        depth: 14,
        score: { type: "cp", value: -15, perspective: "side-to-move" },
      };
      const series = buildQuickPassEvaluationSeries(timeline, [makeResult(job2, info)]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;

      expect(series.points[2].score).toEqual({
        type: "cp", value: -15, perspective: "white",
      });
    });

    it("negates negative cp score at Black-to-move position", () => {
      const timeline = twoStepTimeline();
      const job1 = makeJob(1, AFTER_E4);
      const info: EngineInfo = {
        depth: 14,
        score: { type: "cp", value: -20, perspective: "side-to-move" },
      };
      const series = buildQuickPassEvaluationSeries(timeline, [makeResult(job1, info)]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;

      expect(series.points[1].score).toEqual({
        type: "cp", value: 20, perspective: "white",
      });
    });

    it("preserves zero cp at White-to-move position", () => {
      const timeline = twoStepTimeline();
      const job0 = makeJob(0, INITIAL_FEN);
      const info: EngineInfo = {
        depth: 14,
        score: { type: "cp", value: 0, perspective: "side-to-move" },
      };
      const series = buildQuickPassEvaluationSeries(timeline, [makeResult(job0, info)]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;

      expect(series.points[0].score).toEqual({
        type: "cp", value: 0, perspective: "white",
      });
    });

    it("normalizes zero cp at Black-to-move position", () => {
      const timeline = twoStepTimeline();
      const job1 = makeJob(1, AFTER_E4);
      const info: EngineInfo = {
        depth: 14,
        score: { type: "cp", value: 0, perspective: "side-to-move" },
      };
      const series = buildQuickPassEvaluationSeries(timeline, [makeResult(job1, info)]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;

      expect(series.points[1].score).toEqual({
        type: "cp", value: -0, perspective: "white",
      });
    });

    it("preserves positive mate score at White-to-move position", () => {
      const timeline = twoStepTimeline();
      const job0 = makeJob(0, INITIAL_FEN);
      const info: EngineInfo = {
        depth: 14,
        score: { type: "mate", value: 5, perspective: "side-to-move" },
      };
      const series = buildQuickPassEvaluationSeries(timeline, [makeResult(job0, info)]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;

      expect(series.points[0].score).toEqual({
        type: "mate", value: 5, perspective: "white",
      });
    });

    it("negates positive mate score at Black-to-move position", () => {
      const timeline = twoStepTimeline();
      const job1 = makeJob(1, AFTER_E4);
      const info: EngineInfo = {
        depth: 14,
        score: { type: "mate", value: 5, perspective: "side-to-move" },
      };
      const series = buildQuickPassEvaluationSeries(timeline, [makeResult(job1, info)]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;

      expect(series.points[1].score).toEqual({
        type: "mate", value: -5, perspective: "white",
      });
    });

    it("preserves negative mate score at White-to-move position", () => {
      const timeline = threeStepTimeline();
      const job2 = makeJob(2, AFTER_E5);
      const info: EngineInfo = {
        depth: 14,
        score: { type: "mate", value: -3, perspective: "side-to-move" },
      };
      const series = buildQuickPassEvaluationSeries(timeline, [makeResult(job2, info)]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;

      expect(series.points[2].score).toEqual({
        type: "mate", value: -3, perspective: "white",
      });
    });

    it("negates negative mate score at Black-to-move position", () => {
      const timeline = twoStepTimeline();
      const job1 = makeJob(1, AFTER_E4);
      const info: EngineInfo = {
        depth: 14,
        score: { type: "mate", value: -2, perspective: "side-to-move" },
      };
      const series = buildQuickPassEvaluationSeries(timeline, [makeResult(job1, info)]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;

      expect(series.points[1].score).toEqual({
        type: "mate", value: 2, perspective: "white",
      });
    });

    it("does not mutate the source EngineScore on the result info", () => {
      const timeline = twoStepTimeline();
      const job1 = makeJob(1, AFTER_E4);
      const originalScore: EngineScore = { type: "cp", value: 40, perspective: "side-to-move" };
      const info: EngineInfo = { depth: 14, score: originalScore };
      const result = makeResult(job1, info);

      buildQuickPassEvaluationSeries(timeline, [result]);

      expect(result.info!.score).toEqual({
        type: "cp", value: 40, perspective: "side-to-move",
      });
    });

    it("preserves already White-perspective cp score regardless of side to move", () => {
      const timeline = twoStepTimeline();
      const job0 = makeJob(0, INITIAL_FEN);
      const info: EngineInfo = {
        depth: 14,
        score: { type: "cp", value: 40, perspective: "white" },
      };
      const series = buildQuickPassEvaluationSeries(timeline, [makeResult(job0, info)]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;

      expect(series.points[0].score).toEqual({
        type: "cp", value: 40, perspective: "white",
      });
    });

    it("preserves already White-perspective mate score regardless of side to move", () => {
      const timeline = twoStepTimeline();
      const job1 = makeJob(1, AFTER_E4);
      const info: EngineInfo = {
        depth: 14,
        score: { type: "mate", value: -3, perspective: "white" },
      };
      const series = buildQuickPassEvaluationSeries(timeline, [makeResult(job1, info)]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;

      expect(series.points[1].score).toEqual({
        type: "mate", value: -3, perspective: "white",
      });
    });
  });

  describe("metadata preservation", () => {
    it("preserves depth, nodes, timeMs, and pv from rank-1 info", () => {
      const timeline = twoStepTimeline();
      const job0 = makeJob(0, INITIAL_FEN);
      const info: EngineInfo = {
        depth: 14,
        nodes: 123456,
        timeMs: 500,
        pv: ["e2e4", "e7e5"],
        score: { type: "cp", value: 30, perspective: "side-to-move" },
      };
      const series = buildQuickPassEvaluationSeries(timeline, [makeResult(job0, info)]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;

      const point = series.points[0];
      expect(point.depth).toBe(14);
      expect(point.nodes).toBe(123456);
      expect(point.timeMs).toBe(500);
      expect(point.pv).toEqual(["e2e4", "e7e5"]);
    });

    it("returns null for missing metadata fields", () => {
      const timeline = twoStepTimeline();
      const job0 = makeJob(0, INITIAL_FEN);
      const info: EngineInfo = { depth: 14 };
      const series = buildQuickPassEvaluationSeries(timeline, [makeResult(job0, info)]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;

      const point = series.points[0];
      expect(point.depth).toBe(14);
      expect(point.nodes).toBeNull();
      expect(point.timeMs).toBeNull();
      expect(point.pv).toBeNull();
    });
  });

  describe("alignment by ply", () => {
    it("aligns unordered results by ply, not input-array position", () => {
      const timeline = threeStepTimeline();
      const job0 = makeJob(0, INITIAL_FEN);
      const job2 = makeJob(2, AFTER_E5);
      const job1 = makeJob(1, AFTER_E4);

      const info0: EngineInfo = { depth: 14, score: { type: "cp", value: 10, perspective: "side-to-move" } };
      const info1: EngineInfo = { depth: 14, score: { type: "cp", value: 20, perspective: "side-to-move" } };
      const info2: EngineInfo = { depth: 14, score: { type: "cp", value: 30, perspective: "side-to-move" } };

      // Provide results out of order: ply 2, ply 0, ply 1.
      const series = buildQuickPassEvaluationSeries(timeline, [
        makeResult(job2, info2),
        makeResult(job0, info0),
        makeResult(job1, info1),
      ]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;

      // Points are in timeline order.
      expect(series.points[0].ply).toBe(0);
      expect(series.points[0].score!.value).toBe(10);
      expect(series.points[1].ply).toBe(1);
      expect(series.points[1].score!.value).toBe(-20);
      expect(series.points[2].ply).toBe(2);
      expect(series.points[2].score!.value).toBe(30);
    });

    it("preserves deterministic timeline ordering", () => {
      const timeline = threeStepTimeline();
      const series = buildQuickPassEvaluationSeries(timeline, []);
      expect(series.ok).toBe(true);
      if (!series.ok) return;

      for (let i = 0; i < series.points.length; i++) {
        expect(series.points[i].ply).toBe(i);
      }
    });
  });

  describe("rank 1 only", () => {
    it("does not substitute rank 2 or rank 3 when rank 1 info is missing", () => {
      const timeline = twoStepTimeline();
      const job0 = makeJob(0, INITIAL_FEN);

      const result: QuickPassCompletedJob = {
        job: job0,
        info: null,
        bestMove: { move: "e2e4", ponder: null },
        candidateLines: [
          { rank: 2, info: { depth: 14, score: { type: "cp", value: 18, perspective: "side-to-move" } } },
          { rank: 3, info: { depth: 14, score: { type: "cp", value: 10, perspective: "side-to-move" } } },
        ],
      };

      const series = buildQuickPassEvaluationSeries(timeline, [result]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;

      expect(series.points[0].completed).toBe(true);
      expect(series.points[0].score).toBeNull();
      expect(series.points[0].depth).toBeNull();
    });
  });

  describe("validation failures", () => {
    it("rejects NaN result ply", () => {
      const timeline = twoStepTimeline();
      const badJob: QuickPassJob = {
        id: "qp-nan",
        phase: "quick-pass",
        ply: NaN as unknown as number,
        fen: INITIAL_FEN,
        limit: { kind: "depth", value: 14 },
      };

      const series = buildQuickPassEvaluationSeries(timeline, [makeResult(badJob, { depth: 14 })]);
      expect(series.ok).toBe(false);
      if (series.ok) return;
      expect(series.reason).toContain("finite integer");
    });

    it("rejects positive infinity ply", () => {
      const timeline = twoStepTimeline();
      const badJob: QuickPassJob = {
        id: "qp-inf",
        phase: "quick-pass",
        ply: Infinity,
        fen: INITIAL_FEN,
        limit: { kind: "depth", value: 14 },
      };

      const series = buildQuickPassEvaluationSeries(timeline, [makeResult(badJob, { depth: 14 })]);
      expect(series.ok).toBe(false);
      if (series.ok) return;
      expect(series.reason).toContain("finite integer");
    });

    it("rejects negative infinity ply", () => {
      const timeline = twoStepTimeline();
      const badJob: QuickPassJob = {
        id: "qp-ninf",
        phase: "quick-pass",
        ply: -Infinity,
        fen: INITIAL_FEN,
        limit: { kind: "depth", value: 14 },
      };

      const series = buildQuickPassEvaluationSeries(timeline, [makeResult(badJob, { depth: 14 })]);
      expect(series.ok).toBe(false);
      if (series.ok) return;
      expect(series.reason).toContain("finite integer");
    });

    it("rejects fractional ply", () => {
      const timeline = twoStepTimeline();
      const badJob: QuickPassJob = {
        id: "qp-frac",
        phase: "quick-pass",
        ply: 1.5,
        fen: INITIAL_FEN,
        limit: { kind: "depth", value: 14 },
      };

      const series = buildQuickPassEvaluationSeries(timeline, [makeResult(badJob, { depth: 14 })]);
      expect(series.ok).toBe(false);
      if (series.ok) return;
      expect(series.reason).toContain("integer");
    });

    it("rejects duplicate result plies", () => {
      const timeline = twoStepTimeline();
      const job0a = makeJob(0, INITIAL_FEN);
      const job0b = makeJob(0, INITIAL_FEN);
      const info: EngineInfo = { depth: 14 };

      const series = buildQuickPassEvaluationSeries(timeline, [
        makeResult(job0a, info),
        makeResult(job0b, info),
      ]);
      expect(series.ok).toBe(false);
      if (series.ok) return;
      expect(series.reason).toContain("Duplicate");
      expect(series.reason).toContain("0");
    });

    it("rejects negative ply", () => {
      const timeline = twoStepTimeline();
      const badJob: QuickPassJob = {
        id: "quick-pass--1",
        phase: "quick-pass",
        ply: -1,
        fen: INITIAL_FEN,
        limit: { kind: "depth", value: 14 },
      };
      const info: EngineInfo = { depth: 14 };

      const series = buildQuickPassEvaluationSeries(timeline, [makeResult(badJob, info)]);
      expect(series.ok).toBe(false);
      if (series.ok) return;
      expect(series.reason).toContain("negative");
    });

    it("rejects out-of-range ply", () => {
      const timeline = twoStepTimeline();
      const badJob: QuickPassJob = {
        id: "quick-pass-99",
        phase: "quick-pass",
        ply: 99,
        fen: "some-fen w - - 0 1",
        limit: { kind: "depth", value: 14 },
      };
      const info: EngineInfo = { depth: 14 };

      const series = buildQuickPassEvaluationSeries(timeline, [makeResult(badJob, info)]);
      expect(series.ok).toBe(false);
      if (series.ok) return;
      expect(series.reason).toContain("out of range");
    });

    it("rejects exact FEN mismatch at matching ply", () => {
      const timeline = twoStepTimeline();
      const badJob: QuickPassJob = {
        id: "quick-pass-0",
        phase: "quick-pass",
        ply: 0,
        fen: "WRONG_FEN w KQkq - 0 1",
        limit: { kind: "depth", value: 14 },
      };
      const info: EngineInfo = { depth: 14 };

      const series = buildQuickPassEvaluationSeries(timeline, [makeResult(badJob, info)]);
      expect(series.ok).toBe(false);
      if (series.ok) return;
      expect(series.reason).toContain("FEN mismatch");
      expect(series.reason).toContain("0");
    });

    it("rejects malformed FEN in timeline (no active-color field)", () => {
      const badTimeline = makeTimeline([
        { ply: 0, fen: "malformed-fen-no-spaces", move: null },
      ]);

      const series = buildQuickPassEvaluationSeries(badTimeline, []);
      expect(series.ok).toBe(false);
      if (series.ok) return;
      expect(series.reason).toContain("Malformed FEN");
      expect(series.reason).toContain("0");
    });

    it("rejects invalid board layout with 'w' active color in timeline", () => {
      const badTimeline = makeTimeline([
        { ply: 0, fen: "not-a-valid-board w KQkq - 0 1", move: null },
      ]);

      const series = buildQuickPassEvaluationSeries(badTimeline, []);
      expect(series.ok).toBe(false);
      if (series.ok) return;
      expect(series.reason).toContain("Malformed FEN");
    });

    it("rejects invalid board layout with 'b' active color in timeline", () => {
      const badTimeline = makeTimeline([
        { ply: 0, fen: "not-a-valid-board b KQkq - 0 1", move: null },
      ]);

      const series = buildQuickPassEvaluationSeries(badTimeline, []);
      expect(series.ok).toBe(false);
      if (series.ok) return;
      expect(series.reason).toContain("Malformed FEN");
    });

    it("rejects malformed FEN in result when matching ply", () => {
      const timeline = twoStepTimeline();
      const badJob: QuickPassJob = {
        id: "qp-bad-fen",
        phase: "quick-pass",
        ply: 0,
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1",
        limit: { kind: "depth", value: 14 },
      };
      const info: EngineInfo = { depth: 14 };

      const series = buildQuickPassEvaluationSeries(timeline, [makeResult(badJob, info)]);
      expect(series.ok).toBe(false);
      if (series.ok) return;
      expect(series.reason).toContain("FEN mismatch");
    });
  });

  describe("does not throw for invalid input", () => {
    it("returns a failure result for duplicate plies instead of throwing", () => {
      const timeline = twoStepTimeline();
      const job0a = makeJob(0, INITIAL_FEN);
      const job0b = makeJob(0, INITIAL_FEN);
      const info: EngineInfo = { depth: 14 };

      expect(() =>
        buildQuickPassEvaluationSeries(timeline, [
          makeResult(job0a, info),
          makeResult(job0b, info),
        ])
      ).not.toThrow();
    });

    it("returns a failure result for negative ply instead of throwing", () => {
      const timeline = twoStepTimeline();
      const badJob: QuickPassJob = {
        id: "qp--1",
        phase: "quick-pass",
        ply: -1,
        fen: INITIAL_FEN,
        limit: { kind: "depth", value: 14 },
      };

      expect(() =>
        buildQuickPassEvaluationSeries(timeline, [makeResult(badJob, { depth: 14 })])
      ).not.toThrow();
    });

    it("returns a failure result for fractional ply instead of throwing", () => {
      const timeline = twoStepTimeline();
      const badJob: QuickPassJob = {
        id: "qp-frac",
        phase: "quick-pass",
        ply: 1.5,
        fen: INITIAL_FEN,
        limit: { kind: "depth", value: 14 },
      };

      expect(() =>
        buildQuickPassEvaluationSeries(timeline, [makeResult(badJob, { depth: 14 })])
      ).not.toThrow();
    });
  });
});
