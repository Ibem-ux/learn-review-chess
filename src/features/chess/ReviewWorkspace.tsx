"use client";

import { useCallback, useRef, useState } from "react";
import StudyBoard from "@/features/chess/StudyBoard";
import ReviewBoard from "@/features/chess/ReviewBoard";
import { getPlayerAndResult, normalizeHeader, parsePgn, splitPgnGames } from "@/features/chess/pgn";
import { buildTimeline, type ReviewTimeline } from "@/features/chess/timeline";
import ChesscomGamePicker from "@/features/game-import/ChesscomGamePicker";
import LichessGamePicker from "@/features/game-import/LichessGamePicker";

const MAX_PGN_LENGTH = 20000;
const MAX_PGN_FILE_BYTES = 1000000;

type ImportMethod = "paste" | "chesscom" | "lichess" | "file";


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

function pgnKeyHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

export default function ReviewWorkspace() {
  const [pgn, setPgn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<ReviewTimeline | null>(null);
  const [summary, setSummary] = useState<ReturnType<typeof summarize> | null>(
    null
  );
  const [importMethod, setImportMethod] = useState<ImportMethod>("paste");
  const importMethodRef = useRef<ImportMethod>("paste");
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [isFileReading, setIsFileReading] = useState(false);
  const [multiPgnGames, setMultiPgnGames] = useState<string[]>([]);
  const [descriptionId] = useState("pgn-description");
  const [fileDescriptionId] = useState("file-description");
  const [errorId] = useState("pgn-error");

  const handleMethodChange = (method: ImportMethod) => {
    importMethodRef.current = method;
    setImportMethod(method);
    setError(null);
    setMultiPgnGames([]);
  };

  const loadGame = useCallback((source: string, rawPgn: string) => {
    if (rawPgn.length > MAX_PGN_LENGTH) {
      if (source === "Pasted PGN") {
        setError(
          "PGN input is too long. Paste a completed game of reasonable size."
        );
      } else if (source === "Uploaded file") {
        setError(
          "PGN file is too long. Choose a completed game of reasonable size."
        );
      } else {
        setError(
          "This game's PGN is too long to analyze. Choose a shorter game."
        );
      }
      return;
    }
    const result = parsePgn(rawPgn);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setTimeline(buildTimeline(result.value));
    setSummary(summarize(result.value));
    setError(null);
    setActiveSource(source);
  }, []);

  const handlePasteSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loadGame("Pasted PGN", pgn);
  };

  const handleChesscomSelect = (selectedPgn: string) => {
    loadGame("Chess.com", selectedPgn);
  };

  const handleLichessSelect = (selectedPgn: string) => {
    loadGame("Lichess", selectedPgn);
  };

  const handleFileUpload = async (

    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > MAX_PGN_FILE_BYTES) {
      setError("File is too large. Choose a single-game PGN file under 1MB.");
      input.value = "";
      return;
    }

    setIsFileReading(true);
    try {
      const text = await file.text();
      if (importMethodRef.current !== "file") {
        return;
      }
      const games = splitPgnGames(text);
      if (games.length > 1) {
        setMultiPgnGames(games);
        setError(null);
        return;
      }
      setMultiPgnGames([]);
      loadGame("Uploaded file", text);
    } catch {
      if (importMethodRef.current === "file") {
        setError("Could not read the selected file. Try choosing it again.");
      }
    } finally {
      setIsFileReading(false);
      input.value = "";
    }
  };

  const handleClear = () => {
    setTimeline(null);
    setSummary(null);
    setError(null);
    setPgn("");
    setActiveSource(null);
    setMultiPgnGames([]);
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
                <dt className="font-medium">Source:</dt>
                <dd>{activeSource ?? "Not specified"}</dd>
              </div>
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

        <div
          className="mt-5 flex w-full gap-2"
          role="group"
          aria-label="Import method"
        >
          <button
            type="button"
            aria-pressed={importMethod === "paste"}
            onClick={() => handleMethodChange("paste")}
            className="flex-1 rounded-md border border-black/[.12] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
          >
            Paste PGN
          </button>
          <button
            type="button"
            aria-pressed={importMethod === "chesscom"}
            onClick={() => handleMethodChange("chesscom")}
            className="flex-1 rounded-md border border-black/[.12] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
          >
            Chess.com
          </button>
          <button
            type="button"
            aria-pressed={importMethod === "lichess"}
            onClick={() => handleMethodChange("lichess")}
            className="flex-1 rounded-md border border-black/[.12] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
          >
            Lichess
          </button>
          <button
            type="button"
            aria-pressed={importMethod === "file"}
            onClick={() => handleMethodChange("file")}
            className="flex-1 rounded-md border border-black/[.12] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
          >
            Upload file
          </button>
        </div>

        {importMethod === "paste" && (
          <form className="mt-4" onSubmit={handlePasteSubmit}>
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
        )}

        {importMethod === "chesscom" && (
          <div className="mt-4">
            <ChesscomGamePicker onSelectPgn={handleChesscomSelect} />
          </div>
        )}

        {importMethod === "lichess" && (
          <div className="mt-4">
            <LichessGamePicker onSelectPgn={handleLichessSelect} />
          </div>
        )}


        {importMethod === "file" && (
          <div className="mt-4">
            <label
              htmlFor="file-input"
              className="block text-sm font-medium text-black dark:text-zinc-50"
            >
              Upload a PGN file
            </label>
            <p id={fileDescriptionId} className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Select a .pgn file from your computer. If it contains multiple games, you will be asked to choose one.
            </p>
            <input
              id="file-input"
              type="file"
              accept=".pgn,application/x-chess-pgn,text/plain"
              onChange={handleFileUpload}
              disabled={isFileReading}
              aria-busy={isFileReading}
              aria-invalid={error ? true : undefined}
              aria-describedby={fileDescriptionId}
              className="mt-2 block w-full text-sm text-zinc-600 file:mr-4 file:rounded-md file:border file:border-black/[.12] file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-black hover:file:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:file:border-white/[.2] dark:file:bg-black dark:file:text-zinc-50 dark:hover:file:bg-white/[.08]"
            />
            {isFileReading && (
              <p
                role="status"
                aria-live="polite"
                className="mt-2 text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                Reading PGN file...
              </p>
            )}
            {multiPgnGames.length > 1 && (
              <div className="mt-3 flex flex-col gap-2">
                <div className="text-sm font-medium text-black dark:text-zinc-50">
                  Showing {multiPgnGames.length > 50 ? `first 50 of ${multiPgnGames.length}` : multiPgnGames.length} games
                </div>
                <ul className="flex list-none flex-col gap-2 p-0" role="list">
                  {(() => {
                    const gameCounts = new Map<string, number>();
                    return multiPgnGames.slice(0, 50).map((gamePgn) => {
                      const count = (gameCounts.get(gamePgn) ?? 0) + 1;
                      gameCounts.set(gamePgn, count);
                      const key = `${pgnKeyHash(gamePgn)}-${count}`;
                      const { white, black, result } = getPlayerAndResult(gamePgn);
                      return (
                        <li
                          key={key}
                          className="flex items-center justify-between gap-3 rounded-md border border-black/[.12] px-3 py-2 dark:border-white/[.2]"
                        >
                          <div className="flex flex-col gap-1 text-sm font-medium text-black dark:text-zinc-50">
                            <span>
                              {white} vs {black}{" "}
                              {result !== "*" && (
                                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                                  ({result})
                                </span>
                              )}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => loadGame("Uploaded file", gamePgn)}
                            className="rounded-md border border-black/[.12] px-2 py-1 text-xs font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
                          >
                            Review game
                          </button>
                        </li>
                      );
                    });
                  })()}
                </ul>
              </div>
            )}
          </div>
        )}

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
