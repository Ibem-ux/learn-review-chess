"use client";

import { useState } from "react";
import StudyBoard from "@/features/chess/StudyBoard";
import ReviewBoard from "@/features/chess/ReviewBoard";
import { normalizeHeader, parsePgn } from "@/features/chess/pgn";
import { buildTimeline, type ReviewTimeline } from "@/features/chess/timeline";

const MAX_PGN_LENGTH = 20000;

function summarize(parsed: {
  halfMoveCount: number;
  headers: Readonly<Record<string, string>>;
}) {
  const white = normalizeHeader(parsed.headers.White);
  const black = normalizeHeader(parsed.headers.Black);
  const result = parsed.headers.Result;
  return {
    halfMoves: parsed.halfMoveCount,
    white,
    black,
    result,
  };
}

export default function ReviewWorkspace() {
  const [pgn, setPgn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<ReviewTimeline | null>(null);
  const [summary, setSummary] = useState<ReturnType<typeof summarize> | null>(
    null
  );
  const [descriptionId] = useState("pgn-description");
  const [errorId] = useState("pgn-error");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pgn.length > MAX_PGN_LENGTH) {
      setError(
        "PGN input is too long. Paste a completed game of reasonable size."
      );
      return;
    }
    const result = parsePgn(pgn);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setTimeline(buildTimeline(result.value));
    setSummary(summarize(result.value));
    setError(null);
  };

  const handleClear = () => {
    setTimeline(null);
    setSummary(null);
    setError(null);
    setPgn("");
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section aria-label="Chess workspace">
        {timeline ? <ReviewBoard timeline={timeline} /> : <StudyBoard />}
      </section>

      <aside
        aria-label="Game review"
        className="rounded-lg border border-black/[.08] bg-white p-5 dark:border-white/[.145] dark:bg-black"
      >
        <h2 className="text-base font-semibold text-black dark:text-zinc-50">
          Game review
        </h2>

        {timeline && summary ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {summary.halfMoves} half-move
              {summary.halfMoves === 1 ? "" : "s"} imported.
            </p>
            <dl className="space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
              <div className="flex gap-2">
                <dt className="font-medium">White:</dt>
                <dd>{summary.white ?? "Not specified"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium">Black:</dt>
                <dd>{summary.black ?? "Not specified"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium">Result:</dt>
                <dd>{summary.result ?? "Not specified"}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={handleClear}
              className="rounded-md border border-black/[.12] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
            >
              Clear imported game
            </button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Import a completed game to begin reviewing.
          </p>
        )}

        <form className="mt-5" onSubmit={handleSubmit}>
          <label
            htmlFor="pgn-input"
            className="block text-sm font-medium text-black dark:text-zinc-50"
          >
            Paste a completed PGN game
          </label>
          <p id={descriptionId} className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            Only completed games are reviewed. Paste the full PGN, including
            move list and result.
          </p>
          <textarea
            id="pgn-input"
            name="pgn"
            value={pgn}
            onChange={(event) => setPgn(event.target.value)}
            aria-describedby={descriptionId}
            aria-invalid={error ? true : undefined}
            rows={6}
            className="mt-2 w-full resize-y rounded-md border border-black/[.12] bg-white p-2 text-sm text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground dark:border-white/[.2] dark:bg-black dark:text-zinc-50"
          />
          <button
            type="submit"
            className="mt-3 rounded-md border border-black/[.12] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
          >
            Load game
          </button>
        </form>

        {error && (
          <p
            id={errorId}
            role="alert"
            className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
          >
            {error}
          </p>
        )}
      </aside>
    </div>
  );
}
