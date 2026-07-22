import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { Chessboard } from "react-chessboard";

describe("react-chessboard@5.10.0 contract smoke test", () => {
  beforeEach(() => {
    const mockGetBoundingClientRect = () => ({
      width: 80,
      height: 80,
      top: 0,
      left: 0,
      bottom: 80,
      right: 80,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    Element.prototype.getBoundingClientRect = mockGetBoundingClientRect;
  });

  it("renders a real div root with the expected board id", () => {
    render(<Chessboard options={{ id: "contract", position: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" }} />);
    const board = document.getElementById("contract-board");
    expect(board).toBeTruthy();
    expect(board?.tagName).toBe("DIV");
    expect(board?.getAttribute("role")).toBeNull();
    expect(board?.getAttribute("aria-label")).toBeNull();
  });

  it("renders a controlled initial position", () => {
    render(<Chessboard options={{ position: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" }} />);
    const squares = document.querySelectorAll("#chessboard-board [data-square]");
    expect(squares.length).toBe(64);
    const e2Pawn = document.getElementById("chessboard-piece-wP-e2");
    expect(e2Pawn).toBeTruthy();
    expect(e2Pawn?.getAttribute("data-piece")).toBe("wP");
  });

  it("updates piece placement when the controlled position changes", async () => {
    const initial = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const moved = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    const { rerender } = render(<Chessboard options={{ position: initial }} />);
    const before = document.getElementById("chessboard-piece-wP-e4");
    expect(before).toBeNull();

    rerender(<Chessboard options={{ position: moved }} />);

    await waitFor(() => {
      const after = document.getElementById("chessboard-piece-wP-e4");
      expect(after).toBeTruthy();
      expect(after?.getAttribute("data-piece")).toBe("wP");
    });
  });

  it("produces disabled draggable semantics when allowDragging is false", () => {
    render(<Chessboard options={{ position: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", allowDragging: false }} />);
    const piece = document.getElementById("chessboard-piece-wP-e2");
    const draggableWrapper = piece?.parentElement;
    expect(draggableWrapper).toBeTruthy();
    expect(draggableWrapper?.getAttribute("aria-disabled")).toBe("true");
    expect(draggableWrapper?.getAttribute("role")).toBe("button");
  });

  it("does not supply our application-level board region label", () => {
    render(<Chessboard options={{ position: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" }} />);
    const regions = document.querySelectorAll('[role="region"]');
    expect(regions.length).toBe(0);
  });

  it("does not verify real drag behavior in jsdom", () => {
    // jsdom cannot reliably simulate pointer/touch/keyboard drag sensors from @dnd-kit/core.
    // This test documents that limitation rather than attempting impossible simulation.
    expect(true).toBe(true);
  });
});
