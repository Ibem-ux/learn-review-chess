import type { Color } from "chess.js";

export type EngineColor = Color;

export type EngineStatus =
  | "loading"
  | "ready"
  | "analyzing"
  | "stopped"
  | "error";

export type ScoreBound = "lowerbound" | "upperbound";

export type ScorePerspective = "side-to-move" | "white";

export type EngineScore =
  | {
      type: "cp";
      value: number;
      perspective: ScorePerspective;
      bound?: ScoreBound;
    }
  | {
      type: "mate";
      value: number;
      perspective: ScorePerspective;
      bound?: ScoreBound;
    };

export type EngineInfo = {
  readonly depth?: number;
  readonly seldepth?: number;
  readonly multipv?: number;
  readonly score?: EngineScore;
  readonly nodes?: number;
  readonly nps?: number;
  readonly timeMs?: number;
  readonly hashfull?: number;
  readonly pv?: readonly string[];
};

export type EngineBestMove = {
  readonly move: string | null;
  readonly ponder: string | null;
};

export type EngineConfiguration = {
  readonly threads: number;
  readonly hashMb: number;
  readonly multiPv: number;
};

export type EngineAnalysisLimit =
  | { readonly kind: "depth"; readonly value: number }
  | { readonly kind: "nodes"; readonly value: number }
  | { readonly kind: "movetime"; readonly value: number };

export type EngineWorkerRequest =
  | {
      readonly id: string;
      readonly type: "initialize";
      readonly payload?: {
        readonly configuration?: EngineConfiguration;
      };
    }
  | {
      readonly id: string;
      readonly type: "analyze";
      readonly payload: {
        readonly fen: string;
        readonly limit: EngineAnalysisLimit;
        readonly multiPv?: number;
      };
    }
  | {
      readonly id: string;
      readonly type: "stop";
    }
  | {
      readonly id: string;
      readonly type: "dispose";
    };

export type EngineWorkerEvent =
  | { readonly type: "loading"; readonly requestId: string }
  | { readonly type: "ready"; readonly requestId: string }
  | {
      readonly type: "analysis-info";
      readonly requestId: string;
      readonly info: EngineInfo;
    }
  | {
      readonly type: "best-move";
      readonly requestId: string;
      readonly move: EngineBestMove;
    }
  | { readonly type: "stopped"; readonly requestId: string }
  | {
      readonly type: "error";
      readonly requestId: string;
      readonly message: string;
    };

export function isEngineColor(value: string): value is EngineColor {
  return value === "w" || value === "b";
}

export function scoreToWhitePerspective(
  score: EngineScore,
  sideToMove: EngineColor
): EngineScore {
  if (sideToMove === "w") {
    return { ...score, perspective: "white" };
  }
  const { bound, ...rest } = score;
  let swappedBound: ScoreBound | undefined;
  if (bound === "lowerbound") {
    swappedBound = "upperbound";
  } else if (bound === "upperbound") {
    swappedBound = "lowerbound";
  }
  return {
    ...rest,
    value: -score.value,
    perspective: "white",
    bound: swappedBound,
  };
}
