import { describe, expect, it } from "vitest";
import { lookupOpening, OPENING_BOOK } from "./opening-book";

describe("opening-book", () => {
  it("returns null for an empty move list", () => {
    expect(lookupOpening([])).toBeNull();
  });

  it("returns null when the first move is not in the book", () => {
    expect(lookupOpening(["a3"])).toBeNull();
    expect(lookupOpening(["h4", "e5"])).toBeNull();
  });

  it("identifies the Sicilian Defence from e4 c5", () => {
    const result = lookupOpening(["e4", "c5"]);
    expect(result).toEqual({
      eco: "B20",
      name: "Sicilian Defence",
      bookPlies: 2,
    });
  });

  it("prefers the longest matching prefix", () => {
    const result = lookupOpening(["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6"]);
    expect(result).toEqual({
      eco: "C65",
      name: "Ruy Lopez Berlin Defence",
      bookPlies: 6,
    });
  });

  it("reports bookPlies equal to the matched entry length", () => {
    const result = lookupOpening(["e4", "e5", "Nf3", "Nc6", "Bc4"]);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.bookPlies).toBe(5);
  });

  it("ignores moves played after the book line ends", () => {
    const result = lookupOpening(["e4", "c5", "Nf3", "d6"]);
    expect(result).toEqual({
      eco: "B20",
      name: "Sicilian Defence",
      bookPlies: 2,
    });
  });

  it("is case sensitive on SAN", () => {
    expect(lookupOpening(["nf3"])).toBeNull();
    expect(lookupOpening(["e4", "e5", "nf3"])).toEqual({
      eco: "C20",
      name: "King's Pawn Game",
      bookPlies: 2,
    });
  });

  it("does not mutate the input array", () => {
    const moves = ["e4", "c5"];
    const clone = [...moves];
    lookupOpening(moves);
    expect(moves).toEqual(clone);
  });

  it("every entry in OPENING_BOOK has a non-empty eco, name, and moves array", () => {
    expect(OPENING_BOOK.length).toBeGreaterThan(0);
    for (const entry of OPENING_BOOK) {
      expect(entry.eco.trim().length).toBeGreaterThan(0);
      expect(entry.name.trim().length).toBeGreaterThan(0);
      expect(entry.moves.length).toBeGreaterThan(0);
      for (const move of entry.moves) {
        expect(move.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
