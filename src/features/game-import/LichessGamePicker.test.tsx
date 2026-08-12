import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LichessGamePicker from "./LichessGamePicker";

function createJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("LichessGamePicker", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("renders a username input and a submit button", () => {
    render(<LichessGamePicker onSelectPgn={vi.fn()} />);
    expect(screen.getByLabelText(/Lichess username/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Load games/i })).toBeInTheDocument();
  });

  it("submitting an empty username shows an error and never calls fetch", () => {
    render(<LichessGamePicker onSelectPgn={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Load games/i }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Please enter a username/i);
  });

  it("submitting thibault requests exactly /api/lichess/thibault/games?max=20", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ pgn: "", gameCount: 0 }));
    render(<LichessGamePicker onSelectPgn={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Lichess username/i), { target: { value: "thibault" } });
    fireEvent.click(screen.getByRole("button", { name: /Load games/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/lichess/thibault/games?max=20", expect.any(Object));
  });

  it("the submit button is disabled while the request is pending", async () => {
    let resolveFetch!: (res: Response) => void;
    const pendingPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    fetchMock.mockReturnValue(pendingPromise);

    render(<LichessGamePicker onSelectPgn={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Lichess username/i), { target: { value: "thibault" } });
    fireEvent.click(screen.getByRole("button", { name: /Load games/i }));

    expect(screen.getByRole("button", { name: /Loading|Load/i })).toBeDisabled();

    resolveFetch(createJsonResponse({ pgn: "", gameCount: 0 }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Load games/i })).toBeEnabled());
  });

  it("a status message is shown while the request is pending", async () => {
    let resolveFetch!: (res: Response) => void;
    const pendingPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    fetchMock.mockReturnValue(pendingPromise);

    render(<LichessGamePicker onSelectPgn={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Lichess username/i), { target: { value: "thibault" } });
    fireEvent.click(screen.getByRole("button", { name: /Load games/i }));

    expect(screen.getByText(/Fetching games from Lichess/i)).toBeInTheDocument();

    resolveFetch(createJsonResponse({ pgn: "", gameCount: 0 }));
    await waitFor(() => expect(screen.queryByText(/Fetching games from Lichess/i)).not.toBeInTheDocument());
  });

  it("a body with a two-game pgn renders exactly two game rows", async () => {
    const samplePgn = '[Event "Live Chess"]\n[White "player1"]\n[Black "player2"]\n[Result "1-0"]\n\n1. e4 e5 1-0\n\n[Event "Live Chess"]\n[White "player3"]\n[Black "player4"]\n[Result "0-1"]\n\n1. d4 d5 0-1';
    fetchMock.mockResolvedValueOnce(createJsonResponse({ pgn: samplePgn, gameCount: 2 }));

    render(<LichessGamePicker onSelectPgn={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Lichess username/i), { target: { value: "thibault" } });
    fireEvent.click(screen.getByRole("button", { name: /Load games/i }));

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
  });

  it("each row shows the white and black player names taken from getPlayerAndResult", async () => {
    const samplePgn = '[Event "Live Chess"]\n[White "Magnus"]\n[Black "Hikaru"]\n[Result "1-0"]\n\n1. e4 e5 1-0\n\n[Event "Live Chess"]\n[White "Fabi"]\n[Black "Naka"]\n[Result "0-1"]\n\n1. d4 d5 0-1';
    fetchMock.mockResolvedValueOnce(createJsonResponse({ pgn: samplePgn, gameCount: 2 }));

    render(<LichessGamePicker onSelectPgn={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Lichess username/i), { target: { value: "thibault" } });
    fireEvent.click(screen.getByRole("button", { name: /Load games/i }));

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
    expect(screen.getByText(/Magnus vs Hikaru/i)).toBeInTheDocument();
    expect(screen.getByText(/Fabi vs Naka/i)).toBeInTheDocument();
  });

  it("each row shows the game result", async () => {
    const samplePgn = '[Event "Live Chess"]\n[White "Magnus"]\n[Black "Hikaru"]\n[Result "1-0"]\n\n1. e4 e5 1-0';
    fetchMock.mockResolvedValueOnce(createJsonResponse({ pgn: samplePgn, gameCount: 1 }));

    render(<LichessGamePicker onSelectPgn={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Lichess username/i), { target: { value: "thibault" } });
    fireEvent.click(screen.getByRole("button", { name: /Load games/i }));

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
    expect(screen.getByText("1-0")).toBeInTheDocument();
  });

  it("clicking a row calls onSelectPgn with exactly that game's pgn text and nothing else", async () => {
    const game1Pgn = '[Event "Game 1"]\n[White "A"]\n[Black "B"]\n[Result "1-0"]\n\n1. e4 e5 1-0';
    const game2Pgn = '[Event "Game 2"]\n[White "C"]\n[Black "D"]\n[Result "0-1"]\n\n1. d4 d5 0-1';
    const twoGamePgn = `${game1Pgn}\n\n${game2Pgn}`;
    fetchMock.mockResolvedValueOnce(createJsonResponse({ pgn: twoGamePgn, gameCount: 2 }));

    const onSelectPgn = vi.fn();
    render(<LichessGamePicker onSelectPgn={onSelectPgn} />);
    fireEvent.change(screen.getByLabelText(/Lichess username/i), { target: { value: "thibault" } });
    fireEvent.click(screen.getByRole("button", { name: /Load games/i }));

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: /C vs D/i }));
    expect(onSelectPgn).toHaveBeenCalledTimes(1);
    expect(onSelectPgn).toHaveBeenCalledWith(game2Pgn);
  });

  it("a body with pgn set to the empty string shows a no games found message and renders no rows", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ pgn: "", gameCount: 0 }));

    render(<LichessGamePicker onSelectPgn={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Lichess username/i), { target: { value: "thibault" } });
    fireEvent.click(screen.getByRole("button", { name: /Load games/i }));

    await waitFor(() => expect(screen.getByText(/No games found for this user/i)).toBeInTheDocument());
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("a 404 response shows a player not found message", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ code: "not-found", message: "Player not found." }, 404));

    render(<LichessGamePicker onSelectPgn={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Lichess username/i), { target: { value: "unknownuser" } });
    fireEvent.click(screen.getByRole("button", { name: /Load games/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Player not found/i));
  });

  it("a 429 response shows a rate limited message", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ code: "rate-limited", message: "Rate limited by Lichess." }, 429));

    render(<LichessGamePicker onSelectPgn={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Lichess username/i), { target: { value: "thibault" } });
    fireEvent.click(screen.getByRole("button", { name: /Load games/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Rate limit exceeded/i));
  });

  it("a 500 response shows a generic failure message", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ code: "http-error", message: "Upstream error." }, 500));

    render(<LichessGamePicker onSelectPgn={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Lichess username/i), { target: { value: "thibault" } });
    fireEvent.click(screen.getByRole("button", { name: /Load games/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Failed to load games/i));
  });

  it("a fetch that rejects shows a network failure message", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network error"));

    render(<LichessGamePicker onSelectPgn={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Lichess username/i), { target: { value: "thibault" } });
    fireEvent.click(screen.getByRole("button", { name: /Load games/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Network error/i));
  });

  it("a 200 body missing the pgn field shows an invalid response message and renders no rows", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ invalidField: "data" }));

    render(<LichessGamePicker onSelectPgn={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Lichess username/i), { target: { value: "thibault" } });
    fireEvent.click(screen.getByRole("button", { name: /Load games/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Invalid response from server/i));
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("an error from a first failed submit is cleared when a second submit succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(createJsonResponse({ code: "not-found" }, 404))
      .mockResolvedValueOnce(createJsonResponse({ pgn: '[Event "G1"]\n[White "W"]\n[Black "B"]\n[Result "1-0"]\n\n1. e4 1-0', gameCount: 1 }));

    render(<LichessGamePicker onSelectPgn={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Lichess username/i), { target: { value: "baduser" } });
    fireEvent.click(screen.getByRole("button", { name: /Load games/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Player not found/i));

    fireEvent.change(screen.getByLabelText(/Lichess username/i), { target: { value: "gooduser" } });
    fireEvent.click(screen.getByRole("button", { name: /Load games/i }));

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("a game row is a button that can be activated from the keyboard", async () => {
    const samplePgn = '[Event "Live Chess"]\n[White "Magnus"]\n[Black "Hikaru"]\n[Result "1-0"]\n\n1. e4 e5 1-0';
    fetchMock.mockResolvedValueOnce(createJsonResponse({ pgn: samplePgn, gameCount: 1 }));

    const onSelectPgn = vi.fn();
    render(<LichessGamePicker onSelectPgn={onSelectPgn} />);
    fireEvent.change(screen.getByLabelText(/Lichess username/i), { target: { value: "thibault" } });
    fireEvent.click(screen.getByRole("button", { name: /Load games/i }));

    const gameButton = await screen.findByRole("button", { name: /Magnus vs Hikaru/i });
    expect(gameButton).toBeInTheDocument();

    fireEvent.click(gameButton);
    expect(onSelectPgn).toHaveBeenCalledTimes(1);
    expect(onSelectPgn).toHaveBeenCalledWith(samplePgn);
  });

  it("a second submit started while a first is still pending leaves the form disabled until the second settles", async () => {
    let resolveFetch1!: (res: Response) => void;
    const promise1 = new Promise<Response>((resolve) => {
      resolveFetch1 = resolve;
    });
    let resolveFetch2!: (res: Response) => void;
    const promise2 = new Promise<Response>((resolve) => {
      resolveFetch2 = resolve;
    });

    fetchMock.mockReturnValueOnce(promise1).mockReturnValueOnce(promise2);

    render(<LichessGamePicker onSelectPgn={vi.fn()} />);

    // First submit
    fireEvent.change(screen.getByLabelText(/Lichess username/i), { target: { value: "user1" } });
    const button = screen.getByRole("button", { name: /Load games/i });
    fireEvent.click(button);

    // Second submit while first is pending
    fireEvent.change(screen.getByLabelText(/Lichess username/i), { target: { value: "user2" } });
    fireEvent.submit(button.closest("form")!);

    // Resolve first promise
    resolveFetch1(createJsonResponse({ pgn: "", gameCount: 0 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Form should still be disabled because second request is pending
    expect(screen.getByRole("button", { name: /Loading|Load/i })).toBeDisabled();

    // Resolve second promise
    resolveFetch2(createJsonResponse({ pgn: "", gameCount: 0 }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Load games/i })).toBeEnabled());
  });
});
