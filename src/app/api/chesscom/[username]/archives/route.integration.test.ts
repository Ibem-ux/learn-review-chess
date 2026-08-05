import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("archives route integration", () => {
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
      params: Promise.resolve({ username: "player" }),
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    const body = (await response.json()) as { retryAfter: number };
    expect(body.retryAfter).toBe(60);
  });

  it("returns archives from a real upstream response body", async () => {
    const archivesBody = JSON.stringify({
      archives: [
        "https://api.chess.com/pub/player/player/games/2023/01",
        "https://api.chess.com/pub/player/player/games/2023/02",
      ],
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(archivesBody, { status: 200 }))
    );

    const response = await GET(new Request("http://localhost/"), {
      params: Promise.resolve({ username: "player" }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { archives: unknown[] };
    expect(body.archives).toHaveLength(2);
  });

  it("rejects an invalid username without calling fetch", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response("{}", { status: 200 })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const response = await GET(new Request("http://localhost/"), {
      params: Promise.resolve({ username: "user+name" }),
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
  });
});
