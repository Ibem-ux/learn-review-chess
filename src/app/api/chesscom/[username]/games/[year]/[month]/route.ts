import { getMonthlyGames, type ChesscomError, type FetchLike } from "@/features/game-import/chesscom";

const MONTHLY_GAMES_CACHE_CONTROL = "public, max-age=1800, s-maxage=3600";

function mapMonthlyGamesError(error: ChesscomError): Response {
  switch (error.kind) {
    case "invalid-input":
      return Response.json({ code: "invalid-input", message: "Invalid username or date." }, { status: 400 });
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
  { params }: { params: Promise<{ username: string; year: string; month: string }> }
) {
  const { username, year, month } = await params;

  const yearNum = Number(year);
  const monthNum = Number(month);

  const result = await getMonthlyGames(username, yearNum, monthNum, fetch.bind(globalThis) as unknown as FetchLike);

  if (!result.ok) {
    return mapMonthlyGamesError(result.error);
  }

  return Response.json(
    {
      username,
      year: yearNum,
      month: monthNum,
      games: result.games,
      gameCount: result.games.length,
    },
    {
      headers: {
        "Cache-Control": MONTHLY_GAMES_CACHE_CONTROL,
      },
    }
  );
}
