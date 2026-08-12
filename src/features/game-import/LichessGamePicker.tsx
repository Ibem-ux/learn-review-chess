"use client";

import React, { useState, useEffect, useRef } from "react";
import { splitPgnGames, getPlayerAndResult } from "@/features/chess/pgn";

export type LichessGamePickerProps = {
  readonly onSelectPgn: (pgn: string) => void;
};

type LichessApiResponse = {
  readonly pgn?: string;
  readonly gameCount?: number;
  readonly code?: string;
  readonly message?: string;
};

function isLichessApiResponse(value: unknown): value is LichessApiResponse {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (obj.pgn !== undefined && typeof obj.pgn !== "string") return false;
  if (obj.gameCount !== undefined && typeof obj.gameCount !== "number") return false;
  return true;
}

export default function LichessGamePicker({ onSelectPgn }: LichessGamePickerProps): React.ReactNode {
  const [username, setUsername] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<readonly string[] | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      setError("Please enter a username.");
      setGames(null);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setPending(true);
    setError(null);
    setGames(null);

    try {
      const response = await fetch(`/api/lichess/${encodeURIComponent(trimmed)}/games?max=20`, {
        signal: controller.signal,
      });

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        setError("Invalid response from server.");
        return;
      }

      if (!isLichessApiResponse(data)) {
        setError("Invalid response from server.");
        return;
      }

      if (!response.ok) {
        if (response.status === 404) {
          setError("Player not found.");
        } else if (response.status === 429) {
          setError("Rate limit exceeded. Please try again later.");
        } else {
          setError("Failed to load games. Please try again.");
        }
        return;
      }

      if (typeof data.pgn !== "string") {
        setError("Invalid response from server.");
        return;
      }

      const pgnList = splitPgnGames(data.pgn);
      setGames(pgnList);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setError("Network error. Please check your connection.");
    } finally {
      if (abortControllerRef.current === controller) {
        setPending(false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="lichess-username" className="block text-sm font-medium text-black dark:text-zinc-50">
            Lichess username
          </label>
        </div>
        <input
          id="lichess-username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. thibault"
          disabled={pending}
          className="rounded-md border border-black/[.12] px-3 py-1.5 text-sm text-black transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
        />
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="rounded-md border border-black/[.12] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
        >
          {pending ? "Loading..." : "Load games"}
        </button>
      </form>

      {pending && (
        <div role="status" aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-400">
          Fetching games from Lichess...
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-md border border-red-400 bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {games !== null && !pending && !error && (
        <div className="flex flex-col gap-2">
          {games.length === 0 ? (
            <div className="text-sm text-zinc-600 dark:text-zinc-400">No games found for this user.</div>
          ) : (
            <ul className="flex list-none flex-col gap-2 p-0" role="list">
              {games.map((gamePgn, index) => {
                const info = getPlayerAndResult(gamePgn);
                return (
                  <li key={index} className="flex items-center justify-between gap-3 rounded-md border border-black/[.12] px-3 py-2 dark:border-white/[.2]">
                    <button
                      type="button"
                      onClick={() => onSelectPgn(gamePgn)}
                      className="flex w-full items-center justify-between gap-3 text-left"
                    >
                      <span className="font-medium text-black dark:text-zinc-50">
                        {info.white} vs {info.black}
                      </span>
                      <span className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">
                        {info.result}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
