import { describe, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import AnalysisPanel from "@/features/chess/analysis-panel";
import type { EngineAnalysisLimit } from "@/features/chess/engine";

const DEPTH_LIMIT: EngineAnalysisLimit = { kind: "depth", value: 14 };

const { mockUseEngineAnalysis, lifecycleEvents } = vi.hoisted(() => {
  return {
    mockUseEngineAnalysis: vi.fn(),
    lifecycleEvents: vi.fn(),
  };
});

vi.mock("@/features/chess/use-engine-analysis", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  return {
    useEngineAnalysis: (...args: unknown[]) => {
      React.useEffect(() => {
        lifecycleEvents("mount");
        return () => lifecycleEvents("cleanup");
      }, []);
      return mockUseEngineAnalysis(...args);
    },
  };
});

function setHookValue(
  mock: ReturnType<typeof vi.fn>,
  value: {
    status: string;
    error: string | null;
    lastInfo: unknown;
    lastInfoRequestId: string | null;
    bestMove: { move: string | null; ponder: string | null } | null;
    bestMoveRequestId: string | null;
    analyze: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }
) {
  mock.mockReturnValue(value);
}

describe("AnalysisPanel", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("when analysisEligible is false", () => {
    it("renders the completion restriction message", () => {
      render(
        <AnalysisPanel fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1" analysisEligible={false} limit={DEPTH_LIMIT} />
      );

      expect(
        screen.getByText("Analysis is available only for completed games.")
      ).toBeInTheDocument();
    });

    it("does not render an Analyze or Stop action", () => {
      render(
        <AnalysisPanel fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1" analysisEligible={false} limit={DEPTH_LIMIT} />
      );

      expect(screen.queryByRole("button", { name: "Analyze position" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
    });
  });

  describe("when analysisEligible is true", () => {
    it("invokes the hook and does not analyze automatically", () => {
      const analyze = vi.fn();
      const stop = vi.fn();
      setHookValue(mockUseEngineAnalysis, {
        status: "ready",
        error: null,
        lastInfo: null,
        lastInfoRequestId: null,
        bestMove: null,
        bestMoveRequestId: null,
        analyze,
        stop,
      });

      render(
        <AnalysisPanel fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1" analysisEligible={true} limit={DEPTH_LIMIT} />
      );

      expect(mockUseEngineAnalysis).toHaveBeenCalled();
      expect(analyze).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
    });

    it("does not render results before manual analysis even with old hook values", () => {
      const analyze = vi.fn();
      const stop = vi.fn();
      setHookValue(mockUseEngineAnalysis, {
        status: "ready",
        error: null,
        lastInfo: { depth: 10 },
        lastInfoRequestId: "req-old",
        bestMove: { move: "e2e4", ponder: null },
        bestMoveRequestId: "req-old",
        analyze,
        stop,
      });

      render(
        <AnalysisPanel fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1" analysisEligible={true} limit={DEPTH_LIMIT} />
      );

      const results = screen.getByTestId("analysis-results");
      expect(results.textContent).toBe("");
    });

    it("forwards the exact FEN and limit when Analyze is activated", async () => {
      const analyze = vi.fn();
      const stop = vi.fn();
      setHookValue(mockUseEngineAnalysis, {
        status: "ready",
        error: null,
        lastInfo: null,
        lastInfoRequestId: null,
        bestMove: null,
        bestMoveRequestId: null,
        analyze,
        stop,
      });

      const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
      render(
        <AnalysisPanel fen={fen} analysisEligible={true} limit={DEPTH_LIMIT} />
      );

      await act(async () => {
        screen.getByRole("button", { name: "Analyze position" }).click();
      });

      expect(analyze).toHaveBeenCalledTimes(1);
      expect(analyze).toHaveBeenCalledWith(fen, DEPTH_LIMIT);
    });

    it("does not activate when analyze returns null", async () => {
      const analyze = vi.fn(() => null);
      const stop = vi.fn();
      setHookValue(mockUseEngineAnalysis, {
        status: "ready",
        error: null,
        lastInfo: { depth: 10 },
        lastInfoRequestId: "req-1",
        bestMove: null,
        bestMoveRequestId: null,
        analyze,
        stop,
      });

      render(
        <AnalysisPanel fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1" analysisEligible={true} limit={DEPTH_LIMIT} />
      );

      await act(async () => {
        screen.getByRole("button", { name: "Analyze position" }).click();
      });

      expect(analyze).toHaveBeenCalledTimes(1);
      const results = screen.getByTestId("analysis-results");
      expect(results.textContent).toBe("");
    });

    it("disables Analyze while loading", () => {
      setHookValue(mockUseEngineAnalysis, {
        status: "loading",
        error: null,
        lastInfo: null,
        lastInfoRequestId: null,
        bestMove: null,
        bestMoveRequestId: null,
        analyze: vi.fn(),
        stop: vi.fn(),
      });

      render(
        <AnalysisPanel fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1" analysisEligible={true} limit={DEPTH_LIMIT} />
      );

      expect(screen.getByRole("button", { name: "Analyze position" })).toBeDisabled();
    });

    it("exposes Stop while analyzing and delegates exactly once", async () => {
      const stop = vi.fn();
      setHookValue(mockUseEngineAnalysis, {
        status: "analyzing",
        error: null,
        lastInfo: null,
        lastInfoRequestId: null,
        bestMove: null,
        bestMoveRequestId: null,
        analyze: vi.fn(),
        stop,
      });

      render(
        <AnalysisPanel fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1" analysisEligible={true} limit={DEPTH_LIMIT} />
      );

      await act(async () => {
        screen.getByRole("button", { name: "Stop" }).click();
      });

      expect(stop).toHaveBeenCalledTimes(1);
    });

    it("renders deterministic error text when status is error", () => {
      setHookValue(mockUseEngineAnalysis, {
        status: "error",
        error: "Engine setup failed.",
        lastInfo: null,
        lastInfoRequestId: null,
        bestMove: null,
        bestMoveRequestId: null,
        analyze: vi.fn(),
        stop: vi.fn(),
      });

      render(
        <AnalysisPanel fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1" analysisEligible={true} limit={DEPTH_LIMIT} />
      );

      expect(screen.getByText("Engine setup failed.")).toBeInTheDocument();
    });

    it("renders info when request ID matches the active request", async () => {
      const requestId = "req-1";
      const analyze = vi.fn(() => requestId);
      setHookValue(mockUseEngineAnalysis, {
        status: "ready",
        error: null,
        lastInfo: { depth: 14, nodes: 1200, timeMs: 250 },
        lastInfoRequestId: requestId,
        bestMove: null,
        bestMoveRequestId: null,
        analyze,
        stop: vi.fn(),
      });

      render(
        <AnalysisPanel fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1" analysisEligible={true} limit={DEPTH_LIMIT} />
      );

      await act(async () => {
        screen.getByRole("button", { name: "Analyze position" }).click();
      });

      const results = screen.getByTestId("analysis-results");
      expect(results.textContent).toContain("14");
      expect(results.textContent).toContain("1,200");
      expect(results.textContent).toContain("250ms");
    });

    it("hides info when request ID does not match the active request", async () => {
      const analyze = vi.fn(() => "req-1");
      setHookValue(mockUseEngineAnalysis, {
        status: "ready",
        error: null,
        lastInfo: { depth: 14 },
        lastInfoRequestId: "req-other",
        bestMove: null,
        bestMoveRequestId: null,
        analyze,
        stop: vi.fn(),
      });

      render(
        <AnalysisPanel fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1" analysisEligible={true} limit={DEPTH_LIMIT} />
      );

      await act(async () => {
        screen.getByRole("button", { name: "Analyze position" }).click();
      });

      const results = screen.getByTestId("analysis-results");
      expect(results.textContent).toBe("");
    });

    it("renders best move and ponder when request ID matches the active request", async () => {
      const requestId = "req-1";
      const analyze = vi.fn(() => requestId);
      setHookValue(mockUseEngineAnalysis, {
        status: "ready",
        error: null,
        lastInfo: null,
        lastInfoRequestId: null,
        bestMove: { move: "e2e4", ponder: "e7e5" },
        bestMoveRequestId: requestId,
        analyze,
        stop: vi.fn(),
      });

      render(
        <AnalysisPanel fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1" analysisEligible={true} limit={DEPTH_LIMIT} />
      );

      await act(async () => {
        screen.getByRole("button", { name: "Analyze position" }).click();
      });

      const results = screen.getByTestId("analysis-results");
      expect(results.textContent).toContain("Best move:");
      expect(results.textContent).toContain("e2e4");
      expect(results.textContent).toContain("ponder: e7e5");
    });

    it("hides best move when request ID does not match the active request", async () => {
      const analyze = vi.fn(() => "req-1");
      setHookValue(mockUseEngineAnalysis, {
        status: "ready",
        error: null,
        lastInfo: null,
        lastInfoRequestId: null,
        bestMove: { move: "e2e4", ponder: "e7e5" },
        bestMoveRequestId: "req-other",
        analyze,
        stop: vi.fn(),
      });

      render(
        <AnalysisPanel fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1" analysisEligible={true} limit={DEPTH_LIMIT} />
      );

      await act(async () => {
        screen.getByRole("button", { name: "Analyze position" }).click();
      });

      const results = screen.getByTestId("analysis-results");
      expect(results.textContent).toBe("");
    });

    it("does not call stop when FEN changes without an active request", async () => {
      const stop = vi.fn();
      setHookValue(mockUseEngineAnalysis, {
        status: "ready",
        error: null,
        lastInfo: null,
        lastInfoRequestId: null,
        bestMove: null,
        bestMoveRequestId: null,
        analyze: vi.fn(),
        stop,
      });

      const { rerender } = render(
        <AnalysisPanel fen="fenA" analysisEligible={true} limit={DEPTH_LIMIT} />
      );

      expect(stop).not.toHaveBeenCalled();

      rerender(<AnalysisPanel fen="fenB" analysisEligible={true} limit={DEPTH_LIMIT} />);

      expect(stop).not.toHaveBeenCalled();
    });

    it("calls stop once and hides results when FEN changes with an active request", async () => {
      const requestId = "req-1";
      const analyze = vi.fn(() => requestId);
      const stop = vi.fn();
      setHookValue(mockUseEngineAnalysis, {
        status: "ready",
        error: null,
        lastInfo: { depth: 14 },
        lastInfoRequestId: requestId,
        bestMove: null,
        bestMoveRequestId: null,
        analyze,
        stop,
      });

      const { rerender } = render(
        <AnalysisPanel fen="fenA" analysisEligible={true} limit={DEPTH_LIMIT} />
      );

      await act(async () => {
        screen.getByRole("button", { name: "Analyze position" }).click();
      });

      expect(screen.getByTestId("analysis-results").textContent).toContain("14");

      rerender(<AnalysisPanel fen="fenB" analysisEligible={true} limit={DEPTH_LIMIT} />);

      expect(stop).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("analysis-results").textContent).toBe("");
    });

    it("handles A -> B -> A FEN transitions correctly", async () => {
      const requestIdA = "req-a";
      const requestIdB = "req-b";
      const stop = vi.fn();
      const analyzeA = vi.fn(() => requestIdA);
      const analyzeB = vi.fn(() => requestIdB);
      setHookValue(mockUseEngineAnalysis, {
        status: "ready",
        error: null,
        lastInfo: { depth: 14 },
        lastInfoRequestId: requestIdA,
        bestMove: null,
        bestMoveRequestId: null,
        analyze: analyzeA,
        stop,
      });

      const { rerender } = render(
        <AnalysisPanel fen="fenA" analysisEligible={true} limit={DEPTH_LIMIT} />
      );

      await act(async () => {
        screen.getByRole("button", { name: "Analyze position" }).click();
      });

      expect(screen.getByTestId("analysis-results").textContent).toContain("14");

      rerender(<AnalysisPanel fen="fenB" analysisEligible={true} limit={DEPTH_LIMIT} />);

      expect(stop).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("analysis-results").textContent).toBe("");

      setHookValue(mockUseEngineAnalysis, {
        status: "ready",
        error: null,
        lastInfo: { depth: 20 },
        lastInfoRequestId: requestIdB,
        bestMove: null,
        bestMoveRequestId: null,
        analyze: analyzeB,
        stop,
      });

      rerender(<AnalysisPanel fen="fenB" analysisEligible={true} limit={DEPTH_LIMIT} />);

      await act(async () => {
        screen.getByRole("button", { name: "Analyze position" }).click();
      });

      expect(screen.getByTestId("analysis-results").textContent).toContain("20");

      rerender(<AnalysisPanel fen="fenA" analysisEligible={true} limit={DEPTH_LIMIT} />);

      expect(stop).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("analysis-results").textContent).toBe("");
    });

    it("hides late old-request values and shows new-request values", async () => {
      const requestId1 = "req-1";
      const requestId2 = "req-2";
      const analyze = vi.fn();
      const stop = vi.fn();

      analyze.mockReturnValueOnce(requestId1).mockReturnValueOnce(requestId2);

      setHookValue(mockUseEngineAnalysis, {
        status: "ready",
        error: null,
        lastInfo: { depth: 10 },
        lastInfoRequestId: requestId1,
        bestMove: null,
        bestMoveRequestId: null,
        analyze,
        stop,
      });

      const { rerender } = render(
        <AnalysisPanel fen="fenA" analysisEligible={true} limit={DEPTH_LIMIT} />
      );

      await act(async () => {
        screen.getByRole("button", { name: "Analyze position" }).click();
      });

      expect(screen.getByTestId("analysis-results").textContent).toContain("10");

      setHookValue(mockUseEngineAnalysis, {
        status: "ready",
        error: null,
        lastInfo: { depth: 20 },
        lastInfoRequestId: "req-old",
        bestMove: { move: "old" },
        bestMoveRequestId: "req-old",
        analyze,
        stop,
      });

      rerender(<AnalysisPanel fen="fenA" analysisEligible={true} limit={DEPTH_LIMIT} />);

      const resultsAfterLate = screen.getByTestId("analysis-results");
      expect(resultsAfterLate.textContent).not.toContain("10");
      expect(resultsAfterLate.textContent).not.toContain("20");
      expect(resultsAfterLate.textContent).not.toContain("old");

      setHookValue(mockUseEngineAnalysis, {
        status: "ready",
        error: null,
        lastInfo: { depth: 30 },
        lastInfoRequestId: requestId2,
        bestMove: { move: "new" },
        bestMoveRequestId: requestId2,
        analyze,
        stop,
      });

      rerender(<AnalysisPanel fen="fenA" analysisEligible={true} limit={DEPTH_LIMIT} />);

      await act(async () => {
        screen.getByRole("button", { name: "Analyze position" }).click();
      });

      const resultsAfterNew = screen.getByTestId("analysis-results");
      expect(resultsAfterNew.textContent).toContain("30");
      expect(resultsAfterNew.textContent).toContain("new");
    });

    it("keeps the eligible child mounted across FEN changes", async () => {
      const analyze = vi.fn(() => "req-1");
      const stop = vi.fn();
      setHookValue(mockUseEngineAnalysis, {
        status: "ready",
        error: null,
        lastInfo: { depth: 14 },
        lastInfoRequestId: "req-1",
        bestMove: null,
        bestMoveRequestId: null,
        analyze,
        stop,
      });

      const { rerender } = render(
        <AnalysisPanel fen="fenA" analysisEligible={true} limit={DEPTH_LIMIT} />
      );

      expect(lifecycleEvents).toHaveBeenCalledWith("mount");
      lifecycleEvents.mockClear();

      await act(async () => {
        screen.getByRole("button", { name: "Analyze position" }).click();
      });

      rerender(<AnalysisPanel fen="fenB" analysisEligible={true} limit={DEPTH_LIMIT} />);

      expect(lifecycleEvents).not.toHaveBeenCalledWith("cleanup");
      expect(lifecycleEvents).not.toHaveBeenCalledWith("mount");
    });

    it("unmounts the eligible child when eligibility is lost", async () => {
      const analyze = vi.fn(() => "req-1");
      const stop = vi.fn();
      setHookValue(mockUseEngineAnalysis, {
        status: "ready",
        error: null,
        lastInfo: { depth: 14 },
        lastInfoRequestId: "req-1",
        bestMove: null,
        bestMoveRequestId: null,
        analyze,
        stop,
      });

      const { rerender } = render(
        <AnalysisPanel fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1" analysisEligible={true} limit={DEPTH_LIMIT} />
      );

      expect(lifecycleEvents).toHaveBeenCalledWith("mount");
      lifecycleEvents.mockClear();

      await act(async () => {
        screen.getByRole("button", { name: "Analyze position" }).click();
      });

      rerender(
        <AnalysisPanel fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1" analysisEligible={false} limit={DEPTH_LIMIT} />
      );

      expect(lifecycleEvents).toHaveBeenCalledWith("cleanup");
      expect(screen.queryByRole("region", { name: "Position analysis" })).not.toBeInTheDocument();
      expect(screen.getByText("Analysis is available only for completed games.")).toBeInTheDocument();
    });
  });
});
