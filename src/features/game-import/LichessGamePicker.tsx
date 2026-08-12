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
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="lichess-username" className="block text-sm font-medium text-slate-200 mb-1">
            Lichess username
          </label>
          <input
            id="lichess-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. thibault"
            disabled={pending}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Loading..." : "Load games"}
        </button>
      </form>

      {pending && (
        <div role="status" className="text-sm text-slate-400">
          Fetching games from Lichess...
        </div>
      )}

      {error && (
        <div role="alert" className="p-3 bg-red-950/50 border border-red-800 rounded-md text-sm text-red-300">
          {error}
        </div>
      )}

      {games !== null && !pending && !error && (
        <div className="space-y-2">
          {games.length === 0 ? (
            <div className="text-sm text-slate-400">No games found for this user.</div>
          ) : (
            <ul className="space-y-2">
              {games.map((gamePgn, index) => {
                const info = getPlayerAndResult(gamePgn);
                return (
                  <li key={index} className="border border-slate-700 rounded-md overflow-hidden">
                    <button
                      type="button"
                      onClick={() => onSelectPgn(gamePgn)}
                      className="w-full p-3 bg-slate-800 hover:bg-slate-700 transition-colors flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <span className="font-medium text-slate-200">
                        {info.white} vs {info.black}
                      </span>
                      <span className="text-xs px-2 py-1 bg-slate-900 rounded text-slate-400 font-mono">
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
