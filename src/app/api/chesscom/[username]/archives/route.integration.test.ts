import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

async function readJsonRecord(response: Response): Promise<Record<string, unknown>> {
  const parsed: unknown = await response.json();
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Expected a JSON object body.");
  }
  return { ...parsed };
}

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
    const body = await readJsonRecord(response);
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
    const body = await readJsonRecord(response);
    const archives: unknown = body.archives;
    expect(Array.isArray(archives)).toBe(true);
    expect(archives).toHaveLength(2);
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
