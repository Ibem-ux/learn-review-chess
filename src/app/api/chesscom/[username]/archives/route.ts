import { getArchives, type ChesscomError, type FetchLike } from "@/features/game-import/chesscom";

const ARCHIVE_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400";

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
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  const result = await getArchives(username, fetch.bind(globalThis) as unknown as FetchLike);

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
