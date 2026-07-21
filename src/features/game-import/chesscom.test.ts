import { describe, expect, it, vi } from "vitest";
import {
  getArchives,
  getMonthlyGames,
  normalizeChesscomUsername,
} from "@/features/game-import/chesscom";

function isArchivesSuccess(
  result: { ok: boolean; error?: { kind: string } }
): result is { ok: true; archives: { url: string; year: number; month: number }[] } {
  return result.ok === true;
}

function isArchivesFailure(
  result: { ok: boolean; error?: { kind: string } }
): result is { ok: false; error: { kind: string; status?: number; retryAfterSeconds?: number; body?: string } } {
  return result.ok === false;
}

function isMonthlyGamesSuccess(
  result: { ok: boolean; error?: { kind: string } }
): result is { ok: true; games: { rated?: boolean }[] } {
  return result.ok === true;
}

function isMonthlyGamesFailure(
  result: { ok: boolean; error?: { kind: string } }
): result is { ok: false; error: { kind: string; status?: number; retryAfterSeconds?: number; body?: string } } {
  return result.ok === false;
}

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

describe("normalizeChesscomUsername", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeChesscomUsername("  hikaru  ")).toBe("hikaru");
  });

  it("URL-encodes special characters", () => {
    expect(normalizeChesscomUsername("user+name")).toBe("user%2Bname");
  });

  it("rejects empty input", () => {
    expect(() => normalizeChesscomUsername("")).toThrow();
    expect(() => normalizeChesscomUsername("   ")).toThrow();
  });
});

