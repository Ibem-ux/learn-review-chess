/**
 * Phase detection is position-based, counting only minor and major pieces;
 * the ply bound only prevents an early position with full material from being called middlegame.
 */
export type GamePhase = "opening" | "middlegame" | "endgame";

export function detectGamePhase(fen: string, ply: number): GamePhase {
  const spaceIndex = fen.indexOf(" ");
  const placement = spaceIndex === -1 ? fen : fen.slice(0, spaceIndex);

  const ranks = placement.split("/");
  if (ranks.length !== 8) {
    throw new RangeError("FEN must contain eight ranks.");
  }

  if (!Number.isFinite(ply) || ply < 0) {
    throw new RangeError("Ply must be a finite non-negative number.");
  }

  let minorMajorCount = 0;
  for (let i = 0; i < placement.length; i++) {
    if ("qrbnQRBN".includes(placement[i])) {
      minorMajorCount++;
    }
  }

  if (minorMajorCount <= 6) {
    return "endgame";
  }

  if (ply <= 20 && minorMajorCount >= 12) {
    return "opening";
  }

  return "middlegame";
}
