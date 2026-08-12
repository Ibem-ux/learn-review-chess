import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
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

  it("distributes all four import method buttons evenly across the full group width", () => {
    render(<ReviewWorkspace />);
    const group = screen.getByRole("group", { name: "Import method" });
    expect(group.getAttribute("class")).toContain("w-full");
    const buttons = group.querySelectorAll("button");
    expect(buttons.length).toBe(4);
    expect(buttons[0].getAttribute("class")).toContain("flex-1");
    expect(buttons[1].getAttribute("class")).toContain("flex-1");
    expect(buttons[2].getAttribute("class")).toContain("flex-1");
    expect(buttons[3].getAttribute("class")).toContain("flex-1");
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

  describe("file upload import method", () => {
    it("renders a third import-method button labelled Upload file", () => {
      render(<ReviewWorkspace />);
      expect(
        screen.getByRole("button", { name: "Upload file" })
      ).toBeInTheDocument();
    });

    it("reveals a file input with an accept attribute when Upload file is clicked", () => {
      render(<ReviewWorkspace />);
      fireEvent.click(screen.getByRole("button", { name: "Upload file" }));
      const input = screen.getByLabelText(/upload/i);
      expect(input).toHaveAttribute("type", "file");
      expect(input).toHaveAttribute("accept");
    });

    it("loads the review when a valid single-game .pgn file is chosen and sets Source to Uploaded file", async () => {
      render(<ReviewWorkspace />);
      fireEvent.click(screen.getByRole("button", { name: "Upload file" }));
      const input = screen.getByLabelText(/upload/i);
      const file = new File([SHORT_GAME], "game.pgn", {
        type: "application/x-chess-pgn",
      });
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });
      expect(
        screen.getByRole("region", { name: "Review chessboard" })
      ).toBeInTheDocument();
      expect(screen.getByText("Uploaded file")).toBeInTheDocument();
    });

    it("renders a chooser and shows no alert when a file containing two games is chosen, and loads no review initially", async () => {
      render(<ReviewWorkspace />);
      fireEvent.click(screen.getByRole("button", { name: "Upload file" }));
      const input = screen.getByLabelText(/upload/i);
      const twoGamesPgn =
        '[Event "Game 1"]\n1. e4 e5 1-0\n\n[Event "Game 2"]\n1. d4 d5 1-0';
      const file = new File([twoGamesPgn], "two-games.pgn", {
        type: "application/x-chess-pgn",
      });
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByText(/showing 2 games/i)).toBeInTheDocument();
      expect(screen.queryByTestId("review-ply-count")).not.toBeInTheDocument();
    });

    it("shows an error when an empty file is chosen and loads no review", async () => {
      render(<ReviewWorkspace />);
      fireEvent.click(screen.getByRole("button", { name: "Upload file" }));
      const input = screen.getByLabelText(/upload/i);
      const file = new File([""], "empty.pgn", {
        type: "application/x-chess-pgn",
      });
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toMatch(/empty/i);
      expect(
        screen.getByRole("region", { name: "Chess workspace" })
      ).toBeInTheDocument();
      expect(screen.queryByTestId("review-ply-count")).not.toBeInTheDocument();
    });

    it("shows an error when a file larger than the byte limit is chosen and loads no review", async () => {
      render(<ReviewWorkspace />);
      fireEvent.click(screen.getByRole("button", { name: "Upload file" }));
      const input = screen.getByLabelText(/upload/i);
      const largeContent = "x".repeat(1000001);
      const file = new File([largeContent], "large.pgn", {
        type: "application/x-chess-pgn",
      });
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toMatch(/too large|limit|size/i);
      expect(
        screen.getByRole("region", { name: "Chess workspace" })
      ).toBeInTheDocument();
      expect(screen.queryByTestId("review-ply-count")).not.toBeInTheDocument();
    });

    it("preserves an already loaded review when switching to Upload file and back to Paste PGN", () => {
      render(<ReviewWorkspace />);
      const textbox = screen.getByRole("textbox", {
        name: "Paste a completed PGN game",
      });
      fireEvent.change(textbox, { target: { value: SHORT_GAME } });
      fireEvent.click(screen.getByRole("button", { name: "Load game" }));
      expect(
        screen.getByRole("region", { name: "Review chessboard" })
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Upload file" }));
      expect(
        screen.getByRole("region", { name: "Review chessboard" })
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Paste PGN" }));
      expect(
        screen.getByRole("region", { name: "Review chessboard" })
      ).toBeInTheDocument();
    });

    it("shows an error when the file cannot be read and loads no review", async () => {
      render(<ReviewWorkspace />);
      fireEvent.click(screen.getByRole("button", { name: "Upload file" }));
      const input = screen.getByLabelText(/upload/i);
      const file = new File(["1. e4 e5 1-0"], "game.pgn", {
        type: "application/x-chess-pgn",
      });
      Object.defineProperty(file, "text", {
        value: () => Promise.reject(new Error("disk read failed")),
      });
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toMatch(/could not read|unable to read/i);
      expect(alert.textContent).not.toContain("disk read failed");
      expect(
        screen.getByRole("region", { name: "Chess workspace" })
      ).toBeInTheDocument();
      expect(screen.queryByTestId("review-ply-count")).not.toBeInTheDocument();
    });

    it("renders a status element with role status stating the file is being read while reading is in progress", async () => {
      render(<ReviewWorkspace />);
      fireEvent.click(screen.getByRole("button", { name: "Upload file" }));
      const input = screen.getByLabelText(/upload/i);
      let resolveRead!: (value: string) => void;
      const readPromise = new Promise<string>((resolve) => {
        resolveRead = resolve;
      });
      const file = new File([SHORT_GAME], "game.pgn", {
        type: "application/x-chess-pgn",
      });
      Object.defineProperty(file, "text", {
        value: () => readPromise,
      });

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      const status = screen.getByRole("status");
      expect(status).toHaveTextContent(/reading/i);

      await act(async () => {
        resolveRead(SHORT_GAME);
      });

      expect(screen.queryByText(/reading pgn file/i)).not.toBeInTheDocument();
    });

    it("disables the file input while reading and re-enables it after reading completes", async () => {
      render(<ReviewWorkspace />);
      fireEvent.click(screen.getByRole("button", { name: "Upload file" }));
      const input = screen.getByLabelText(/upload/i);
      let resolveRead!: (value: string) => void;
      const readPromise = new Promise<string>((resolve) => {
        resolveRead = resolve;
      });
      const file = new File([SHORT_GAME], "game.pgn", {
        type: "application/x-chess-pgn",
      });
      Object.defineProperty(file, "text", {
        value: () => readPromise,
      });

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      expect(input).toBeDisabled();

      await act(async () => {
        resolveRead(SHORT_GAME);
      });

      expect(input).not.toBeDisabled();
    });

    it("removes the busy status element and displays the error alert when reading fails", async () => {
      render(<ReviewWorkspace />);
      fireEvent.click(screen.getByRole("button", { name: "Upload file" }));
      const input = screen.getByLabelText(/upload/i);
      let rejectRead!: (reason?: unknown) => void;
      const readPromise = new Promise<string>((_, reject) => {
        rejectRead = reject;
      });
      const file = new File([SHORT_GAME], "game.pgn", {
        type: "application/x-chess-pgn",
      });
      Object.defineProperty(file, "text", {
        value: () => readPromise,
      });

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      expect(screen.getByRole("status")).toBeInTheDocument();

      await act(async () => {
        rejectRead(new Error("disk read failed"));
      });

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("displays White and Black player names for each game in the chooser list", async () => {
      render(<ReviewWorkspace />);
      fireEvent.click(screen.getByRole("button", { name: "Upload file" }));
      const input = screen.getByLabelText(/upload/i);
      const pgn =
        '[Event "G1"]\n[White "Kasparov"]\n[Black "Deep Blue"]\n1. e4 e5 1-0\n\n[Event "G2"]\n[White "Carlsen"]\n[Black "Nakamura"]\n1. d4 d5 0-1';
      const file = new File([pgn], "games.pgn", {
        type: "application/x-chess-pgn",
      });
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });
      expect(screen.getByText(/kasparov vs deep blue/i)).toBeInTheDocument();
      expect(screen.getByText(/carlsen vs nakamura/i)).toBeInTheDocument();
    });

    it("loads the selected game when clicking its Review game button in the chooser", async () => {
      render(<ReviewWorkspace />);
      fireEvent.click(screen.getByRole("button", { name: "Upload file" }));
      const input = screen.getByLabelText(/upload/i);
      const pgn =
        '[Event "G1"]\n[White "Kasparov"]\n[Black "Deep Blue"]\n1. e4 e5 1-0\n\n[Event "G2"]\n[White "Carlsen"]\n[Black "Nakamura"]\n1. d4 d5 0-1';
      const file = new File([pgn], "games.pgn", {
        type: "application/x-chess-pgn",
      });
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });
      const reviewButtons = screen.getAllByRole("button", { name: "Review game" });
      expect(reviewButtons).toHaveLength(2);
      await act(async () => {
        fireEvent.click(reviewButtons[1]);
      });
      expect(screen.getByText("Carlsen", { selector: "dd" })).toBeInTheDocument();
      expect(screen.getByText("Nakamura", { selector: "dd" })).toBeInTheDocument();
      expect(screen.queryByText("Kasparov", { selector: "dd" })).not.toBeInTheDocument();
      expect(screen.queryByText("Deep Blue", { selector: "dd" })).not.toBeInTheDocument();
      expect(screen.getByText(/carlsen vs nakamura/i)).toBeInTheDocument();
      expect(screen.getByTestId("review-ply-count")).toBeInTheDocument();
      expect(screen.getByText(/showing 2 games/i)).toBeInTheDocument();
    });

    it("loads single-game PGN file directly without displaying a chooser", async () => {
      render(<ReviewWorkspace />);
      fireEvent.click(screen.getByRole("button", { name: "Upload file" }));
      const input = screen.getByLabelText(/upload/i);
      const file = new File([SHORT_GAME], "single.pgn", {
        type: "application/x-chess-pgn",
      });
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });
      expect(screen.getByTestId("review-ply-count")).toBeInTheDocument();
      expect(screen.queryByText(/showing.*games/i)).not.toBeInTheDocument();
    });

    it("caps chooser display at 50 games and shows total game count when file contains more than 50 games", async () => {
      render(<ReviewWorkspace />);
      fireEvent.click(screen.getByRole("button", { name: "Upload file" }));
      const input = screen.getByLabelText(/upload/i);
      const games = [];
      for (let i = 1; i <= 52; i++) {
        games.push(`[Event "Game ${i}"]\n[White "Player${i}"]\n1. e4 e5 1-0`);
      }
      const multiGamePgn = games.join("\n\n");
      const file = new File([multiGamePgn], "many-games.pgn", {
        type: "application/x-chess-pgn",
      });
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });
      expect(screen.getByText(/showing first 50 of 52 games/i)).toBeInTheDocument();
      const reviewButtons = screen.getAllByRole("button", { name: "Review game" });
      expect(reviewButtons).toHaveLength(50);
    });

    it("resets the multi-game chooser when clearing the review", async () => {
      render(<ReviewWorkspace />);
      fireEvent.click(screen.getByRole("button", { name: "Upload file" }));
      const input = screen.getByLabelText(/upload/i);
      const pgn =
        '[Event "G1"]\n[White "Kasparov"]\n[Black "Deep Blue"]\n1. e4 e5 1-0\n\n[Event "G2"]\n[White "Carlsen"]\n[Black "Nakamura"]\n1. d4 d5 0-1';
      const file = new File([pgn], "games.pgn", {
        type: "application/x-chess-pgn",
      });
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });
      expect(screen.getByText(/showing 2 games/i)).toBeInTheDocument();
      const reviewButtons = screen.getAllByRole("button", { name: "Review game" });
      await act(async () => {
        fireEvent.click(reviewButtons[0]);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Clear imported game" }));
      });
      expect(screen.queryByText(/showing 2 games/i)).not.toBeInTheDocument();
    });

    it("clears an existing error alert when a multi-game file is chosen", async () => {
      render(<ReviewWorkspace />);
      fireEvent.click(screen.getByRole("button", { name: "Upload file" }));
      const input = screen.getByLabelText(/upload/i);
      const largeContent = "x".repeat(1000001);
      const largeFile = new File([largeContent], "large.pgn", {
        type: "application/x-chess-pgn",
      });
      await act(async () => {
        fireEvent.change(input, { target: { files: [largeFile] } });
      });
      expect(screen.getByRole("alert")).toBeInTheDocument();
      const twoGamesPgn =
        '[Event "Game 1"]\n1. e4 e5 1-0\n\n[Event "Game 2"]\n1. d4 d5 1-0';
      const multiFile = new File([twoGamesPgn], "two-games.pgn", {
        type: "application/x-chess-pgn",
      });
      await act(async () => {
        fireEvent.change(input, { target: { files: [multiFile] } });
      });
      expect(screen.getByText(/showing 2 games/i)).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("while a PGN file is being read, the file input carries aria-busy=\"true\"; when idle it carries aria-busy=\"false\"", async () => {
      let resolveFileText!: (text: string) => void;
      const filePromise = new Promise<string>((resolve) => {
        resolveFileText = resolve;
      });

      render(<ReviewWorkspace />);
      fireEvent.click(screen.getByRole("button", { name: "Upload file" }));

      const fileInput = screen.getByLabelText(/Upload a PGN file/i);
      expect(fileInput).toHaveAttribute("aria-busy", "false");

      const file = new File(['[Event "G1"]\n1. e4 *'], "test.pgn", { type: "text/plain" });
      file.text = vi.fn().mockReturnValue(filePromise);

      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(fileInput).toHaveAttribute("aria-busy", "true");

      resolveFileText('[Event "G1"]\n1. e4 *');
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(fileInput).toHaveAttribute("aria-busy", "false");
    });

    it("the file-reading status paragraph carries aria-live=\"polite\"", async () => {
      let resolveFileText!: (text: string) => void;
      const filePromise = new Promise<string>((resolve) => {
        resolveFileText = resolve;
      });

      render(<ReviewWorkspace />);
      fireEvent.click(screen.getByRole("button", { name: "Upload file" }));

      const fileInput = screen.getByLabelText(/Upload a PGN file/i);
      const file = new File(['[Event "G1"]\n1. e4 *'], "test.pgn", { type: "text/plain" });
      file.text = vi.fn().mockReturnValue(filePromise);

      fireEvent.change(fileInput, { target: { files: [file] } });

      const statusParagraph = screen.getByText("Reading PGN file...");
      expect(statusParagraph).toHaveAttribute("aria-live", "polite");

      resolveFileText('[Event "G1"]\n1. e4 *');
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
    });
  });

  describe("Lichess import method", () => {
    it("renders a fourth import tab labelled for Lichess", () => {
      render(<ReviewWorkspace />);
      expect(screen.getByRole("button", { name: "Lichess" })).toBeInTheDocument();
      const group = screen.getByRole("group", { name: "Import method" });
      expect(group.querySelectorAll("button")).toHaveLength(4);
    });

    it("renders Lichess username field and hides Chess.com username field when Lichess tab is selected", () => {
      render(<ReviewWorkspace />);
      fireEvent.click(screen.getByRole("button", { name: "Lichess" }));
      expect(screen.getByLabelText(/lichess username/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/chess\.com username/i)).not.toBeInTheDocument();
    });

    it("loads a game selected from Lichess picker into the workspace", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ pgn: SHORT_GAME, gameCount: 1 }),
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<ReviewWorkspace />);
      fireEvent.click(screen.getByRole("button", { name: "Lichess" }));
      fireEvent.change(screen.getByLabelText(/lichess username/i), { target: { value: "thibault" } });
      fireEvent.click(screen.getByRole("button", { name: "Load games" }));

      await waitFor(() => expect(screen.getByRole("button", { name: /Alice vs Bob/i })).toBeInTheDocument());

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Alice vs Bob/i }));
      });

      expect(screen.getByRole("region", { name: "Review chessboard" })).toBeInTheDocument();
      expect(screen.getByTestId("review-ply-count")).toHaveTextContent("(0 / 4)");
      expect(screen.getByText("Source:")).toBeInTheDocument();
      expect(screen.getByText("Lichess", { selector: "dd" })).toBeInTheDocument();

      vi.unstubAllGlobals();
    });

    it("queries status role without multiple matches when Lichess tab request is pending", async () => {
      let resolveFetch!: (res: Response) => void;
      const fetchPromise = new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });
      const fetchMock = vi.fn().mockReturnValue(fetchPromise);
      vi.stubGlobal("fetch", fetchMock);

      render(<ReviewWorkspace />);
      fireEvent.click(screen.getByRole("button", { name: "Lichess" }));
      fireEvent.change(screen.getByLabelText(/lichess username/i), { target: { value: "thibault" } });
      fireEvent.click(screen.getByRole("button", { name: "Load games" }));

      expect(screen.getAllByRole("status")).toHaveLength(1);
      expect(screen.getByRole("status")).toHaveTextContent(/fetching games from lichess/i);

      resolveFetch({
        ok: true,
        json: async () => ({ pgn: "", gameCount: 0 }),
      } as Response);

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      vi.unstubAllGlobals();
    });

  });
});

