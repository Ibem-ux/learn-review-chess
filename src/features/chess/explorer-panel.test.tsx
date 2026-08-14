import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createExplorerStack, pushExplorerPosition } from "./explorer-position-stack";
import { ExplorerPanel } from "./explorer-panel";

const rootFen = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";

describe("ExplorerPanel", () => {
  it("renders the panel at depth zero", () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    render(<ExplorerPanel stack={stack} onBack={() => {}} onReset={() => {}} />);
    expect(screen.getByTestId("explorer-panel")).toBeInTheDocument();
  });

  it("at depth zero shows the exact text Exploring from the game position", () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    render(<ExplorerPanel stack={stack} onBack={() => {}} onReset={() => {}} />);
    expect(screen.getByText("Exploring from the game position")).toBeInTheDocument();
  });

  it("at depth zero renders no explorer-crumb elements", () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    render(<ExplorerPanel stack={stack} onBack={() => {}} onReset={() => {}} />);
    expect(screen.queryAllByTestId("explorer-crumb")).toHaveLength(0);
  });

  it("at depth zero Back is disabled", () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    render(<ExplorerPanel stack={stack} onBack={() => {}} onReset={() => {}} />);
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  });

  it("at depth zero Return to game is disabled", () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    render(<ExplorerPanel stack={stack} onBack={() => {}} onReset={() => {}} />);
    expect(screen.getByRole("button", { name: "Return to game" })).toBeDisabled();
  });

  it("after one push renders exactly one crumb reading Bc4", () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    const pushed = pushExplorerPosition(stack, { fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", san: "Bc4" });
    render(<ExplorerPanel stack={pushed} onBack={() => {}} onReset={() => {}} />);
    const crumbs = screen.getAllByTestId("explorer-crumb");
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0].textContent).toBe("Bc4");
  });

  it("after one push Back is enabled", () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    const pushed = pushExplorerPosition(stack, { fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", san: "Bc4" });
    render(<ExplorerPanel stack={pushed} onBack={() => {}} onReset={() => {}} />);
    expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
  });

  it("after two pushes renders two crumbs in order Bc4 then Bc5", () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    const afterBc4 = pushExplorerPosition(stack, { fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", san: "Bc4" });
    const afterBc5 = pushExplorerPosition(afterBc4, { fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", san: "Bc5" });
    render(<ExplorerPanel stack={afterBc5} onBack={() => {}} onReset={() => {}} />);
    const crumbs = screen.getAllByTestId("explorer-crumb");
    expect(crumbs).toHaveLength(2);
    expect(crumbs[0].textContent).toBe("Bc4");
    expect(crumbs[1].textContent).toBe("Bc5");
  });

  it("clicking Back calls onBack exactly once", () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    const pushed = pushExplorerPosition(stack, { fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", san: "Bc4" });
    const onBack = vi.fn();
    render(<ExplorerPanel stack={pushed} onBack={onBack} onReset={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("clicking Return to game calls onReset exactly once", () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    const pushed = pushExplorerPosition(stack, { fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", san: "Bc4" });
    const onReset = vi.fn();
    render(<ExplorerPanel stack={pushed} onBack={() => {}} onReset={onReset} />);
    fireEvent.click(screen.getByRole("button", { name: "Return to game" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("when disabled is true at depth two, both buttons are disabled", () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    const afterBc4 = pushExplorerPosition(stack, { fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", san: "Bc4" });
    const afterBc5 = pushExplorerPosition(afterBc4, { fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", san: "Bc5" });
    render(<ExplorerPanel stack={afterBc5} onBack={() => {}} onReset={() => {}} disabled />);
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Return to game" })).toBeDisabled();
  });

  it("at depth two the breadcrumb text reads the sans joined by a space", () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    const afterBc4 = pushExplorerPosition(stack, { fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", san: "Bc4" });
    const afterBc5 = pushExplorerPosition(afterBc4, { fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", san: "Bc5" });
    render(<ExplorerPanel stack={afterBc5} onBack={() => {}} onReset={() => {}} />);
    expect(screen.getByTestId("explorer-breadcrumb").textContent).toBe("Bc4 Bc5");
  });
});

describe("depth indicator removal (task B5)", () => {
  it("no element with data-testid explorer-depth is rendered at depth zero or at depth two", () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    const { queryByTestId, rerender } = render(
      <ExplorerPanel stack={stack} onBack={() => {}} onReset={() => {}} />
    );
    expect(queryByTestId("explorer-depth")).toBeNull();

    const afterBc4 = pushExplorerPosition(stack, {
      fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
      san: "Bc4",
    });
    const afterBc5 = pushExplorerPosition(afterBc4, {
      fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
      san: "Bc5",
    });
    rerender(<ExplorerPanel stack={afterBc5} onBack={() => {}} onReset={() => {}} />);
    expect(queryByTestId("explorer-depth")).toBeNull();
  });
});
