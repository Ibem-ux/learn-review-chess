import { describe, expect, it, vi } from "vitest";
import {
  getArchives,
  getMonthlyGames,
  MAX_RESPONSE_BYTES,
} from "@/features/game-import/chesscom";

function createResponse(
  status: number,
  body: unknown,
  headers: Readonly<Record<string, string>> = {}
): {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly text: () => Promise<string>;
} {
  return {
    status,
    headers,
    text: async () => JSON.stringify(body),
  };
}

describe("chesscom security characterisation", () => {
  // Characterisation: getArchives("..") is rejected as invalid input without calling fetch.
  it("getArchives rejects path traversal username without calling fetch", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, { archives: [] })
    );
    const result = await getArchives("..", fetchImpl);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ kind: "invalid-input" }),
      })
    );
  });

  // Characterisation: getArchives with a username of 4096 repeated "a" characters is rejected as invalid input without calling fetch.
  it("getArchives rejects 4096-character username without calling fetch", async () => {
    const longUsername = "a".repeat(4096);
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, { archives: [] })
    );
    const result = await getArchives(longUsername, fetchImpl);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ kind: "invalid-input" }),
      })
    );
  });

  // Characterisation: getArchives("hikaru") calls fetchImpl with an init object that has an own "signal" property of type AbortSignal.
  it("getArchives calls fetchImpl with init object containing signal property", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, { archives: [] })
    );
    await getArchives("hikaru", fetchImpl);
    const init = fetchImpl.mock.calls[0][1];
    expect(Object.prototype.hasOwnProperty.call(init, "signal")).toBe(true);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  // Characterisation: getMonthlyGames("hikaru", 2023, 1, fake) calls fetchImpl with an init object that has an own "signal" property of type AbortSignal.
  it("getMonthlyGames calls fetchImpl with init object containing signal property", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, { games: [] })
    );
    await getMonthlyGames("hikaru", 2023, 1, fetchImpl);
    const init = fetchImpl.mock.calls[0][1];
    expect(Object.prototype.hasOwnProperty.call(init, "signal")).toBe(true);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  // Characterisation: getArchives("hello") where username contains a non-ASCII character is rejected as invalid input without calling fetch.
  it("getArchives rejects non-ASCII username without calling fetch", async () => {
    const username = "h\u00e9llo";
    const encoded = encodeURIComponent(username);
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, {
        archives: [`https://api.chess.com/pub/player/${encoded}/games/2023/01`],
      })
    );
    const result = await getArchives(username, fetchImpl);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ kind: "invalid-input" }),
      })
    );
  });

  // Characterisation: getArchives rejects with error.kind "invalid-response" when response headers report content-length greater than MAX_RESPONSE_BYTES, and body text function is never called.
  it("getArchives rejects when content-length header exceeds MAX_RESPONSE_BYTES without calling text()", async () => {
    const textFn = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 200,
      headers: { "content-length": String(MAX_RESPONSE_BYTES + 1) },
      text: textFn,
    });
    const result = await getArchives("hikaru", fetchImpl);
    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ kind: "invalid-response" }),
      })
    );
    expect(textFn).not.toHaveBeenCalled();
  });

  // Characterisation: getMonthlyGames rejects with error.kind "invalid-response" when there is no content-length header but body text exceeds MAX_RESPONSE_BYTES.
  it("getMonthlyGames rejects when body text exceeds MAX_RESPONSE_BYTES without content-length header", async () => {
    const hugeBody = "a".repeat(MAX_RESPONSE_BYTES + 1);
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 200,
      headers: {},
      text: async () => hugeBody,
    });
    const result = await getMonthlyGames("hikaru", 2023, 1, fetchImpl);
    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ kind: "invalid-response" }),
      })
    );
  });

  // Characterisation: getArchives succeeds normally for a small body with content-length header well under the limit.
  it("getArchives succeeds for small body with content-length header well under limit", async () => {
    const body = { archives: ["https://api.chess.com/pub/player/hikaru/games/2023/01"] };
    const jsonStr = JSON.stringify(body);
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 200,
      headers: { "content-length": String(jsonStr.length) },
      text: async () => jsonStr,
    });
    const result = await getArchives("hikaru", fetchImpl);
    expect(result).toEqual({
      ok: true,
      archives: [{ url: "https://api.chess.com/pub/player/hikaru/games/2023/01", year: 2023, month: 1 }],
    });
  });

  // Characterisation: getArchives accepts username with underscore and hyphen, issuing one request and returning ok true.
  it("getArchives accepts username with underscore and hyphen", async () => {
    const username = "grand_master-9";
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, { archives: [] })
    );
    const result = await getArchives(username, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
  });

  // Characterisation: getArchives rejects oversize content-length without calling text() function.
  it("getArchives rejects oversize content-length without calling text function", async () => {
    const textFn = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 200,
      headers: { "content-length": "9007199254740991" },
      text: textFn,
    });
    const result = await getArchives("hikaru", fetchImpl);
    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ kind: "invalid-response" }),
      })
    );
    expect(textFn).not.toHaveBeenCalled();
  });
});
