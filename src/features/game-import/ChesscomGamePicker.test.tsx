import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
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
    expect(screen.getByRole("button", { name: "Load games" })).toBeEnabled();
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
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trims username and uses encoded relative route", async () => {
    fetchMock.mockResolvedValueOnce(createArchivesResponse([]));
    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "  hikaru  " } });
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/chesscom/hikaru/archives", expect.any(Object));
  });

  it("requests archives before monthly games", async () => {
    fetchMock
      .mockResolvedValueOnce(createArchivesResponse([{ url: `/games/2023/01`, year: 2023, month: 1 }]))
      .mockResolvedValueOnce(createGamesResponse([]));

    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const firstCall = fetchMock.mock.calls[0];
    const secondCall = fetchMock.mock.calls[1];
    expect(firstCall?.[0]).toBe("/api/chesscom/hikaru/archives");
    expect(secondCall?.[0]).toBe("/api/chesscom/hikaru/games/2023/01");
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
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const secondCall = fetchMock.mock.calls[1];
    expect(secondCall?.[0]).toBe("/api/chesscom/hikaru/games/2024/06");
  });

  it("disables inputs while loading", async () => {
    fetchMock.mockImplementationOnce(() => new Promise(() => {}));
    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

    await waitFor(() => {
      const items = screen.getAllByRole("listitem");
      expect(items).toHaveLength(3);
      expect(items[0]?.textContent).toContain("W2 vs B2");
      expect(items[1]?.textContent).toContain("W3 vs B3");
      expect(items[2]?.textContent).toContain("W1 vs B1");
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
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

    await waitFor(() => {
      const items = screen.getAllByRole("listitem");
      expect(items[0]?.textContent).toContain("Not specified vs Not specified");
      expect(items[0]?.textContent).not.toContain("(");
    });
  });

  it("normalizes question-mark player headers to Not specified", async () => {
    const pgn = '[Event "Test"]\n[White "?"]\n[Black "?"]\n\n1. e4 e5 *';
    fetchMock
      .mockResolvedValueOnce(createArchivesResponse([{ url: "/games/2023/01", year: 2023, month: 1 }]))
      .mockResolvedValueOnce(createGamesResponse([{ url: "1", endTime: "1000", timeClass: "rapid", pgn }]));

    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

    await waitFor(() => {
      const items = screen.getAllByRole("listitem");
      expect(items[0]?.textContent).toContain("Not specified vs Not specified");
      expect(items[0]?.textContent).not.toContain("?");
    });
  });

  it("normalizes empty and whitespace-only player headers", async () => {
    const pgn = '[Event "Test"]\n[White ""]\n[Black "   "]\n\n1. e4 e5 *';
    fetchMock
      .mockResolvedValueOnce(createArchivesResponse([{ url: "/games/2023/01", year: 2023, month: 1 }]))
      .mockResolvedValueOnce(createGamesResponse([{ url: "1", endTime: "1000", timeClass: "rapid", pgn }]));

    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

    await waitFor(() => {
      const items = screen.getAllByRole("listitem");
      expect(items[0]?.textContent).toContain("Not specified vs Not specified");
    });
  });

  it("preserves legitimate player names unchanged", async () => {
    const pgn = '[Event "Test"]\n[White "Alice"]\n[Black "Bob"]\n\n1. e4 e5 *';
    fetchMock
      .mockResolvedValueOnce(createArchivesResponse([{ url: "/games/2023/01", year: 2023, month: 1 }]))
      .mockResolvedValueOnce(createGamesResponse([{ url: "1", endTime: "1000", timeClass: "rapid", pgn }]));

    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

    await waitFor(() => {
      const items = screen.getAllByRole("listitem");
      expect(items[0]?.textContent).not.toContain("* vs *");
      expect(items[0]?.textContent).toContain("Not specified vs Not specified");
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
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Review game" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Review game" }));
    expect(onSelect).toHaveBeenCalledWith(pgn);
  });

  it("shows no archives state when archives array is empty", async () => {
    fetchMock.mockResolvedValueOnce(createArchivesResponse([]));
    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

    await waitFor(() => {
      expect(screen.getByText("No games found for January 2023.")).toBeInTheDocument();
    });
  });

  it("displays a 404 error safely", async () => {
    fetchMock.mockResolvedValueOnce(createErrorResponse({ code: "not-found", message: "Player not found." }, 404));
    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

    await waitFor(() => expect(screen.getByText(/Wold vs Bold/)).toBeInTheDocument());

    fireEvent.change(input, { target: { value: "new" } });
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

    await waitFor(() => expect(screen.getByText(/Wnew vs Bnew/)).toBeInTheDocument());
    expect(screen.queryByText(/Wold vs Bold/)).not.toBeInTheDocument();
  });

  it("renders every archive month as an option in the select", async () => {
    fetchMock
      .mockResolvedValueOnce(
        createArchivesResponse([
          { url: "/games/2023/01", year: 2023, month: 1 },
          { url: "/games/2024/06", year: 2024, month: 6 },
        ])
      )
      .mockResolvedValueOnce(createGamesResponse([]));

    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

    await waitFor(() => expect(screen.getByTestId("archive-month-select")).toBeInTheDocument());

    const select = screen.getByTestId("archive-month-select");
    const options = select.querySelectorAll("option");
    expect(options).toHaveLength(2);
    expect(options[0]?.textContent).toBe("June 2024");
    expect(options[1]?.textContent).toBe("January 2023");
  });

  it("orders archive month options newest first", async () => {
    fetchMock
      .mockResolvedValueOnce(
        createArchivesResponse([
          { url: "/games/2022/11", year: 2022, month: 11 },
          { url: "/games/2025/03", year: 2025, month: 3 },
          { url: "/games/2025/01", year: 2025, month: 1 },
        ])
      )
      .mockResolvedValueOnce(createGamesResponse([]));

    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

    await waitFor(() => expect(screen.getByTestId("archive-month-select")).toBeInTheDocument());

    const select = screen.getByTestId("archive-month-select");
    const options = select.querySelectorAll("option");
    const values = Array.from(options).map((opt) => opt.value);
    expect(values).toEqual(["2025-03", "2025-01", "2022-11"]);
  });

  it("selects the newest month on initial submit and requests its games", async () => {
    fetchMock
      .mockResolvedValueOnce(
        createArchivesResponse([
          { url: "/games/2023/05", year: 2023, month: 5 },
          { url: "/games/2024/02", year: 2024, month: 2 },
        ])
      )
      .mockResolvedValueOnce(createGamesResponse([]));

    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const select = screen.getByTestId("archive-month-select");
    expect(select).toHaveValue("2024-02");
    const secondCall = fetchMock.mock.calls[1];
    expect(secondCall?.[0]).toBe("/api/chesscom/hikaru/games/2024/02");
  });

  it("requests games for an older month on select change without refetching archives", async () => {
    fetchMock
      .mockResolvedValueOnce(
        createArchivesResponse([
          { url: "/games/2024/06", year: 2024, month: 6 },
          { url: "/games/2023/01", year: 2023, month: 1 },
        ])
      )
      .mockResolvedValueOnce(createGamesResponse([]))
      .mockResolvedValueOnce(createGamesResponse([]));

    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const select = screen.getByTestId("archive-month-select");
    fireEvent.change(select, { target: { value: "2023-01" } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const thirdCall = fetchMock.mock.calls[2];
    expect(thirdCall?.[0]).toBe("/api/chesscom/hikaru/games/2023/01");
  });

  it("replaces displayed games when a new month is selected", async () => {
    const juneGames = [
      { url: "1", endTime: "100", timeClass: "rapid", pgn: '[Event "June Game"]\n[White "JuneW"]\n[Black "JuneB"]\n\n1. e4 *' },
    ];
    const janGames = [
      { url: "2", endTime: "200", timeClass: "rapid", pgn: '[Event "Jan Game"]\n[White "JanW"]\n[Black "JanB"]\n\n1. d4 *' },
    ];

    fetchMock
      .mockResolvedValueOnce(
        createArchivesResponse([
          { url: "/games/2024/06", year: 2024, month: 6 },
          { url: "/games/2024/01", year: 2024, month: 1 },
        ])
      )
      .mockResolvedValueOnce(createGamesResponse(juneGames))
      .mockResolvedValueOnce(createGamesResponse(janGames));

    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

    await waitFor(() => expect(screen.getByText(/JuneW vs JuneB/)).toBeInTheDocument());

    fireEvent.change(screen.getByTestId("archive-month-select"), { target: { value: "2024-01" } });

    await waitFor(() => expect(screen.getByText(/JanW vs JanB/)).toBeInTheDocument());
    expect(screen.queryByText(/JuneW vs JuneB/)).not.toBeInTheDocument();
  });

  it("names the selected month when that month returns no games", async () => {
    fetchMock
      .mockResolvedValueOnce(
        createArchivesResponse([
          { url: "/games/2025/08", year: 2025, month: 8 },
        ])
      )
      .mockResolvedValueOnce(createGamesResponse([]));

    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

    await waitFor(() => {
      expect(screen.getByText("No games found for August 2025.")).toBeInTheDocument();
    });
  });

  it("uses the originally loaded username when username input changes before month change", async () => {
    fetchMock
      .mockResolvedValueOnce(
        createArchivesResponse([
          { url: "/games/2024/06", year: 2024, month: 6 },
          { url: "/games/2023/01", year: 2023, month: 1 },
        ])
      )
      .mockResolvedValueOnce(createGamesResponse([]))
      .mockResolvedValueOnce(createGamesResponse([]));

    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    const usernameInput = screen.getByLabelText("Chess.com username");
    fireEvent.change(usernameInput, { target: { value: "originaluser" } });
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    fireEvent.change(usernameInput, { target: { value: "editeduser" } });

    const select = screen.getByTestId("archive-month-select");
    fireEvent.change(select, { target: { value: "2023-01" } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const thirdCall = fetchMock.mock.calls[2];
    expect(thirdCall?.[0]).toBe("/api/chesscom/originaluser/games/2023/01");
  });

  it("renders only valid month entries when response contains month 13", async () => {
    fetchMock
      .mockResolvedValueOnce(
        createArchivesResponse([
          { url: "/games/2024/13", year: 2024, month: 13 },
          { url: "/games/2024/06", year: 2024, month: 6 },
        ])
      )
      .mockResolvedValueOnce(createGamesResponse([]));

    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

    await waitFor(() => expect(screen.getByTestId("archive-month-select")).toBeInTheDocument());

    const select = screen.getByTestId("archive-month-select");
    const options = select.querySelectorAll("option");
    expect(options).toHaveLength(1);
    expect(options[0]?.textContent).toBe("June 2024");
  });

  it("while the archives request is pending, the submit button carries aria-busy=\"true\"; before any submit it carries aria-busy=\"false\"", async () => {
    let resolveFetch!: (res: Response) => void;
    const pendingPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    fetchMock.mockReturnValue(pendingPromise);

    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    const submitButton = screen.getByRole("button", { name: "Load games" });
    expect(submitButton).toHaveAttribute("aria-busy", "false");

    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(submitButton);

    expect(submitButton).toHaveAttribute("aria-busy", "true");

    resolveFetch(createArchivesResponse([]));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it("the pending status region is queryable by role status and carries aria-live=\"polite\"", async () => {
    let resolveFetch!: (res: Response) => void;
    const pendingPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    fetchMock.mockReturnValue(pendingPromise);

    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

    const statusRegion = screen.getByRole("status");
    expect(statusRegion).toHaveAttribute("aria-live", "polite");
    expect(statusRegion).toHaveTextContent("Loading available months...");

    resolveFetch(createArchivesResponse([]));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it("while the games request following a month change is pending, the archive month select carries aria-busy=\"true\"", async () => {
    fetchMock
      .mockResolvedValueOnce(
        createArchivesResponse([
          { url: "/games/2024/05", year: 2024, month: 5 },
          { url: "/games/2024/04", year: 2024, month: 4 },
        ])
      )
      .mockResolvedValueOnce(createGamesResponse([]));

    render(<ChesscomGamePicker onSelectPgn={() => {}} />);
    fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
    fireEvent.click(screen.getByRole("button", { name: "Load games" }));

    await waitFor(() => expect(screen.getByTestId("archive-month-select")).toBeInTheDocument());

    const select = screen.getByTestId("archive-month-select");
    expect(select).toHaveAttribute("aria-busy", "false");

    let resolveGamesFetch!: (res: Response) => void;
    const pendingGamesPromise = new Promise<Response>((resolve) => {
      resolveGamesFetch = resolve;
    });
    fetchMock.mockReturnValue(pendingGamesPromise);

    fireEvent.change(select, { target: { value: "2024-04" } });

    expect(select).toHaveAttribute("aria-busy", "true");

    resolveGamesFetch(createGamesResponse([]));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  describe("loading text contrast contract (task B2-R)", () => {
    it("renders status text element with high-contrast foreground color classes text-black and dark:text-zinc-50 during loading", async () => {
      let resolveFetch!: (res: Response) => void;
      const pendingPromise = new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });
      fetchMock.mockReturnValue(pendingPromise);

      render(<ChesscomGamePicker onSelectPgn={() => {}} />);
      fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
      fireEvent.click(screen.getByRole("button", { name: "Load games" }));

      const statusElement = screen.getByRole("status");
      expect(statusElement).toBeInTheDocument();
      expect(statusElement.className).toContain("text-black");
      expect(statusElement.className).toContain("dark:text-zinc-50");

      resolveFetch(createArchivesResponse([]));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
    });
  });

  describe("month-switch loading feedback and stability (task B2-F)", () => {
    it("status region carries min-h-5 minimum height class", () => {
      render(<ChesscomGamePicker onSelectPgn={() => {}} />);
      const statusElement = screen.getByRole("status");
      expect(statusElement.className).toContain("min-h-5");
    });

    it("renders data-testid status-indicator with aria-hidden true during loading states, and omits it in non-loading states", async () => {
      let resolveArchivesFetch!: (res: Response) => void;
      const archivesPromise = new Promise<Response>((resolve) => {
        resolveArchivesFetch = resolve;
      });

      fetchMock.mockReturnValue(archivesPromise);

      render(<ChesscomGamePicker onSelectPgn={() => {}} />);
      expect(screen.queryByTestId("status-indicator")).not.toBeInTheDocument();

      fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
      fireEvent.click(screen.getByRole("button", { name: "Load games" }));

      const indicator = screen.getByTestId("status-indicator");
      expect(indicator).toBeInTheDocument();
      expect(indicator.getAttribute("aria-hidden")).toBe("true");

      let resolveGamesFetch!: (res: Response) => void;
      const gamesPromise = new Promise<Response>((resolve) => {
        resolveGamesFetch = resolve;
      });

      fetchMock.mockReturnValue(gamesPromise);

      resolveArchivesFetch(
        createArchivesResponse([{ url: "/games/2024/06", year: 2024, month: 6 }])
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      const gamesIndicator = screen.getByTestId("status-indicator");
      expect(gamesIndicator).toBeInTheDocument();
      expect(gamesIndicator.getAttribute("aria-hidden")).toBe("true");

      resolveGamesFetch(
        createGamesResponse([
          { url: "1", endTime: "100", timeClass: "rapid", pgn: '[Event "1"]\n\n1. e4 *' },
        ])
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(screen.queryByTestId("status-indicator")).not.toBeInTheDocument();
    });

    it("retains previously loaded game rows with aria-busy true on ul while new month fetch is in flight, and updates to new games with aria-busy false when resolved", async () => {
      const juneGames = [
        { url: "1", endTime: "100", timeClass: "rapid", pgn: '[Event "June"]\n[White "JuneW"]\n[Black "JuneB"]\n\n1. e4 *' },
      ];
      const janGames = [
        { url: "2", endTime: "200", timeClass: "rapid", pgn: '[Event "Jan"]\n[White "JanW"]\n[Black "JanB"]\n\n1. d4 *' },
      ];

      let resolveJanGamesFetch!: (res: Response) => void;
      const janGamesPromise = new Promise<Response>((resolve) => {
        resolveJanGamesFetch = resolve;
      });

      fetchMock
        .mockResolvedValueOnce(
          createArchivesResponse([
            { url: "/games/2024/06", year: 2024, month: 6 },
            { url: "/games/2024/01", year: 2024, month: 1 },
          ])
        )
        .mockResolvedValueOnce(createGamesResponse(juneGames))
        .mockReturnValueOnce(janGamesPromise);

      render(<ChesscomGamePicker onSelectPgn={() => {}} />);
      fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
      fireEvent.click(screen.getByRole("button", { name: "Load games" }));

      await waitFor(() => expect(screen.getByText(/JuneW vs JuneB/)).toBeInTheDocument());

      const listBefore = screen.getByRole("list");
      expect(listBefore.getAttribute("aria-busy")).toBe("false");
      expect(listBefore.className).not.toContain("opacity-50");

      fireEvent.change(screen.getByTestId("archive-month-select"), { target: { value: "2024-01" } });

      expect(screen.getByText(/JuneW vs JuneB/)).toBeInTheDocument();
      const listInFlight = screen.getByRole("list");
      expect(listInFlight.getAttribute("aria-busy")).toBe("true");
      expect(listInFlight.className).toContain("opacity-50");
      expect(listInFlight.className).toContain("pointer-events-none");

      resolveJanGamesFetch(createGamesResponse(janGames));

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(screen.getByText(/JanW vs JanB/)).toBeInTheDocument();
      expect(screen.queryByText(/JuneW vs JuneB/)).not.toBeInTheDocument();
      const listAfter = screen.getByRole("list");
      expect(listAfter.getAttribute("aria-busy")).toBe("false");
      expect(listAfter.className).not.toContain("opacity-50");
    });

    it("clears stale game rows and shows no-games message when new month resolves with zero games", async () => {
      const juneGames = [
        { url: "1", endTime: "100", timeClass: "rapid", pgn: '[Event "June"]\n[White "JuneW"]\n[Black "JuneB"]\n\n1. e4 *' },
      ];

      fetchMock
        .mockResolvedValueOnce(
          createArchivesResponse([
            { url: "/games/2024/06", year: 2024, month: 6 },
            { url: "/games/2024/01", year: 2024, month: 1 },
          ])
        )
        .mockResolvedValueOnce(createGamesResponse(juneGames))
        .mockResolvedValueOnce(createGamesResponse([]));

      render(<ChesscomGamePicker onSelectPgn={() => {}} />);
      fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
      fireEvent.click(screen.getByRole("button", { name: "Load games" }));

      await waitFor(() => expect(screen.getByText(/JuneW vs JuneB/)).toBeInTheDocument());

      fireEvent.change(screen.getByTestId("archive-month-select"), { target: { value: "2024-01" } });

      await waitFor(() => {
        expect(screen.getByText("No games found for January 2024.")).toBeInTheDocument();
      });

      expect(screen.queryByRole("list")).not.toBeInTheDocument();
      expect(screen.queryByText(/JuneW vs JuneB/)).not.toBeInTheDocument();
    });

    it("does not write games into state from a superseded or stale month response", async () => {
      let resolveJuneFetch!: (res: Response) => void;
      const junePromise = new Promise<Response>((resolve) => {
        resolveJuneFetch = resolve;
      });

      const juneGames = [
        { url: "1", endTime: "100", timeClass: "rapid", pgn: '[Event "June"]\n[White "JuneW"]\n[Black "JuneB"]\n\n1. e4 *' },
      ];
      const janGames = [
        { url: "2", endTime: "200", timeClass: "rapid", pgn: '[Event "Jan"]\n[White "JanW"]\n[Black "JanB"]\n\n1. d4 *' },
      ];

      fetchMock
        .mockResolvedValueOnce(
          createArchivesResponse([
            { url: "/games/2024/06", year: 2024, month: 6 },
            { url: "/games/2024/01", year: 2024, month: 1 },
          ])
        )
        .mockReturnValueOnce(junePromise)
        .mockResolvedValueOnce(createGamesResponse(janGames));

      render(<ChesscomGamePicker onSelectPgn={() => {}} />);
      fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
      fireEvent.click(screen.getByRole("button", { name: "Load games" }));

      await waitFor(() => expect(screen.getByTestId("archive-month-select")).toBeInTheDocument());

      fireEvent.change(screen.getByTestId("archive-month-select"), { target: { value: "2024-01" } });

      await waitFor(() => expect(screen.getByText(/JanW vs JanB/)).toBeInTheDocument());

      resolveJuneFetch(createGamesResponse(juneGames));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(screen.getByText(/JanW vs JanB/)).toBeInTheDocument();
      expect(screen.queryByText(/JuneW vs JuneB/)).not.toBeInTheDocument();
    });
  });

  describe("native select dark-mode contrast contract (task B3)", () => {
    it("carries bg-white and dark:bg-zinc-900 on the archive month select element", async () => {
      fetchMock
        .mockResolvedValueOnce(
          createArchivesResponse([
            { url: "/games/2024/06", year: 2024, month: 6 },
            { url: "/games/2024/01", year: 2024, month: 1 },
          ])
        )
        .mockResolvedValueOnce(createGamesResponse([]));

      render(<ChesscomGamePicker onSelectPgn={() => {}} />);
      fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
      fireEvent.click(screen.getByRole("button", { name: "Load games" }));

      await waitFor(() => expect(screen.getByTestId("archive-month-select")).toBeInTheDocument());

      const select = screen.getByTestId("archive-month-select");
      expect(select.className).toContain("bg-white");
      expect(select.className).toContain("dark:bg-zinc-900");
    });

    it("carries bg-white, text-black, dark:bg-zinc-900 and dark:text-zinc-50 on every option element inside the archive month select", async () => {
      fetchMock
        .mockResolvedValueOnce(
          createArchivesResponse([
            { url: "/games/2024/06", year: 2024, month: 6 },
            { url: "/games/2024/05", year: 2024, month: 5 },
            { url: "/games/2024/01", year: 2024, month: 1 },
          ])
        )
        .mockResolvedValueOnce(createGamesResponse([]));

      render(<ChesscomGamePicker onSelectPgn={() => {}} />);
      fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
      fireEvent.click(screen.getByRole("button", { name: "Load games" }));

      await waitFor(() => expect(screen.getByTestId("archive-month-select")).toBeInTheDocument());

      const select = screen.getByTestId("archive-month-select");
      const options = select.querySelectorAll("option");
      expect(options.length).toBeGreaterThan(1);

      for (const option of options) {
        expect(option.className).toContain("bg-white");
        expect(option.className).toContain("text-black");
        expect(option.className).toContain("dark:bg-zinc-900");
        expect(option.className).toContain("dark:text-zinc-50");
      }
    });

    it("preserves text-black and dark:text-zinc-50 on the archive month select element", async () => {
      fetchMock
        .mockResolvedValueOnce(
          createArchivesResponse([
            { url: "/games/2024/06", year: 2024, month: 6 },
            { url: "/games/2024/01", year: 2024, month: 1 },
          ])
        )
        .mockResolvedValueOnce(createGamesResponse([]));

      render(<ChesscomGamePicker onSelectPgn={() => {}} />);
      fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
      fireEvent.click(screen.getByRole("button", { name: "Load games" }));

      await waitFor(() => expect(screen.getByTestId("archive-month-select")).toBeInTheDocument());

      const select = screen.getByTestId("archive-month-select");
      expect(select.className).toContain("text-black");
      expect(select.className).toContain("dark:text-zinc-50");
    });

    it("preserves min-h-5 on the status region and renders the status-indicator spinner during loading (B2-F regression guard)", () => {
      let resolveArchivesFetch!: (res: Response) => void;
      const archivesPromise = new Promise<Response>((resolve) => {
        resolveArchivesFetch = resolve;
      });
      fetchMock.mockReturnValue(archivesPromise);

      render(<ChesscomGamePicker onSelectPgn={() => {}} />);
      const statusElement = screen.getByRole("status");
      expect(statusElement.className).toContain("min-h-5");

      fireEvent.change(screen.getByLabelText("Chess.com username"), { target: { value: "hikaru" } });
      fireEvent.click(screen.getByRole("button", { name: "Load games" }));

      const spinner = screen.getByTestId("status-indicator");
      expect(spinner).toBeInTheDocument();
      expect(spinner.getAttribute("aria-hidden")).toBe("true");

      resolveArchivesFetch(createArchivesResponse([]));
    });
  });
});
