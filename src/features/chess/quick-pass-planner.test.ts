import { describe, expect, it } from "vitest";
import { parsePgn } from "@/features/chess/pgn";
import {
  buildTimeline,
  type ReviewTimeline,
} from "@/features/chess/timeline";
import { planCriticalPass, planQuickPass } from "@/features/chess/quick-pass-planner";
import type { QuickPassJob, QuickPassPlan } from "@/features/chess/quick-pass-planner";
import type { CriticalPosition } from "@/features/chess/critical-positions";

const COMPLETED_PGN = `[Event "Test"]
[White "White"]
[Black "Black"]
[Result "1-0"]

1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0`;

const INCOMPLETE_PGN = `[Event "Test"]
[Result "*"]

1. e4 e5 *`;

function completedTimeline(): ReviewTimeline {
  const result = parsePgn(COMPLETED_PGN);
  if (!result.ok) throw new Error("expected successful parse");
  return buildTimeline(result.value);
}

function incompleteTimeline(): ReviewTimeline {
  const result = parsePgn(INCOMPLETE_PGN);
  if (!result.ok) throw new Error("expected successful parse");
  return buildTimeline(result.value);
}

function collectJobs(plan: QuickPassPlan): QuickPassJob[] {
  return plan.ok ? [...plan.jobs] : [];
}

