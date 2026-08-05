import { describe, expect, it, vi } from "vitest";
import { createFetchLike } from "./fetch-adapter";

describe("createFetchLike", () => {
  it("copies status through from response", async () => {
    const underlying = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const fetchLike = createFetchLike(underlying);
    const result = await fetchLike("https://api.chess.com/test");
    expect(result.status).toBe(200);
  });

  it("exposes retry-after header in returned headers record", async () => {
    const underlying = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "rate-limited" }), {
        status: 429,
        headers: { "retry-after": "60" },
      })
    );
    const fetchLike = createFetchLike(underlying);
    const result = await fetchLike("https://api.chess.com/test");
    expect(result.headers["retry-after"]).toBe("60");
  });

  it("exposes content-length header in returned headers record", async () => {
    const underlying = vi.fn().mockResolvedValue(
      new Response("hello world", {
        status: 200,
        headers: { "content-length": "11" },
      })
    );
    const fetchLike = createFetchLike(underlying);
    const result = await fetchLike("https://api.chess.com/test");
    expect(result.headers["content-length"]).toBe("11");
  });

  it("yields record with no retry-after key when Response has no extra headers", async () => {
    const underlying = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ archives: [] }), { status: 200 })
    );
    const fetchLike = createFetchLike(underlying);
    const result = await fetchLike("https://api.chess.com/test");
    expect(Object.prototype.hasOwnProperty.call(result.headers, "retry-after")).toBe(false);
  });

  it("resolves text() to the response body string", async () => {
    const underlying = vi.fn().mockResolvedValue(
      new Response("sample body content", { status: 200 })
    );
    const fetchLike = createFetchLike(underlying);
    const result = await fetchLike("https://api.chess.com/test");
    const bodyText = await result.text();
    expect(bodyText).toBe("sample body content");
  });

  it("forwards init object including signal unchanged to underlying fetch", async () => {
    const underlying = vi.fn().mockResolvedValue(
      new Response("ok", { status: 200 })
    );
    const fetchLike = createFetchLike(underlying);
    const controller = new AbortController();
    const init = {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    };
    await fetchLike("https://api.chess.com/test", init);
    expect(underlying).toHaveBeenCalledWith(
      "https://api.chess.com/test",
      expect.objectContaining({
        headers: { Accept: "application/json" },
        signal: expect.any(Object),
      })
    );
    const passedInit = underlying.mock.calls[0][1];
    expect(passedInit?.signal).toBeInstanceOf(AbortSignal);
  });
});
