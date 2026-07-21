import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-chessboard", () => import("@/features/chess/__mocks__/react-chessboard"));

import ReviewWorkspace from "@/features/chess/ReviewWorkspace";
import * as pgnModule from "@/features/chess/pgn";

const SHORT_GAME = [
  '[Event "Test"]',
  '[White "Alice"]',
  '[Black "Bob"]',
  '[Result "1-0"]',
  "",
  "1. e4 e5 2. Nf3 Nc6 *",
].join("\n");

const NO_HEADERS_GAME = "1. e4 e5 2. Nf3 Nc6 *";

describe("ReviewWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initially renders StudyBoard and the PGN form", () => {
    render(<ReviewWorkspace />);
    expect(
      screen.getByRole("region", { name: "Chess workspace" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Paste a completed PGN game" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Load game" })
    ).toBeInTheDocument();
  });

  it("shows a visible textarea label and description", () => {
    render(<ReviewWorkspace />);
    const textbox = screen.getByRole("textbox", {
      name: "Paste a completed PGN game",
    });
    expect(textbox).toHaveAttribute("aria-describedby");
    const describedBy = textbox.getAttribute("aria-describedby")!;
    const description = document.getElementById(describedBy);
    expect(description?.textContent).toMatch(/Only completed games are reviewed/i);
  });

  it("shows the sanitized empty-input failure", () => {
    render(<ReviewWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Load game" }));
    expect(screen.getByRole("alert")).toHaveTextContent("PGN input is empty.");
    expect(
      screen.getByRole("region", { name: "Chess workspace" })
    ).toBeInTheDocument();
  });

  it("shows the sanitized parsing failure for malformed PGN", () => {
    render(<ReviewWorkspace />);
    fireEvent.change(
      screen.getByRole("textbox", { name: "Paste a completed PGN game" }),
      { target: { value: "this is not valid pgn" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Load game" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to parse PGN. Check that the game notation is valid."
    );
    expect(
      screen.getByRole("region", { name: "Chess workspace" })
    ).toBeInTheDocument();
  });

  it("renders ReviewBoard at ply 0 for valid PGN", () => {
    render(<ReviewWorkspace />);
    fireEvent.change(
      screen.getByRole("textbox", { name: "Paste a completed PGN game" }),
      { target: { value: SHORT_GAME } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Load game" }));
    expect(
      screen.getByRole("region", { name: "Review chessboard" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(0 / 4)");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows player names and result in the imported summary", () => {
    render(<ReviewWorkspace />);
    fireEvent.change(
      screen.getByRole("textbox", { name: "Paste a completed PGN game" }),
      { target: { value: SHORT_GAME } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Load game" }));
    expect(screen.getByText("White:")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Black:")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Result:")).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByText(/4 half-moves imported/i)).toBeInTheDocument();
  });

  it("uses graceful fallback text when headers are missing", () => {
    render(<ReviewWorkspace />);
    fireEvent.change(
      screen.getByRole("textbox", { name: "Paste a completed PGN game" }),
      { target: { value: NO_HEADERS_GAME } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Load game" }));
    expect(screen.getByText("White:")).toBeInTheDocument();
    expect(screen.getAllByText("Not specified")).toHaveLength(2);
    expect(screen.getByText("Black:")).toBeInTheDocument();
    expect(screen.getByText("Result:")).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("supports ReviewBoard navigation after import", () => {
    render(<ReviewWorkspace />);
    fireEvent.change(
      screen.getByRole("textbox", { name: "Paste a completed PGN game" }),
      { target: { value: SHORT_GAME } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Load game" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(1 / 4)");
    expect(screen.getByTestId("review-ply-status")).toHaveTextContent("e4");
  });

  it("preserves a successful review when a failed replacement import is attempted", () => {
    render(<ReviewWorkspace />);
    fireEvent.change(
      screen.getByRole("textbox", { name: "Paste a completed PGN game" }),
      { target: { value: SHORT_GAME } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Load game" }));
    expect(
      screen.getByRole("region", { name: "Review chessboard" })
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("textbox", { name: "Paste a completed PGN game" }),
      { target: { value: "not valid pgn" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Load game" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Review chessboard" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(0 / 4)");
  });

  it("loads a new successful replacement import at ply 0", () => {
    render(<ReviewWorkspace />);
    fireEvent.change(
      screen.getByRole("textbox", { name: "Paste a completed PGN game" }),
      { target: { value: SHORT_GAME } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Load game" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(1 / 4)");

    const replacement = ['[Event "Two"]', "1. d4 d5 *"].join("\n");
    fireEvent.change(
      screen.getByRole("textbox", { name: "Paste a completed PGN game" }),
      { target: { value: replacement } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Load game" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(0 / 2)");
  });

  it("returns to StudyBoard and resets form on clear", () => {
    render(<ReviewWorkspace />);
    const textbox = screen.getByRole("textbox", {
      name: "Paste a completed PGN game",
    });
    fireEvent.change(textbox, { target: { value: SHORT_GAME } });
    fireEvent.click(screen.getByRole("button", { name: "Load game" }));
    expect(
      screen.getByRole("button", { name: "Clear imported game" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear imported game" }));
    expect(
      screen.getByRole("region", { name: "Chess workspace" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Paste a completed PGN game" })
    ).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("returns a user-safe length error for over-limit input without parsing", () => {
    const spy = vi.spyOn(pgnModule, "parsePgn");
    render(<ReviewWorkspace />);
    fireEvent.change(
      screen.getByRole("textbox", { name: "Paste a completed PGN game" }),
      { target: { value: "a".repeat(20001) } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Load game" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/too long/i);
    expect(spy).not.toHaveBeenCalled();
    expect(
      screen.getByRole("region", { name: "Chess workspace" })
    ).toBeInTheDocument();
  });

  it("exposes a distinct Chess workspace landmark", () => {
    render(<ReviewWorkspace />);
    const workspace = screen.getByRole("region", { name: "Chess workspace" });
    expect(workspace).toBeInTheDocument();
    expect(screen.queryAllByRole("region", { name: "Interactive chessboard" })).toHaveLength(
      1
    );
  });

  it("preserves legitimate player names", () => {
    render(<ReviewWorkspace />);
    fireEvent.change(
      screen.getByRole("textbox", { name: "Paste a completed PGN game" }),
      { target: { value: SHORT_GAME } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Load game" }));
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("normalizes empty and whitespace-only headers to Not specified", () => {
    render(<ReviewWorkspace />);
    const pgn = ['[Event "Test"]', '[White ""]', '[Black "   "]', "1. e4 *"].join("\n");
    fireEvent.change(
      screen.getByRole("textbox", { name: "Paste a completed PGN game" }),
      { target: { value: pgn } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Load game" }));
    expect(screen.getAllByText("Not specified")).toHaveLength(2);
  });
});
