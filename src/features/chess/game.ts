import { Chess, type Color, type Square } from "chess.js";

export type ChessColor = Color;
export type ChessSquare = Square;

export type ChessMoveInput = {
  from: ChessSquare;
  to: ChessSquare;
  promotion?: "n" | "b" | "r" | "q";
};

export type ChessGame = {
  chess: Chess;
  fen: () => string;
  turn: () => ChessColor;
  history: () => readonly ChessHistoryEntry[];
  move: (input: ChessMoveInput) => ChessMoveResult;
  undo: () => ChessUndoResult;
};

export type ChessMoveSuccess = {
  ok: true;
  from: ChessSquare;
  to: ChessSquare;
  fen: string;
  turn: ChessColor;
};

export type ChessMoveFailure = {
  ok: false;
  reason: string;
  fen: string;
  turn: ChessColor;
};

export type ChessMoveResult = ChessMoveSuccess | ChessMoveFailure;

export type ChessHistoryEntry = {
  san: string;
  from: ChessSquare;
  to: ChessSquare;
  color: ChessColor;
};

export type ChessUndoSuccess = {
  ok: true;
  undone: ChessHistoryEntry;
  fen: string;
  turn: ChessColor;
};

export type ChessUndoFailure = {
  ok: false;
  reason: string;
  fen: string;
  turn: ChessColor;
};

export type ChessUndoResult = ChessUndoSuccess | ChessUndoFailure;

export function createGame(fen?: string): ChessGame {
  const chess = new Chess(fen);

  const toHistoryEntry = (move: {
    san: string;
    from: ChessSquare;
    to: ChessSquare;
    color: ChessColor;
  }): ChessHistoryEntry => ({
    san: move.san,
    from: move.from,
    to: move.to,
    color: move.color,
  });

  return {
    chess,
    fen: () => chess.fen(),
    turn: () => chess.turn(),
    history: (): readonly ChessHistoryEntry[] =>
      chess
        .history({ verbose: true })
        .map((move) => toHistoryEntry(move)),
    move: (input: ChessMoveInput): ChessMoveResult => {
      const before = chess.fen();
      try {
        chess.move({
          from: input.from,
          to: input.to,
          promotion: input.promotion,
        });
        return {
          ok: true,
          from: input.from,
          to: input.to,
          fen: chess.fen(),
          turn: chess.turn(),
        };
      } catch (error) {
        return {
          ok: false,
          reason: error instanceof Error ? error.message : "Illegal move",
          fen: before,
          turn: chess.turn(),
        };
      }
    },
    undo: (): ChessUndoResult => {
      const before = chess.fen();
      try {
        const undone = chess.undo();
        if (!undone) {
          return {
            ok: false,
            reason: "No move to undo",
            fen: before,
            turn: chess.turn(),
          };
        }
        return {
          ok: true,
          undone: toHistoryEntry(undone),
          fen: chess.fen(),
          turn: chess.turn(),
        };
      } catch (error) {
        return {
          ok: false,
          reason: error instanceof Error ? error.message : "Unable to undo",
          fen: before,
          turn: chess.turn(),
        };
      }
    },
  };
}
