"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeHeader, parsePgn } from "@/features/chess/pgn";

const MAX_DISPLAYED_GAMES = 20;

type GameStatus = "initial" | "loading-archives" | "loading-games" | "success" | "no-archives" | "no-games" | "error";

type InternalArchivesResponse = {
  readonly username: string;
  readonly archives: readonly {
    readonly url: string;
    readonly year: number;
    readonly month: number;
  }[];
};

type InternalGame = {
  readonly url: string;
  readonly pgn: string;
  readonly endTime: string;
  readonly timeControl: string;
  readonly timeClass?: string;
  readonly rules: string;
  readonly rated?: boolean;
};

type InternalGamesResponse = {
  readonly username: string;
  readonly year: number;
  readonly month: number;
  readonly games: readonly InternalGame[];
};

type InternalError = {
  readonly code: string;
  readonly message: string;
  readonly retryAfter?: number;
};

function isInternalArchivesResponse(value: unknown): value is InternalArchivesResponse {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.username !== "string") return false;
  if (!Array.isArray(obj.archives)) return false;
  return true;
}

function isInternalGamesResponse(value: unknown): value is InternalGamesResponse {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.username !== "string") return false;
  if (typeof obj.year !== "number") return false;
  if (typeof obj.month !== "number") return false;
  if (!Array.isArray(obj.games)) return false;
  return true;
}

function isInternalError(value: unknown): value is InternalError {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.code === "string" && typeof obj.message === "string";
}

function encodeUsername(username: string): string {
  return encodeURIComponent(username.trim());
}

function pickLatestArchive(archives: readonly { year: number; month: number }[]): { year: number; month: number } | null {
  if (archives.length === 0) return null;
  let latest = archives[0]!;
  for (const entry of archives) {
    if (entry.year > latest.year || (entry.year === latest.year && entry.month > latest.month)) {
      latest = entry;
    }
  }
  return latest;
}

