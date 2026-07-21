export type ChesscomArchiveRef = {
  readonly url: string;
  readonly year: number;
  readonly month: number;
};

export type ChesscomGame = {
  readonly url: string;
  readonly pgn: string;
  readonly endTime: string;
  readonly timeControl: string;
  readonly timeClass: string;
  readonly rules: string;
  readonly rated?: boolean;
};

export type ChesscomError =
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

export type ArchivesSuccess = {
  readonly ok: true;
  readonly archives: readonly ChesscomArchiveRef[];
};

export type ArchivesFailure = {
  readonly ok: false;
  readonly error: ChesscomError;
};

export type ArchivesResult = ArchivesSuccess | ArchivesFailure;

export type MonthlyGamesSuccess = {
  readonly ok: true;
  readonly games: readonly ChesscomGame[];
};

export type MonthlyGamesFailure = {
  readonly ok: false;
  readonly error: ChesscomError;
};

export type MonthlyGamesResult = MonthlyGamesSuccess | MonthlyGamesFailure;

export type FetchLike = (
  input: string,
  init?: { readonly headers?: Readonly<Record<string, string>> }
) => Promise<{ readonly status: number; readonly headers: Readonly<Record<string, string>>; readonly text: () => Promise<string> }>;

const USER_AGENT = "LearnReviewChess/0.1 (+https://github.com/Ibem-ux/learn-review-chess)";

const ARCHIVE_PATH_PATTERN = /^\/pub\/player\/([^/]+)\/games\/(\d{4})\/(\d{2})$/;

function isHTTPS(url: string): boolean {
  return url.startsWith("https://");
}

function hasDefaultHTTPSPort(url: string): boolean {
  const parsed = new URL(url);
  return parsed.port === "" || parsed.port === "443";
}

function parseArchiveURL(url: string, expectedPlayer: string): { year: number; month: number } | null {
  const parsed = new URL(url);
  if (parsed.host !== "api.chess.com") return null;
  if (!isHTTPS(url)) return null;
  if (!hasDefaultHTTPSPort(url)) return null;

  const match = parsed.pathname.match(ARCHIVE_PATH_PATTERN);
  if (!match) return null;

  let decodedPlayer: string;
  try {
    decodedPlayer = decodeURIComponent(match[1]!);
  } catch {
    return null;
  }
  if (decodedPlayer.toLowerCase() !== expectedPlayer.toLowerCase()) return null;

  const year = Number(match[2]!);
  const month = Number(match[3]!);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;

  return { year, month };
}

export function normalizeChesscomUsername(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error("Chess.com username must not be empty.");
  }
  return encodeURIComponent(trimmed);
}

export async function getArchives(
  rawUsername: string,
  fetchImpl: FetchLike
): Promise<ArchivesResult> {
  let encoded: string;
  try {
    encoded = normalizeChesscomUsername(rawUsername);
  } catch {
    return { ok: false, error: { kind: "invalid-input", reason: "Username must not be empty." } };
  }

  const url = `https://api.chess.com/pub/player/${encoded}/games/archives`;

  let response: { readonly status: number; readonly headers: Readonly<Record<string, string>>; readonly text: () => Promise<string> };
  try {
    response = await fetchImpl(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    });
  } catch (networkError) {
    return { ok: false, error: { kind: "network-error", reason: String(networkError) } };
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
    return { ok: false, error: { kind: "rate-limited", status: 429, retryAfterSeconds, body } };
  }

  if (response.status < 200 || response.status >= 300) {
    let body: string | undefined;
    try {
      body = await response.text();
    } catch {
      body = undefined;
    }
    return { ok: false, error: { kind: "http-error", status: response.status, body } };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await response.text());
  } catch {
    return { ok: false, error: { kind: "invalid-response", reason: "Response is not valid JSON." } };
  }

  if (!isArchiveListResponse(raw)) {
    return { ok: false, error: { kind: "invalid-response", reason: "Unexpected response shape." } };
  }

  const archives: ChesscomArchiveRef[] = [];
  for (const entry of raw.archives) {
    if (typeof entry !== "string") {
      return { ok: false, error: { kind: "invalid-response", reason: "Archive entry is not a string." } };
    }
    const parsed = parseArchiveURL(entry, encoded);
    if (!parsed) {
      return { ok: false, error: { kind: "invalid-response", reason: `Invalid archive URL: ${entry}` } };
    }
    archives.push({ url: entry, year: parsed.year, month: parsed.month });
  }

  return { ok: true, archives };
}

export async function getMonthlyGames(
  rawUsername: string,
  year: number,
  month: number,
  fetchImpl: FetchLike
): Promise<MonthlyGamesResult> {
  let encoded: string;
  try {
    encoded = normalizeChesscomUsername(rawUsername);
  } catch {
    return { ok: false, error: { kind: "invalid-input", reason: "Username must not be empty." } };
  }

  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    return { ok: false, error: { kind: "invalid-input", reason: "Year must be a four-digit integer." } };
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { ok: false, error: { kind: "invalid-input", reason: "Month must be between 1 and 12." } };
  }

  const monthStr = String(month).padStart(2, "0");
  const url = `https://api.chess.com/pub/player/${encoded}/games/${year}/${monthStr}`;

  let response: { readonly status: number; readonly headers: Readonly<Record<string, string>>; readonly text: () => Promise<string> };
  try {
    response = await fetchImpl(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    });
  } catch (networkError) {
    return { ok: false, error: { kind: "network-error", reason: String(networkError) } };
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
    return { ok: false, error: { kind: "rate-limited", status: 429, retryAfterSeconds, body } };
  }

  if (response.status < 200 || response.status >= 300) {
    let body: string | undefined;
    try {
      body = await response.text();
    } catch {
      body = undefined;
    }
    return { ok: false, error: { kind: "http-error", status: response.status, body } };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await response.text());
  } catch {
    return { ok: false, error: { kind: "invalid-response", reason: "Response is not valid JSON." } };
  }

  if (!isMonthlyGamesResponse(raw)) {
    return { ok: false, error: { kind: "invalid-response", reason: "Unexpected response shape." } };
  }

  const games: ChesscomGame[] = [];
  for (const entry of raw.games) {
    if (!isChesscomGame(entry)) {
      return { ok: false, error: { kind: "invalid-response", reason: "Game entry has invalid shape." } };
    }
    games.push({
      url: entry.url,
      pgn: entry.pgn,
      endTime: entry.end_time,
      timeControl: entry.time_control,
      timeClass: entry.time_class,
      rules: entry.rules,
      ...(entry.rated !== undefined ? { rated: entry.rated } : {}),
    });
  }

  return { ok: true, games };
}

function parseRetryAfter(headers: Readonly<Record<string, string>>): number | undefined {
  const value = headers["retry-after"] ?? headers["Retry-After"];
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return undefined;
}

function isArchiveListResponse(value: unknown): value is { readonly archives: readonly unknown[] } {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj.archives)) return false;
  return true;
}

function isMonthlyGamesResponse(value: unknown): value is { readonly games: readonly unknown[] } {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj.games)) return false;
  return true;
}

function isChesscomGame(value: unknown): value is {
  readonly url: string;
  readonly pgn: string;
  readonly end_time: string;
  readonly time_control: string;
  readonly time_class: string;
  readonly rules: string;
  readonly rated?: boolean;
} {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.url === "string" &&
    typeof obj.pgn === "string" &&
    typeof obj.end_time === "string" &&
    typeof obj.time_control === "string" &&
    typeof obj.time_class === "string" &&
    typeof obj.rules === "string"
  );
}
