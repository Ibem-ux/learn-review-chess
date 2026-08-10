import { Chess, type Color, type Square } from "chess.js";

export type PgnHeader = Readonly<Record<string, string>>;

export type PgnMove = {
  readonly san: string;
  readonly color: Color;
  readonly from: Square;
  readonly to: Square;
  readonly promotion?: string;
  readonly before: string;
  readonly after: string;
};

export type PgnParsed = {
  readonly headers: PgnHeader;
  readonly moves: readonly PgnMove[];
  readonly finalFen: string;
  readonly halfMoveCount: number;
  readonly analysisEligible: boolean;
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

const TERMINAL_RESULTS = new Set(["1-0", "0-1", "1/2-1/2"]);

function isTerminalResult(result: string | undefined): boolean {
  return result !== undefined && TERMINAL_RESULTS.has(result);
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
    promotion: move.promotion,
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
      analysisEligible: isTerminalResult(headers.Result),
    },
  };
}

export function countPgnGames(input: string): number {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  const lines = trimmed.split(/\r?\n/);
  let eventHeaderCount = 0;
  for (const line of lines) {
    if (/^\s*\[Event[\s"]/.test(line)) {
      eventHeaderCount++;
    }
  }
  if (eventHeaderCount === 0) {
    return 1;
  }
  return eventHeaderCount;
}

export function splitPgnGames(input: string): string[] {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const normalized = input.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  const eventIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\[Event[\s"]/.test(lines[i])) {
      eventIndices.push(i);
    }
  }

  if (eventIndices.length === 0) {
    return [trimmed];
  }

  const games: string[] = [];
  for (let i = 0; i < eventIndices.length; i++) {
    const startIndex = i === 0 ? 0 : eventIndices[i];
    const endIndex =
      i === eventIndices.length - 1 ? lines.length : eventIndices[i + 1];
    const gameChunk = lines.slice(startIndex, endIndex).join("\n").trim();
    if (gameChunk.length > 0) {
      games.push(gameChunk);
    }
  }

  return games;
}
