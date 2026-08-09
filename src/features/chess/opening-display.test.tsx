import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { parsePgn } from "@/features/chess/pgn";
import { buildTimeline, type ReviewTimeline } from "@/features/chess/timeline";
import ReviewBoard from "@/features/chess/ReviewBoard";
import { OpeningDisplay } from "@/features/chess/opening-display";

vi.mock("react-chessboard", () => import("@/features/chess/__mocks__/react-chessboard"));

vi.mock("@/features/chess/full-game-analysis-panel", () => ({
  default: function MockFullGameAnalysisPanel() {
    return <div data-testid="mock-full-game-analysis-panel" />;
  },
}));

vi.mock("@/features/chess/engine-controller", () => ({
  EngineController: vi.fn(function MockEngineController() {
    return {
      status: "ready",
      subscribe: vi.fn(() => () => {}),
      initialize: vi.fn(),
      dispose: vi.fn(),
      analyze: vi.fn(),
      stop: vi.fn(),
    };
  }),
}));

vi.mock("@/features/chess/engine-worker-factory", () => ({
  createStockfishWorkerFactory: vi.fn(() => () => ({
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addMessageListener: vi.fn(),
    removeMessageListener: vi.fn(),
    addErrorListener: vi.fn(),
    removeErrorListener: vi.fn(),
  })),
}));

function createTestTimeline(pgn: string): ReviewTimeline {
  const parseResult = parsePgn(pgn);
  if (!parseResult.ok) {
    throw new Error("Failed to parse PGN in test helper");
  }
  return buildTimeline(parseResult.value);
}

describe("OpeningDisplay", () => {
  it("renders null when opening is null", () => {
    const { container } = render(<OpeningDisplay opening={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders eco code and opening name when opening is present", () => {
    render(
      <OpeningDisplay
        opening={{ eco: "B20", name: "Sicilian Defence", bookPlies: 2 }}
      />
    );
    expect(screen.getByTestId("opening-eco").textContent).toBe("B20");
    expect(screen.getByTestId("opening-name").textContent).toBe("Sicilian Defence");
  });
});

describe("ReviewBoard Opening Integration", () => {
  it("shows no opening label at ply 0", () => {
    const timeline = createTestTimeline('[Result "1-0"] 1. e4 c5 2. Nf3 d6 1-0');
    render(<ReviewBoard timeline={timeline} />);
    expect(screen.queryByTestId("opening-display")).toBeNull();
  });

  it("shows correct ECO code and name for a known opening", () => {
    const timeline = createTestTimeline('[Result "1-0"] 1. e4 c5 2. Nf3 d6 1-0');
    render(<ReviewBoard timeline={timeline} />);
    const nextBtn = screen.getByRole("button", { name: "Next" });
    fireEvent.click(nextBtn);
    fireEvent.click(nextBtn);

    expect(screen.getByTestId("opening-eco").textContent).toBe("B20");
    expect(screen.getByTestId("opening-name").textContent).toBe("Sicilian Defence");
  });

  it("updates the label when ply changes", () => {
    const timeline = createTestTimeline('[Result "1-0"] 1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 1-0');
    render(<ReviewBoard timeline={timeline} />);
    const nextBtn = screen.getByRole("button", { name: "Next" });

    fireEvent.click(nextBtn);
    expect(screen.getByTestId("opening-eco").textContent).toBe("B00");
    expect(screen.getByTestId("opening-name").textContent).toBe("King's Pawn Opening");

    fireEvent.click(nextBtn);
    expect(screen.getByTestId("opening-eco").textContent).toBe("C20");
    expect(screen.getByTestId("opening-name").textContent).toBe("King's Pawn Game");

    fireEvent.click(nextBtn);
    fireEvent.click(nextBtn);
    fireEvent.click(nextBtn);
    expect(screen.getByTestId("opening-eco").textContent).toBe("C60");
    expect(screen.getByTestId("opening-name").textContent).toBe("Ruy Lopez");

    fireEvent.click(nextBtn);
    expect(screen.getByTestId("opening-eco").textContent).toBe("C65");
    expect(screen.getByTestId("opening-name").textContent).toBe("Ruy Lopez Berlin Defence");
  });

  it("renders empty state for a game whose first move is not in the book", () => {
    const timeline = createTestTimeline('[Result "1-0"] 1. a3 e5 1-0');
    render(<ReviewBoard timeline={timeline} />);
    const nextBtn = screen.getByRole("button", { name: "Next" });

    fireEvent.click(nextBtn);
    expect(screen.queryByTestId("opening-display")).toBeNull();

    fireEvent.click(nextBtn);
    expect(screen.queryByTestId("opening-display")).toBeNull();
  });
});
