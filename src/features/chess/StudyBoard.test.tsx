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

  it("updates the side to move to Black after a legal move", () => {
    render(<StudyBoard />);
    expect(screen.getByTestId("side-to-move")).toHaveTextContent("White");
    fireEvent.click(screen.getByTestId("simulate-drop"));
    expect(screen.getByTestId("side-to-move")).toHaveTextContent("Black");
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
