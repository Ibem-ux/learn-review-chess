import { resolveClientKey } from "@/client-key";
import {
  getRecentGamesPgn,
  LICHESS_MAX_GAMES,
  type LichessError,
} from "@/features/game-import/lichess";
import { createFetchLike } from "@/features/game-import/fetch-adapter";
import { countPgnGames } from "@/features/chess/pgn";
import { createRateLimiter } from "@/rate-limit";

const LICHESS_GAMES_CACHE_CONTROL =
  "public, max-age=60, s-maxage=120, stale-while-revalidate=600";

const limiter = createRateLimiter({ now: () => Date.now() });

function mapLichessError(error: LichessError): Response {
  switch (error.kind) {
    case "invalid-input":
      return Response.json(
        { code: "invalid-input", message: "Invalid username or max parameter." },
        { status: 400 }
      );
    case "not-found":
      return Response.json(
        { code: "not-found", message: "Player not found." },
        { status: 404 }
      );
    case "rate-limited": {
      const headers: Record<string, string> = {};
      if (error.retryAfterSeconds) {
        headers["Retry-After"] = String(error.retryAfterSeconds);
      }
      return Response.json(
        {
          code: "rate-limited",
          message: "Rate limited by Lichess.",
          ...(error.retryAfterSeconds ? { retryAfter: error.retryAfterSeconds } : {}),
        },
        { status: 429, headers }
      );
    }
    case "http-error":
      return Response.json(
        { code: "http-error", message: "Upstream error." },
        { status: 502 }
      );
    case "network-error":
      return Response.json(
        { code: "network-error", message: "Network error." },
        { status: 503 }
      );
    case "invalid-response":
      return Response.json(
        { code: "invalid-response", message: "Invalid upstream response." },
        { status: 502 }
      );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const key = resolveClientKey(request.headers);
  const decision = limiter.check(key);
  if (!decision.allowed) {
    return Response.json(
      { code: "rate-limited", message: "Too many requests." },
      {
        status: 429,
        headers: {
          "Retry-After": String(decision.retryAfterSeconds),
        },
      }
    );
  }

  const { username } = await params;

  const url = new URL(request.url);
  const maxParam = url.searchParams.get("max");

  let max: number = LICHESS_MAX_GAMES;
  if (maxParam !== null) {
    const parsedMax = Number(maxParam);
    if (!Number.isInteger(parsedMax) || parsedMax < 1) {
      return Response.json(
        { code: "invalid-input", message: "Max query parameter must be a positive integer." },
        { status: 400 }
      );
    }
    max = parsedMax;
  }

  const result = await getRecentGamesPgn(username, max, createFetchLike());

  if (!result.ok) {
    return mapLichessError(result.error);
  }

  const gameCount = countPgnGames(result.pgn);

  return Response.json(
    {
      username,
      max,
      pgn: result.pgn,
      gameCount,
    },
    {
      headers: {
        "Cache-Control": LICHESS_GAMES_CACHE_CONTROL,
      },
    }
  );
}