describe("planQuickPass", () => {
  it("returns deterministic failure and no jobs for an ineligible timeline", () => {
    const timeline = incompleteTimeline();
    const plan = planQuickPass(timeline, { kind: "depth", value: 14 });

    expect(plan.ok).toBe(false);
    if (plan.ok) throw new Error("expected an ineligible plan");
    expect(plan.reason).toBe("Timeline is not eligible for analysis.");
    expect(collectJobs(plan)).toHaveLength(0);
  });

  it("produces exactly the ply-0 job for an eligible zero-move timeline", () => {
    const timeline: ReviewTimeline = {
      steps: [{ ply: 0, fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", move: null }],
      totalPlies: 0,
      initialFen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      finalFen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      analysisEligible: true,
    };
    const plan = planQuickPass(timeline, { kind: "depth", value: 14 });

    expect(plan.ok).toBe(true);
    expect(collectJobs(plan)).toHaveLength(1);
    expect(plan.jobs[0].ply).toBe(0);
    expect(plan.jobs[0].fen).toBe(timeline.initialFen);
  });

  it("produces totalPlies + 1 jobs for a multi-ply eligible timeline", () => {
    const timeline = completedTimeline();
    const plan = planQuickPass(timeline, { kind: "depth", value: 14 });

    expect(plan.ok).toBe(true);
    expect(collectJobs(plan)).toHaveLength(timeline.totalPlies + 1);
  });

  it("orders jobs from ply 0 through the final ply", () => {
    const timeline = completedTimeline();
    const plan = planQuickPass(timeline, { kind: "depth", value: 14 });

    expect(plan.ok).toBe(true);
    for (let i = 0; i < plan.jobs.length; i += 1) {
      expect(plan.jobs[i].ply).toBe(i);
    }
  });

  it("preserves the exact initial and final timeline FENs", () => {
    const timeline = completedTimeline();
    const plan = planQuickPass(timeline, { kind: "depth", value: 14 });

    expect(plan.ok).toBe(true);
    expect(plan.jobs[0].fen).toBe(timeline.initialFen);
    expect(plan.jobs[plan.jobs.length - 1].fen).toBe(timeline.finalFen);
  });

  it("preserves every intermediate timeline FEN exactly", () => {
    const timeline = completedTimeline();
    const plan = planQuickPass(timeline, { kind: "depth", value: 14 });

    expect(plan.ok).toBe(true);
    for (let i = 0; i < timeline.steps.length; i += 1) {
      expect(plan.jobs[i].fen).toBe(timeline.steps[i].fen);
    }
  });

  it("generates deterministic and unique IDs within a plan", () => {
    const timeline = completedTimeline();
    const plan = planQuickPass(timeline, { kind: "depth", value: 14 });

    expect(plan.ok).toBe(true);
    const ids = plan.jobs.map((job) => job.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const job of plan.jobs) {
      expect(job.id).toBe(`quick-pass-${job.ply}`);
    }
  });

  it("produces deeply equal results for repeated planning with identical inputs", () => {
    const timeline = completedTimeline();
    const limit = { kind: "depth", value: 14 } as const;
    const first = planQuickPass(timeline, limit);
    const second = planQuickPass(timeline, limit);

    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
  });

  it("preserves the depth limit exactly", () => {
    const timeline = completedTimeline();
    const limit = { kind: "depth", value: 14 } as const;
    const plan = planQuickPass(timeline, limit);

    expect(plan.ok).toBe(true);
    for (const job of plan.jobs) {
      expect(job.limit).toEqual({ kind: "depth", value: 14 });
    }
  });

  it("preserves the nodes limit exactly", () => {
    const timeline = completedTimeline();
    const limit = { kind: "nodes", value: 50000 } as const;
    const plan = planQuickPass(timeline, limit);

    expect(plan.ok).toBe(true);
    for (const job of plan.jobs) {
      expect(job.limit).toEqual({ kind: "nodes", value: 50000 });
    }
  });

  it("preserves the movetime limit exactly", () => {
    const timeline = completedTimeline();
    const limit = { kind: "movetime", value: 1000 } as const;
    const plan = planQuickPass(timeline, limit);

    expect(plan.ok).toBe(true);
    for (const job of plan.jobs) {
      expect(job.limit).toEqual({ kind: "movetime", value: 1000 });
    }
  });

  it("does not mutate the input timeline or limit", () => {
    const timeline = completedTimeline();
    const originalStepsLength = timeline.steps.length;
    const originalTotalPlies = timeline.totalPlies;
    const originalInitialFen = timeline.initialFen;
    const originalFinalFen = timeline.finalFen;

    const limit = { kind: "depth", value: 14 } as const;
    const plan = planQuickPass(timeline, limit);

    expect(timeline.steps.length).toBe(originalStepsLength);
    expect(timeline.totalPlies).toBe(originalTotalPlies);
    expect(timeline.initialFen).toBe(originalInitialFen);
    expect(timeline.finalFen).toBe(originalFinalFen);
    expect(plan.ok).toBe(true);
    expect(limit).toEqual({ kind: "depth", value: 14 });
  });
});

describe("planCriticalPass", () => {
  it("an empty positions array returns the failure variant with the exact reason string", () => {
    const plan = planCriticalPass([], { kind: "depth", value: 18 });
    expect(plan.ok).toBe(false);
    if (plan.ok) throw new Error("expected failure variant");
    expect(plan.reason).toBe("No critical positions to analyze.");
  });

  it("an empty positions array returns an empty jobs array", () => {
    const plan = planCriticalPass([], { kind: "depth", value: 18 });
    expect(plan.jobs).toEqual([]);
  });

  it("one position produces exactly one job", () => {
    const pos: CriticalPosition = { ply: 5, fen: "fen-5", reason: "blunder" };
    const plan = planCriticalPass([pos], { kind: "depth", value: 18 });
    expect(plan.ok).toBe(true);
    expect(plan.jobs).toHaveLength(1);
  });

  it("that job's id is critical-pass-<ply> for the position's ply", () => {
    const pos: CriticalPosition = { ply: 5, fen: "fen-5", reason: "blunder" };
    const plan = planCriticalPass([pos], { kind: "depth", value: 18 });
    expect(plan.jobs[0].id).toBe("critical-pass-5");
  });

  it("that job's phase is critical-pass", () => {
    const pos: CriticalPosition = { ply: 5, fen: "fen-5", reason: "blunder" };
    const plan = planCriticalPass([pos], { kind: "depth", value: 18 });
    expect(plan.jobs[0].phase).toBe("critical-pass");
  });

  it("that job's fen and ply equal the position's fen and ply", () => {
    const pos: CriticalPosition = { ply: 5, fen: "fen-5", reason: "blunder" };
    const plan = planCriticalPass([pos], { kind: "depth", value: 18 });
    expect(plan.jobs[0].ply).toBe(5);
    expect(plan.jobs[0].fen).toBe("fen-5");
  });

  it("three positions produce three jobs in the same order as the input", () => {
    const positions: readonly CriticalPosition[] = [
      { ply: 10, fen: "fen-10", reason: "blunder" },
      { ply: 3, fen: "fen-3", reason: "mistake" },
      { ply: 15, fen: "fen-15", reason: "inaccuracy" },
    ];
    const plan = planCriticalPass(positions, { kind: "depth", value: 18 });
    expect(plan.ok).toBe(true);
    expect(plan.jobs.map((j) => j.ply)).toEqual([10, 3, 15]);
  });

  it("every job carries the identical limit value that was passed in", () => {
    const positions: readonly CriticalPosition[] = [
      { ply: 1, fen: "fen-1", reason: "blunder" },
      { ply: 2, fen: "fen-2", reason: "mistake" },
    ];
    const limit = { kind: "depth", value: 18 } as const;
    const plan = planCriticalPass(positions, limit);
    expect(plan.ok).toBe(true);
    for (const job of plan.jobs) {
      expect(job.limit).toEqual(limit);
    }
  });

  it("the input array is not mutated", () => {
    const positions: readonly CriticalPosition[] = [
      { ply: 1, fen: "fen-1", reason: "blunder" },
      { ply: 2, fen: "fen-2", reason: "mistake" },
    ];
    const originalJson = JSON.stringify(positions);
    planCriticalPass(positions, { kind: "depth", value: 18 });
    expect(JSON.stringify(positions)).toBe(originalJson);
  });
});