function parseGameDate(endTime: string): string {
  const timestamp = Number(endTime);
  if (!Number.isInteger(timestamp) || timestamp <= 0) return "Unknown date";
  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getPlayerAndResult(
  pgn: string
): { white: string; black: string; result: string } {
  const parsed = parsePgn(pgn);
  if (!parsed.ok) {
    return { white: "Not specified", black: "Not specified", result: "*" };
  }
  const headers = parsed.value.headers;
  const white = normalizeHeader(headers.White?.trim() || headers.white?.trim());
  const black = normalizeHeader(headers.Black?.trim() || headers.black?.trim());
  const rawResult = normalizeHeader(headers.Result?.trim() || headers.result?.trim());
  const result = rawResult === "Not specified" ? "*" : rawResult;
  return { white, black, result };
}

export type ChesscomGamePickerProps = {
  readonly onSelectPgn: (pgn: string) => void;
};

export default function ChesscomGamePicker({ onSelectPgn }: ChesscomGamePickerProps) {
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<GameStatus>("initial");
  const [games, setGames] = useState<readonly InternalGame[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorRetryAfter, setErrorRetryAfter] = useState<number | undefined>(undefined);
  const controllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = username.trim();
      if (trimmed.length === 0) return;

      const encoded = encodeUsername(trimmed);

      if (controllerRef.current) {
        controllerRef.current.abort();
      }
      const controller = new AbortController();
      controllerRef.current = controller;
      const generation = ++generationRef.current;

      setStatus("loading-archives");
      setGames([]);
      setErrorMessage("");
      setErrorRetryAfter(undefined);

      try {
        const archivesResponse = await fetch(`/api/chesscom/${encoded}/archives`, {
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        let archivesJson: unknown;
        try {
          archivesJson = await archivesResponse.json();
        } catch {
          if (controller.signal.aborted) return;
          setStatus("error");
          setErrorMessage("Invalid archive response from server.");
          return;
        }

        if (archivesResponse.status !== 200) {
          if (isInternalError(archivesJson)) {
            setStatus("error");
            setErrorMessage(archivesJson.message);
            setErrorRetryAfter(archivesJson.retryAfter);
          } else {
            setStatus("error");
            setErrorMessage("Server error while loading archives.");
          }
          return;
        }

        if (!isInternalArchivesResponse(archivesJson)) {
          setStatus("error");
          setErrorMessage("Invalid archive response from server.");
          return;
        }

        if (archivesJson.archives.length === 0) {
          setStatus("no-archives");
          return;
        }

        const archiveEntries = archivesJson.archives.map((a) => ({
          url: a.url,
          year: a.year,
          month: a.month,
        }));
        const latest = pickLatestArchive(archiveEntries);

        if (!latest) {
          setStatus("no-archives");
          return;
        }

        setStatus("loading-games");

        const monthStr = String(latest.month).padStart(2, "0");
        const gamesResponse = await fetch(`/api/chesscom/${encoded}/games/${latest.year}/${monthStr}`, {
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        let gamesJson: unknown;
        try {
          gamesJson = await gamesResponse.json();
        } catch {
          if (controller.signal.aborted) return;
          setStatus("error");
          setErrorMessage("Invalid games response from server.");
          return;
        }

        if (gamesResponse.status !== 200) {
          if (isInternalError(gamesJson)) {
            setStatus("error");
            setErrorMessage(gamesJson.message);
            setErrorRetryAfter(gamesJson.retryAfter);
          } else {
            setStatus("error");
            setErrorMessage("Server error while loading games.");
          }
          return;
        }

        if (!isInternalGamesResponse(gamesJson)) {
          setStatus("error");
          setErrorMessage("Invalid games response from server.");
          return;
        }

        if (generation !== generationRef.current) return;

        const sorted = [...gamesJson.games].sort((a, b) => {
          const aTime = Number(a.endTime);
          const bTime = Number(b.endTime);
          const aValid = Number.isInteger(aTime) && aTime > 0;
          const bValid = Number.isInteger(bTime) && bTime > 0;
          if (aValid && bValid) return bTime - aTime;
          if (aValid) return -1;
          if (bValid) return 1;
          return 0;
        });

        const limited = sorted.slice(0, MAX_DISPLAYED_GAMES);

        if (limited.length === 0) {
          setStatus("no-games");
        } else {
          setStatus("success");
        }
        setGames(limited);
      } catch {
        if (controller.signal.aborted) return;
        setStatus("error");
        setErrorMessage("Unable to reach the server. Please try again later.");
      }
    },
    [username]
  );

  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, []);

  const isSubmitting = status === "loading-archives" || status === "loading-games";

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="chesscom-username" className="block text-sm font-medium text-black dark:text-zinc-50">
            Chess.com username
          </label>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            Only public completed-game data is retrieved. No password, token, or account access is required.
          </p>
        </div>
        <input
          id="chesscom-username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={isSubmitting}
          className="rounded-md border border-black/[.12] px-3 py-1.5 text-sm text-black transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
          placeholder="e.g. hikaru"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md border border-black/[.12] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
        >
          {isSubmitting ? "Loading..." : "Load latest games"}
        </button>
      </form>

      <div aria-live="polite" className="text-sm font-medium text-black dark:text-zinc-50">
        {status === "loading-archives" && "Loading available months..."}
        {status === "loading-games" && "Loading recent games..."}
        {status === "success" && (
          <span>{games.length > 0 ? `Showing ${games.length} game${games.length === 1 ? "" : "s"}` : ""}</span>
        )}
        {status === "no-archives" && "No public game archives found for this player."}
        {status === "no-games" && "No games found for the latest month."}
      </div>

      {status === "error" && (
        <div role="alert" className="rounded-md border border-red-400 bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {errorMessage}
          {errorRetryAfter !== undefined && (
            <span className="ml-2 text-xs text-red-600 dark:text-red-300">
              Retry after {errorRetryAfter} {errorRetryAfter === 1 ? "second" : "seconds"}.
            </span>
          )}
        </div>
      )}

      {status === "success" && games.length > 0 && (
        <ul className="flex list-none flex-col gap-2 p-0" role="list">
          {games.map((game, index) => {
            const { white, black, result } = getPlayerAndResult(game.pgn);
            const timeClass = game.timeClass ?? "Unknown time class";
            const dateLabel = parseGameDate(game.endTime);
            return (
              <li
                key={`${game.url}-${index}`}
                className="flex items-center justify-between gap-3 rounded-md border border-black/[.12] px-3 py-2 dark:border-white/[.2]"
              >
                <div className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-black dark:text-zinc-50">
                    {white} vs {black} {result !== "*" && <span className="text-xs text-zinc-600 dark:text-zinc-400">({result})</span>}
                  </span>
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">
                    {timeClass} • {dateLabel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectPgn(game.pgn)}
                  className="rounded-md border border-black/[.12] px-2 py-1 text-xs font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
                >
                  Review game
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
