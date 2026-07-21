import { Chess, type Color, type Square } from "chess.js";

export type PgnHeader = Readonly<Record<string, string>>;

export type PgnMove = {
  readonly san: string;
  readonly color: Color;
  readonly from: Square;
  readonly to: Square;
  readonly before: string;
  readonly after: string;
};

export type PgnParsed = {
  readonly headers: PgnHeader;
  readonly moves: readonly PgnMove[];
  readonly finalFen: string;
  readonly halfMoveCount: number;
};

export type PgnSuccess = {
  ok: true;
  value: PgnParsed;
};

export type PgnFailure = {
  ok: false;
  reason: string;
};

export type PgnResult = PgnSuccess | PgnFailure;

export function normalizeHeader(value: string | undefined): string {
  if (value == null) {
    return "Not specified";
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed === "?") {
    return "Not specified";
  }
  return value;
}

function toUserSafeReason(): string {
  return "Unable to parse PGN. Check that the game notation is valid.";
}

export function parsePgn(input: string): PgnResult {
  const source = input.trim();
  if (source.length === 0) {
    return { ok: false, reason: "PGN input is empty." };
  }

  const chess = new Chess();
  try {
    chess.loadPgn(source);
  } catch {
    return { ok: false, reason: toUserSafeReason() };
  }

  const headers: Record<string, string> = { ...chess.getHeaders() };

  const moves: PgnMove[] = chess.history({ verbose: true }).map((move) => ({
    san: move.san,
    color: move.color,
    from: move.from,
    to: move.to,
    before: move.before,
    after: move.after,
  }));

  const finalFen = chess.fen();

  return {
    ok: true,
    value: {
      headers,
      moves,
      finalFen,
      halfMoveCount: moves.length,
    },
  };
}
