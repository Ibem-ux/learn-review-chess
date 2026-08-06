import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MoveExplanation } from "./move-explanation";
import { MoveExplanationPanel } from "./move-explanation-panel";

describe("MoveExplanationPanel", () => {
  it("getByRole region is present when explanation is null", () => {
    render(<MoveExplanationPanel explanation={null} />);
    expect(
      screen.getByRole("region", { name: "Move explanation" })
    ).toBeInTheDocument();
  });

  it("getByRole region is present when explanation is provided", () => {
    const explanation: MoveExplanation = {
      ply: 1,
      mover: "white",
      san: "e4",
      facts: [{ kind: "played-best-move" }],
    };
    render(<MoveExplanationPanel explanation={explanation} />);
    expect(
      screen.getByRole("region", { name: "Move explanation" })
    ).toBeInTheDocument();
  });

  it("null explanation renders exact empty-state string and zero listitems", () => {
    render(<MoveExplanationPanel explanation={null} />);
    expect(
      screen.getByText("Select a move to see its explanation.")
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem").length).toBe(0);
  });

  it("when an explanation is present, the empty-state string is absent", () => {
    const explanation: MoveExplanation = {
      ply: 1,
      mover: "white",
      san: "e4",
      facts: [{ kind: "played-best-move" }],
    };
    render(<MoveExplanationPanel explanation={explanation} />);
    expect(
      screen.queryByText("Select a move to see its explanation.")
    ).toBeNull();
  });

  it("a four-fact explanation renders exactly 4 listitems", () => {
    const explanation: MoveExplanation = {
      ply: 25,
      mover: "white",
      san: "Nf3",
      facts: [
        { kind: "phase", phase: "middlegame" },
        { kind: "played-best-move" },
        { kind: "material-even" },
        { kind: "mate-converted", movesToMate: 3 },
      ],
    };
    render(<MoveExplanationPanel explanation={explanation} />);
    expect(screen.getAllByRole("listitem").length).toBe(4);
  });

  it("the listitem text content appears in fact order", () => {
    const explanation: MoveExplanation = {
      ply: 25,
      mover: "white",
      san: "Nf3",
      facts: [
        { kind: "phase", phase: "middlegame" },
        { kind: "played-best-move" },
        { kind: "material-even" },
        { kind: "mate-converted", movesToMate: 3 },
      ],
    };
    render(<MoveExplanationPanel explanation={explanation} />);
    const listitems = screen.getAllByRole("listitem");
    expect(
      within(listitems[0]).getByText("Played in the middlegame.")
    ).toBeInTheDocument();
    expect(
      within(listitems[1]).getByText("This was the engine's top choice.")
    ).toBeInTheDocument();
    expect(
      within(listitems[2]).getByText("Material is unchanged on this move.")
    ).toBeInTheDocument();
    expect(
      within(listitems[3]).getByText("This move keeps a forced mate in 3.")
    ).toBeInTheDocument();
  });

  it("the SAN appears as a heading", () => {
    const explanation: MoveExplanation = {
      ply: 1,
      mover: "white",
      san: "Nf3",
      facts: [{ kind: "played-best-move" }],
    };
    render(<MoveExplanationPanel explanation={explanation} />);
    expect(screen.getByRole("heading", { name: "Nf3" })).toBeInTheDocument();
  });

  it("an unavailable explanation renders exactly 1 listitem with its sentence", () => {
    const explanation: MoveExplanation = {
      ply: 1,
      mover: "white",
      san: "e4",
      facts: [{ kind: "unavailable", reason: "before-analysis-missing" }],
    };
    render(<MoveExplanationPanel explanation={explanation} />);
    const listitems = screen.getAllByRole("listitem");
    expect(listitems.length).toBe(1);
    expect(
      within(listitems[0]).getByText(
        "This move could not be explained because the position before it was not analyzed."
      )
    ).toBeInTheDocument();
  });

  it("an explanation containing mate-found renders \"This move creates a forced mate in 4.\"", () => {
    const explanation: MoveExplanation = {
      ply: 15,
      mover: "white",
      san: "Qh7#",
      facts: [
        { kind: "phase", phase: "middlegame" },
        { kind: "mate-found", movesToMate: 4 },
      ],
    };
    render(<MoveExplanationPanel explanation={explanation} />);
    expect(
      screen.getByText("This move creates a forced mate in 4.")
    ).toBeInTheDocument();
  });

  it("an explanation containing mate-missed renders expected sentence", () => {
    const explanation: MoveExplanation = {
      ply: 10,
      mover: "white",
      san: "Qe2",
      facts: [{ kind: "mate-missed", movesToMate: 2 }],
    };
    render(<MoveExplanationPanel explanation={explanation} />);
    expect(
      screen.getByText("A forced mate in 2 was available and was missed.")
    ).toBeInTheDocument();
  });

  it("an explanation containing mate-allowed renders expected sentence", () => {
    const explanation: MoveExplanation = {
      ply: 12,
      mover: "black",
      san: "f6",
      facts: [{ kind: "mate-allowed", movesToMate: 1 }],
    };
    render(<MoveExplanationPanel explanation={explanation} />);
    expect(
      screen.getByText("This move allows a forced mate in 1.")
    ).toBeInTheDocument();
  });

  it("an explanation containing evaluation-drop renders expected sentence", () => {
    const explanation: MoveExplanation = {
      ply: 8,
      mover: "white",
      san: "d4",
      facts: [{ kind: "evaluation-drop", centipawnLoss: 150 }],
    };
    render(<MoveExplanationPanel explanation={explanation} />);
    expect(
      screen.getByText("The evaluation dropped by 150 centipawns.")
    ).toBeInTheDocument();
  });
});
