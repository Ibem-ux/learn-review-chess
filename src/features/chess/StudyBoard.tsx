"use client";

import { useCallback, useMemo, useState } from "react";
import { Chessboard, type PieceDropHandlerArgs } from "react-chessboard";
import { createGame, type ChessColor } from "@/features/chess/game";

function groupSanPairs(moves: string[]): string[] {
  const lines: string[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    const moveNumber = i / 2 + 1;
    const white = moves[i] ?? "";
    const black = moves[i + 1] ?? "";
    lines.push(`${moveNumber}. ${white}${black ? ` ${black}` : ""}`);
  }
  return lines;
}

export default function StudyBoard() {
  const game = useMemo(() => createGame(), []);
  const [fen, setFen] = useState<string>(game.fen());
  const [turn, setTurn] = useState<ChessColor>(game.turn());
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [moves, setMoves] = useState<string[]>([]);

  const syncFromGame = useCallback(() => {
    setFen(game.fen());
    setTurn(game.turn());
    setMoves(game.history().map((entry) => entry.san));
  }, [game]);

  const handlePieceDrop = useCallback(
    (args: PieceDropHandlerArgs): boolean => {
      const { sourceSquare, targetSquare } = args;
      if (!targetSquare) return false;
      const result = game.move({
        from: sourceSquare as never,
        to: targetSquare as never,
      });
      if (!result.ok) return false;
      syncFromGame();
      return true;
    },
    [game, syncFromGame]
  );

  const handleUndo = useCallback(() => {
    const result = game.undo();
    if (!result.ok) return;
    syncFromGame();
  }, [game, syncFromGame]);

  const handleReset = useCallback(() => {
    const fresh = createGame();
    setFen(fresh.fen());
    setTurn(fresh.turn());
    setMoves([]);
  }, []);

  const handleFlip = useCallback(() => {
    setOrientation((current) => (current === "white" ? "black" : "white"));
  }, []);

  const sanLines = groupSanPairs(moves);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-black dark:text-zinc-50">
          Side to move:{" "}
          <span data-testid="side-to-move">{turn === "w" ? "White" : "Black"}</span>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={moves.length === 0}
            className="rounded-md border border-black/[.12] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
          >
            Undo move
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-md border border-black/[.12] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
          >
            Reset position
          </button>
          <button
            type="button"
            onClick={handleFlip}
            className="rounded-md border border-black/[.12] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
          >
            Flip board
          </button>
        </div>
      </div>

      <div className="aspect-square w-full max-w-2xl overflow-hidden rounded-lg border border-black/[.15] dark:border-white/[.2]">
        <Chessboard
          options={{
            position: fen,
            boardOrientation: orientation,
            onPieceDrop: handlePieceDrop,
            animationDurationInMs: 150,
          }}
        />
      </div>

      <section
        aria-label="Move history"
        className="w-full max-w-2xl rounded-lg border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-black"
      >
        <h2 className="text-sm font-semibold text-black dark:text-zinc-50">
          Move history
        </h2>
        {moves.length === 0 ? (
          <p
            data-testid="move-history-empty"
            className="mt-2 text-sm text-zinc-600 dark:text-zinc-400"
          >
            No moves yet.
          </p>
        ) : (
          <ol
            data-testid="move-history"
            className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-300"
          >
            {sanLines.map((line, index) => (
              <li key={index} className="font-mono">
                {line}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
