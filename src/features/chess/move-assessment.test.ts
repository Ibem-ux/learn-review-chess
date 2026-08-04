import { describe, expect, it } from "vitest";
import type { EngineScore, EngineInfo } from "@/features/chess/engine";
import type { ReviewTimeline } from "@/features/chess/timeline";
import type { PgnMove } from "@/features/chess/pgn";
import type { QuickPassCompletedJob, QuickPassCandidateLine } from "@/features/chess/quick-pass-runner";
import type { QuickPassJob } from "@/features/chess/quick-pass-planner";
import type { Square } from "chess.js";
import {
  buildMoveAssessments,
} from "@/features/chess/move-assessment";

// ---------------------------------------------------------------------------
// Shared FENs
// ---------------------------------------------------------------------------

const INITIAL = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const AFTER_E5 = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2";
const AFTER_NF3 = "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2";
const AFTER_NC6 = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";

const BEFORE_CASTLE = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQK2R w KQkq - 0 1";
const AFTER_CASTLE = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQ1RK1 b kq - 1 1";

const BEFORE_PROMO = "4k3/7P/8/8/8/8/8/4K3 w - - 0 1";
const AFTER_PROMO = "4k3/7Q/8/8/8/8/8/4K3 b - - 0 1";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TimelinePlyLocal = { readonly ply: number; readonly fen: string; readonly move: PgnMove | null };

function makeTimeline(steps: TimelinePlyLocal[]): ReviewTimeline {
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
    id: `qp-${ply}`,
    phase: "quick-pass",
    ply,
    fen,
    limit: { kind: "depth", value: 14 },
  };
}

function makeResult(
  job: QuickPassJob,
  info: EngineInfo | null,
  candidateLines?: readonly QuickPassCandidateLine[],
): QuickPassCompletedJob {
  return {
    job,
    info,
    bestMove: info ? { move: "e2e4", ponder: null } : null,
    candidateLines: candidateLines ?? (info ? [{ rank: 1, info }] : []),
  };
}

function makePgnMove(
  san: string,
  color: "w" | "b",
  from: Square,
  to: Square,
  before: string,
  after: string,
  opts?: { promotion?: string },
): PgnMove {
  return {
    san,
    color,
    from,
    to,
    before,
    after,
    ...opts,
  };
}

function shortGameTimeline(): ReviewTimeline {
  return makeTimeline([
    { ply: 0, fen: INITIAL, move: null },
    { ply: 1, fen: AFTER_E4, move: makePgnMove("e4", "w", "e2", "e4", INITIAL, AFTER_E4) },
    { ply: 2, fen: AFTER_E5, move: makePgnMove("e5", "b", "e7", "e5", AFTER_E4, AFTER_E5) },
    { ply: 3, fen: AFTER_NF3, move: makePgnMove("Nf3", "w", "g1", "f3", AFTER_E5, AFTER_NF3) },
    { ply: 4, fen: AFTER_NC6, move: makePgnMove("Nc6", "b", "b8", "c6", AFTER_NF3, AFTER_NC6) },
  ]);
}

function resultsFor(
  timeline: ReviewTimeline,
  scores: Array<{ ply: number; score: EngineScore }>,
): QuickPassCompletedJob[] {
  return scores.map((s) => {
    const job = makeJob(s.ply, timeline.steps[s.ply].fen);
    return makeResult(job, {
      depth: 14,
      score: s.score,
      pv: ["e2e4"],
    });
  });
}

// ---------------------------------------------------------------------------
// Alignment and availability
// ---------------------------------------------------------------------------

