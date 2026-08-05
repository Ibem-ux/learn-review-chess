import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

async function readJsonRecord(response: Response): Promise<Record<string, unknown>> {
  const parsed: unknown = await response.json();
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Expected a JSON object body.");
  }
  return { ...parsed };
}

describe("monthly games route integration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it("propagates upstream retry-after through the real adapter", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("{}", { status: 429, headers: { "Retry-After": "60" } })
      )
    );

    const response = await GET(new Request("http://localhost/"), {
      params: Promise.resolve({ username: "player", year: "2023", month: "01" }),
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    const body = await readJsonRecord(response);
    expect(body.retryAfter).toBe(60);
  });

  it("returns games from a real upstream response body", async () => {
    const gamesBody = JSON.stringify({
      games: [
        {
          url: "https://www.chess.com/game/live/123456789",
          pgn: "1. e4 e5 *",
          end_time: 1672531200,
          time_control: "300+0",
          time_class: "rapid",
          rules: "chess",
          rated: true,
        },
      ],
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(gamesBody, { status: 200 }))
    );

    const response = await GET(new Request("http://localhost/"), {
      params: Promise.resolve({ username: "player", year: "2023", month: "01" }),
    });

    expect(response.status).toBe(200);
    const body = await readJsonRecord(response);
    const games: unknown = body.games;
    expect(Array.isArray(games)).toBe(true);
    expect(games).toHaveLength(1);
  });

  it("rejects an invalid username without calling fetch", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response("{}", { status: 200 })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const response = await GET(new Request("http://localhost/"), {
      params: Promise.resolve({ username: "user+name", year: "2023", month: "01" }),
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
  });
});
