import type { EngineScore, ScoreBound } from "./engine";

export type CommandSuccess = { readonly ok: true; readonly command: string };
export type CommandFailure = { readonly ok: false; readonly reason: string };
export type CommandResult = CommandSuccess | CommandFailure;

export const UCI = "uci";
export const ISREADY = "isready";
export const UCINEWGAME = "ucinewgame";
export const STOP = "stop";
export const QUIT = "quit";

export function setoptionThreads(value: number): CommandResult {
  return setoption("Threads", value);
}

export function setoptionHash(value: number): CommandResult {
  return setoption("Hash", value);
}

export function setoptionMultiPv(value: number): CommandResult {
  return setoption("MultiPV", value);
}

export function positionFen(fen: string): CommandResult {
  if (/[\r\n]/.test(fen)) {
    return { ok: false, reason: "FEN must not contain line breaks." };
  }
  return { ok: true, command: `position fen ${fen}` };
}

export function goDepth(depth: number): CommandResult {
  return goLimit("depth", depth);
}

export function goNodes(nodes: number): CommandResult {
  return goLimit("nodes", nodes);
}

export function goMovetime(movetime: number): CommandResult {
  return goLimit("movetime", movetime);
}

export type ParsedInfo = {
  depth?: number;
  seldepth?: number;
  multipv?: number;
  score?: EngineScore;
  nodes?: number;
  nps?: number;
  timeMs?: number;
  hashfull?: number;
  pv: readonly string[];
};

export type UciMessage =
  | { readonly type: "uciok" }
  | { readonly type: "readyok" }
  | { readonly type: "id"; readonly kind: "name" | "author"; readonly value: string }
  | { readonly type: "info"; readonly info: ParsedInfo }
  | { readonly type: "bestmove"; readonly move: string | null; readonly ponder: string | null };

export function parseUciLine(line: string): UciMessage | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;

  if (trimmed === "uciok") return { type: "uciok" };
  if (trimmed === "readyok") return { type: "readyok" };

  if (trimmed.startsWith("id name ")) {
    return { type: "id", kind: "name", value: trimmed.slice(8) };
  }
  if (trimmed.startsWith("id author ")) {
    return { type: "id", kind: "author", value: trimmed.slice(10) };
  }

  if (trimmed.startsWith("bestmove ")) {
    return parseBestmove(trimmed.slice(9));
  }

  if (trimmed.startsWith("info ")) {
    const info = parseInfo(trimmed.slice(5));
    return info ? { type: "info", info } : null;
  }

  return null;
}

function setoption(name: string, value: number): CommandResult {
  const validated = validatePositiveInteger(value, name);
  if (!validated.ok) return validated;
  return { ok: true, command: `setoption name ${name} value ${value}` };
}

function goLimit(name: string, value: number): CommandResult {
  const validated = validatePositiveInteger(value, name);
  if (!validated.ok) return validated;
  return { ok: true, command: `go ${name} ${value}` };
}

function validatePositiveInteger(value: number, label: string): CommandResult {
  if (!Number.isFinite(value)) {
    return { ok: false, reason: `${label} must be a finite number.` };
  }
  if (Number.isNaN(value)) {
    return { ok: false, reason: `${label} must be a number.` };
  }
  if (!Number.isInteger(value)) {
    return { ok: false, reason: `${label} must be an integer.` };
  }
  if (value <= 0) {
    return { ok: false, reason: `${label} must be greater than zero.` };
  }
  return { ok: true, command: "" };
}

function tokenize(value: string): readonly string[] {
  return value.split(/\s+/).filter((token) => token.length > 0);
}

