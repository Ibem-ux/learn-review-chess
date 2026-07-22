import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/features/game-import/chesscom", () => ({
  getArchives: vi.fn(),
}));

import { getArchives } from "@/features/game-import/chesscom";

describe("GET /api/chesscom/[username]/archives", () => {
  it("returns archive months on success", async () => {
    vi.mocked(getArchives).mockResolvedValue({
      ok: true,
      archives: [
        { url: "https://api.chess.com/pub/player/hikaru/games/2023/01", year: 2023, month: 1 },
        { url: "https://api.chess.com/pub/player/hikaru/games/2023/02", year: 2023, month: 2 },
      ],
    });

    const response = await GET(new Request("http://localhost/api/chesscom/hikaru/archives"), {
      params: Promise.resolve({ username: "hikaru" }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({
      username: "hikaru",
      archives: [
        { url: "https://api.chess.com/pub/player/hikaru/games/2023/01", year: 2023, month: 1 },
        { url: "https://api.chess.com/pub/player/hikaru/games/2023/02", year: 2023, month: 2 },
      ],
    });
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600, s-maxage=86400");
  });

  it("passes the username to the client", async () => {
    vi.mocked(getArchives).mockResolvedValue({ ok: true, archives: [] });

    await GET(new Request("http://localhost/api/chesscom/hikaru/archives"), {
      params: Promise.resolve({ username: "hikaru" }),
    });

    expect(getArchives).toHaveBeenCalledWith("hikaru", expect.any(Function));
  });

  it("maps invalid-input to 400", async () => {
    vi.mocked(getArchives).mockResolvedValue({
      ok: false,
      error: { kind: "invalid-input", reason: "Username must not be empty." },
    });

    const response = await GET(new Request("http://localhost/api/chesscom/hikaru/archives"), {
      params: Promise.resolve({ username: "hikaru" }),
    });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toEqual({ code: "invalid-input", message: "Invalid username." });
  });

  it("maps not-found to 404", async () => {
    vi.mocked(getArchives).mockResolvedValue({
      ok: false,
      error: { kind: "not-found", status: 404 },
    });

    const response = await GET(new Request("http://localhost/api/chesscom/hikaru/archives"), {
      params: Promise.resolve({ username: "hikaru" }),
    });

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json).toEqual({ code: "not-found", message: "Player not found." });
  });

  it("maps rate-limited to 429 with Retry-After header", async () => {
    vi.mocked(getArchives).mockResolvedValue({
      ok: false,
      error: { kind: "rate-limited", status: 429, retryAfterSeconds: 60 },
    });

    const response = await GET(new Request("http://localhost/api/chesscom/hikaru/archives"), {
      params: Promise.resolve({ username: "hikaru" }),
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    const json = await response.json();
    expect(json).toEqual({ code: "rate-limited", message: "Rate limited by Chess.com.", retryAfter: 60 });
  });

  it("maps rate-limited without retry value", async () => {
    vi.mocked(getArchives).mockResolvedValue({
      ok: false,
      error: { kind: "rate-limited", status: 429 },
    });

    const response = await GET(new Request("http://localhost/api/chesscom/hikaru/archives"), {
      params: Promise.resolve({ username: "hikaru" }),
    });

    expect(response.status).toBe(429);
    expect(response.headers.has("retry-after")).toBe(false);
    const json = await response.json();
    expect(json).toEqual({ code: "rate-limited", message: "Rate limited by Chess.com." });
  });

  it("maps http-error to 502", async () => {
    vi.mocked(getArchives).mockResolvedValue({
      ok: false,
      error: { kind: "http-error", status: 500 },
    });

    const response = await GET(new Request("http://localhost/api/chesscom/hikaru/archives"), {
      params: Promise.resolve({ username: "hikaru" }),
    });

    expect(response.status).toBe(502);
    const json = await response.json();
    expect(json).toEqual({ code: "http-error", message: "Upstream error." });
  });

  it("maps network-error to 503", async () => {
    vi.mocked(getArchives).mockResolvedValue({
      ok: false,
      error: { kind: "network-error", reason: "network down" },
    });

    const response = await GET(new Request("http://localhost/api/chesscom/hikaru/archives"), {
      params: Promise.resolve({ username: "hikaru" }),
    });

    expect(response.status).toBe(503);
    const json = await response.json();
    expect(json).toEqual({ code: "network-error", message: "Network error." });
  });

  it("maps invalid-response to 502", async () => {
    vi.mocked(getArchives).mockResolvedValue({
      ok: false,
      error: { kind: "invalid-response", reason: "bad json" },
    });

    const response = await GET(new Request("http://localhost/api/chesscom/hikaru/archives"), {
      params: Promise.resolve({ username: "hikaru" }),
    });

    expect(response.status).toBe(502);
    const json = await response.json();
    expect(json).toEqual({ code: "invalid-response", message: "Invalid upstream response." });
  });

  it("does not expose internal error details", async () => {
    vi.mocked(getArchives).mockResolvedValue({
      ok: false,
      error: { kind: "http-error", status: 500, body: "secret upstream body" },
    });

    const response = await GET(new Request("http://localhost/api/chesscom/hikaru/archives"), {
      params: Promise.resolve({ username: "hikaru" }),
    });

    const json = await response.json();
    expect(json).not.toHaveProperty("body");
    expect(json).not.toHaveProperty("reason");
    expect(json).not.toHaveProperty("status");
  });
});
