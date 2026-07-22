import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/features/game-import/chesscom", () => ({
  getMonthlyGames: vi.fn(),
}));

import { getMonthlyGames } from "@/features/game-import/chesscom";

describe("GET /api/chesscom/[username]/games/[year]/[month]", () => {
  it("returns monthly games on success", async () => {
    vi.mocked(getMonthlyGames).mockResolvedValue({
      ok: true,
      games: [
        {
          url: "https://www.chess.com/game/live/123456789",
          pgn: "1. e4 e5 *",
          endTime: "1672531200",
          timeControl: "300+0",
          timeClass: "rapid",
          rules: "chess",
          rated: true,
        },
      ],
    });

    const response = await GET(
      new Request("http://localhost/api/chesscom/hikaru/games/2023/01"),
      {
        params: Promise.resolve({ username: "hikaru", year: "2023", month: "01" }),
      }
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({
      username: "hikaru",
      year: 2023,
      month: 1,
      games: [
        {
          url: "https://www.chess.com/game/live/123456789",
          pgn: "1. e4 e5 *",
          endTime: "1672531200",
          timeControl: "300+0",
          timeClass: "rapid",
          rules: "chess",
          rated: true,
        },
      ],
      gameCount: 1,
    });
    expect(response.headers.get("cache-control")).toBe("public, max-age=1800, s-maxage=3600");
  });

  it("passes username, year, and month to the client", async () => {
    vi.mocked(getMonthlyGames).mockResolvedValue({ ok: true, games: [] });

    await GET(new Request("http://localhost/api/chesscom/hikaru/games/2023/01"), {
      params: Promise.resolve({ username: "hikaru", year: "2023", month: "01" }),
    });

    expect(getMonthlyGames).toHaveBeenCalledWith("hikaru", 2023, 1, expect.any(Function));
  });

  it("passes month as a number despite string params", async () => {
    vi.mocked(getMonthlyGames).mockResolvedValue({ ok: true, games: [] });

    await GET(new Request("http://localhost/api/chesscom/hikaru/games/2023/01"), {
      params: Promise.resolve({ username: "hikaru", year: "2023", month: "01" }),
    });

    const lastCall = vi.mocked(getMonthlyGames).mock.calls[0];
    expect(lastCall?.[1]).toBe(2023);
    expect(lastCall?.[2]).toBe(1);
  });

  it("maps invalid-input to 400", async () => {
    vi.mocked(getMonthlyGames).mockResolvedValue({
      ok: false,
      error: { kind: "invalid-input", reason: "Year must be a four-digit integer." },
    });

    const response = await GET(new Request("http://localhost/api/chesscom/hikaru/games/2023/01"), {
      params: Promise.resolve({ username: "hikaru", year: "2023", month: "01" }),
    });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toEqual({ code: "invalid-input", message: "Invalid username or date." });
  });

  it("maps not-found to 404", async () => {
    vi.mocked(getMonthlyGames).mockResolvedValue({
      ok: false,
      error: { kind: "not-found", status: 404 },
    });

    const response = await GET(new Request("http://localhost/api/chesscom/hikaru/games/2023/01"), {
      params: Promise.resolve({ username: "hikaru", year: "2023", month: "01" }),
    });

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json).toEqual({ code: "not-found", message: "Player not found." });
  });

  it("maps rate-limited to 429 with Retry-After header", async () => {
    vi.mocked(getMonthlyGames).mockResolvedValue({
      ok: false,
      error: { kind: "rate-limited", status: 429, retryAfterSeconds: 120 },
    });

    const response = await GET(new Request("http://localhost/api/chesscom/hikaru/games/2023/01"), {
      params: Promise.resolve({ username: "hikaru", year: "2023", month: "01" }),
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("120");
    const json = await response.json();
    expect(json).toEqual({ code: "rate-limited", message: "Rate limited by Chess.com.", retryAfter: 120 });
  });

  it("maps rate-limited without retry value", async () => {
    vi.mocked(getMonthlyGames).mockResolvedValue({
      ok: false,
      error: { kind: "rate-limited", status: 429 },
    });

    const response = await GET(new Request("http://localhost/api/chesscom/hikaru/games/2023/01"), {
      params: Promise.resolve({ username: "hikaru", year: "2023", month: "01" }),
    });

    expect(response.status).toBe(429);
    expect(response.headers.has("retry-after")).toBe(false);
    const json = await response.json();
    expect(json).toEqual({ code: "rate-limited", message: "Rate limited by Chess.com." });
  });

  it("maps http-error to 502", async () => {
    vi.mocked(getMonthlyGames).mockResolvedValue({
      ok: false,
      error: { kind: "http-error", status: 503 },
    });

    const response = await GET(new Request("http://localhost/api/chesscom/hikaru/games/2023/01"), {
      params: Promise.resolve({ username: "hikaru", year: "2023", month: "01" }),
    });

    expect(response.status).toBe(502);
    const json = await response.json();
    expect(json).toEqual({ code: "http-error", message: "Upstream error." });
  });

  it("maps network-error to 503", async () => {
    vi.mocked(getMonthlyGames).mockResolvedValue({
      ok: false,
      error: { kind: "network-error", reason: "offline" },
    });

    const response = await GET(new Request("http://localhost/api/chesscom/hikaru/games/2023/01"), {
      params: Promise.resolve({ username: "hikaru", year: "2023", month: "01" }),
    });

    expect(response.status).toBe(503);
    const json = await response.json();
    expect(json).toEqual({ code: "network-error", message: "Network error." });
  });

  it("maps invalid-response to 502", async () => {
    vi.mocked(getMonthlyGames).mockResolvedValue({
      ok: false,
      error: { kind: "invalid-response", reason: "bad json" },
    });

    const response = await GET(new Request("http://localhost/api/chesscom/hikaru/games/2023/01"), {
      params: Promise.resolve({ username: "hikaru", year: "2023", month: "01" }),
    });

    expect(response.status).toBe(502);
    const json = await response.json();
    expect(json).toEqual({ code: "invalid-response", message: "Invalid upstream response." });
  });

  it("does not expose internal error details", async () => {
    vi.mocked(getMonthlyGames).mockResolvedValue({
      ok: false,
      error: { kind: "network-error", reason: "ECONNREFUSED 127.0.0.1:443" },
    });

    const response = await GET(new Request("http://localhost/api/chesscom/hikaru/games/2023/01"), {
      params: Promise.resolve({ username: "hikaru", year: "2023", month: "01" }),
    });

    const json = await response.json();
    expect(json).not.toHaveProperty("reason");
    expect(json).not.toHaveProperty("body");
    expect(json).not.toHaveProperty("status");
  });
});
