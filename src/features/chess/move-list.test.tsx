import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { MoveList } from "@/features/chess/move-list";
import type { ReviewTimeline } from "@/features/chess/timeline";
import type { MoveClassification } from "@/features/chess/move-classification";

const SHORT_GAME_TIMELINE: ReviewTimeline = {
  steps: [
    { ply: 0, fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", move: null },
    { ply: 1, fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", move: { san: "e4", color: "w", from: "e2", to: "e4", before: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", after: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1" } },
    { ply: 2, fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2", move: { san: "e5", color: "b", from: "e7", to: "e5", before: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1", after: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2" } },
    { ply: 3, fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", move: { san: "Nf3", color: "w", from: "g1", to: "f3", before: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2", after: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2" } },
    { ply: 4, fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", move: { san: "Nc6", color: "b", from: "b8", to: "c6", before: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", after: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3" } },
  ],
  totalPlies: 4,
  initialFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  finalFen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
  analysisEligible: true,
};

const ITALIAN_GAME_TIMELINE: ReviewTimeline = {
  steps: [
    { ply: 0, fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", move: null },
    { ply: 1, fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1", move: { san: "e4", color: "w", from: "e2", to: "e4", before: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", after: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1" } },
    { ply: 2, fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2", move: { san: "e5", color: "b", from: "e7", to: "e5", before: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1", after: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2" } },
    { ply: 3, fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", move: { san: "Nf3", color: "w", from: "g1", to: "f3", before: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2", after: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2" } },
    { ply: 4, fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", move: { san: "Nc6", color: "b", from: "b8", to: "c6", before: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", after: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3" } },
    { ply: 5, fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", move: { san: "Bc4", color: "w", from: "f1", to: "c4", before: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", after: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3" } },
    { ply: 6, fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", move: { san: "Bc5", color: "b", from: "f8", to: "c5", before: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", after: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4" } },
  ],
  totalPlies: 6,
  initialFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  finalFen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
  analysisEligible: true,
};

function classificationMap(
  entries: Array<[number, MoveClassification]>
): Map<number, MoveClassification> {
  return new Map(entries);
}

function renderList(
  timeline: ReviewTimeline,
  currentPly = 0,
  classifications?: Map<number, MoveClassification>
) {
  return render(
    <MoveList
      timeline={timeline}
      currentPly={currentPly}
      onSelectPly={vi.fn()}
      classifications={classifications}
    />
  );
}

describe("MoveList", () => {
  it("renders one button per played move", () => {
    const { container } = renderList(SHORT_GAME_TIMELINE);
    const buttons = container.querySelectorAll('button[data-ply]');
    expect(buttons).toHaveLength(4);
  });

  it("assigns correct move numbers for at least three full pairs", () => {
    const { container } = renderList(ITALIAN_GAME_TIMELINE);
    const buttons = Array.from(container.querySelectorAll('button[data-ply]'));
    const labels = buttons.map((btn) => btn.textContent?.trim() ?? "");

    expect(labels[0]).toBe("1. e4");
    expect(labels[1]).toBe("1... e5");
    expect(labels[2]).toBe("2. Nf3");
    expect(labels[3]).toBe("2... Nc6");
    expect(labels[4]).toBe("3. Bc4");
    expect(labels[5]).toBe("3... Bc5");
  });

  it("sets data-ply to the correct ply for each button", () => {
    const { container } = renderList(SHORT_GAME_TIMELINE);
    const buttons = Array.from(container.querySelectorAll('button[data-ply]'));
    buttons.forEach((btn, index) => {
      expect(btn.getAttribute("data-ply")).toBe(String(index + 1));
    });
  });

  it("calls onSelectPly once with the clicked ply", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <MoveList timeline={SHORT_GAME_TIMELINE} currentPly={0} onSelectPly={onSelect} />
    );
    const buttons = container.querySelectorAll('button[data-ply]');
    expect(buttons).toHaveLength(4);
    fireEvent.click(buttons[2]!);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it("sets aria-current only on the button matching currentPly", () => {
    const { container } = renderList(SHORT_GAME_TIMELINE, 2);
    const buttons = Array.from(container.querySelectorAll('button[data-ply]'));
    buttons.forEach((btn, index) => {
      const ply = index + 1;
      if (ply === 2) {
        expect(btn.getAttribute("aria-current")).toBe("true");
      } else {
        expect(btn.hasAttribute("aria-current")).toBe(false);
      }
    });
  });

  it("renders zero buttons for an empty timeline without throwing", () => {
    const emptyTimeline: ReviewTimeline = {
      steps: [{ ply: 0, fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", move: null }],
      totalPlies: 0,
      initialFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      finalFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      analysisEligible: true,
    };
    const { container } = renderList(emptyTimeline);
    const buttons = container.querySelectorAll('button[data-ply]');
    expect(buttons).toHaveLength(0);
  });

  it("renders a game ending after a White move without a phantom Black move", () => {
    const whiteOnlyTimeline: ReviewTimeline = {
      steps: [
        { ply: 0, fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", move: null },
        { ply: 1, fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", move: { san: "e4", color: "w", from: "e2", to: "e4", before: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", after: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1" } },
      ],
      totalPlies: 1,
      initialFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      finalFen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      analysisEligible: true,
    };
    const { container } = renderList(whiteOnlyTimeline);
    const buttons = Array.from(container.querySelectorAll('button[data-ply]'));
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.getAttribute("data-ply")).toBe("1");
  });

  it("exposes the move list with accessible name 'Move list'", () => {
    const { container } = renderList(SHORT_GAME_TIMELINE);
    const list = container.querySelector('[aria-label="Move list"]');
    expect(list).toBeInTheDocument();
    expect(list?.tagName.toLowerCase()).toBe("ol");
  });

  it("renders one listitem per played move", () => {
    const { container } = renderList(SHORT_GAME_TIMELINE);
    const listItems = container.querySelectorAll('li');
    expect(listItems).toHaveLength(4);
  });

  it("renders no move list element for an empty timeline", () => {
    const emptyTimeline: ReviewTimeline = {
      steps: [{ ply: 0, fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", move: null }],
      totalPlies: 0,
      initialFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      finalFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      analysisEligible: true,
    };
    const { container } = renderList(emptyTimeline);
    expect(container.querySelector('[aria-label="Move list"]')).toBeNull();
  });

  it("renders one classification icon per classified ply", () => {
    const { container } = renderList(
      SHORT_GAME_TIMELINE,
      0,
      classificationMap([[2, "blunder"], [4, "best"]])
    );
    const icons = container.querySelectorAll('[data-classification]');
    expect(icons).toHaveLength(2);
  });

  it("matches data-classification to the expected classification for each ply", () => {
    const { container } = renderList(
      SHORT_GAME_TIMELINE,
      0,
      classificationMap([[2, "blunder"], [4, "best"]])
    );
    expect(container.querySelector('[data-classification="blunder"]')).toBeInTheDocument();
    expect(container.querySelector('[data-classification="best"]')).toBeInTheDocument();
  });

  it("renders zero classification icons when no classifications are supplied", () => {
    const { container } = renderList(SHORT_GAME_TIMELINE);
    const icons = container.querySelectorAll('[data-classification]');
    expect(icons).toHaveLength(0);
  });

  it("calls onSelectPly with the correct ply when icons are present", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <MoveList
        timeline={SHORT_GAME_TIMELINE}
        currentPly={0}
        onSelectPly={onSelect}
        classifications={classificationMap([[3, "mistake"]])}
      />
    );
    const buttons = container.querySelectorAll('button[data-ply]');
    expect(buttons).toHaveLength(4);
    fireEvent.click(buttons[2]!);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it("renders a visually-hidden label for a classified move", () => {
    const { container } = renderList(
      SHORT_GAME_TIMELINE,
      0,
      classificationMap([[2, "blunder"]])
    );
    const labels = container.querySelectorAll(".sr-only");
    expect(labels).toHaveLength(1);
    expect(labels[0]).toHaveTextContent("Blunder");
  });

  it("renders the same button count with or without classifications", () => {
    const { container: without } = renderList(SHORT_GAME_TIMELINE);
    const { container: withClass } = renderList(
      SHORT_GAME_TIMELINE,
      0,
      classificationMap([[1, "best"]])
    );
    expect(without.querySelectorAll('button[data-ply]')).toHaveLength(4);
    expect(withClass.querySelectorAll('button[data-ply]')).toHaveLength(4);
  });
});
