export type OpeningEntry = {
  readonly eco: string;
  readonly name: string;
  readonly moves: readonly string[];
};

export const OPENING_BOOK: readonly OpeningEntry[] = [
  { eco: "B00", name: "King's Pawn Opening", moves: ["e4"] },
  { eco: "A40", name: "Queen's Pawn Opening", moves: ["d4"] },
  { eco: "A10", name: "English Opening", moves: ["c4"] },
  { eco: "A04", name: "Reti Opening", moves: ["Nf3"] },
  { eco: "A02", name: "Bird's Opening", moves: ["f4"] },
  { eco: "C20", name: "King's Pawn Game", moves: ["e4", "e5"] },
  { eco: "B20", name: "Sicilian Defence", moves: ["e4", "c5"] },
  { eco: "C00", name: "French Defence", moves: ["e4", "e6"] },
  { eco: "B10", name: "Caro-Kann Defence", moves: ["e4", "c6"] },
  { eco: "B01", name: "Scandinavian Defence", moves: ["e4", "d5"] },
  { eco: "B07", name: "Pirc Defence", moves: ["e4", "d6"] },
  { eco: "B02", name: "Alekhine Defence", moves: ["e4", "Nf6"] },
  { eco: "B06", name: "Modern Defence", moves: ["e4", "g6"] },
  { eco: "C21", name: "Centre Game", moves: ["e4", "e5", "d4"] },
  { eco: "C30", name: "King's Gambit", moves: ["e4", "e5", "f4"] },
  { eco: "C40", name: "King's Knight Opening", moves: ["e4", "e5", "Nf3"] },
  { eco: "C41", name: "Philidor Defence", moves: ["e4", "e5", "Nf3", "d6"] },
  { eco: "C42", name: "Petrov Defence", moves: ["e4", "e5", "Nf3", "Nf6"] },
  { eco: "C44", name: "Scotch Game", moves: ["e4", "e5", "Nf3", "Nc6", "d4"] },
  { eco: "C50", name: "Italian Game", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4"] },
  { eco: "C60", name: "Ruy Lopez", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"] },
  { eco: "C65", name: "Ruy Lopez Berlin Defence", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6"] },
  { eco: "A45", name: "Queen's Pawn Game", moves: ["d4", "Nf6"] },
  { eco: "A80", name: "Dutch Defence", moves: ["d4", "f5"] },
  { eco: "A43", name: "Old Benoni Defence", moves: ["d4", "c5"] },
  { eco: "D06", name: "Queen's Gambit", moves: ["d4", "d5", "c4"] },
  { eco: "D20", name: "Queen's Gambit Accepted", moves: ["d4", "d5", "c4", "dxc4"] },
  { eco: "D30", name: "Queen's Gambit Declined", moves: ["d4", "d5", "c4", "e6"] },
];

export type OpeningMatch = {
  readonly eco: string;
  readonly name: string;
  readonly bookPlies: number;
};

export function lookupOpening(
  sanMoves: readonly string[],
): OpeningMatch | null {
  if (sanMoves.length === 0) {
    return null;
  }

  let bestMatch: OpeningEntry | null = null;

  for (const entry of OPENING_BOOK) {
    if (entry.moves.length > sanMoves.length) {
      continue;
    }

    let isMatch = true;
    for (let i = 0; i < entry.moves.length; i++) {
      if (sanMoves[i] !== entry.moves[i]) {
        isMatch = false;
        break;
      }
    }

    if (isMatch) {
      if (bestMatch === null || entry.moves.length > bestMatch.moves.length) {
        bestMatch = entry;
      }
    }
  }

  if (bestMatch === null) {
    return null;
  }

  return {
    eco: bestMatch.eco,
    name: bestMatch.name,
    bookPlies: bestMatch.moves.length,
  };
}
