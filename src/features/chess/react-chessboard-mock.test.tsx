import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("react-chessboard", () => import("@/features/chess/__mocks__/react-chessboard"));

import { Chessboard } from "react-chessboard";

describe("react-chessboard mock", () => {
  it("board mock exposes the arrows it was given", () => {
    render(
      <Chessboard
        options={{
          position: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          arrows: [
            { startSquare: "e2", endSquare: "e4", color: "#22c55e" },
            { startSquare: "d2", endSquare: "d4", color: "#3b82f6" },
          ],
        }}
      />
    );
    const board = document.querySelector('[data-testid="chessboard"]');
    expect(board?.getAttribute("data-arrows")).toBe("e2>e4:#22c55e,d2>d4:#3b82f6");
  });

  it("board mock exposes an empty arrow list when none are given", () => {
    render(
      <Chessboard
        options={{
          position: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        }}
      />
    );
    const board = document.querySelector('[data-testid="chessboard"]');
    expect(board?.getAttribute("data-arrows")).toBe("");
  });

  it("board mock exposes clearArrowsOnPositionChange", () => {
    const { rerender } = render(
      <Chessboard
        options={{
          position: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          clearArrowsOnPositionChange: true,
        }}
      />
    );
    const board = document.querySelector('[data-testid="chessboard"]');
    expect(board?.getAttribute("data-clear-arrows-on-position-change")).toBe("true");

    rerender(
      <Chessboard
        options={{
          position: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        }}
      />
    );
    expect(board?.getAttribute("data-clear-arrows-on-position-change")).toBe("undefined");
  });
});
