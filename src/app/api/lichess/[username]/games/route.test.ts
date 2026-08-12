import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/features/game-import/lichess", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/game-import/lichess")>();
  return {
    ...actual,
    getRecentGamesPgn: vi.fn(),
  };
});

vi.mock("@/client-key", () => {
  let counter = 0;
  return {
    resolveClientKey: vi.fn(() => `mocked-client-key-${++counter}`),
  };
});

import { getRecentGamesPgn, LICHESS_MAX_GAMES } from "@/features/game-import/lichess";

describe("GET /api/lichess/[username]/games", () => {
  it("a successful call returns status 200", async () => {
    vi.mocked(getRecentGamesPgn).mockResolvedValue({
      ok: true,
      pgn: '[Event "Game 1"]\n1. e4 e5 1-0',
    });

    const response = await GET(
      new Request("http://localhost/api/lichess/thibault/games?max=5"),
      {
        params: Promise.resolve({ username: "thibault" }),
      }
    );

    expect(response.status).toBe(200);
  });

  it("the response body has a pgn field holding the exact PGN the client returned", async () => {
    const pgn = '[Event "Game 1"]\n1. e4 e5 1-0';
    vi.mocked(getRecentGamesPgn).mockResolvedValue({
      ok: true,
      pgn,
    });

    const response = await GET(
      new Request("http://localhost/api/lichess/thibault/games?max=5"),
      {
        params: Promise.resolve({ username: "thibault" }),
      }
    );

    const json = await response.json();
    expect(json.pgn).toBe(pgn);
  });

  it("the response body has a gameCount field computed with countPgnGames from src/features/chess/pgn, and a two-game body yields 2", async () => {
    const pgn = '[Event "Game 1"]\n1. e4 e5 1-0\n\n[Event "Game 2"]\n1. d4 d5 0-1';
    vi.mocked(getRecentGamesPgn).mockResolvedValue({
      ok: true,
      pgn,
    });

    const response = await GET(
      new Request("http://localhost/api/lichess/thibault/games?max=5"),
      {
        params: Promise.resolve({ username: "thibault" }),
      }
    );

    const json = await response.json();
    expect(json.gameCount).toBe(2);
  });

  it("an empty PGN body returns 200 with pgn empty and gameCount 0", async () => {
    vi.mocked(getRecentGamesPgn).mockResolvedValue({
      ok: true,
      pgn: "",
    });

    const response = await GET(
      new Request("http://localhost/api/lichess/thibault/games?max=5"),
      {
        params: Promise.resolve({ username: "thibault" }),
      }
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.pgn).toBe("");
    expect(json.gameCount).toBe(0);
  });

  it("the Cache-Control header is public, max-age=60, s-maxage=120, stale-while-revalidate=600", async () => {
    vi.mocked(getRecentGamesPgn).mockResolvedValue({
      ok: true,
      pgn: "",
    });

    const response = await GET(
      new Request("http://localhost/api/lichess/thibault/games?max=5"),
      {
        params: Promise.resolve({ username: "thibault" }),
      }
    );

    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=60, s-maxage=120, stale-while-revalidate=600"
    );
  });

  it("the max query parameter is forwarded to the client as a number", async () => {
    vi.mocked(getRecentGamesPgn).mockResolvedValue({
      ok: true,
      pgn: "",
    });

    await GET(
      new Request("http://localhost/api/lichess/thibault/games?max=10"),
      {
        params: Promise.resolve({ username: "thibault" }),
      }
    );

    expect(getRecentGamesPgn).toHaveBeenCalledWith(
      "thibault",
      10,
      expect.any(Function)
    );
  });

  it("a missing max query parameter defaults to LICHESS_MAX_GAMES", async () => {
    vi.mocked(getRecentGamesPgn).mockResolvedValue({
      ok: true,
      pgn: "",
    });

    await GET(
      new Request("http://localhost/api/lichess/thibault/games"),
      {
        params: Promise.resolve({ username: "thibault" }),
      }
    );

    expect(getRecentGamesPgn).toHaveBeenCalledWith(
      "thibault",
      LICHESS_MAX_GAMES,
      expect.any(Function)
    );
  });

  it("a non-numeric max query parameter returns 400 with code invalid-input and the client is never called", async () => {
    vi.mocked(getRecentGamesPgn).mockClear();

    const response = await GET(
      new Request("http://localhost/api/lichess/thibault/games?max=abc"),
      {
        params: Promise.resolve({ username: "thibault" }),
      }
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toEqual({
      code: "invalid-input",
      message: "Max query parameter must be a positive integer.",
    });
    expect(getRecentGamesPgn).not.toHaveBeenCalled();
  });

  it("client invalid-input maps to 400", async () => {
    vi.mocked(getRecentGamesPgn).mockResolvedValue({
      ok: false,
      error: { kind: "invalid-input", reason: "Username contains invalid characters." },
    });

    const response = await GET(
      new Request("http://localhost/api/lichess/user%20name/games"),
      {
        params: Promise.resolve({ username: "user name" }),
      }
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toEqual({
      code: "invalid-input",
      message: "Invalid username or max parameter.",
    });
  });

  it("client not-found maps to 404", async () => {
    vi.mocked(getRecentGamesPgn).mockResolvedValue({
      ok: false,
      error: { kind: "not-found", status: 404 },
    });

    const response = await GET(
      new Request("http://localhost/api/lichess/nonexistent/games"),
      {
        params: Promise.resolve({ username: "nonexistent" }),
      }
    );

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json).toEqual({
      code: "not-found",
      message: "Player not found.",
    });
  });

  it("client rate-limited maps to 429 and sets a Retry-After header", async () => {
    vi.mocked(getRecentGamesPgn).mockResolvedValue({
      ok: false,
      error: { kind: "rate-limited", status: 429, retryAfterSeconds: 60 },
    });

    const response = await GET(
      new Request("http://localhost/api/lichess/thibault/games"),
      {
        params: Promise.resolve({ username: "thibault" }),
      }
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    const json = await response.json();
    expect(json).toEqual({
      code: "rate-limited",
      message: "Rate limited by Lichess.",
      retryAfter: 60,
    });
  });

  it("client http-error maps to 502", async () => {
    vi.mocked(getRecentGamesPgn).mockResolvedValue({
      ok: false,
      error: { kind: "http-error", status: 500 },
    });

    const response = await GET(
      new Request("http://localhost/api/lichess/thibault/games"),
      {
        params: Promise.resolve({ username: "thibault" }),
      }
    );

    expect(response.status).toBe(502);
    const json = await response.json();
    expect(json).toEqual({
      code: "http-error",
      message: "Upstream error.",
    });
  });

  it("client network-error maps to 503", async () => {
    vi.mocked(getRecentGamesPgn).mockResolvedValue({
      ok: false,
      error: { kind: "network-error", reason: "offline" },
    });

    const response = await GET(
      new Request("http://localhost/api/lichess/thibault/games"),
      {
        params: Promise.resolve({ username: "thibault" }),
      }
    );

    expect(response.status).toBe(503);
    const json = await response.json();
    expect(json).toEqual({
      code: "network-error",
      message: "Network error.",
    });
  });

  it("client invalid-response maps to 502", async () => {
    vi.mocked(getRecentGamesPgn).mockResolvedValue({
      ok: false,
      error: { kind: "invalid-response", reason: "too large" },
    });

    const response = await GET(
      new Request("http://localhost/api/lichess/thibault/games"),
      {
        params: Promise.resolve({ username: "thibault" }),
      }
    );

    expect(response.status).toBe(502);
    const json = await response.json();
    expect(json).toEqual({
      code: "invalid-response",
      message: "Invalid upstream response.",
    });
  });
});
