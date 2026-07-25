import type { EngineAnalysisLimit } from "./engine";
import type { ReviewTimeline } from "./timeline";

export type QuickPassJob = {
  readonly id: string;
  readonly phase: "quick-pass";
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
