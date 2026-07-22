import { act, render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-chessboard", () => import("@/features/chess/__mocks__/react-chessboard"));

let capturedOnSelectPgn: ((pgn: string) => void) | null = null;

vi.mock("@/features/game-import/ChesscomGamePicker", () => ({
  default: (props: { onSelectPgn: (pgn: string) => void }) => {
    capturedOnSelectPgn = props.onSelectPgn;
    return <div data-testid="chesscom-game-picker" />;
  },
}));

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

const CHESSCOM_PGN = '[Event "Online"]\n[White "Alice"]\n[Black "Bob"]\n[Result "1-0"]\n\n1. e4 e5 *';

describe("ReviewWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnSelectPgn = null;
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

  it("has Paste PGN selected by default", () => {
    render(<ReviewWorkspace />);
    expect(screen.getByRole("button", { name: "Paste PGN" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Chess.com" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("selecting Chess.com renders the game picker", () => {
    render(<ReviewWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Chess.com" }));
    expect(screen.getByTestId("chesscom-game-picker")).toBeInTheDocument();
  });

  it("switching methods does not trigger a fetch by itself", () => {
    render(<ReviewWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Chess.com" }));
    fireEvent.click(screen.getByRole("button", { name: "Paste PGN" }));
    expect(screen.queryByTestId("chesscom-game-picker")).not.toBeInTheDocument();
  });

  it("selecting a valid Chess.com game loads ReviewBoard at ply 0", async () => {
    render(<ReviewWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Chess.com" }));
    expect(screen.getByTestId("chesscom-game-picker")).toBeInTheDocument();

    await act(async () => {
      capturedOnSelectPgn?.(CHESSCOM_PGN);
    });

    expect(
      screen.getByRole("region", { name: "Review chessboard" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(0 / 2)");
  });

  it("selected Chess.com PGN produces the correct summary", async () => {
    render(<ReviewWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Chess.com" }));
    await act(async () => {
      capturedOnSelectPgn?.(CHESSCOM_PGN);
    });

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText(/2 half-moves imported/i)).toBeInTheDocument();
  });

  it("displays Chess.com as the active source", async () => {
    render(<ReviewWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Chess.com" }));
    await act(async () => {
      capturedOnSelectPgn?.(CHESSCOM_PGN);
    });
    expect(screen.getByText("Source:")).toBeInTheDocument();
    const sourceValues = screen.getAllByText("Chess.com");
    expect(sourceValues.length).toBeGreaterThanOrEqual(1);
    expect(sourceValues[0].tagName).toBe("DD");
  });

  it("supports ReviewBoard navigation after Chess.com selection", async () => {
    render(<ReviewWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Chess.com" }));
    await act(async () => {
      capturedOnSelectPgn?.(SHORT_GAME);
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(1 / 4)");
    expect(screen.getByTestId("review-ply-status")).toHaveTextContent("e4");
  });

  it("switching back to Paste PGN preserves the active review and ply", async () => {
    render(<ReviewWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Chess.com" }));
    await act(async () => {
      capturedOnSelectPgn?.(SHORT_GAME);
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(1 / 4)");

    fireEvent.click(screen.getByRole("button", { name: "Paste PGN" }));
    expect(
      screen.getByRole("region", { name: "Review chessboard" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(1 / 4)");
  });

  it("selecting another valid Chess.com game resets ReviewBoard to ply 0", async () => {
    const replacement = '[Event "Two"]\n[White "Carol"]\n[Black "Dave"]\n\n1. d4 d5 *';
    render(<ReviewWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Chess.com" }));
    await act(async () => {
      capturedOnSelectPgn?.(SHORT_GAME);
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(1 / 4)");

    await act(async () => {
      capturedOnSelectPgn?.(replacement);
    });
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(0 / 2)");
    expect(screen.getByText("Carol")).toBeInTheDocument();
    expect(screen.getByText("Dave")).toBeInTheDocument();
  });

  it("invalid selected PGN displays sanitized error and preserves existing review", async () => {
    render(<ReviewWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Chess.com" }));
    await act(async () => {
      capturedOnSelectPgn?.(SHORT_GAME);
    });
    expect(
      screen.getByRole("region", { name: "Review chessboard" })
    ).toBeInTheDocument();

    await act(async () => {
      capturedOnSelectPgn?.("not valid pgn");
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to parse PGN. Check that the game notation is valid."
    );
    expect(
      screen.getByRole("region", { name: "Review chessboard" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(0 / 4)");
  });

  it("clear returns to StudyBoard and keeps selected import method", async () => {
    render(<ReviewWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Chess.com" }));
    await act(async () => {
      capturedOnSelectPgn?.(SHORT_GAME);
    });
    expect(
      screen.getByRole("region", { name: "Review chessboard" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear imported game" }));
    expect(
      screen.getByRole("region", { name: "Chess workspace" })
    ).toBeInTheDocument();
    expect(screen.queryByTestId("review-ply-count")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chess.com" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("clear keeps pasted PGN selected when active", () => {
    render(<ReviewWorkspace />);
    const textbox = screen.getByRole("textbox", {
      name: "Paste a completed PGN game",
    });
    fireEvent.change(textbox, { target: { value: SHORT_GAME } });
    fireEvent.click(screen.getByRole("button", { name: "Load game" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear imported game" }));

    expect(screen.getByRole("button", { name: "Paste PGN" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(textbox).toHaveValue("");
  });
});
