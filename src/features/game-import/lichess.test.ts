import { describe, expect, it, vi } from "vitest";
import { getRecentGamesPgn, LICHESS_MAX_GAMES } from "./lichess";
import { MAX_RESPONSE_BYTES } from "./http";

describe("getRecentGamesPgn", () => {
  it("empty username returns invalid-input", async () => {
    const fakeFetch = vi.fn();
    const result = await getRecentGamesPgn("", 5, fakeFetch);
    expect(result).toEqual({
      ok: false,
      error: { kind: "invalid-input", reason: expect.any(String) },
    });
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it("username longer than 30 characters returns invalid-input", async () => {
    const fakeFetch = vi.fn();
    const result = await getRecentGamesPgn("a".repeat(31), 5, fakeFetch);
    expect(result).toEqual({
      ok: false,
      error: { kind: "invalid-input", reason: expect.any(String) },
    });
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it("username containing a space returns invalid-input", async () => {
    const fakeFetch = vi.fn();
    const result = await getRecentGamesPgn("user name", 5, fakeFetch);
    expect(result).toEqual({
      ok: false,
      error: { kind: "invalid-input", reason: expect.any(String) },
    });
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it("username containing a slash returns invalid-input", async () => {
    const fakeFetch = vi.fn();
    const result = await getRecentGamesPgn("user/name", 5, fakeFetch);
    expect(result).toEqual({
      ok: false,
      error: { kind: "invalid-input", reason: expect.any(String) },
    });
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it("the requested URL is exactly https://lichess.org/api/games/user/thibault?max=5 for username thibault and max 5, asserted on the argument the fake fetch received", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: {},
      text: async () => "1. e4 e5 1-0",
    });
    await getRecentGamesPgn("thibault", 5, fakeFetch);
    expect(fakeFetch).toHaveBeenCalledWith(
      "https://lichess.org/api/games/user/thibault?max=5&clocks=false&evals=false&literate=false",
      expect.anything()
    );
  });

  it("the Accept header sent is application/x-chess-pgn", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: {},
      text: async () => "1. e4 e5 1-0",
    });
    await getRecentGamesPgn("thibault", 5, fakeFetch);
    expect(fakeFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/x-chess-pgn",
        }),
      })
    );
  });

  it("a User-Agent header is sent", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: {},
      text: async () => "1. e4 e5 1-0",
    });
    await getRecentGamesPgn("thibault", 5, fakeFetch);
    const call = fakeFetch.mock.calls[0];
    expect(call).toBeDefined();
    expect(typeof call[1]?.headers?.["User-Agent"]).toBe("string");
  });

  it("an AbortSignal is passed in init", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: {},
      text: async () => "1. e4 e5 1-0",
    });
    await getRecentGamesPgn("thibault", 5, fakeFetch);
    const call = fakeFetch.mock.calls[0];
    expect(call).toBeDefined();
    expect(call[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("max above LICHESS_MAX_GAMES is clamped down to LICHESS_MAX_GAMES, asserted by reading the URL the fake fetch received", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: {},
      text: async () => "1. e4 e5 1-0",
    });
    await getRecentGamesPgn("thibault", 100, fakeFetch);
    expect(fakeFetch).toHaveBeenCalledWith(
      `https://lichess.org/api/games/user/thibault?max=${LICHESS_MAX_GAMES}&clocks=false&evals=false&literate=false`,
      expect.anything()
    );
  });

  it("max below 1 returns invalid-input and the fake fetch is never called", async () => {
    const fakeFetch = vi.fn();
    const result = await getRecentGamesPgn("thibault", 0, fakeFetch);
    expect(result).toEqual({
      ok: false,
      error: { kind: "invalid-input", reason: expect.any(String) },
    });
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it("status 404 returns not-found", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      status: 404,
      headers: {},
      text: async () => "Not Found",
    });
    const result = await getRecentGamesPgn("thibault", 5, fakeFetch);
    expect(result).toEqual({
      ok: false,
      error: { kind: "not-found", status: 404, body: "Not Found" },
    });
  });

  it("status 429 with a retry-after header of 60 returns rate-limited with retryAfterSeconds 60", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      status: 429,
      headers: { "retry-after": "60" },
      text: async () => "Rate Limited",
    });
    const result = await getRecentGamesPgn("thibault", 5, fakeFetch);
    expect(result).toEqual({
      ok: false,
      error: {
        kind: "rate-limited",
        status: 429,
        retryAfterSeconds: 60,
        body: "Rate Limited",
      },
    });
  });

  it("status 500 returns http-error", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      status: 500,
      headers: {},
      text: async () => "Internal Error",
    });
    const result = await getRecentGamesPgn("thibault", 5, fakeFetch);
    expect(result).toEqual({
      ok: false,
      error: { kind: "http-error", status: 500, body: "Internal Error" },
    });
  });

  it("a fake fetch that throws returns network-error", async () => {
    const fakeFetch = vi.fn().mockRejectedValue(new Error("Connection refused"));
    const result = await getRecentGamesPgn("thibault", 5, fakeFetch);
    expect(result).toEqual({
      ok: false,
      error: { kind: "network-error", reason: "Error: Connection refused" },
    });
  });

  it("a content-length header larger than MAX_RESPONSE_BYTES returns invalid-response, proving the shared size guard is wired in", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: { "content-length": String(MAX_RESPONSE_BYTES + 1) },
      text: async () => "",
    });
    const result = await getRecentGamesPgn("thibault", 5, fakeFetch);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("invalid-response");
    }
  });

  it("a successful two-game PGN body is returned byte for byte unchanged in the pgn field, including the blank line between games", async () => {
    const pgn = '[Event "Game 1"]\n1. e4 e5 1-0\n\n[Event "Game 2"]\n1. d4 d5 0-1';
    const fakeFetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: {},
      text: async () => pgn,
    });
    const result = await getRecentGamesPgn("thibault", 5, fakeFetch);
    expect(result).toEqual({ ok: true, pgn });
  });

  it("a successful body that is NOT valid JSON still returns ok true, proving the client never parses JSON", async () => {
    const nonJsonPgn = '[Event "Game 1"]\n1. e4 e5 1-0\nThis is raw PGN text { not json }';
    const fakeFetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: {},
      text: async () => nonJsonPgn,
    });
    const result = await getRecentGamesPgn("thibault", 5, fakeFetch);
    expect(result).toEqual({ ok: true, pgn: nonJsonPgn });
  });

  it("a 200 response with an empty body returns ok true with pgn set to the empty string", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: {},
      text: async () => "",
    });
    const result = await getRecentGamesPgn("thibault", 5, fakeFetch);
    expect(result).toEqual({ ok: true, pgn: "" });
  });
});
