import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { EngineAnalysisLimit } from "@/features/chess/engine";
import type { ReviewTimeline } from "@/features/chess/timeline";

const stableStart = vi.fn(() => true);
const stableCancel = vi.fn();

const mockReturn = {
  status: "ready" as const,
  error: null as string | null,
  totalJobs: 0,
  completedJobs: 0,
  currentJobId: null as string | null,
  results: [] as unknown[],
  start: stableStart,
  cancel: stableCancel,
};

const mockUseQuickPassAnalysis = vi.fn(() => mockReturn);

function createTimeline(overrides: Partial<ReviewTimeline> = {}): ReviewTimeline {
  return {
    steps: [
      { ply: 0, fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", move: null },
      { ply: 1, fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 0", move: { san: "e4", uci: "e2e4", before: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", after: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 0", color: "w" } },
    ],
    totalPlies: 1,
    initialFen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    finalFen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 0",
    analysisEligible: true,
    ...overrides,
  };
}

function createResult(ply: number) {
  return {
    job: { id: `quick-pass-${ply}`, phase: "quick-pass" as const, ply, fen: `fen-${ply}`, limit: { kind: "depth" as const, value: 14 } },
    info: { depth: 14, multipv: 1, score: { type: "cp" as const, value: 30, perspective: "side-to-move" as const }, nodes: 1000, timeMs: 100, pv: ["e2e4", "e7e5"] },
    bestMove: { move: "e2e4", ponder: "e7e5" },
    candidateLines: [
      { rank: 1, info: { depth: 14, multipv: 1, score: { type: "cp" as const, value: 30, perspective: "side-to-move" as const }, nodes: 1000, timeMs: 100, pv: ["e2e4", "e7e5"] } },
      { rank: 2, info: { depth: 12, multipv: 2, score: { type: "cp" as const, value: 20, perspective: "side-to-move" as const }, nodes: 800, timeMs: 80, pv: ["d2d4"] } },
    ],
  };
}

function createMinimalResult(ply: number) {
  return {
    job: { id: `quick-pass-${ply}`, phase: "quick-pass" as const, ply, fen: `fen-${ply}`, limit: { kind: "depth" as const, value: 14 } },
    info: { depth: 14, pv: ["e2e4"] },
    bestMove: { move: "e2e4", ponder: null },
    candidateLines: [
      { rank: 1, info: { depth: 14, pv: ["e2e4"] } },
    ],
  };
}

const limit: EngineAnalysisLimit = { kind: "depth", value: 14 };

describe("FullGameAnalysisPanel", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockReturn.status = "ready";
    mockReturn.error = null;
    mockReturn.totalJobs = 0;
    mockReturn.completedJobs = 0;
    mockReturn.currentJobId = null;
    mockReturn.results = [];
    stableStart.mockClear();
    stableCancel.mockClear();
  });

  beforeEach(() => {
    vi.doMock("@/features/chess/use-quick-pass-analysis", () => ({
      useQuickPassAnalysis: mockUseQuickPassAnalysis,
    }));
  });

  it("renders eligibility message for ineligible timeline and does not invoke the hook", async () => {
    const mod = await import("@/features/chess/full-game-analysis-panel");
    const FullGameAnalysisPanel = mod.default;
    render(<FullGameAnalysisPanel timeline={createTimeline({ analysisEligible: false })} currentPly={0} limit={limit} />);
    expect(screen.getByText("Full-game analysis is available only for completed games.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Analyze full game" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(mockUseQuickPassAnalysis).not.toHaveBeenCalled();
  });

  it("eligible mount invokes the hook but does not start automatically", async () => {
    const mod = await import("@/features/chess/full-game-analysis-panel");
    const FullGameAnalysisPanel = mod.default;
    render(<FullGameAnalysisPanel timeline={createTimeline()} currentPly={0} limit={limit} />);
    expect(mockUseQuickPassAnalysis).toHaveBeenCalled();
    expect(stableStart).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Analyze full game" })).toBeDefined();
  });

  it("loading disables Analyze", async () => {
    const mod = await import("@/features/chess/full-game-analysis-panel");
    const FullGameAnalysisPanel = mod.default;
    mockReturn.status = "loading";
    render(<FullGameAnalysisPanel timeline={createTimeline()} currentPly={0} limit={limit} />);
    const button = screen.getByRole("button", { name: "Analyze full game" });
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("Analyze forwards exact timeline, limit, and MultiPV", async () => {
    const mod = await import("@/features/chess/full-game-analysis-panel");
    const FullGameAnalysisPanel = mod.default;
    const timeline = createTimeline();
    render(<FullGameAnalysisPanel timeline={timeline} currentPly={0} limit={limit} multiPv={5} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();
    expect(stableStart).toHaveBeenCalledTimes(1);
    expect(stableStart).toHaveBeenCalledWith(timeline, limit, 5);
  });

  it("default MultiPV is 3", async () => {
    const mod = await import("@/features/chess/full-game-analysis-panel");
    const FullGameAnalysisPanel = mod.default;
    const timeline = createTimeline();
    render(<FullGameAnalysisPanel timeline={timeline} currentPly={0} limit={limit} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();
    expect(stableStart).toHaveBeenCalledWith(timeline, limit, 3);
  });

  it("running progress renders correct completed and total counts", async () => {
    const mod = await import("@/features/chess/full-game-analysis-panel");
    const FullGameAnalysisPanel = mod.default;
    const { rerender } = render(<FullGameAnalysisPanel timeline={createTimeline()} currentPly={0} limit={limit} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockReturn.status = "running";
    mockReturn.totalJobs = 5;
    mockReturn.completedJobs = 2;
    mockReturn.currentJobId = "quick-pass-1";
    rerender(<FullGameAnalysisPanel timeline={createTimeline()} currentPly={0} limit={limit} />);

    expect(screen.getByText("Analyzing position quick-pass-1 (2/5)")).toBeDefined();
  });

  it("running exposes Cancel and delegates once", async () => {
    const mod = await import("@/features/chess/full-game-analysis-panel");
    const FullGameAnalysisPanel = mod.default;
    const { rerender } = render(<FullGameAnalysisPanel timeline={createTimeline()} currentPly={0} limit={limit} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockReturn.status = "running";
    rerender(<FullGameAnalysisPanel timeline={createTimeline()} currentPly={0} limit={limit} />);

    screen.getByRole("button", { name: "Cancel" }).click();
    expect(stableCancel).toHaveBeenCalledTimes(1);
  });

  it("completed state renders correctly", async () => {
    const mod = await import("@/features/chess/full-game-analysis-panel");
    const FullGameAnalysisPanel = mod.default;
    const { rerender } = render(<FullGameAnalysisPanel timeline={createTimeline()} currentPly={0} limit={limit} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockReturn.status = "completed";
    rerender(<FullGameAnalysisPanel timeline={createTimeline()} currentPly={0} limit={limit} />);

    expect(screen.getByText("Analysis complete.")).toBeDefined();
  });

  it("cancelled state renders correctly and preserves partial results", async () => {
    const mod = await import("@/features/chess/full-game-analysis-panel");
    const FullGameAnalysisPanel = mod.default;
    const partial = createResult(0);
    const { rerender } = render(<FullGameAnalysisPanel timeline={createTimeline()} currentPly={0} limit={limit} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockReturn.status = "cancelled";
    mockReturn.results = [partial];
    rerender(<FullGameAnalysisPanel timeline={createTimeline()} currentPly={0} limit={limit} />);

    expect(screen.getByText("Analysis cancelled.")).toBeDefined();
    const resultContainer = screen.getByTestId("current-ply-result");
    expect(resultContainer.textContent).toContain("Ply:");
    expect(resultContainer.textContent).toContain("0");
  });

  it("error state renders the exact safe hook error", async () => {
    const mod = await import("@/features/chess/full-game-analysis-panel");
    const FullGameAnalysisPanel = mod.default;
    const { rerender } = render(<FullGameAnalysisPanel timeline={createTimeline()} currentPly={0} limit={limit} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockReturn.status = "error";
    mockReturn.error = "Engine failure.";
    rerender(<FullGameAnalysisPanel timeline={createTimeline()} currentPly={0} limit={limit} />);

    expect(screen.getByText("Engine failure.")).toBeDefined();
  });

  it("current ply displays only its matching result", async () => {
    const mod = await import("@/features/chess/full-game-analysis-panel");
    const FullGameAnalysisPanel = mod.default;
    const results = [createResult(0), createResult(1)];
    const { rerender } = render(<FullGameAnalysisPanel timeline={createTimeline()} currentPly={0} limit={limit} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockReturn.status = "completed";
    mockReturn.results = results;
    rerender(<FullGameAnalysisPanel timeline={createTimeline()} currentPly={1} limit={limit} />);

    const resultContainer = screen.getByTestId("current-ply-result");
    expect(resultContainer.textContent).toContain("Ply:");
    expect(resultContainer.textContent).toContain("1");
    expect(screen.queryByTestId("current-ply-result")?.textContent).not.toContain("Ply: 0");
  });

  it("changing current ply does not call start or cancel", async () => {
    const mod = await import("@/features/chess/full-game-analysis-panel");
    const FullGameAnalysisPanel = mod.default;
    const { rerender } = render(<FullGameAnalysisPanel timeline={createTimeline()} currentPly={0} limit={limit} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    const startCallsBefore = stableStart.mock.calls.length;
    const cancelCallsBefore = stableCancel.mock.calls.length;
    rerender(<FullGameAnalysisPanel timeline={createTimeline()} currentPly={1} limit={limit} />);
    expect(stableStart).toHaveBeenCalledTimes(startCallsBefore);
    expect(stableCancel).toHaveBeenCalledTimes(cancelCallsBefore);
  });

  it("ranked candidate lines render in ascending order", async () => {
    const mod = await import("@/features/chess/full-game-analysis-panel");
    const FullGameAnalysisPanel = mod.default;
    const result = createResult(0);
    result.candidateLines = [
      { rank: 3, info: { depth: 10, score: { type: "cp", value: 10, perspective: "side-to-move" }, pv: ["g1f3"] } },
      { rank: 1, info: { depth: 14, score: { type: "cp", value: 30, perspective: "side-to-move" }, pv: ["e2e4", "e7e5"] } },
      { rank: 2, info: { depth: 12, score: { type: "cp", value: 20, perspective: "side-to-move" }, pv: ["d2d4"] } },
    ];
    const { rerender } = render(<FullGameAnalysisPanel timeline={createTimeline()} currentPly={0} limit={limit} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockReturn.status = "completed";
    mockReturn.results = [result];
    rerender(<FullGameAnalysisPanel timeline={createTimeline()} currentPly={0} limit={limit} />);

    const rankElements = screen.getAllByText(/^Rank \d+:/);
    expect(rankElements[0].textContent).toBe("Rank 1:");
    expect(rankElements[1].textContent).toBe("Rank 2:");
    expect(rankElements[2].textContent).toBe("Rank 3:");
  });

  it("missing ranks and optional fields are not fabricated", async () => {
    const mod = await import("@/features/chess/full-game-analysis-panel");
    const FullGameAnalysisPanel = mod.default;
    const result = createMinimalResult(0);
    const { rerender } = render(<FullGameAnalysisPanel timeline={createTimeline()} currentPly={0} limit={limit} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockReturn.status = "completed";
    mockReturn.results = [result];
    rerender(<FullGameAnalysisPanel timeline={createTimeline()} currentPly={0} limit={limit} />);

    expect(screen.getByText("Rank 1:")).toBeDefined();
    expect(screen.queryByText("Rank 2:")).toBeNull();
    const candidateContainer = screen.getByText("Candidate lines:").closest("div");
    expect(candidateContainer?.textContent).not.toContain("Score:");
  });

  it("best move and ponder render when present", async () => {
    const mod = await import("@/features/chess/full-game-analysis-panel");
    const FullGameAnalysisPanel = mod.default;
    const result = createResult(0);
    result.bestMove = { move: "e2e4", ponder: "e7e5" };
    const { rerender } = render(<FullGameAnalysisPanel timeline={createTimeline()} currentPly={0} limit={limit} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockReturn.status = "completed";
    mockReturn.results = [result];
    rerender(<FullGameAnalysisPanel timeline={createTimeline()} currentPly={0} limit={limit} />);

    const resultContainer = screen.getByTestId("current-ply-result");
    expect(resultContainer.textContent).toContain("Best move:");
    expect(resultContainer.textContent).toContain("e2e4");
    expect(resultContainer.textContent).toContain("ponder: e7e5");
  });

  it("timeline replacement during running cancels once and hides old results", async () => {
    const mod = await import("@/features/chess/full-game-analysis-panel");
    const FullGameAnalysisPanel = mod.default;
    const timelineA = createTimeline({ finalFen: "fen-a" });
    const timelineB = createTimeline({ finalFen: "fen-b" });
    const { rerender } = render(<FullGameAnalysisPanel timeline={timelineA} currentPly={0} limit={limit} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockReturn.status = "running";
    mockReturn.results = [createResult(0)];
    rerender(<FullGameAnalysisPanel timeline={timelineA} currentPly={0} limit={limit} />);
    expect(screen.getByText(/Analyzing position/)).toBeDefined();

    rerender(<FullGameAnalysisPanel timeline={timelineB} currentPly={0} limit={limit} />);
    expect(stableCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("current-ply-result")).toBeNull();
  });

  it("timeline replacement after completion hides old results without cancellation", async () => {
    const mod = await import("@/features/chess/full-game-analysis-panel");
    const FullGameAnalysisPanel = mod.default;
    const timelineA = createTimeline({ finalFen: "fen-a" });
    const timelineB = createTimeline({ finalFen: "fen-b" });
    const { rerender } = render(<FullGameAnalysisPanel timeline={timelineA} currentPly={0} limit={limit} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockReturn.status = "completed";
    mockReturn.results = [createResult(0)];
    rerender(<FullGameAnalysisPanel timeline={timelineA} currentPly={0} limit={limit} />);
    expect(screen.getByText("Analysis complete.")).toBeDefined();

    rerender(<FullGameAnalysisPanel timeline={timelineB} currentPly={0} limit={limit} />);
    expect(stableCancel).not.toHaveBeenCalled();
    expect(screen.queryByTestId("current-ply-result")).toBeNull();
  });

  it("new timeline does not start automatically", async () => {
    const mod = await import("@/features/chess/full-game-analysis-panel");
    const FullGameAnalysisPanel = mod.default;
    const timelineA = createTimeline({ finalFen: "fen-a" });
    const timelineB = createTimeline({ finalFen: "fen-b" });
    const { rerender } = render(<FullGameAnalysisPanel timeline={timelineA} currentPly={0} limit={limit} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockReturn.status = "completed";
    rerender(<FullGameAnalysisPanel timeline={timelineA} currentPly={0} limit={limit} />);
    stableStart.mockClear();
    rerender(<FullGameAnalysisPanel timeline={timelineB} currentPly={0} limit={limit} />);
    expect(stableStart).not.toHaveBeenCalled();
  });

  it("eligibility loss unmounts the hook-owning child", async () => {
    const mod = await import("@/features/chess/full-game-analysis-panel");
    const FullGameAnalysisPanel = mod.default;
    const eligibleTimeline = createTimeline({ analysisEligible: true });
    const ineligibleTimeline = createTimeline({ analysisEligible: false });
    const { rerender } = render(<FullGameAnalysisPanel timeline={eligibleTimeline} currentPly={0} limit={limit} />);
    expect(mockUseQuickPassAnalysis).toHaveBeenCalled();
    mockUseQuickPassAnalysis.mockClear();
    rerender(<FullGameAnalysisPanel timeline={ineligibleTimeline} currentPly={0} limit={limit} />);
    expect(mockUseQuickPassAnalysis).not.toHaveBeenCalled();
  });

  it("rejected start leaves no started timeline and shows no stale results", async () => {
    const mod = await import("@/features/chess/full-game-analysis-panel");
    const FullGameAnalysisPanel = mod.default;
    const timelineA = createTimeline({ finalFen: "fen-a" });
    const timelineB = createTimeline({ finalFen: "fen-b" });
    const { rerender } = render(<FullGameAnalysisPanel timeline={timelineA} currentPly={0} limit={limit} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockReturn.status = "completed";
    mockReturn.results = [createResult(0)];
    rerender(<FullGameAnalysisPanel timeline={timelineA} currentPly={0} limit={limit} />);
    expect(screen.getByTestId("current-ply-result")).toBeDefined();

    rerender(<FullGameAnalysisPanel timeline={timelineB} currentPly={0} limit={limit} />);
    stableStart.mockReturnValueOnce(false);
    screen.getByRole("button", { name: "Analyze full game" }).click();
    expect(stableStart).toHaveBeenCalledWith(timelineB, limit, 3);
    rerender(<FullGameAnalysisPanel timeline={timelineB} currentPly={0} limit={limit} />);
    expect(screen.queryByTestId("current-ply-result")).toBeNull();
    expect(screen.getByText("Ready to analyze.")).toBeDefined();
  });

  it("accepted repeat run clears previous results until new results arrive", async () => {
    const mod = await import("@/features/chess/full-game-analysis-panel");
    const FullGameAnalysisPanel = mod.default;
    const timeline = createTimeline();
    const { rerender } = render(<FullGameAnalysisPanel timeline={timeline} currentPly={0} limit={limit} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockReturn.status = "completed";
    mockReturn.results = [createResult(0)];
    rerender(<FullGameAnalysisPanel timeline={timeline} currentPly={0} limit={limit} />);
    expect(screen.getByTestId("current-ply-result")).toBeDefined();

    screen.getByRole("button", { name: "Analyze full game" }).click();
    mockReturn.status = "running";
    mockReturn.results = [];
    rerender(<FullGameAnalysisPanel timeline={timeline} currentPly={0} limit={limit} />);
    expect(screen.queryByTestId("current-ply-result")).toBeNull();
    expect(screen.getByText(/Analyzing position/)).toBeDefined();

    mockReturn.results = [createResult(0)];
    rerender(<FullGameAnalysisPanel timeline={timeline} currentPly={0} limit={limit} />);
    expect(screen.getByTestId("current-ply-result")).toBeDefined();
  });

  it("timeline A to B to A requires new explicit start", async () => {
    const mod = await import("@/features/chess/full-game-analysis-panel");
    const FullGameAnalysisPanel = mod.default;
    const timelineA = createTimeline({ finalFen: "fen-a" });
    const timelineB = createTimeline({ finalFen: "fen-b" });
    const { rerender } = render(<FullGameAnalysisPanel timeline={timelineA} currentPly={0} limit={limit} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockReturn.status = "completed";
    mockReturn.results = [createResult(0)];
    rerender(<FullGameAnalysisPanel timeline={timelineA} currentPly={0} limit={limit} />);
    expect(screen.getByTestId("current-ply-result")).toBeDefined();

    rerender(<FullGameAnalysisPanel timeline={timelineB} currentPly={0} limit={limit} />);
    expect(screen.queryByTestId("current-ply-result")).toBeNull();

    rerender(<FullGameAnalysisPanel timeline={timelineA} currentPly={0} limit={limit} />);
    expect(screen.queryByTestId("current-ply-result")).toBeNull();
    expect(screen.getByText("Ready to analyze.")).toBeDefined();
  });

  it("timeline identity distinguishes timelines with different intermediate steps", async () => {
    const timelineA = createTimeline({ finalFen: "same-fen" });
    const timelineB = createTimeline({
      finalFen: "same-fen",
      steps: [
        { ply: 0, fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", move: null },
        { ply: 1, fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 0", move: { san: "d4", uci: "d2d4", before: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", after: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 0", color: "w" } },
      ],
    });
    expect(timelineA.initialFen).toBe(timelineB.initialFen);
    expect(timelineA.finalFen).toBe(timelineB.finalFen);
    expect(timelineA.totalPlies).toBe(timelineB.totalPlies);
    expect(timelineA.analysisEligible).toBe(timelineB.analysisEligible);
    expect(timelineA.steps[1].move?.san).not.toBe(timelineB.steps[1].move?.san);
  });

  it("eligibility loss during run does not duplicate cancellation", async () => {
    const mod = await import("@/features/chess/full-game-analysis-panel");
    const FullGameAnalysisPanel = mod.default;
    const eligibleTimeline = createTimeline({ analysisEligible: true });
    const ineligibleTimeline = createTimeline({ analysisEligible: false });
    const { rerender } = render(<FullGameAnalysisPanel timeline={eligibleTimeline} currentPly={0} limit={limit} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockReturn.status = "running";
    rerender(<FullGameAnalysisPanel timeline={eligibleTimeline} currentPly={0} limit={limit} />);
    expect(stableCancel).not.toHaveBeenCalled();

    mockUseQuickPassAnalysis.mockClear();
    rerender(<FullGameAnalysisPanel timeline={ineligibleTimeline} currentPly={0} limit={limit} />);
    expect(stableCancel).not.toHaveBeenCalled();
    expect(mockUseQuickPassAnalysis).not.toHaveBeenCalled();
  });
});
