import { describe, expect, it } from "vitest";
import { detectGamePhase } from "./game-phase";

describe("detectGamePhase", () => {
  it("detects standard start FEN at ply 0 as opening", () => {
    expect(
      detectGamePhase(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        0,
      ),
    ).toBe("opening");
  });

  it("detects standard start FEN at ply 40 as middlegame due to ply bound", () => {
    expect(
      detectGamePhase(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        40,
      ),
    ).toBe("middlegame");
  });

  it("detects a full-material position at ply 20 as opening at the boundary", () => {
    expect(
      detectGamePhase(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        20,
      ),
    ).toBe("opening");
  });

  it("detects a full-material position at ply 21 as middlegame at the boundary", () => {
    expect(
      detectGamePhase(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        21,
      ),
    ).toBe("middlegame");
  });

  it("detects a king-and-pawns-only position as endgame at ply 0", () => {
    expect(
      detectGamePhase(
        "4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1",
        0,
      ),
    ).toBe("endgame");
  });

  it("detects a king-and-pawns-only position as endgame at ply 60", () => {
    expect(
      detectGamePhase(
        "4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1",
        60,
      ),
    ).toBe("endgame");
  });

  it("detects exactly 6 minor/major pieces as endgame at the boundary", () => {
    expect(
      detectGamePhase(
        "qrb1k3/pppppppp/8/8/8/8/PPPPPPPP/QRB1K3 w - - 0 1",
        0,
      ),
    ).toBe("endgame");
  });

  it("detects exactly 7 minor/major pieces at ply 40 as middlegame at the boundary", () => {
    expect(
      detectGamePhase(
        "qrb1k3/pppppppp/8/8/8/8/PPPPPPPP/QRBNK3 w - - 0 1",
        40,
      ),
    ).toBe("middlegame");
  });

  it("detects 11 minor/major pieces at ply 5 as middlegame at the boundary", () => {
    expect(
      detectGamePhase(
        "qrrbbk2/pppppppp/8/8/8/8/PPPPPPPP/QRRBBNK1 w - - 0 1",
        5,
      ),
    ).toBe("middlegame");
  });

  it("throws RangeError for an empty FEN string", () => {
    expect(() => detectGamePhase("", 0)).toThrow(RangeError);
    expect(() => detectGamePhase("", 0)).toThrow(
      "FEN must contain eight ranks.",
    );
  });

  it("throws RangeError for a placement field with 7 ranks", () => {
    expect(() =>
      detectGamePhase("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP w KQkq - 0 1", 0),
    ).toThrow(RangeError);
    expect(() =>
      detectGamePhase("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP w KQkq - 0 1", 0),
    ).toThrow("FEN must contain eight ranks.");
  });

  it("throws RangeError for a negative ply", () => {
    expect(() =>
      detectGamePhase(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        -1,
      ),
    ).toThrow(RangeError);
    expect(() =>
      detectGamePhase(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        -1,
      ),
    ).toThrow("Ply must be a finite non-negative number.");
  });

  it("throws RangeError for a non-finite ply", () => {
    expect(() =>
      detectGamePhase(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        Infinity,
      ),
    ).toThrow(RangeError);
    expect(() =>
      detectGamePhase(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        Infinity,
      ),
    ).toThrow("Ply must be a finite non-negative number.");
  });
});
