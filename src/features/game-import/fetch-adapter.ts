import type { FetchLike } from "./chesscom";

export function createFetchLike(underlying: typeof fetch = fetch): FetchLike {
  return async (input, init) => {
    const response = await underlying(input, { ...init, redirect: "error" });
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return {
      status: response.status,
      headers,
      text: () => response.text(),
    };
  };
}
