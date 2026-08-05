import { describe, expect, it, vi } from "vitest";
import {
  getArchives,
  getMonthlyGames,
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
  // Characterisation: getArchives("..") issues a request whose URL, when passed to new URL(...), has pathname exactly "/pub/games/archives".
  it("getArchives path traversal username yields pathname /pub/games/archives", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, { archives: [] })
    );
    await getArchives("..", fetchImpl);
    const requestedUrl = fetchImpl.mock.calls[0][0];
    const parsed = new URL(requestedUrl);
    expect(parsed.pathname).toBe("/pub/games/archives");
  });

  // Characterisation: getArchives with a username of 4096 repeated "a" characters still issues exactly one request, and the captured URL length is greater than 4096.
  it("getArchives with 4096-character username issues one request with length greater than 4096", async () => {
    const longUsername = "a".repeat(4096);
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, { archives: [] })
    );
    await getArchives(longUsername, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const requestedUrl = fetchImpl.mock.calls[0][0];
    expect(requestedUrl.length).toBeGreaterThan(4096);
  });

  // Characterisation: getArchives("hikaru") calls fetchImpl with an init object that has no "signal" property.
  it("getArchives calls fetchImpl with init object missing signal property", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, { archives: [] })
    );
    await getArchives("hikaru", fetchImpl);
    const init = fetchImpl.mock.calls[0][1];
    expect(Object.prototype.hasOwnProperty.call(init, "signal")).toBe(false);
    expect(init?.headers).toBeDefined();
  });

  // Characterisation: getMonthlyGames("hikaru", 2023, 1, fake) has the same absent-signal property.
  it("getMonthlyGames calls fetchImpl with init object missing signal property", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, { games: [] })
    );
    await getMonthlyGames("hikaru", 2023, 1, fetchImpl);
    const init = fetchImpl.mock.calls[0][1];
    expect(Object.prototype.hasOwnProperty.call(init, "signal")).toBe(false);
    expect(init?.headers).toBeDefined();
  });

  // Characterisation: getArchives("hello") where the username contains a non-ASCII character that percent-encodes, and the faked archive list contains the correctly encoded URL for that same player, currently returns ok false with error.kind exactly "invalid-response".
  it("getArchives with non-ASCII username returns invalid-response error", async () => {
    const username = "h\u00e9llo";
    const encoded = encodeURIComponent(username);
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, {
        archives: [`https://api.chess.com/pub/player/${encoded}/games/2023/01`],
      })
    );
    const result = await getArchives(username, fetchImpl);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("invalid-response");
    }
  });
});
