"use client";

import { useCallback, useMemo, useState } from "react";
import { Chessboard, type PieceDropHandlerArgs } from "react-chessboard";
import { createGame, type ChessColor } from "@/features/chess/game";

export default function StudyBoard() {
  const game = useMemo(() => createGame(), []);
  const [fen, setFen] = useState<string>(game.fen());
  const [turn, setTurn] = useState<ChessColor>(game.turn());
  const [orientation, setOrientation] = useState<"white" | "black">("white");

  const handlePieceDrop = useCallback(
    (args: PieceDropHandlerArgs): boolean => {
      const { sourceSquare, targetSquare } = args;
      if (!targetSquare) return false;
      const result = game.move({
        from: sourceSquare as never,
        to: targetSquare as never,
      });
      if (!result.ok) return false;
      setFen(result.fen);
      setTurn(result.turn);
      return true;
    },
    [game]
  );

  const handleReset = useCallback(() => {
    const fresh = createGame();
    setFen(fresh.fen());
    setTurn(fresh.turn());
  }, []);

  const handleFlip = useCallback(() => {
    setOrientation((current) => (current === "white" ? "black" : "white"));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-black dark:text-zinc-50">
          Side to move: <span data-testid="side-to-move">{turn === "w" ? "White" : "Black"}</span>
        </p>
        <div className="flex gap-2">
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
    </div>
  );
}
