import type { CriticalPosition } from "./critical-positions";
import type { EngineAnalysisLimit } from "./engine";
import type { ReviewTimeline } from "./timeline";

export type QuickPassPhase = "quick-pass" | "critical-pass";

export type QuickPassJob = {
  readonly id: string;
  readonly phase: QuickPassPhase;
  readonly ply: number;
  readonly fen: string;
  readonly limit: EngineAnalysisLimit;
};

export type QuickPassPlanSuccess = {
  readonly ok: true;
  readonly jobs: readonly QuickPassJob[];
};

export type QuickPassPlanFailure = {
  readonly ok: false;
  readonly reason: string;
  readonly jobs: readonly QuickPassJob[];
};

export type QuickPassPlan = QuickPassPlanSuccess | QuickPassPlanFailure;

export function planQuickPass(
  timeline: ReviewTimeline,
  limit: EngineAnalysisLimit
): QuickPassPlan {
  if (!timeline.analysisEligible) {
    return {
      ok: false,
      reason: "Timeline is not eligible for analysis.",
      jobs: [],
    };
  }

  const jobs = timeline.steps.map((step) => ({
    id: `quick-pass-${step.ply}`,
    phase: "quick-pass" as const,
    ply: step.ply,
    fen: step.fen,
    limit,
  }));

  return {
    ok: true,
    jobs,
  };
}

export function planCriticalPass(
  positions: readonly CriticalPosition[],
  limit: EngineAnalysisLimit
): QuickPassPlan {
  if (positions.length === 0) {
    return {
      ok: false,
      reason: "No critical positions to analyze.",
      jobs: [],
    };
  }

  const jobs = positions.map((position) => ({
    id: `critical-pass-${position.ply}`,
    phase: "critical-pass" as const,
    ply: position.ply,
    fen: position.fen,
    limit,
  }));

  return {
    ok: true,
    jobs,
  };
}

