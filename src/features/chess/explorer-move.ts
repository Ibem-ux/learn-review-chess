import { Chess } from "chess.js";

export type ExplorerMoveResult =
  | { readonly ok: true; readonly fen: string; readonly san: string }
  | { readonly ok: false; readonly reason: "illegal" | "invalid-fen" };

export function applyExplorerMove(
  fen: string,
  move: { readonly from: string; readonly to: string; readonly promotion?: string }
): ExplorerMoveResult {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return { ok: false, reason: "invalid-fen" };
  }

  try {
    const result = chess.move({ from: move.from, to: move.to, promotion: move.promotion });
    if (result) {
      return { ok: true, fen: chess.fen(), san: result.san };
    }
    return { ok: false, reason: "illegal" };
  } catch {
    return { ok: false, reason: "illegal" };
  }
}