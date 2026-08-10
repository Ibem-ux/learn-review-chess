import { resolveClientKey } from "@/client-key";
import { getArchives, type ChesscomError } from "@/features/game-import/chesscom";
import { createFetchLike } from "@/features/game-import/fetch-adapter";
import { createRateLimiter } from "@/rate-limit";

const ARCHIVE_CACHE_CONTROL =
  "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

const limiter = createRateLimiter({ now: () => Date.now() });

function mapArchivesError(error: ChesscomError): Response {
  switch (error.kind) {
    case "invalid-input":
      return Response.json({ code: "invalid-input", message: "Invalid username." }, { status: 400 });
    case "not-found":
      return Response.json({ code: "not-found", message: "Player not found." }, { status: 404 });
    case "rate-limited": {
      const headers: Record<string, string> = {};
      if (error.retryAfterSeconds) {
        headers["Retry-After"] = String(error.retryAfterSeconds);
      }
      return Response.json(
        {
          code: "rate-limited",
          message: "Rate limited by Chess.com.",
          ...(error.retryAfterSeconds ? { retryAfter: error.retryAfterSeconds } : {}),
        },
        { status: 429, headers }
      );
    }
    case "http-error":
      return Response.json({ code: "http-error", message: "Upstream error." }, { status: 502 });
    case "network-error":
      return Response.json({ code: "network-error", message: "Network error." }, { status: 503 });
    case "invalid-response":
      return Response.json({ code: "invalid-response", message: "Invalid upstream response." }, { status: 502 });
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

  const result = await getArchives(username, createFetchLike());

  if (!result.ok) {
    return mapArchivesError(result.error);
  }

  return Response.json(
    {
      username,
      archives: result.archives.map((a) => ({
        url: a.url,
        year: a.year,
        month: a.month,
      })),
    },
    {
      headers: {
        "Cache-Control": ARCHIVE_CACHE_CONTROL,
      },
    }
  );
}
