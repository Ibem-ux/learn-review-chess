import {
  type FetchLike,
  REQUEST_TIMEOUT_MS,
  readResponseTextSafely,
  parseRetryAfter,
} from "./http";

export const LICHESS_MAX_GAMES = 20;
export const MAX_LICHESS_USERNAME_LENGTH = 30;
export const LICHESS_USERNAME_PATTERN = /^[A-Za-z0-9_-]+$/;

const USER_AGENT = "LearnReviewChess/0.1 (+https://github.com/Ibem-ux/learn-review-chess)";

export type LichessError =
  | { readonly kind: "invalid-input"; readonly reason: string }
  | { readonly kind: "not-found"; readonly status: 404; readonly body?: string }
  | {
      readonly kind: "rate-limited";
      readonly status: 429;
      readonly retryAfterSeconds?: number;
      readonly body?: string;
    }
  | { readonly kind: "http-error"; readonly status: number; readonly body?: string }
  | { readonly kind: "network-error"; readonly reason: string }
  | { readonly kind: "invalid-response"; readonly reason: string };

export type LichessPgnResult =
  | { readonly ok: true; readonly pgn: string }
  | { readonly ok: false; readonly error: LichessError };

export function normalizeLichessUsername(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error("Lichess username must not be empty.");
  }
  if (trimmed.length > MAX_LICHESS_USERNAME_LENGTH) {
    throw new Error(`Username exceeds maximum length of ${MAX_LICHESS_USERNAME_LENGTH} characters.`);
  }
  if (!LICHESS_USERNAME_PATTERN.test(trimmed)) {
    throw new Error("Username contains invalid characters.");
  }
  return encodeURIComponent(trimmed);
}

export async function getRecentGamesPgn(
  rawUsername: string,
  max: number,
  fetchImpl: FetchLike
): Promise<LichessPgnResult> {
  let encoded: string;
  try {
    encoded = normalizeLichessUsername(rawUsername);
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: "invalid-input",
        reason: err instanceof Error ? err.message : String(err),
      },
    };
  }

  if (!Number.isInteger(max) || max < 1) {
    return {
      ok: false,
      error: {
        kind: "invalid-input",
        reason: "Max must be a positive integer.",
      },
    };
  }

  const clampedMax = Math.min(max, LICHESS_MAX_GAMES);
  const url = `https://lichess.org/api/games/user/${encoded}?max=${clampedMax}&clocks=false&evals=false&literate=false`;

  let response: {
    readonly status: number;
    readonly headers: Readonly<Record<string, string>>;
    readonly text: () => Promise<string>;
  };
  try {
    response = await fetchImpl(url, {
      headers: {
        Accept: "application/x-chess-pgn",
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (networkError) {
    return {
      ok: false,
      error: { kind: "network-error", reason: String(networkError) },
    };
  }

  if (response.status === 404) {
    let body: string | undefined;
    try {
      body = await response.text();
    } catch {
      body = undefined;
    }
    return { ok: false, error: { kind: "not-found", status: 404, body } };
  }

  if (response.status === 429) {
    const retryAfterSeconds = parseRetryAfter(response.headers);
    let body: string | undefined;
    try {
      body = await response.text();
    } catch {
      body = undefined;
    }
    return {
      ok: false,
      error: { kind: "rate-limited", status: 429, retryAfterSeconds, body },
    };
  }

  if (response.status < 200 || response.status >= 300) {
    let body: string | undefined;
    try {
      body = await response.text();
    } catch {
      body = undefined;
    }
    return {
      ok: false,
      error: { kind: "http-error", status: response.status, body },
    };
  }

  const bodyResult = await readResponseTextSafely(response);
  if (!bodyResult.ok) {
    return {
      ok: false,
      error: { kind: "invalid-response", reason: bodyResult.reason },
    };
  }

  return { ok: true, pgn: bodyResult.text };
}