describe("getArchives", () => {
  it("returns empty list for player with no archives", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, { archives: [] })
    );
    const result = await getArchives("hikaru", fetchImpl);
    expect(result.ok).toBe(true);
    if (isArchivesSuccess(result)) {
      expect(result.archives).toHaveLength(0);
    }
  });

  it("parses archive URLs into year and month", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, {
        archives: [
          "https://api.chess.com/pub/player/hikaru/games/2023/01",
          "https://api.chess.com/pub/player/hikaru/games/2023/02",
        ],
      })
    );
    const result = await getArchives("hikaru", fetchImpl);
    expect(result.ok).toBe(true);
    if (isArchivesSuccess(result)) {
      expect(result.archives).toHaveLength(2);
      expect(result.archives[0]).toEqual({
        url: "https://api.chess.com/pub/player/hikaru/games/2023/01",
        year: 2023,
        month: 1,
      });
      expect(result.archives[1]).toEqual({
        url: "https://api.chess.com/pub/player/hikaru/games/2023/02",
        year: 2023,
        month: 2,
      });
    }
  });

  it("uses the corrected User-Agent", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, { archives: [] })
    );
    await getArchives("hikaru", fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.chess.com/pub/player/hikaru/games/archives",
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": "LearnReviewChess/0.1 (+https://github.com/Ibem-ux/learn-review-chess)",
        }),
      })
    );
  });

  it("rejects non-Chess.com origins", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, {
        archives: ["https://evil.example.com/player/hikaru/games/2023/01"],
      })
    );
    const result = await getArchives("hikaru", fetchImpl);
    expect(result.ok).toBe(false);
    if (isArchivesFailure(result)) {
      expect(result.error.kind).toBe("invalid-response");
    }
  });

  it("rejects malformed archive paths", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, {
        archives: ["https://api.chess.com/pub/player/hikaru/games/bad"],
      })
    );
    const result = await getArchives("hikaru", fetchImpl);
    expect(result.ok).toBe(false);
    if (isArchivesFailure(result)) {
      expect(result.error.kind).toBe("invalid-response");
    }
  });

  it("rejects mismatched player in archive URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, {
        archives: ["https://api.chess.com/pub/player/other/games/2023/01"],
      })
    );
    const result = await getArchives("hikaru", fetchImpl);
    expect(result.ok).toBe(false);
    if (isArchivesFailure(result)) {
      expect(result.error.kind).toBe("invalid-response");
    }
  });

  it("accepts mixed-case requested username with lowercase canonical archive URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, {
        archives: ["https://api.chess.com/pub/player/hikaru/games/2023/01"],
      })
    );
    const result = await getArchives("Hikaru", fetchImpl);
    expect(result.ok).toBe(true);
    if (isArchivesSuccess(result)) {
      expect(result.archives).toHaveLength(1);
    }
  });

  it("accepts lowercase requested username with mixed-case archive URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, {
        archives: ["https://api.chess.com/pub/player/Hikaru/games/2023/01"],
      })
    );
    const result = await getArchives("hikaru", fetchImpl);
    expect(result.ok).toBe(true);
    if (isArchivesSuccess(result)) {
      expect(result.archives).toHaveLength(1);
    }
  });

  it("rejects a genuinely different player name", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, {
        archives: ["https://api.chess.com/pub/player/other/games/2023/01"],
      })
    );
    const result = await getArchives("hikaru", fetchImpl);
    expect(result.ok).toBe(false);
    if (isArchivesFailure(result)) {
      expect(result.error.kind).toBe("invalid-response");
    }
  });

  it("rejects archive URL with non-default port", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, {
        archives: ["https://api.chess.com:8443/pub/player/hikaru/games/2023/01"],
      })
    );
    const result = await getArchives("hikaru", fetchImpl);
    expect(result.ok).toBe(false);
    if (isArchivesFailure(result)) {
      expect(result.error.kind).toBe("invalid-response");
    }
  });

  it("rejects malformed encoded username path without throwing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, {
        archives: ["https://api.chess.com/pub/player/%E0%A4%A/games/2023/01"],
      })
    );
    const result = await getArchives("hikaru", fetchImpl);
    expect(result.ok).toBe(false);
    if (isArchivesFailure(result)) {
      expect(result.error.kind).toBe("invalid-response");
    }
  });

  it("handles HTTP 404 as not-found", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(404, { error: "Player not found" })
    );
    const result = await getArchives("nonexistent", fetchImpl);
    expect(result.ok).toBe(false);
    if (isArchivesFailure(result)) {
      expect(result.error.kind).toBe("not-found");
      expect(result.error.status).toBe(404);
    }
  });

  it("handles HTTP 429 with Retry-After", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(429, { error: "Rate limited" }, { "retry-after": "60" })
    );
    const result = await getArchives("hikaru", fetchImpl);
    expect(result.ok).toBe(false);
    if (isArchivesFailure(result)) {
      expect(result.error.kind).toBe("rate-limited");
      expect(result.error.status).toBe(429);
      expect(result.error.retryAfterSeconds).toBe(60);
    }
  });

  it("handles HTTP 429 without Retry-After", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(429, { error: "Rate limited" })
    );
    const result = await getArchives("hikaru", fetchImpl);
    expect(result.ok).toBe(false);
    if (isArchivesFailure(result)) {
      expect(result.error.kind).toBe("rate-limited");
      expect(result.error.retryAfterSeconds).toBeUndefined();
    }
  });

  it("handles other HTTP errors", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(500, { error: "Server error" })
    );
    const result = await getArchives("hikaru", fetchImpl);
    expect(result.ok).toBe(false);
    if (isArchivesFailure(result)) {
      expect(result.error.kind).toBe("http-error");
      expect(result.error.status).toBe(500);
    }
  });

  it("handles network exceptions", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await getArchives("hikaru", fetchImpl);
    expect(result.ok).toBe(false);
    if (isArchivesFailure(result)) {
      expect(result.error.kind).toBe("network-error");
    }
  });

  it("handles invalid JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 200,
      headers: {},
      text: async () => "not json",
    });
    const result = await getArchives("hikaru", fetchImpl);
    expect(result.ok).toBe(false);
    if (isArchivesFailure(result)) {
      expect(result.error.kind).toBe("invalid-response");
    }
  });

  it("handles malformed response shape", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, { data: [] })
    );
    const result = await getArchives("hikaru", fetchImpl);
    expect(result.ok).toBe(false);
    if (isArchivesFailure(result)) {
      expect(result.error.kind).toBe("invalid-response");
    }
  });

  it("rejects empty username without calling fetch", async () => {
    const fetchImpl = vi.fn();
    const result = await getArchives("", fetchImpl);
    expect(result.ok).toBe(false);
    if (isArchivesFailure(result)) {
      expect(result.error.kind).toBe("invalid-input");
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("preserves archive order from the API", async () => {
    const archives = [
      "https://api.chess.com/pub/player/hikaru/games/2023/03",
      "https://api.chess.com/pub/player/hikaru/games/2023/01",
      "https://api.chess.com/pub/player/hikaru/games/2023/02",
    ];
    const fetchImpl = vi.fn().mockResolvedValue(createResponse(200, { archives }));
    const result = await getArchives("hikaru", fetchImpl);
    expect(result.ok).toBe(true);
    if (isArchivesSuccess(result)) {
      expect(result.archives.map((a) => a.month)).toEqual([3, 1, 2]);
    }
  });
});

describe("getMonthlyGames", () => {
  it("returns games for a valid month", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, {
        games: [
          {
            url: "https://www.chess.com/game/live/123456789",
            pgn: "1. e4 e5 *",
            end_time: "1672531200",
            time_control: "300+0",
            time_class: "rapid",
            rules: "chess",
            rated: true,
          },
        ],
      })
    );
    const result = await getMonthlyGames("hikaru", 2023, 1, fetchImpl);
    expect(result.ok).toBe(true);
    if (isMonthlyGamesSuccess(result)) {
      expect(result.games).toHaveLength(1);
      expect(result.games[0].url).toBe("https://www.chess.com/game/live/123456789");
      expect(result.games[0].pgn).toBe("1. e4 e5 *");
      expect(result.games[0].endTime).toBe("1672531200");
      expect(result.games[0].timeControl).toBe("300+0");
      expect(result.games[0].timeClass).toBe("rapid");
      expect(result.games[0].rules).toBe("chess");
      expect(result.games[0].rated).toBe(true);
    }
  });

  it("uses the corrected User-Agent", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, { games: [] })
    );
    await getMonthlyGames("hikaru", 2023, 1, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.chess.com/pub/player/hikaru/games/2023/01",
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": "LearnReviewChess/0.1 (+https://github.com/Ibem-ux/learn-review-chess)",
        }),
      })
    );
  });

  it("formats month as two digits in the endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, { games: [] })
    );
    await getMonthlyGames("hikaru", 2023, 1, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.chess.com/pub/player/hikaru/games/2023/01",
      expect.any(Object)
    );
  });

  it("rejects invalid month without calling fetch", async () => {
    const fetchImpl = vi.fn();
    const result = await getMonthlyGames("hikaru", 2023, 0, fetchImpl);
    expect(result.ok).toBe(false);
    if (isMonthlyGamesFailure(result)) {
      expect(result.error.kind).toBe("invalid-input");
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects invalid year without calling fetch", async () => {
    const fetchImpl = vi.fn();
    const result = await getMonthlyGames("hikaru", 99, 1, fetchImpl);
    expect(result.ok).toBe(false);
    if (isMonthlyGamesFailure(result)) {
      expect(result.error.kind).toBe("invalid-input");
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("handles HTTP 404", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(404, { error: "Not found" })
    );
    const result = await getMonthlyGames("hikaru", 2023, 1, fetchImpl);
    expect(result.ok).toBe(false);
    if (isMonthlyGamesFailure(result)) {
      expect(result.error.kind).toBe("not-found");
      expect(result.error.status).toBe(404);
    }
  });

  it("handles HTTP 429 with Retry-After", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(429, { error: "Rate limited" }, { "retry-after": "120" })
    );
    const result = await getMonthlyGames("hikaru", 2023, 1, fetchImpl);
    expect(result.ok).toBe(false);
    if (isMonthlyGamesFailure(result)) {
      expect(result.error.kind).toBe("rate-limited");
      expect(result.error.retryAfterSeconds).toBe(120);
    }
  });

  it("handles other HTTP errors", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(503, { error: "Unavailable" })
    );
    const result = await getMonthlyGames("hikaru", 2023, 1, fetchImpl);
    expect(result.ok).toBe(false);
    if (isMonthlyGamesFailure(result)) {
      expect(result.error.kind).toBe("http-error");
      expect(result.error.status).toBe(503);
    }
  });

  it("handles network exceptions", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
    const result = await getMonthlyGames("hikaru", 2023, 1, fetchImpl);
    expect(result.ok).toBe(false);
    if (isMonthlyGamesFailure(result)) {
      expect(result.error.kind).toBe("network-error");
    }
  });

  it("handles invalid JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 200,
      headers: {},
      text: async () => "not json",
    });
    const result = await getMonthlyGames("hikaru", 2023, 1, fetchImpl);
    expect(result.ok).toBe(false);
    if (isMonthlyGamesFailure(result)) {
      expect(result.error.kind).toBe("invalid-response");
    }
  });

  it("handles malformed response shape", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, { data: [] })
    );
    const result = await getMonthlyGames("hikaru", 2023, 1, fetchImpl);
    expect(result.ok).toBe(false);
    if (isMonthlyGamesFailure(result)) {
      expect(result.error.kind).toBe("invalid-response");
    }
  });

  it("handles optional rated field absence", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      createResponse(200, {
        games: [
          {
            url: "https://www.chess.com/game/live/1",
            pgn: "1. e4 *",
            end_time: "1672531200",
            time_control: "300+0",
            time_class: "rapid",
            rules: "chess",
          },
        ],
      })
    );
    const result = await getMonthlyGames("hikaru", 2023, 1, fetchImpl);
    expect(result.ok).toBe(true);
    if (isMonthlyGamesSuccess(result)) {
      expect(result.games[0].rated).toBeUndefined();
    }
  });
});