describe("buildMoveAssessments", () => {
  describe("alignment", () => {
    it("produces no assessment for ply 0", () => {
      const timeline = shortGameTimeline();
      const series = buildMoveAssessments(timeline, []);
      expect(series.ok).toBe(true);
      if (!series.ok) return;
      expect(series.assessments).toHaveLength(4);
      for (const a of series.assessments) {
        expect(a.ply).toBeGreaterThanOrEqual(1);
      }
    });

    it("produces one assessment per played move", () => {
      const timeline = shortGameTimeline();
      const series = buildMoveAssessments(timeline, []);
      expect(series.ok).toBe(true);
      if (!series.ok) return;
      expect(series.assessments).toHaveLength(4);
      expect(series.assessments.map((a) => a.ply)).toEqual([1, 2, 3, 4]);
    });

    it("preserves deterministic timeline order", () => {
      const timeline = shortGameTimeline();
      const series = buildMoveAssessments(timeline, []);
      expect(series.ok).toBe(true);
      if (!series.ok) return;
      for (let i = 0; i < series.assessments.length; i++) {
        expect(series.assessments[i].ply).toBe(i + 1);
        expect(series.assessments[i].san).toBe(
          ["e4", "e5", "Nf3", "Nc6"][i]
        );
      }
    });

    it("rejects a missing timeline move for ply > 0", () => {
      const timeline = makeTimeline([
        { ply: 0, fen: INITIAL, move: null },
        { ply: 1, fen: AFTER_E4, move: null },
      ]);
      const result = buildMoveAssessments(timeline, []);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toContain("missing");
    });
  });

  describe("availability", () => {
    it("unavailable when before-analysis is missing", () => {
      const timeline = shortGameTimeline();
      const result = buildMoveAssessments(timeline, []);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const a = result.assessments[0];
      expect(a.available).toBe(false);
      expect(a.unavailableReason).toBe("before-analysis-missing");
    });

    it("unavailable when after-analysis is missing", () => {
      const timeline = shortGameTimeline();
      const results = resultsFor(timeline, [
        { ply: 0, score: { type: "cp", value: 30, perspective: "white" } },
      ]);
      const result = buildMoveAssessments(timeline, results);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const a = result.assessments[0];
      expect(a.available).toBe(false);
      expect(a.unavailableReason).toBe("after-analysis-missing");
    });

    it("unavailable when before-score is missing", () => {
      const timeline = shortGameTimeline();
      const job1 = makeJob(1, AFTER_E4);
      const result = buildMoveAssessments(timeline, [
        {
          job: makeJob(0, INITIAL),
          info: null,
          bestMove: null,
          candidateLines: [],
        },
        { job: job1, info: null, bestMove: { move: "e2e4", ponder: null }, candidateLines: [] },
      ]);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const a = result.assessments[0];
      expect(a.available).toBe(false);
      expect(a.unavailableReason).toBe("before-score-missing");
    });

    it("unavailable when after-score is missing", () => {
      const timeline = shortGameTimeline();
      const job0 = makeJob(0, INITIAL);
      const job1 = makeJob(1, AFTER_E4);
      const results = [
        makeResult(job0, {
          depth: 14,
          score: { type: "cp", value: 30, perspective: "white" },
        }),
        { job: job1, info: { depth: 14 }, bestMove: null, candidateLines: [] },
      ];
      const result = buildMoveAssessments(timeline, results);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const a = result.assessments[0];
      expect(a.available).toBe(false);
      expect(a.unavailableReason).toBe("after-score-missing");
    });
  });

  describe("delta computation", () => {
    it("computes white mover centipawn loss", () => {
      const timeline = shortGameTimeline();
      const results = resultsFor(timeline, [
        { ply: 0, score: { type: "cp", value: 30, perspective: "white" } },
        { ply: 1, score: { type: "cp", value: 10, perspective: "white" } },
      ]);
      const result = buildMoveAssessments(timeline, results);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const a = result.assessments[0];
      expect(a.mover).toBe("white");
      const delta = a.delta;
      expect(delta).not.toBeNull();
      if (!delta || delta.kind !== "exact") return;
      expect(delta.signedChange).toBe(-20);
      expect(delta.centipawnLoss).toBe(20);
    });

    it("computes black mover centipawn loss", () => {
      const timeline = shortGameTimeline();
      const results = resultsFor(timeline, [
        { ply: 1, score: { type: "cp", value: -30, perspective: "white" } },
        { ply: 2, score: { type: "cp", value: 10, perspective: "white" } },
      ]);
      const result = buildMoveAssessments(timeline, results);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const a = result.assessments[1];
      expect(a.mover).toBe("black");
      const delta = a.delta;
      expect(delta).not.toBeNull();
      if (!delta || delta.kind !== "exact") return;
      expect(delta.signedChange).toBe(-40);
      expect(delta.centipawnLoss).toBe(40);
    });

    it("clamps improvement to zero loss", () => {
      const timeline = shortGameTimeline();
      const results = resultsFor(timeline, [
        { ply: 0, score: { type: "cp", value: 30, perspective: "white" } },
        { ply: 1, score: { type: "cp", value: 50, perspective: "white" } },
      ]);
      const result = buildMoveAssessments(timeline, results);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const a = result.assessments[0];
      const delta = a.delta;
      expect(delta).not.toBeNull();
      if (!delta || delta.kind !== "exact") return;
      expect(delta.signedChange).toBe(20);
      expect(delta.centipawnLoss).toBe(0);
    });

    it("produces zero loss on equal evaluation", () => {
      const timeline = shortGameTimeline();
      const results = resultsFor(timeline, [
        { ply: 0, score: { type: "cp", value: 40, perspective: "white" } },
        { ply: 1, score: { type: "cp", value: 40, perspective: "white" } },
      ]);
      const result = buildMoveAssessments(timeline, results);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const a = result.assessments[0];
      const delta = a.delta;
      expect(delta).not.toBeNull();
      if (!delta || delta.kind !== "exact") return;
      expect(delta.signedChange).toBe(0);
      expect(delta.centipawnLoss).toBe(0);
    });

    it("handles positive and negative evaluations", () => {
      const timeline = shortGameTimeline();
      const results = resultsFor(timeline, [
        { ply: 0, score: { type: "cp", value: 50, perspective: "white" } },
        { ply: 1, score: { type: "cp", value: -20, perspective: "white" } },
      ]);
      const result = buildMoveAssessments(timeline, results);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const a = result.assessments[0];
      const delta = a.delta;
      expect(delta).not.toBeNull();
      if (!delta || delta.kind !== "exact") return;
      expect(delta.signedChange).toBe(-70);
      expect(delta.centipawnLoss).toBe(70);
    });

    it("returns bounded delta when before score has lowerbound", () => {
      const timeline = shortGameTimeline();
      const score: EngineScore = { type: "cp", value: 30, perspective: "white", bound: "lowerbound" };
      const results = resultsFor(timeline, [
        {
          ply: 0,
          score,
        },
        { ply: 1, score: { type: "cp", value: 10, perspective: "white" } },
      ]);
      const result = buildMoveAssessments(timeline, results);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const a = result.assessments[0];
      expect(a.available).toBe(true);
      const delta = a.delta;
      expect(delta).not.toBeNull();
      expect(delta!.kind).toBe("bounded");
    });

    it("returns bounded delta when after score has upperbound", () => {
      const timeline = shortGameTimeline();
      const score: EngineScore = { type: "cp", value: 10, perspective: "white", bound: "upperbound" };
      const results = resultsFor(timeline, [
        { ply: 0, score: { type: "cp", value: 30, perspective: "white" } },
        {
          ply: 1,
          score,
        },
      ]);
      const result = buildMoveAssessments(timeline, results);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const a = result.assessments[0];
      expect(a.available).toBe(true);
      const delta = a.delta;
      expect(delta).not.toBeNull();
      expect(delta!.kind).toBe("bounded");
    });

    it("returns mate delta when both scores are centipawn but after is mate", () => {
      const timeline = shortGameTimeline();
      const results = resultsFor(timeline, [
        { ply: 0, score: { type: "cp", value: 30, perspective: "white" } },
        { ply: 1, score: { type: "mate", value: 3, perspective: "white" } },
      ]);
      const result = buildMoveAssessments(timeline, results);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const a = result.assessments[0];
      const delta = a.delta;
      expect(delta).not.toBeNull();
      expect(delta!.kind).toBe("mate");
    });

    it("handles cp to mate transition for white mover", () => {
      const timeline = shortGameTimeline();
      const results = resultsFor(timeline, [
        { ply: 0, score: { type: "cp", value: 40, perspective: "white" } },
        { ply: 1, score: { type: "mate", value: 2, perspective: "white" } },
      ]);
      const result = buildMoveAssessments(timeline, results);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const a = result.assessments[0];
      const delta = a.delta;
      expect(delta).not.toBeNull();
      if (!delta || delta.kind !== "mate") return;
      expect(delta.beforeMoverScore.type).toBe("cp");
      expect(delta.afterMoverScore.type).toBe("mate");
    });

    it("handles mate to cp transition", () => {
      const timeline = shortGameTimeline();
      const results = resultsFor(timeline, [
        { ply: 0, score: { type: "mate", value: 3, perspective: "white" } },
        { ply: 1, score: { type: "cp", value: -20, perspective: "white" } },
      ]);
      const result = buildMoveAssessments(timeline, results);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const a = result.assessments[0];
      const delta = a.delta;
      expect(delta).not.toBeNull();
      if (!delta || delta.kind !== "mate") return;
      expect(delta.beforeMoverScore.type).toBe("mate");
      expect(delta.afterMoverScore.type).toBe("cp");
    });

    it("preserves positive mate transition sign", () => {
      const timeline = shortGameTimeline();
      const results = resultsFor(timeline, [
        { ply: 0, score: { type: "mate", value: -2, perspective: "white" } },
        { ply: 1, score: { type: "mate", value: -4, perspective: "white" } },
      ]);
      const result = buildMoveAssessments(timeline, results);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const a = result.assessments[0];
      const delta = a.delta;
      expect(delta).not.toBeNull();
      if (!delta || delta.kind !== "mate") return;
      expect(delta.beforeMoverScore.value).toBe(-2);
      expect(delta.afterMoverScore.value).toBe(-4);
    });

    it("preserves negative mate transition sign", () => {
      const timeline = shortGameTimeline();
      const results = resultsFor(timeline, [
        { ply: 0, score: { type: "mate", value: 3, perspective: "white" } },
        { ply: 1, score: { type: "mate", value: 1, perspective: "white" } },
      ]);
      const result = buildMoveAssessments(timeline, results);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const a = result.assessments[0];
      const delta = a.delta;
      expect(delta).not.toBeNull();
      if (!delta || delta.kind !== "mate") return;
      expect(delta.beforeMoverScore.value).toBe(3);
      expect(delta.afterMoverScore.value).toBe(1);
    });

    it("does not mutate source scores", () => {
      const timeline = shortGameTimeline();
      const beforeScore: EngineScore = { type: "cp", value: 40, perspective: "white" };
      const afterScore: EngineScore = { type: "cp", value: 10, perspective: "white" };
      const results = resultsFor(timeline, [
        { ply: 0, score: beforeScore },
        { ply: 1, score: afterScore },
      ]);
      buildMoveAssessments(timeline, results);
      expect(beforeScore).toEqual({ type: "cp", value: 40, perspective: "white" });
      expect(afterScore).toEqual({ type: "cp", value: 10, perspective: "white" });
    });

    it("white mover scores use perspective mover", () => {
      const timeline = shortGameTimeline();
      const results = resultsFor(timeline, [
        { ply: 0, score: { type: "cp", value: 30, perspective: "white" } },
        { ply: 1, score: { type: "cp", value: 10, perspective: "white" } },
      ]);
      const result = buildMoveAssessments(timeline, results);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const a = result.assessments[0];
      expect(a.mover).toBe("white");
      const delta = a.delta;
      expect(delta).not.toBeNull();
      expect(delta?.kind).toBe("exact");
      if (delta?.kind !== "exact") {
        throw new Error("Expected exact delta");
      }
      expect(delta.beforeMoverScore.perspective).toBe("mover");
      expect(delta.afterMoverScore.perspective).toBe("mover");
    });

    it("black mover scores use perspective mover", () => {
      const timeline = shortGameTimeline();
      const results = resultsFor(timeline, [
        { ply: 1, score: { type: "cp", value: -30, perspective: "white" } },
        { ply: 2, score: { type: "cp", value: 10, perspective: "white" } },
      ]);
      const result = buildMoveAssessments(timeline, results);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const a = result.assessments[1];
      expect(a.mover).toBe("black");
      const delta = a.delta;
      expect(delta).not.toBeNull();
      expect(delta?.kind).toBe("exact");
      if (delta?.kind !== "exact") {
        throw new Error("Expected exact delta");
      }
      expect(delta.beforeMoverScore.perspective).toBe("mover");
      expect(delta.afterMoverScore.perspective).toBe("mover");
    });

    it("black centipawn values are negated", () => {
      const timeline = shortGameTimeline();
      const results = resultsFor(timeline, [
        { ply: 1, score: { type: "cp", value: -30, perspective: "white" } },
        { ply: 2, score: { type: "cp", value: 10, perspective: "white" } },
      ]);
      const result = buildMoveAssessments(timeline, results);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const a = result.assessments[1];
      const delta = a.delta;
      expect(delta).not.toBeNull();
      expect(delta?.kind).toBe("exact");
      if (delta?.kind !== "exact") {
        throw new Error("Expected exact delta");
      }
      expect(delta.beforeMoverScore.value).toBe(30);
      expect(delta.afterMoverScore.value).toBe(-10);
    });

    it("black mate values are negated", () => {
      const timeline = shortGameTimeline();
      const results = resultsFor(timeline, [
        { ply: 1, score: { type: "mate", value: -3, perspective: "white" } },
        { ply: 2, score: { type: "mate", value: 2, perspective: "white" } },
      ]);
      const result = buildMoveAssessments(timeline, results);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const a = result.assessments[1];
      const delta = a.delta;
      expect(delta).not.toBeNull();
      expect(delta?.kind).toBe("mate");
      if (delta?.kind !== "mate") {
        throw new Error("Expected mate delta");
      }
      expect(delta.beforeMoverScore.value).toBe(3);
      expect(delta.afterMoverScore.value).toBe(-2);
    });

    it("black lowerbound becomes upperbound", () => {
      const timeline = shortGameTimeline();
      const score: EngineScore = { type: "cp", value: -30, perspective: "white", bound: "lowerbound" };
      const results = resultsFor(timeline, [
        {
          ply: 1,
          score,
        },
        { ply: 2, score: { type: "cp", value: 10, perspective: "white" } },
      ]);
      const result = buildMoveAssessments(timeline, results);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const a = result.assessments[1];
      const delta = a.delta;
      expect(delta).not.toBeNull();
      expect(delta?.kind).toBe("bounded");
      if (delta?.kind !== "bounded") {
        throw new Error("Expected bounded delta");
      }
      expect(delta.beforeMoverScore.bound).toBe("upperbound");
    });

    it("black upperbound becomes lowerbound", () => {
      const timeline = shortGameTimeline();
      const score: EngineScore = { type: "cp", value: -30, perspective: "white", bound: "upperbound" };
      const results = resultsFor(timeline, [
        {
          ply: 1,
          score,
        },
        { ply: 2, score: { type: "cp", value: 10, perspective: "white" } },
      ]);
      const result = buildMoveAssessments(timeline, results);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const a = result.assessments[1];
      const delta = a.delta;
      expect(delta).not.toBeNull();
      expect(delta?.kind).toBe("bounded");
      if (delta?.kind !== "bounded") {
        throw new Error("Expected bounded delta");
      }
      expect(delta.beforeMoverScore.bound).toBe("lowerbound");
    });

    it("white bounds are unchanged", () => {
      const timeline = shortGameTimeline();
      const score: EngineScore = { type: "cp", value: 30, perspective: "white", bound: "lowerbound" };
      const results = resultsFor(timeline, [
        {
          ply: 0,
          score,
        },
        { ply: 1, score: { type: "cp", value: 10, perspective: "white" } },
      ]);
      const result = buildMoveAssessments(timeline, results);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const a = result.assessments[0];
      const delta = a.delta;
      expect(delta).not.toBeNull();
      expect(delta?.kind).toBe("bounded");
      if (delta?.kind !== "bounded") {
        throw new Error("Expected bounded delta");
      }
      expect(delta.beforeMoverScore.bound).toBe("lowerbound");
    });
  });

  describe("candidate matching", () => {
    function makeCandidateLine(
      rank: number,
      pv: readonly string[],
      score: EngineScore,
    ): QuickPassCandidateLine {
      return {
        rank,
        info: { depth: 14, score, pv },
      };
    }

    it("matches candidate rank 1", () => {
      const timeline = shortGameTimeline();
      const job0 = makeJob(0, INITIAL);
      const info: EngineInfo = {
        depth: 14,
        score: { type: "cp", value: 30, perspective: "white" },
        pv: ["e2e4"],
      };
      const result = makeResult(job0, info, [
        makeCandidateLine(1, ["e2e4"], { type: "cp", value: 30, perspective: "white" }),
      ]);
      const series = buildMoveAssessments(timeline, [result]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;
      const a = series.assessments[0];
      expect(a.candidateRank).toBe(1);
      expect(a.bestCandidateUci).toBe("e2e4");
      expect(a.candidateMoves).toEqual(["e2e4"]);
    });

    it("matches candidate rank 2", () => {
      const timeline = shortGameTimeline();
      const job0 = makeJob(0, INITIAL);
      const info: EngineInfo = {
        depth: 14,
        score: { type: "cp", value: 30, perspective: "white" },
        pv: ["d2d4"],
      };
      const result = makeResult(job0, info, [
        makeCandidateLine(1, ["d2d4"], { type: "cp", value: 30, perspective: "white" }),
        makeCandidateLine(2, ["e2e4"], { type: "cp", value: 25, perspective: "white" }),
      ]);
      const series = buildMoveAssessments(timeline, [result]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;
      const a = series.assessments[0];
      expect(a.candidateRank).toBe(2);
      expect(a.bestCandidateUci).toBe("d2d4");
      expect(a.candidateMoves).toEqual(["d2d4", "e2e4"]);
    });

    it("matches candidate rank 3", () => {
      const timeline = makeTimeline([
        { ply: 0, fen: INITIAL, move: null },
        { ply: 1, fen: AFTER_NF3, move: makePgnMove("Nf3", "w", "g1", "f3", INITIAL, AFTER_NF3) },
      ]);
      const job0 = makeJob(0, INITIAL);
      const info: EngineInfo = {
        depth: 14,
        score: { type: "cp", value: 30, perspective: "white" },
        pv: ["e2e4"],
      };
      const result = makeResult(job0, info, [
        makeCandidateLine(1, ["e2e4"], { type: "cp", value: 30, perspective: "white" }),
        makeCandidateLine(2, ["d2d4"], { type: "cp", value: 25, perspective: "white" }),
        makeCandidateLine(3, ["g1f3"], { type: "cp", value: 20, perspective: "white" }),
      ]);
      const series = buildMoveAssessments(timeline, [result]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;
      const a = series.assessments[0];
      expect(a.candidateRank).toBe(3);
      expect(a.bestCandidateUci).toBe("e2e4");
      expect(a.candidateMoves).toEqual(["e2e4", "d2d4", "g1f3"]);
    });

    it("returns null when no candidate matches", () => {
      const timeline = shortGameTimeline();
      const job0 = makeJob(0, INITIAL);
      const info: EngineInfo = {
        depth: 14,
        score: { type: "cp", value: 30, perspective: "white" },
        pv: ["d2d4"],
      };
      const result = makeResult(job0, info, [
        makeCandidateLine(1, ["d2d4"], { type: "cp", value: 30, perspective: "white" }),
      ]);
      const series = buildMoveAssessments(timeline, [result]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;
      const a = series.assessments[0];
      expect(a.candidateRank).toBeNull();
      expect(a.bestCandidateUci).toBe("d2d4");
      expect(a.candidateMoves).toEqual(["d2d4"]);
    });

    it("returns empty candidate data when PV is missing", () => {
      const timeline = shortGameTimeline();
      const job0 = makeJob(0, INITIAL);
      const info: EngineInfo = { depth: 14, score: { type: "cp", value: 30, perspective: "white" } };
      const result = makeResult(job0, info, [
        makeCandidateLine(1, [], { type: "cp", value: 30, perspective: "white" }),
      ]);
      const series = buildMoveAssessments(timeline, [result]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;
      const a = series.assessments[0];
      expect(a.candidateRank).toBeNull();
      expect(a.bestCandidateUci).toBeNull();
      expect(a.candidateMoves).toEqual([]);
    });

    it("skips malformed PV first move", () => {
      const timeline = shortGameTimeline();
      const job0 = makeJob(0, INITIAL);
      const info: EngineInfo = {
        depth: 14,
        score: { type: "cp", value: 30, perspective: "white" },
        pv: [""],
      };
      const result = makeResult(job0, info, [
        makeCandidateLine(1, [""], { type: "cp", value: 30, perspective: "white" }),
      ]);
      const series = buildMoveAssessments(timeline, [result]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;
      const a = series.assessments[0];
      expect(a.candidateRank).toBeNull();
      expect(a.bestCandidateUci).toBeNull();
      expect(a.candidateMoves).toEqual([]);
    });

    it("sorts out-of-order candidate lines by rank", () => {
      const timeline = shortGameTimeline();
      const job0 = makeJob(0, INITIAL);
      const info: EngineInfo = { depth: 14, score: { type: "cp", value: 30, perspective: "white" }, pv: ["e2e4"] };
      const result = makeResult(job0, info, [
        makeCandidateLine(3, ["g1f3"], { type: "cp", value: 20, perspective: "white" }),
        makeCandidateLine(1, ["e2e4"], { type: "cp", value: 30, perspective: "white" }),
        makeCandidateLine(2, ["d2d4"], { type: "cp", value: 25, perspective: "white" }),
      ]);
      const series = buildMoveAssessments(timeline, [result]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;
      const a = series.assessments[0];
      expect(a.candidateMoves).toEqual(["e2e4", "d2d4", "g1f3"]);
      expect(a.bestCandidateUci).toBe("e2e4");
    });

    it("rejects duplicate candidate ranks", () => {
      const timeline = shortGameTimeline();
      const job0 = makeJob(0, INITIAL);
      const info: EngineInfo = { depth: 14, score: { type: "cp", value: 30, perspective: "white" }, pv: ["e2e4"] };
      const result = makeResult(job0, info, [
        makeCandidateLine(1, ["e2e4"], { type: "cp", value: 30, perspective: "white" }),
        makeCandidateLine(1, ["d2d4"], { type: "cp", value: 25, perspective: "white" }),
      ]);
      const series = buildMoveAssessments(timeline, [result]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;
      const a = series.assessments[0];
      expect(a.candidateRank).toBe(1);
      expect(a.candidateMoves).toEqual(["e2e4"]);
    });

    it("normalizes UCI case for matching", () => {
      const timeline = shortGameTimeline();
      const job0 = makeJob(0, INITIAL);
      const info: EngineInfo = { depth: 14, score: { type: "cp", value: 30, perspective: "white" }, pv: ["E2E4"] };
      const result = makeResult(job0, info, [
        makeCandidateLine(1, ["E2E4"], { type: "cp", value: 30, perspective: "white" }),
      ]);
      const series = buildMoveAssessments(timeline, [result]);
      expect(series.ok).toBe(true);
      if (!series.ok) return;
      const a = series.assessments[0];
      expect(a.candidateRank).toBe(1);
      expect(a.playedUci).toBe("e2e4");
    });
  });

  describe("UCI conversion", () => {
    it("converts a normal move", () => {
      const timeline = shortGameTimeline();
      const series = buildMoveAssessments(timeline, []);
      expect(series.ok).toBe(true);
      if (!series.ok) return;
      expect(series.assessments[0].playedUci).toBe("e2e4");
    });

    it("converts a promotion move", () => {
      const timeline = makeTimeline([
        { ply: 0, fen: BEFORE_PROMO, move: null },
        {
          ply: 1,
          fen: AFTER_PROMO,
          move: makePgnMove("h8=Q", "w", "h7", "h8", BEFORE_PROMO, AFTER_PROMO, { promotion: "q" }),
        },
      ]);
      const series = buildMoveAssessments(timeline, []);
      expect(series.ok).toBe(true);
      if (!series.ok) return;
      const a = series.assessments[0];
      expect(a.playedUci).toBe("h7h8q");
      expect(a.promotion).toBe("q");
    });

    it("converts a castling move", () => {
      const timeline = makeTimeline([
        { ply: 0, fen: BEFORE_CASTLE, move: null },
        { ply: 1, fen: AFTER_CASTLE, move: makePgnMove("O-O", "w", "e1", "g1", BEFORE_CASTLE, AFTER_CASTLE) },
      ]);
      const series = buildMoveAssessments(timeline, []);
      expect(series.ok).toBe(true);
      if (!series.ok) return;
      const a = series.assessments[0];
      expect(a.playedUci).toBe("e1g1");
    });
  });

  describe("validation failures", () => {
    it("rejects mover color mismatch", () => {
      const timeline = makeTimeline([
        { ply: 0, fen: AFTER_E4, move: null },
        { ply: 1, fen: AFTER_E5, move: makePgnMove("e5", "w", "e7", "e5", AFTER_E4, AFTER_E5) },
      ]);
      const result = buildMoveAssessments(timeline, []);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toContain("color mismatch");
    });

    it("propagates evaluation-series failures", () => {
      const timeline = makeTimeline([
        { ply: 0, fen: "not-a-valid-board w KQkq - 0 1", move: null },
        { ply: 1, fen: AFTER_E4, move: makePgnMove("e4", "w", "e2", "e4", "not-a-valid-board w KQkq - 0 1", AFTER_E4) },
      ]);
      const result = buildMoveAssessments(timeline, []);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toContain("Malformed FEN");
    });
  });
});
