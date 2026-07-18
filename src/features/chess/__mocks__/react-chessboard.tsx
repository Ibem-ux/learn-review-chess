import { type PieceDropHandlerArgs } from "react-chessboard";

export function Chessboard(props: { options?: Record<string, unknown> }) {
  const options = props.options ?? {};
  const position = typeof options.position === "string" ? options.position : "";
  const orientation =
    options.boardOrientation === "black" ? "black" : "white";
  const onPieceDrop = options.onPieceDrop as
    | ((args: PieceDropHandlerArgs) => boolean)
    | undefined;

  const legalDrop: PieceDropHandlerArgs = {
    piece: { isSparePiece: false, position: "e2", pieceType: "wP" },
    sourceSquare: "e2",
    targetSquare: "e4",
  };
  const illegalDrop: PieceDropHandlerArgs = {
    piece: { isSparePiece: false, position: "e2", pieceType: "wP" },
    sourceSquare: "e2",
    targetSquare: "e5",
  };

  return (
    <section
      role="region"
      aria-label="Interactive chessboard"
      data-testid="chessboard"
      data-position={position}
      data-orientation={orientation}
    >
      <button
        type="button"
        data-testid="simulate-drop"
        onClick={() => {
          onPieceDrop?.(legalDrop);
        }}
      >
        simulate legal drop
      </button>
      <button
        type="button"
        data-testid="simulate-illegal-drop"
        onClick={() => {
          onPieceDrop?.(illegalDrop);
        }}
      >
        simulate illegal drop
      </button>
    </section>
  );
}
