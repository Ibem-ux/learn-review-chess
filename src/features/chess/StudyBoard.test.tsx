import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-chessboard", () => import("@/features/chess/__mocks__/react-chessboard"));

import StudyBoard from "@/features/chess/StudyBoard";

describe("StudyBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the board region", () => {
    render(<StudyBoard />);
    expect(
      screen.getByRole("region", { name: "Interactive chessboard" })
    ).toBeInTheDocument();
  });

  it("shows White as the side to move initially", () => {
    render(<StudyBoard />);
    expect(screen.getByTestId("side-to-move")).toHaveTextContent("White");
  });

  it("undo is initially disabled", () => {
    render(<StudyBoard />);
    expect(screen.getByRole("button", { name: "Undo move" })).toBeDisabled();
  });

  it("shows the empty-history state initially", () => {
    render(<StudyBoard />);
    expect(screen.getByTestId("move-history-empty")).toBeInTheDocument();
    expect(
      screen.getByText("No moves yet.")
    ).toBeInTheDocument();
  });

  it("adds the SAN entry after a legal move", () => {
    render(<StudyBoard />);
    fireEvent.click(screen.getByTestId("simulate-drop"));
    expect(screen.getByTestId("move-history").textContent).toBe("1. e4");
    expect(screen.queryByTestId("move-history-empty")).not.toBeInTheDocument();
  });

  it("displays a short legal sequence in correct move-number order", () => {
    render(<StudyBoard />);
    fireEvent.click(screen.getByTestId("simulate-drop"));
    fireEvent.click(screen.getByTestId("simulate-second-drop"));
    expect(screen.getByTestId("move-history").textContent).toBe("1. e4 e5");
    expect(screen.getByTestId("side-to-move")).toHaveTextContent("White");
  });

  it("updates the side to move to Black after a legal move", () => {
    render(<StudyBoard />);
    expect(screen.getByTestId("side-to-move")).toHaveTextContent("White");
    fireEvent.click(screen.getByTestId("simulate-drop"));
    expect(screen.getByTestId("side-to-move")).toHaveTextContent("Black");
  });

  it("does not change history after an illegal move", () => {
    render(<StudyBoard />);
    fireEvent.click(screen.getByTestId("simulate-drop"));
    fireEvent.click(screen.getByTestId("simulate-illegal-drop"));
    expect(screen.getByTestId("move-history").textContent).toBe("1. e4");
    expect(screen.getByTestId("side-to-move")).toHaveTextContent("Black");
  });

  it("removes only the latest half-move on undo", () => {
    render(<StudyBoard />);
    fireEvent.click(screen.getByTestId("simulate-drop"));
    fireEvent.click(screen.getByTestId("simulate-second-drop"));
    expect(screen.getByTestId("move-history").textContent).toBe("1. e4 e5");
    fireEvent.click(screen.getByRole("button", { name: "Undo move" }));
    expect(screen.getByTestId("move-history").textContent).toBe("1. e4");
    expect(screen.getByTestId("side-to-move")).toHaveTextContent("Black");
  });

  it("restores the correct position and side to move on undo", () => {
    render(<StudyBoard />);
    fireEvent.click(screen.getByTestId("simulate-drop"));
    expect(screen.getByTestId("side-to-move")).toHaveTextContent("Black");
    fireEvent.click(screen.getByRole("button", { name: "Undo move" }));
    expect(screen.getByTestId("side-to-move")).toHaveTextContent("White");
    expect(screen.getByTestId("chessboard").getAttribute("data-position")).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    );
    expect(screen.getByTestId("move-history-empty")).toBeInTheDocument();
  });

  it("preserves Black orientation after undo following a flip", () => {
    render(<StudyBoard />);
    fireEvent.click(screen.getByRole("button", { name: "Flip board" }));
    fireEvent.click(screen.getByTestId("simulate-drop"));
    fireEvent.click(screen.getByRole("button", { name: "Undo move" }));
    expect(screen.getByTestId("chessboard").getAttribute("data-orientation")).toBe(
      "black"
    );
    expect(screen.getByTestId("move-history-empty")).toBeInTheDocument();
  });

  it("reset clears history while preserving orientation", () => {
    render(<StudyBoard />);
    fireEvent.click(screen.getByRole("button", { name: "Flip board" }));
    fireEvent.click(screen.getByTestId("simulate-drop"));
    fireEvent.click(screen.getByTestId("simulate-second-drop"));
    expect(screen.getByTestId("move-history").textContent).toBe("1. e4 e5");
    fireEvent.click(screen.getByRole("button", { name: "Reset position" }));
    expect(screen.getByTestId("move-history-empty")).toBeInTheDocument();
    expect(screen.getByTestId("chessboard").getAttribute("data-orientation")).toBe(
      "black"
    );
    expect(screen.getByTestId("side-to-move")).toHaveTextContent("White");
  });

  it("flip alone does not modify history or position", () => {
    render(<StudyBoard />);
    const board = screen.getByTestId("chessboard");
    const positionBefore = board.getAttribute("data-position");
    fireEvent.click(screen.getByRole("button", { name: "Flip board" }));
    expect(screen.getByTestId("chessboard").getAttribute("data-orientation")).toBe(
      "black"
    );
    expect(screen.getByTestId("chessboard").getAttribute("data-position")).toBe(
      positionBefore
    );
    expect(screen.getByTestId("move-history-empty")).toBeInTheDocument();
  });

  it("rejects an illegal move and leaves White to move", () => {
    render(<StudyBoard />);
    const board = screen.getByTestId("chessboard");
    const positionBefore = board.getAttribute("data-position");
    fireEvent.click(screen.getByTestId("simulate-illegal-drop"));
    expect(screen.getByTestId("side-to-move")).toHaveTextContent("White");
    expect(board.getAttribute("data-position")).toBe(positionBefore);
  });

  it("reset after flip restores the starting position and White to move but keeps Black orientation", () => {
    render(<StudyBoard />);
    expect(screen.getByTestId("chessboard").getAttribute("data-orientation")).toBe(
      "white"
    );
    fireEvent.click(screen.getByRole("button", { name: "Flip board" }));
    expect(screen.getByTestId("chessboard").getAttribute("data-orientation")).toBe(
      "black"
    );
    fireEvent.click(screen.getByTestId("simulate-drop"));
    expect(screen.getByTestId("side-to-move")).toHaveTextContent("Black");
    fireEvent.click(screen.getByRole("button", { name: "Reset position" }));
    expect(screen.getByTestId("side-to-move")).toHaveTextContent("White");
    const board = screen.getByTestId("chessboard");
    expect(board.getAttribute("data-orientation")).toBe("black");
    expect(board.getAttribute("data-position")).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    );
  });

  it("flip changes orientation without changing the position", () => {
    render(<StudyBoard />);
    const board = screen.getByTestId("chessboard");
    const positionBefore = board.getAttribute("data-position");
    fireEvent.click(screen.getByRole("button", { name: "Flip board" }));
    const boardAfter = screen.getByTestId("chessboard");
    expect(boardAfter.getAttribute("data-orientation")).toBe("black");
    expect(boardAfter.getAttribute("data-position")).toBe(positionBefore);
  });
});
