/**
 * Conventional piece exchange values used only for sacrifice detection,
 * not a positional evaluation.
 */

// The king is deliberately excluded - it is never captured and has no exchange value.
export const PIECE_VALUES: Readonly<Record<"p" | "n" | "b" | "r" | "q", number>> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
};

// The threshold a sacrifice must meet or exceed, sitting below both n (320) and b (330) so either minor piece qualifies.
export const MINOR_PIECE_VALUE = 300;

function getPieceValue(lowerChar: string): number {
  if (lowerChar === "p") return PIECE_VALUES.p;
  if (lowerChar === "n") return PIECE_VALUES.n;
  if (lowerChar === "b") return PIECE_VALUES.b;
  if (lowerChar === "r") return PIECE_VALUES.r;
  if (lowerChar === "q") return PIECE_VALUES.q;
  return 0;
}

export function materialBalanceFromFen(fen: string): number {
  const spaceIndex = fen.indexOf(" ");
  const placement = spaceIndex === -1 ? fen : fen.slice(0, spaceIndex);

  const ranks = placement.split("/");
  if (ranks.length !== 8) {
    throw new RangeError("FEN must contain eight ranks.");
  }

  const validPieces = "pnbrqkPNBRQK";
  let balance = 0;

  for (let i = 0; i < placement.length; i++) {
    const char = placement[i];
    if (char === "/") {
      continue;
    }
    if (char >= "0" && char <= "9") {
      continue;
    }
    if (!validPieces.includes(char)) {
      throw new RangeError("FEN contains an unsupported piece character.");
    }
    if (char === "k" || char === "K") {
      continue;
    }

    const lower = char.toLowerCase();
    const value = getPieceValue(lower);
    if (char >= "A" && char <= "Z") {
      balance += value;
    } else {
      balance -= value;
    }
  }

  return balance;
}
