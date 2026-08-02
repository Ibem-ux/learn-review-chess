import { type PieceDropHandlerArgs } from "react-chessboard";

type MockArrow = {
  startSquare: string;
  endSquare: string;
  color: string;
};

function isMockArrow(value: unknown): value is MockArrow {
  return (
    typeof value === "object" &&
    value !== null &&
    "startSquare" in value &&
    typeof value.startSquare === "string" &&
    "endSquare" in value &&
    typeof value.endSquare === "string" &&
    "color" in value &&
    typeof value.color === "string"
  );
}

export function Chessboard(props: { options?: Record<string, unknown> }) {
  const options = props.options ?? {};
  const position = typeof options.position === "string" ? options.position : "";
  const orientation =
    options.boardOrientation === "black" ? "black" : "white";
  const id = typeof options.id === "string" ? options.id : "interactive";
  const allowDragging = options.allowDragging !== false;
  const onPieceDrop = options.onPieceDrop as
    | ((args: PieceDropHandlerArgs) => boolean)
    | undefined;

  const rawArrows = Array.isArray(options.arrows) ? options.arrows : [];
  const arrowsValue = rawArrows
    .filter(isMockArrow)
    .map((arrow) => `${arrow.startSquare}>${arrow.endSquare}:${arrow.color}`)
    .join(",");
  const clearArrowsOnPositionChange =
    options.clearArrowsOnPositionChange !== undefined
      ? String(options.clearArrowsOnPositionChange)
      : "undefined";

  const legalDrop: PieceDropHandlerArgs = {
    piece: { isSparePiece: false, position: "e2", pieceType: "wP" },
    sourceSquare: "e2",
    targetSquare: "e4",
  };
  const secondDrop: PieceDropHandlerArgs = {
    piece: { isSparePiece: false, position: "e7", pieceType: "bP" },
    sourceSquare: "e7",
    targetSquare: "e5",
  };
  const illegalDrop: PieceDropHandlerArgs = {
    piece: { isSparePiece: false, position: "e2", pieceType: "wP" },
    sourceSquare: "e2",
    targetSquare: "e5",
  };

  return (
    <div
      data-testid="chessboard"
      data-board-id={id}
      data-position={position}
      data-orientation={orientation}
      data-allow-dragging={String(allowDragging)}
      data-arrows={arrowsValue}
      data-clear-arrows-on-position-change={clearArrowsOnPositionChange}
    >
      {allowDragging && (
        <>
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
            data-testid="simulate-second-drop"
            onClick={() => {
              onPieceDrop?.(secondDrop);
            }}
          >
            simulate second legal drop
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
        </>
      )}
    </div>
  );
}
