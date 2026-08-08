import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import FullGameAnalysisPanel from "@/features/chess/full-game-analysis-panel";
import type { EngineAnalysisLimit } from "@/features/chess/engine";
import type { ReviewTimeline } from "@/features/chess/timeline";
import type { QuickPassCompletedJob } from "@/features/chess/quick-pass-runner";
import type { UseQuickPassAnalysis } from "@/features/chess/use-quick-pass-analysis";

type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

const stableStart = vi.fn(() => true);
const stableStartCriticalPass = vi.fn(() => true);
const stableCancel = vi.fn();

const mockAnalysisState: Mutable<UseQuickPassAnalysis> = {
  status: "ready",
  error: null,
  totalJobs: 0,
  completedJobs: 0,
  currentJobId: null,
  results: [],
  start: stableStart,
  startCriticalPass: stableStartCriticalPass,
  cancel: stableCancel,
};

function createTimeline(overrides: Partial<ReviewTimeline> = {}): ReviewTimeline {
  return {
    steps: [
      { ply: 0, fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", move: null },
      { ply: 1, fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 0", move: { san: "e4", from: "e2", to: "e4", before: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", after: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 0", color: "w" } },
    ],
    totalPlies: 1,
    initialFen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    finalFen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 0",
    analysisEligible: true,
    ...overrides,
  };
}

function createResult(ply: number): Mutable<QuickPassCompletedJob> {
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

function createMinimalResult(ply: number): Mutable<QuickPassCompletedJob> {
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
    vi.clearAllMocks();
    mockAnalysisState.status = "ready";
    mockAnalysisState.error = null;
    mockAnalysisState.totalJobs = 0;
    mockAnalysisState.completedJobs = 0;
    mockAnalysisState.currentJobId = null;
    mockAnalysisState.results = [];
    stableStart.mockClear();
    stableCancel.mockClear();
  });

  const defaultProps = {
    timeline: createTimeline(),
    currentPly: 0,
    limit,
    analysisState: mockAnalysisState,
  };

  it("renders eligibility message for ineligible timeline and does not invoke start or cancel", () => {
    render(<FullGameAnalysisPanel {...defaultProps} timeline={createTimeline({ analysisEligible: false })} />);
    expect(screen.getByText("Full-game analysis is available only for completed games.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Analyze full game" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(stableStart).not.toHaveBeenCalled();
    expect(stableCancel).not.toHaveBeenCalled();
  });

  it("eligible mount shows Analyze button but does not start automatically", () => {
    render(<FullGameAnalysisPanel {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Analyze full game" })).toBeDefined();
    expect(stableStart).not.toHaveBeenCalled();
  });

  it("loading disables Analyze", () => {
    mockAnalysisState.status = "loading";
    render(<FullGameAnalysisPanel {...defaultProps} />);
    const button = screen.getByRole("button", { name: "Analyze full game" });
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("Analyze forwards exact timeline, limit, and MultiPV", () => {
    const timeline = createTimeline();
    render(<FullGameAnalysisPanel {...defaultProps} timeline={timeline} multiPv={5} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();
    expect(stableStart).toHaveBeenCalledTimes(1);
    expect(stableStart).toHaveBeenCalledWith(timeline, limit, 5);
  });

  it("default MultiPV is 3", () => {
    const timeline = createTimeline();
    render(<FullGameAnalysisPanel {...defaultProps} timeline={timeline} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();
    expect(stableStart).toHaveBeenCalledWith(timeline, limit, 3);
  });

  it("running progress renders correct completed and total counts", () => {
    const { rerender } = render(<FullGameAnalysisPanel {...defaultProps} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockAnalysisState.status = "running";
    mockAnalysisState.totalJobs = 5;
    mockAnalysisState.completedJobs = 2;
    mockAnalysisState.currentJobId = "quick-pass-1";
    rerender(<FullGameAnalysisPanel {...defaultProps} />);

    expect(screen.getByText("Analyzing position quick-pass-1 (2/5)")).toBeDefined();
  });

  it("running exposes Cancel and delegates once", () => {
    const { rerender } = render(<FullGameAnalysisPanel {...defaultProps} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockAnalysisState.status = "running";
    rerender(<FullGameAnalysisPanel {...defaultProps} />);

    screen.getByRole("button", { name: "Cancel" }).click();
    expect(stableCancel).toHaveBeenCalledTimes(1);
  });

  it("completed state renders correctly", () => {
    const { rerender } = render(<FullGameAnalysisPanel {...defaultProps} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockAnalysisState.status = "completed";
    rerender(<FullGameAnalysisPanel {...defaultProps} />);

    expect(screen.getByText("Analysis complete.")).toBeDefined();
  });

  it("cancelled state renders correctly and preserves partial results", () => {
    const partial = createResult(0);
    const { rerender } = render(<FullGameAnalysisPanel {...defaultProps} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockAnalysisState.status = "cancelled";
    mockAnalysisState.results = [partial];
    rerender(<FullGameAnalysisPanel {...defaultProps} />);

    expect(screen.getByText("Analysis cancelled.")).toBeDefined();
    const resultContainer = screen.getByTestId("current-ply-result");
    expect(resultContainer.textContent).toContain("Ply:");
    expect(resultContainer.textContent).toContain("0");
  });

  it("error state renders the exact safe hook error", () => {
    const { rerender } = render(<FullGameAnalysisPanel {...defaultProps} />);
    mockAnalysisState.status = "error";
    mockAnalysisState.error = "Engine failure.";
    rerender(<FullGameAnalysisPanel {...defaultProps} />);

    expect(screen.getByText("Engine failure.")).toBeDefined();
  });

  it("current ply displays only its matching result", () => {
    const results = [createResult(0), createResult(1)];
    const { rerender } = render(<FullGameAnalysisPanel {...defaultProps} currentPly={0} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockAnalysisState.status = "completed";
    mockAnalysisState.results = results;
    rerender(<FullGameAnalysisPanel {...defaultProps} currentPly={1} />);

    const resultContainer = screen.getByTestId("current-ply-result");
    expect(resultContainer.textContent).toContain("Ply:");
    expect(resultContainer.textContent).toContain("1");
    expect(screen.queryByTestId("current-ply-result")?.textContent).not.toContain("Ply: 0");
  });

  it("changing current ply does not call start or cancel", () => {
    const { rerender } = render(<FullGameAnalysisPanel {...defaultProps} currentPly={0} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    const startCallsBefore = stableStart.mock.calls.length;
    const cancelCallsBefore = stableCancel.mock.calls.length;
    rerender(<FullGameAnalysisPanel {...defaultProps} currentPly={1} />);
    expect(stableStart).toHaveBeenCalledTimes(startCallsBefore);
    expect(stableCancel).toHaveBeenCalledTimes(cancelCallsBefore);
  });

  it("ranked candidate lines render in ascending order", () => {
    const result = createResult(0);
    result.candidateLines = [
      { rank: 3, info: { depth: 10, score: { type: "cp", value: 10, perspective: "side-to-move" }, pv: ["g1f3"] } },
      { rank: 1, info: { depth: 14, score: { type: "cp", value: 30, perspective: "side-to-move" }, pv: ["e2e4", "e7e5"] } },
      { rank: 2, info: { depth: 12, score: { type: "cp", value: 20, perspective: "side-to-move" }, pv: ["d2d4"] } },
    ];
    const { rerender } = render(<FullGameAnalysisPanel {...defaultProps} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockAnalysisState.status = "completed";
    mockAnalysisState.results = [result];
    rerender(<FullGameAnalysisPanel {...defaultProps} />);

    const rankElements = screen.getAllByText(/^Rank \d+:/);
    expect(rankElements[0].textContent).toBe("Rank 1:");
    expect(rankElements[1].textContent).toBe("Rank 2:");
    expect(rankElements[2].textContent).toBe("Rank 3:");
  });

  it("missing ranks and optional fields are not fabricated", () => {
    const result = createMinimalResult(0);
    const { rerender } = render(<FullGameAnalysisPanel {...defaultProps} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockAnalysisState.status = "completed";
    mockAnalysisState.results = [result];
    rerender(<FullGameAnalysisPanel {...defaultProps} />);

    expect(screen.getByText("Rank 1:")).toBeDefined();
    expect(screen.queryByText("Rank 2:")).toBeNull();
    const candidateContainer = screen.getByText("Candidate lines:").closest("div");
    expect(candidateContainer?.textContent).not.toContain("Score:");
  });

  it("best move and ponder render when present", () => {
    const result = createResult(0);
    result.bestMove = { move: "e2e4", ponder: "e7e5" };
    const { rerender } = render(<FullGameAnalysisPanel {...defaultProps} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockAnalysisState.status = "completed";
    mockAnalysisState.results = [result];
    rerender(<FullGameAnalysisPanel {...defaultProps} />);

    const resultContainer = screen.getByTestId("current-ply-result");
    expect(resultContainer.textContent).toContain("Best move:");
    expect(resultContainer.textContent).toContain("e2e4");
    expect(resultContainer.textContent).toContain("ponder: e7e5");
  });

  it("timeline replacement during running cancels once and hides old results", () => {
    const timelineA = createTimeline({ finalFen: "fen-a" });
    const timelineB = createTimeline({ finalFen: "fen-b" });
    const { rerender } = render(<FullGameAnalysisPanel {...defaultProps} timeline={timelineA} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockAnalysisState.status = "running";
    mockAnalysisState.results = [createResult(0)];
    rerender(<FullGameAnalysisPanel {...defaultProps} timeline={timelineA} />);
    expect(screen.getByText(/Analyzing position/)).toBeDefined();

    rerender(<FullGameAnalysisPanel {...defaultProps} timeline={timelineB} />);
    expect(stableCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("current-ply-result")).toBeNull();
  });

  it("timeline replacement after completion hides old results without cancellation", () => {
    const timelineA = createTimeline({ finalFen: "fen-a" });
    const timelineB = createTimeline({ finalFen: "fen-b" });
    const { rerender } = render(<FullGameAnalysisPanel {...defaultProps} timeline={timelineA} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockAnalysisState.status = "completed";
    mockAnalysisState.results = [createResult(0)];
    rerender(<FullGameAnalysisPanel {...defaultProps} timeline={timelineA} />);
    expect(screen.getByText("Analysis complete.")).toBeDefined();

    rerender(<FullGameAnalysisPanel {...defaultProps} timeline={timelineB} />);
    expect(stableCancel).not.toHaveBeenCalled();
    expect(screen.queryByTestId("current-ply-result")).toBeNull();
  });

  it("new timeline does not start automatically", () => {
    const timelineA = createTimeline({ finalFen: "fen-a" });
    const timelineB = createTimeline({ finalFen: "fen-b" });
    const { rerender } = render(<FullGameAnalysisPanel {...defaultProps} timeline={timelineA} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockAnalysisState.status = "completed";
    stableStart.mockClear();
    rerender(<FullGameAnalysisPanel {...defaultProps} timeline={timelineB} />);
    expect(stableStart).not.toHaveBeenCalled();
  });

  it("rejected start leaves no started timeline and shows no stale results", () => {
    const timelineA = createTimeline({ finalFen: "fen-a" });
    const timelineB = createTimeline({ finalFen: "fen-b" });
    const { rerender } = render(<FullGameAnalysisPanel {...defaultProps} timeline={timelineA} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockAnalysisState.status = "completed";
    mockAnalysisState.results = [createResult(0)];
    rerender(<FullGameAnalysisPanel {...defaultProps} timeline={timelineA} />);
    expect(screen.getByTestId("current-ply-result")).toBeDefined();

    rerender(<FullGameAnalysisPanel {...defaultProps} timeline={timelineB} />);
    stableStart.mockReturnValueOnce(false);
    screen.getByRole("button", { name: "Analyze full game" }).click();
    expect(stableStart).toHaveBeenCalledWith(timelineB, limit, 3);
    rerender(<FullGameAnalysisPanel {...defaultProps} timeline={timelineB} />);
    expect(screen.queryByTestId("current-ply-result")).toBeNull();
    expect(screen.getByText("Ready to analyze.")).toBeDefined();
  });

  it("accepted repeat run clears previous results until new results arrive", () => {
    const timeline = createTimeline();
    const { rerender } = render(<FullGameAnalysisPanel {...defaultProps} timeline={timeline} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockAnalysisState.status = "completed";
    mockAnalysisState.results = [createResult(0)];
    rerender(<FullGameAnalysisPanel {...defaultProps} timeline={timeline} />);
    expect(screen.getByTestId("current-ply-result")).toBeDefined();

    screen.getByRole("button", { name: "Analyze full game" }).click();
    mockAnalysisState.status = "running";
    mockAnalysisState.results = [];
    rerender(<FullGameAnalysisPanel {...defaultProps} timeline={timeline} />);
    expect(screen.queryByTestId("current-ply-result")).toBeNull();
    expect(screen.getByText(/Analyzing position/)).toBeDefined();

    mockAnalysisState.results = [createResult(0)];
    rerender(<FullGameAnalysisPanel {...defaultProps} timeline={timeline} />);
    expect(screen.getByTestId("current-ply-result")).toBeDefined();
  });

  it("timeline A to B to A requires new explicit start", () => {
    const timelineA = createTimeline({ finalFen: "fen-a" });
    const timelineB = createTimeline({ finalFen: "fen-b" });
    const { rerender } = render(<FullGameAnalysisPanel {...defaultProps} timeline={timelineA} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();

    mockAnalysisState.status = "completed";
    mockAnalysisState.results = [createResult(0)];
    rerender(<FullGameAnalysisPanel {...defaultProps} timeline={timelineA} />);
    expect(screen.getByTestId("current-ply-result")).toBeDefined();

    rerender(<FullGameAnalysisPanel {...defaultProps} timeline={timelineB} />);
    expect(screen.queryByTestId("current-ply-result")).toBeNull();

    rerender(<FullGameAnalysisPanel {...defaultProps} timeline={timelineA} />);
    expect(screen.queryByTestId("current-ply-result")).toBeNull();
    expect(screen.getByText("Ready to analyze.")).toBeDefined();
  });

  it("timeline identity distinguishes timelines with different intermediate steps", () => {
    const timelineA = createTimeline({ finalFen: "same-fen" });
    const timelineB = createTimeline({
      finalFen: "same-fen",
      steps: [
        { ply: 0, fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", move: null },
        { ply: 1, fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 0", move: { san: "d4", from: "d2", to: "d4", before: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", after: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 0", color: "w" } },
      ],
    });
    expect(timelineA.initialFen).toBe(timelineB.initialFen);
    expect(timelineA.finalFen).toBe(timelineB.finalFen);
    expect(timelineA.totalPlies).toBe(timelineB.totalPlies);
    expect(timelineA.analysisEligible).toBe(timelineB.analysisEligible);
    expect(timelineA.steps[1].move?.san).not.toBe(timelineB.steps[1].move?.san);
  });

  it("eligibility loss shows ineligible message and does not invoke start or cancel", () => {
    const eligibleTimeline = createTimeline({ analysisEligible: true });
    const ineligibleTimeline = createTimeline({ analysisEligible: false });
    const { rerender } = render(<FullGameAnalysisPanel timeline={eligibleTimeline} currentPly={0} limit={limit} analysisState={mockAnalysisState} />);
    expect(screen.getByRole("button", { name: "Analyze full game" })).toBeDefined();
    rerender(<FullGameAnalysisPanel timeline={ineligibleTimeline} currentPly={0} limit={limit} analysisState={mockAnalysisState} />);
    expect(screen.queryByRole("button", { name: "Analyze full game" })).toBeNull();
    expect(screen.getByText("Full-game analysis is available only for completed games.")).toBeDefined();
    expect(stableStart).not.toHaveBeenCalled();
    expect(stableCancel).not.toHaveBeenCalled();
  });

  it("eligibility loss during run does not call cancel", () => {
    const eligibleTimeline = createTimeline({ analysisEligible: true });
    const ineligibleTimeline = createTimeline({ analysisEligible: false });
    const { rerender } = render(<FullGameAnalysisPanel timeline={eligibleTimeline} currentPly={0} limit={limit} analysisState={mockAnalysisState} />);
    screen.getByRole("button", { name: "Analyze full game" }).click();
    mockAnalysisState.status = "running";
    rerender(<FullGameAnalysisPanel timeline={eligibleTimeline} currentPly={0} limit={limit} analysisState={mockAnalysisState} />);
    expect(stableCancel).not.toHaveBeenCalled();

    rerender(<FullGameAnalysisPanel timeline={ineligibleTimeline} currentPly={0} limit={limit} analysisState={mockAnalysisState} />);
    expect(stableCancel).not.toHaveBeenCalled();
  });
});