function tryParseInt(token: string): number | undefined {
  const value = Number.parseInt(token, 10);
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function isUciMove(token: string): boolean {
  return /^[a-h][1-8][a-h][1-8][nbrq]?$/.test(token);
}

function parseInfo(content: string): ParsedInfo | null {
  const tokens = tokenize(content);
  const result: ParsedInfo = { pv: [] };
  let hasParsedField = false;

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    switch (token) {
      case "depth": {
        const next = tokens[i + 1];
        const parsed = tryParseInt(next ?? "");
        if (parsed !== undefined) {
          result.depth = parsed;
          hasParsedField = true;
        }
        i += 2;
        continue;
      }
      case "seldepth": {
        const next = tokens[i + 1];
        const parsed = tryParseInt(next ?? "");
        if (parsed !== undefined) {
          result.seldepth = parsed;
          hasParsedField = true;
        }
        i += 2;
        continue;
      }
      case "multipv": {
        const next = tokens[i + 1];
        const parsed = tryParseInt(next ?? "");
        if (parsed !== undefined) {
          result.multipv = parsed;
          hasParsedField = true;
        }
        i += 2;
        continue;
      }
      case "score": {
        const scoreType = tokens[i + 1];
        const scoreValueToken = tokens[i + 2];
        if ((scoreType === "cp" || scoreType === "mate") && scoreValueToken !== undefined) {
          const scoreValue = tryParseInt(scoreValueToken);
          if (scoreValue !== undefined) {
            let bound: ScoreBound | undefined;
            const boundToken = tokens[i + 3];
            if (boundToken === "lowerbound" || boundToken === "upperbound") {
              bound = boundToken;
              i += 4;
            } else {
              i += 3;
            }
            result.score = { type: scoreType, value: scoreValue, bound, perspective: "side-to-move" };
            hasParsedField = true;
            continue;
          }
        }
        i += 1;
        continue;
      }
      case "nodes": {
        const next = tokens[i + 1];
        const parsed = tryParseInt(next ?? "");
        if (parsed !== undefined) {
          result.nodes = parsed;
          hasParsedField = true;
        }
        i += 2;
        continue;
      }
      case "nps": {
        const next = tokens[i + 1];
        const parsed = tryParseInt(next ?? "");
        if (parsed !== undefined) {
          result.nps = parsed;
          hasParsedField = true;
        }
        i += 2;
        continue;
      }
      case "time": {
        const next = tokens[i + 1];
        const parsed = tryParseInt(next ?? "");
        if (parsed !== undefined) {
          result.timeMs = parsed;
          hasParsedField = true;
        }
        i += 2;
        continue;
      }
      case "hashfull": {
        const next = tokens[i + 1];
        const parsed = tryParseInt(next ?? "");
        if (parsed !== undefined) {
          result.hashfull = parsed;
          hasParsedField = true;
        }
        i += 2;
        continue;
      }
      case "tbhits": {
        i += 2;
        continue;
      }
      case "currmove": {
        i += 2;
        continue;
      }
      case "currmovenumber": {
        i += 2;
        continue;
      }
      case "refutation": {
        i += 1;
        while (i < tokens.length && tokens[i] !== "string" && tokens[i] !== "pv") {
          i += 1;
        }
        continue;
      }
      case "currline": {
        i += 1;
        if (i < tokens.length && !tokens[i].startsWith("pv") && !tokens[i].startsWith("string")) {
          i += 1;
        }
        while (i < tokens.length && !tokens[i].startsWith("pv") && !tokens[i].startsWith("string")) {
          i += 1;
        }
        continue;
      }
      case "string": {
        i += 1;
        while (i < tokens.length) {
          i += 1;
        }
        continue;
      }
      case "pv": {
        i += 1;
        while (i < tokens.length) {
          result.pv = result.pv.concat(tokens[i]);
          i += 1;
        }
        hasParsedField = true;
        continue;
      }
      default:
        i += 1;
    }
  }

  if (!hasParsedField) {
    return null;
  }

  return result;
}

function parseBestmove(content: string): UciMessage | null {
  const tokens = tokenize(content);
  if (tokens.length === 0) return null;

  if (tokens.length === 1) {
    const token = tokens[0];
    if (token === "0000" || token === "(none)" || isUciMove(token)) {
      return { type: "bestmove", move: token === "0000" || token === "(none)" ? null : token, ponder: null };
    }
    return null;
  }

  const moveToken = tokens[0];
  if (moveToken === "0000" || moveToken === "(none)") {
    return null;
  }
  if (!isUciMove(moveToken)) {
    return null;
  }

  if (tokens.length === 2) {
    return null;
  }

  if (tokens.length > 3 || tokens[1] !== "ponder") {
    return null;
  }

  const ponderToken = tokens[2];
  if (ponderToken === "0000" || ponderToken === "(none)" || isUciMove(ponderToken)) {
    return {
      type: "bestmove",
      move: moveToken,
      ponder: ponderToken === "0000" || ponderToken === "(none)" ? null : ponderToken,
    };
  }

  return null;
}
