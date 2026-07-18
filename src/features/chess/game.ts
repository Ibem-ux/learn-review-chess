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
  move: (input: ChessMoveInput) => ChessMoveResult;
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

export function createGame(fen?: string): ChessGame {
  const chess = new Chess(fen);

  return {
    chess,
    fen: () => chess.fen(),
    turn: () => chess.turn(),
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
  };
}
