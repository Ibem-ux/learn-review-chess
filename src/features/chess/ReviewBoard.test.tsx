import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-chessboard", () => import("@/features/chess/__mocks__/react-chessboard"));

import ReviewBoard from "@/features/chess/ReviewBoard";
import { parsePgn } from "@/features/chess/pgn";
import { buildTimeline, type ReviewTimeline } from "@/features/chess/timeline";

function timelineOf(pgn: string): ReviewTimeline {
  const result = parsePgn(pgn);
  if (!result.ok) throw new Error("expected successful parse");
  return buildTimeline(result.value);
}

const SHORT_GAME = [
  '[Event "Test"]',
  '[White "Alice"]',
  '[Black "Bob"]',
  "",
  "1. e4 e5 2. Nf3 Nc6 *",
].join("\n");

describe("ReviewBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the review chessboard region", () => {
    const timeline = timelineOf(SHORT_GAME);
    render(<ReviewBoard timeline={timeline} />);
    expect(
      screen.getByRole("region", { name: "Review chessboard" })
    ).toBeInTheDocument();
  });

  it("starts at ply 0 with the start position label", () => {
    const timeline = timelineOf(SHORT_GAME);
    render(<ReviewBoard timeline={timeline} />);
    expect(screen.getByTestId("review-ply-status")).toHaveTextContent(
      "Start position"
    );
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(0 / 4)");
    const board = screen.getByTestId("chessboard");
    expect(board.getAttribute("data-position")).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    );
  });

  it("disables Start and Previous initially", () => {
    const timeline = timelineOf(SHORT_GAME);
    render(<ReviewBoard timeline={timeline} />);
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "End" })).toBeEnabled();
  });

  it("advances one ply with Next and updates SAN", () => {
    const timeline = timelineOf(SHORT_GAME);
    render(<ReviewBoard timeline={timeline} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByTestId("review-ply-status")).toHaveTextContent("e4");
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(1 / 4)");
    expect(screen.getByTestId("chessboard").getAttribute("data-position")).toBe(
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    );
  });

  it("returns one ply with Previous", () => {
    const timeline = timelineOf(SHORT_GAME);
    render(<ReviewBoard timeline={timeline} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(2 / 4)");
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(1 / 4)");
    expect(screen.getByTestId("review-ply-status")).toHaveTextContent("e4");
  });

  it("reaches the final FEN with End and disables Next/End", () => {
    const timeline = timelineOf(SHORT_GAME);
    render(<ReviewBoard timeline={timeline} />);
    fireEvent.click(screen.getByRole("button", { name: "End" }));
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(4 / 4)");
    expect(screen.getByTestId("review-ply-status")).toHaveTextContent("Nc6");
    expect(screen.getByTestId("chessboard").getAttribute("data-position")).toBe(
      "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3"
    );
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "End" })).toBeDisabled();
  });

  it("returns to ply 0 with Start", () => {
    const timeline = timelineOf(SHORT_GAME);
    render(<ReviewBoard timeline={timeline} />);
    fireEvent.click(screen.getByRole("button", { name: "End" }));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(0 / 4)");
    expect(screen.getByTestId("review-ply-status")).toHaveTextContent(
      "Start position"
    );
  });

  it("never navigates beyond the timeline boundaries", () => {
    const timeline = timelineOf(SHORT_GAME);
    render(<ReviewBoard timeline={timeline} />);
    fireEvent.click(screen.getByRole("button", { name: "End" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(4 / 4)");
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(0 / 4)");
  });

  it("flip changes orientation without changing ply or FEN", () => {
    const timeline = timelineOf(SHORT_GAME);
    render(<ReviewBoard timeline={timeline} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const before = screen.getByTestId("chessboard").getAttribute("data-position");
    fireEvent.click(screen.getByRole("button", { name: "Flip board" }));
    const board = screen.getByTestId("chessboard");
    expect(board.getAttribute("data-orientation")).toBe("black");
    expect(board.getAttribute("data-position")).toBe(before);
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(1 / 4)");
  });

  it("does not accept or persist user moves", () => {
    const timeline = timelineOf(SHORT_GAME);
    render(<ReviewBoard timeline={timeline} />);
    expect(screen.queryByTestId("simulate-drop")).not.toBeInTheDocument();
    expect(screen.getByTestId("chessboard").getAttribute("data-position")).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    );
  });

  it("resets to ply 0 when the timeline prop changes", () => {
    const first = timelineOf(SHORT_GAME);
    const { rerender } = render(<ReviewBoard timeline={first} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(1 / 4)");

    const zero = timelineOf('[Event "Empty"]\n\n');
    rerender(<ReviewBoard timeline={zero} />);
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(0 / 0)");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "End" })).toBeDisabled();
  });

  it("preserves ply and orientation on rerender with an equivalent rebuilt timeline", () => {
    const first = timelineOf(SHORT_GAME);
    const { rerender } = render(<ReviewBoard timeline={first} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(2 / 4)");
    fireEvent.click(screen.getByRole("button", { name: "Flip board" }));

    const equivalent = timelineOf(SHORT_GAME);
    expect(equivalent).not.toBe(first);
    rerender(<ReviewBoard timeline={equivalent} />);
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(2 / 4)");
    expect(screen.getByTestId("review-ply-status")).toHaveTextContent("e5");
    expect(screen.getByTestId("chessboard").getAttribute("data-orientation")).toBe(
      "black"
    );
  });

  it("resets to ply 0 with orientation preserved on a genuinely different timeline", () => {
    const first = timelineOf(SHORT_GAME);
    const { rerender } = render(<ReviewBoard timeline={first} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Flip board" }));
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(1 / 4)");
    expect(screen.getByTestId("chessboard").getAttribute("data-orientation")).toBe(
      "black"
    );

    const different = timelineOf('[Event "Other"]\n\n1. d4 d5 *');
    expect(different).not.toBe(first);
    rerender(<ReviewBoard timeline={different} />);
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(0 / 2)");
    expect(screen.getByTestId("review-ply-status")).toHaveTextContent(
      "Start position"
    );
    expect(screen.getByTestId("chessboard").getAttribute("data-orientation")).toBe(
      "black"
    );
  });
});
