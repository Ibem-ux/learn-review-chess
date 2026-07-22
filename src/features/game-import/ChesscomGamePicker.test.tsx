import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ChesscomGamePicker from "@/features/game-import/ChesscomGamePicker";

function createArchivesResponse(archives: { url: string; year: number; month: number }[]): Response {
  return new Response(JSON.stringify({ username: "test", archives }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function createGamesResponse(games: { url: string; endTime: string; timeClass?: string; pgn: string }[]): Response {
  return new Response(JSON.stringify({ username: "test", year: 2023, month: 1, games }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function createErrorResponse(body: { code: string; message: string; retryAfter?: number }, status = 400): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ChesscomGamePicker", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("renders the initial form", () => {
    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    expect(screen.getByLabelText("Chess.com username")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. hikaru")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load latest games" })).toBeEnabled();
    expect(screen.getByText(/Only public completed-game data is retrieved/)).toBeInTheDocument();
  });

  it("renders no password or credential fields", () => {
    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/token/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/oauth/i)).not.toBeInTheDocument();
  });

  it("rejects empty username without fetch", async () => {
    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Load latest games" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trims username and uses encoded relative route", async () => {
    fetchMock.mockResolvedValueOnce(createArchivesResponse([]));
    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "  hikaru  " } });
    fireEvent.click(screen.getByRole("button", { name: "Load latest games" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/chesscom/hikaru/archives", expect.any(Object));
  });

  it("requests archives before monthly games", async () => {
    fetchMock
      .mockResolvedValueOnce(createArchivesResponse([{ url: `/games/2023/01`, year: 2023, month: 1 }]))
      .mockResolvedValueOnce(createGamesResponse([]));

    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load latest games" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/chesscom/hikaru/archives");
    expect(fetchMock.mock.calls[1]![0]).toBe("/api/chesscom/hikaru/games/2023/01");
  });

  it("selects the latest archive from an unsorted response", async () => {
    fetchMock
      .mockResolvedValueOnce(
        createArchivesResponse([
          { url: "/games/2023/01", year: 2023, month: 1 },
          { url: "/games/2024/06", year: 2024, month: 6 },
          { url: "/games/2023/12", year: 2023, month: 12 },
        ])
      )
      .mockResolvedValueOnce(createGamesResponse([]));

    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load latest games" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]![0]).toBe("/api/chesscom/hikaru/games/2024/06");
  });

  it("disables inputs while loading", async () => {
    fetchMock.mockImplementationOnce(() => new Promise(() => {}));
    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load latest games" }));

    expect(screen.getByLabelText("Chess.com username")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();
  });

  it("sorts games newest first without mutating input", async () => {
    const gamesResponse = [
      { url: "1", endTime: "100", timeClass: "rapid", pgn: '[Event "1"]\n[White "W1"]\n[Black "B1"]\n\n1. e4 *' },
      { url: "2", endTime: "300", timeClass: "rapid", pgn: '[Event "2"]\n[White "W2"]\n[Black "B2"]\n\n1. e4 *' },
      { url: "3", endTime: "200", timeClass: "rapid", pgn: '[Event "3"]\n[White "W3"]\n[Black "B3"]\n\n1. e4 *' },
    ];

    fetchMock
      .mockResolvedValueOnce(createArchivesResponse([{ url: "/games/2023/01", year: 2023, month: 1 }]))
      .mockResolvedValueOnce(createGamesResponse(gamesResponse));

    const inputCopy = gamesResponse.map((g) => ({ ...g }));
    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load latest games" }));

    await waitFor(() => {
      const items = screen.getAllByRole("listitem");
      expect(items).toHaveLength(3);
      expect(items[0].textContent).toContain("W2 vs B2");
      expect(items[1].textContent).toContain("W3 vs B3");
      expect(items[2].textContent).toContain("W1 vs B1");
    });
    expect(gamesResponse).toEqual(inputCopy);
  });

  it("displays up to 20 games", async () => {
    const gamesResponse = Array.from({ length: 25 }, (_, i) => ({
      url: String(i),
      endTime: String(1000 + i),
      timeClass: "rapid",
      pgn: `[Event "${i}"]\n\n1. e4 *`,
    }));

    fetchMock
      .mockResolvedValueOnce(createArchivesResponse([{ url: "/games/2023/01", year: 2023, month: 1 }]))
      .mockResolvedValueOnce(createGamesResponse(gamesResponse));

    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load latest games" }));

    await waitFor(() => {
      const listItems = screen.getAllByRole("listitem");
      expect(listItems).toHaveLength(20);
    });
  });

  it("derives player names and result from PGN headers", async () => {
    const pgn = '[Event "Test"]\n[White "Alice"]\n[Black "Bob"]\n[Result "1-0"]\n\n1. e4 e5 *';
    fetchMock
      .mockResolvedValueOnce(createArchivesResponse([{ url: "/games/2023/01", year: 2023, month: 1 }]))
      .mockResolvedValueOnce(createGamesResponse([{ url: "1", endTime: "1000", timeClass: "blitz", pgn }]));

    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load latest games" }));

    await waitFor(() => {
      expect(screen.getByText(/Alice vs Bob/)).toBeInTheDocument();
      const listItems = screen.getAllByRole("listitem");
      expect(listItems).toHaveLength(1);
    });
  });

  it("uses fallbacks for missing PGN metadata", async () => {
    const pgn = '\n\n1. e4 e5 *';
    fetchMock
      .mockResolvedValueOnce(createArchivesResponse([{ url: "/games/2023/01", year: 2023, month: 1 }]))
      .mockResolvedValueOnce(createGamesResponse([{ url: "1", endTime: "1000", timeClass: "rapid", pgn }]));

    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load latest games" }));

    await waitFor(() => {
      const items = screen.getAllByRole("listitem");
      expect(items[0].textContent).toContain("Not specified vs Not specified");
      expect(items[0].textContent).not.toContain("(");
    });
  });

  it("normalizes question-mark player headers to Not specified", async () => {
    const pgn = '[Event "Test"]\n[White "?"]\n[Black "?"]\n\n1. e4 e5 *';
    fetchMock
      .mockResolvedValueOnce(createArchivesResponse([{ url: "/games/2023/01", year: 2023, month: 1 }]))
      .mockResolvedValueOnce(createGamesResponse([{ url: "1", endTime: "1000", timeClass: "rapid", pgn }]));

    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load latest games" }));

    await waitFor(() => {
      const items = screen.getAllByRole("listitem");
      expect(items[0].textContent).toContain("Not specified vs Not specified");
      expect(items[0].textContent).not.toContain("?");
    });
  });

  it("normalizes empty and whitespace-only player headers", async () => {
    const pgn = '[Event "Test"]\n[White ""]\n[Black "   "]\n\n1. e4 e5 *';
    fetchMock
      .mockResolvedValueOnce(createArchivesResponse([{ url: "/games/2023/01", year: 2023, month: 1 }]))
      .mockResolvedValueOnce(createGamesResponse([{ url: "1", endTime: "1000", timeClass: "rapid", pgn }]));

    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load latest games" }));

    await waitFor(() => {
      const items = screen.getAllByRole("listitem");
      expect(items[0].textContent).toContain("Not specified vs Not specified");
    });
  });

  it("preserves legitimate player names unchanged", async () => {
    const pgn = '[Event "Test"]\n[White "Alice"]\n[Black "Bob"]\n\n1. e4 e5 *';
    fetchMock
      .mockResolvedValueOnce(createArchivesResponse([{ url: "/games/2023/01", year: 2023, month: 1 }]))
      .mockResolvedValueOnce(createGamesResponse([{ url: "1", endTime: "1000", timeClass: "rapid", pgn }]));

    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load latest games" }));

    await waitFor(() => {
      expect(screen.getByText(/Alice vs Bob/)).toBeInTheDocument();
    });
  });

  it("does not render result marker as a player name", async () => {
    const pgn = '[Event "Test"]\n\n1. e4 e5 *';
    fetchMock
      .mockResolvedValueOnce(createArchivesResponse([{ url: "/games/2023/01", year: 2023, month: 1 }]))
      .mockResolvedValueOnce(createGamesResponse([{ url: "1", endTime: "1000", timeClass: "rapid", pgn }]));

    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load latest games" }));

    await waitFor(() => {
      const items = screen.getAllByRole("listitem");
      expect(items[0].textContent).not.toContain("* vs *");
      expect(items[0].textContent).toContain("Not specified vs Not specified");
    });
  });

  it("calls onSelectPgn with exact PGN when reviewing", async () => {
    const pgn = '[Event "Test"]\n\n1. e4 e5 *';
    const onSelect = vi.fn();
    fetchMock
      .mockResolvedValueOnce(createArchivesResponse([{ url: "/games/2023/01", year: 2023, month: 1 }]))
      .mockResolvedValueOnce(createGamesResponse([{ url: "1", endTime: "1000", timeClass: "rapid", pgn }]));

    render(<ChesscomGamePicker onSelectPgn={onSelect} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load latest games" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Review game" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Review game" }));
    expect(onSelect).toHaveBeenCalledWith(pgn);
  });

  it("shows no archives state when archives array is empty", async () => {
    fetchMock.mockResolvedValueOnce(createArchivesResponse([]));
    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load latest games" }));

    await waitFor(() => {
      expect(screen.getByText("No public game archives found for this player.")).toBeInTheDocument();
    });
  });

  it("shows no games state when monthly games array is empty", async () => {
    fetchMock
      .mockResolvedValueOnce(createArchivesResponse([{ url: "/games/2023/01", year: 2023, month: 1 }]))
      .mockResolvedValueOnce(createGamesResponse([]));

    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load latest games" }));

    await waitFor(() => {
      expect(screen.getByText("No games found for the latest month.")).toBeInTheDocument();
    });
  });

  it("displays a 404 error safely", async () => {
    fetchMock.mockResolvedValueOnce(createErrorResponse({ code: "not-found", message: "Player not found." }, 404));
    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load latest games" }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("Player not found.");
      expect(alert).not.toHaveTextContent("ECONNREFUSED");
    });
  });

  it("displays a 429 error with retry information", async () => {
    fetchMock.mockResolvedValueOnce(createErrorResponse({ code: "rate-limited", message: "Rate limited by Chess.com.", retryAfter: 60 }, 429));
    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load latest games" }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("Rate limited by Chess.com.");
      expect(alert).toHaveTextContent("Retry after 60 seconds");
    });
  });

  it("displays a service/network error safely", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED 127.0.0.1:443"));
    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load latest games" }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("Unable to reach the server. Please try again later.");
      expect(alert).not.toHaveTextContent("ECONNREFUSED");
    });
  });

  it("handles malformed JSON safely", async () => {
    fetchMock.mockResolvedValueOnce(new Response("not json", { status: 200, headers: { "Content-Type": "application/json" } }));
    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load latest games" }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("Invalid archive response from server.");
    });
  });

  it("ignores stale responses from an older submission", async () => {
    const oldPgn = '[Event "old"]\n[White "Wold"]\n[Black "Bold"]\n\n1. e4 *';
    const newPgn = '[Event "new"]\n[White "Wnew"]\n[Black "Bnew"]\n\n1. d4 *';
    fetchMock
      .mockResolvedValueOnce(createArchivesResponse([{ url: "/games/2023/01", year: 2023, month: 1 }]))
      .mockResolvedValueOnce(createGamesResponse([{ url: "1", endTime: "100", timeClass: "rapid", pgn: oldPgn }]))
      .mockResolvedValueOnce(createArchivesResponse([{ url: "/games/2024/06", year: 2024, month: 6 }]))
      .mockResolvedValueOnce(createGamesResponse([{ url: "2", endTime: "200", timeClass: "rapid", pgn: newPgn }]));

    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    const input = screen.getByLabelText("Chess.com username");

    fireEvent.change(input, { target: { value: "old" } });
    fireEvent.click(screen.getByRole("button", { name: "Load latest games" }));

    await waitFor(() => expect(screen.getByText(/Wold vs Bold/)).toBeInTheDocument());

    fireEvent.change(input, { target: { value: "new" } });
    fireEvent.click(screen.getByRole("button", { name: "Load latest games" }));

    await waitFor(() => expect(screen.getByText(/Wnew vs Bnew/)).toBeInTheDocument());
    expect(screen.queryByText(/Wold vs Bold/)).not.toBeInTheDocument();
  });
});
