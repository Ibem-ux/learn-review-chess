import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
  GamePerformance,
  PlayerPerformance,
} from "@/features/chess/game-performance";
import { GamePerformanceSummary } from "@/features/chess/game-performance-summary";
import { MOVE_CLASSIFICATION_ORDER } from "@/features/chess/move-classification";

function makePlayerPerformance(
  overrides?: Partial<PlayerPerformance>
): PlayerPerformance {
  return {
    mover: "white",
    totalMoves: 20,
    countedMoves: 20,
    accuracyMoves: 20,
    averageAccuracy: 85.432,
    phaseMoves: {
      opening: 10,
      middlegame: 10,
      endgame: 0,
    },
    phaseAccuracy: {
      opening: 90.0,
      middlegame: 80.86,
      endgame: null,
    },
    counts: {
      brilliant: 1,
      great: 2,
      best: 5,
      excellent: 4,
      good: 3,
      inaccuracy: 2,
      mistake: 1,
      blunder: 1,
      unclassified: 1,
    },
    averageCentipawnLoss: 25.4,
    ...overrides,
  };
}

function makeGamePerformance(
  whiteOverrides?: Partial<PlayerPerformance>,
  blackOverrides?: Partial<PlayerPerformance>
): GamePerformance {
  return {
    white: makePlayerPerformance({ mover: "white", ...whiteOverrides }),
    black: makePlayerPerformance({ mover: "black", ...blackOverrides }),
  };
}

describe("GamePerformanceSummary", () => {
  it("renders run-an-analysis message and no white performance block when performance is null", () => {
    render(<GamePerformanceSummary performance={null} />);
    expect(
      screen.getByText(/full-game analysis/i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId("performance-white")).toBeNull();
  });

  it("renders both player blocks when performance is populated", () => {
    const perf = makeGamePerformance();
    render(<GamePerformanceSummary performance={perf} />);
    expect(screen.getByTestId("performance-white")).toBeInTheDocument();
    expect(screen.getByTestId("performance-black")).toBeInTheDocument();
  });

  it("renders White block before Black block in document order", () => {
    const perf = makeGamePerformance();
    render(<GamePerformanceSummary performance={perf} />);
    const whiteBlock = screen.getByTestId("performance-white");
    const blackBlock = screen.getByTestId("performance-black");
    expect(
      whiteBlock.compareDocumentPosition(blackBlock) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0);
  });

  it("renders White accuracy rounded to one decimal place", () => {
    const perf = makeGamePerformance({ averageAccuracy: 85.432 });
    render(<GamePerformanceSummary performance={perf} />);
    const whiteBlock = screen.getByTestId("performance-white");
    expect(whiteBlock).toHaveTextContent("85.4%");
  });

  it("renders Not enough data. when average accuracy is null", () => {
    const perf = makeGamePerformance({ averageAccuracy: null });
    render(<GamePerformanceSummary performance={perf} />);
    const whiteBlock = screen.getByTestId("performance-white");
    expect(whiteBlock).toHaveTextContent("Not enough data.");
  });

  it("renders a rating estimate containing the word estimate when data is sufficient", () => {
    const perf = makeGamePerformance({
      averageAccuracy: 90.0,
      accuracyMoves: 10,
    });
    render(<GamePerformanceSummary performance={perf} />);
    const whiteBlock = screen.getByTestId("performance-white");
    expect(whiteBlock).toHaveTextContent(/estimate/i);
  });

  it("renders Not enough data. when rating estimate is null due to insufficient moves", () => {
    const perf = makeGamePerformance({
      averageAccuracy: 90.0,
      accuracyMoves: 2,
    });
    render(<GamePerformanceSummary performance={perf} />);
    const whiteBlock = screen.getByTestId("performance-white");
    expect(whiteBlock).toHaveTextContent("Not enough data.");
  });

  it("renders count rows in MOVE_CLASSIFICATION_ORDER sequence when all counts are non-zero", () => {
    const perf = makeGamePerformance({
      counts: {
        brilliant: 1,
        great: 1,
        best: 1,
        excellent: 1,
        good: 1,
        inaccuracy: 1,
        mistake: 1,
        blunder: 1,
        unclassified: 1,
      },
    });
    render(<GamePerformanceSummary performance={perf} />);
    const whiteBlock = screen.getByTestId("performance-white");
    const countRows = whiteBlock.querySelectorAll('[data-testid="count-row"]');
    expect(countRows.length).toBe(MOVE_CLASSIFICATION_ORDER.length);

    const renderedTexts = Array.from(countRows).map((row) => row.textContent);
    expect(renderedTexts.length).toBe(MOVE_CLASSIFICATION_ORDER.length);
    expect(renderedTexts[0]).toContain("Brilliant");
    expect(renderedTexts[1]).toContain("Great");
    expect(renderedTexts[renderedTexts.length - 1]).toContain("Unclassified");
  });

  it("omits count row when classification count is zero", () => {
    const perf = makeGamePerformance({
      counts: {
        brilliant: 0,
        great: 1,
        best: 0,
        excellent: 0,
        good: 0,
        inaccuracy: 0,
        mistake: 0,
        blunder: 0,
        unclassified: 0,
      },
    });
    render(<GamePerformanceSummary performance={perf} />);
    const whiteBlock = screen.getByTestId("performance-white");
    const countRows = whiteBlock.querySelectorAll('[data-testid="count-row"]');
    expect(countRows.length).toBe(1);
    expect(countRows[0]).toHaveTextContent("Great move");
  });

  it("renders all three phases and shows Not enough data. for null phase accuracy", () => {
    const perf = makeGamePerformance({
      phaseAccuracy: {
        opening: 95.2,
        middlegame: 80.0,
        endgame: null,
      },
    });
    render(<GamePerformanceSummary performance={perf} />);
    const whiteBlock = screen.getByTestId("performance-white");
    expect(whiteBlock).toHaveTextContent("Opening: 95.2%");
    expect(whiteBlock).toHaveTextContent("Middlegame: 80.0%");
    expect(whiteBlock).toHaveTextContent("Endgame: Not enough data.");
  });

  it("renders White and Black values in their respective blocks without swapping", () => {
    const perf = makeGamePerformance(
      { averageAccuracy: 99.1 },
      { averageAccuracy: 42.7 }
    );
    render(<GamePerformanceSummary performance={perf} />);
    const whiteBlock = screen.getByTestId("performance-white");
    const blackBlock = screen.getByTestId("performance-black");

    expect(whiteBlock).toHaveTextContent("99.1%");
    expect(whiteBlock).not.toHaveTextContent("42.7%");

    expect(blackBlock).toHaveTextContent("42.7%");
    expect(blackBlock).not.toHaveTextContent("99.1%");
  });

  it("renders classification name exactly once in a count row", () => {
    const perf = makeGamePerformance({
      counts: {
        brilliant: 0,
        great: 0,
        best: 0,
        excellent: 0,
        good: 0,
        inaccuracy: 0,
        mistake: 0,
        blunder: 1,
        unclassified: 0,
      },
    });
    render(<GamePerformanceSummary performance={perf} />);
    const whiteBlock = screen.getByTestId("performance-white");
    const countRow = whiteBlock.querySelector('[data-testid="count-row"]');
    const text = countRow?.textContent ?? "";
    const occurrences = text.match(/Blunder/g) ?? [];
    expect(occurrences.length).toBe(1);
    expect(text).toBe("Blunder(1)");
  });
});
