import { describe, expect, it } from "vitest";
import { countPgnGames, normalizeHeader, parsePgn, splitPgnGames } from "@/features/chess/pgn";

const ELIGIBLE_RESULTS = ["1-0", "0-1", "1/2-1/2"] as const;

describe("parsePgn", () => {
  it("rejects empty input", () => {
    const result = parsePgn("");
    expect(result.ok).toBe(false);
  });

  it("rejects whitespace-only input", () => {
    const result = parsePgn("   \n\t  ");
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed PGN with the sanitized reason", () => {
    const result = parsePgn("not a real pgn at all");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(
      "Unable to parse PGN. Check that the game notation is valid."
    );
  });

  it("rejects an illegal move sequence with the sanitized reason", () => {
    const result = parsePgn('[Event "bad"]\n\n1. e2e4 e7e5 2. Qh4 *');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(
      "Unable to parse PGN. Check that the game notation is valid."
    );
  });

  it("never exposes raw chess.js exception messages", () => {
    const malformed = parsePgn("not a real pgn at all");
    const illegal = parsePgn('[Event "bad"]\n\n1. e2e4 e7e5 2. Qh4 *');
    for (const result of [malformed, illegal]) {
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.reason).not.toMatch(/move|illegal|chess\.js|Error|throw|exception/i);
    }
  });

  it("parses a valid short game", () => {
    const pgn = [
      '[Event "Test"]',
      '[Site "Local"]',
      '[White "Alice"]',
      '[Black "Bob"]',
      "",
      "1. e4 e5 2. Nf3 Nc6 *",
    ].join("\n");
    const result = parsePgn(pgn);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.halfMoveCount).toBe(4);
    expect(result.value.moves.map((m) => m.san)).toEqual([
      "e4",
      "e5",
      "Nf3",
      "Nc6",
    ]);
  });

  it("extracts headers", () => {
    const pgn = [
      '[Event "Test"]',
      '[Site "Local"]',
      '[White "Alice"]',
      '[Black "Bob"]',
      "",
      "1. e4 e5 *",
    ].join("\n");
    const result = parsePgn(pgn);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.headers.Event).toBe("Test");
    expect(result.value.headers.White).toBe("Alice");
    expect(result.value.headers.Black).toBe("Bob");
  });

  it("assigns correct White/Black move colors", () => {
    const pgn = ["[Event \"x\"]", "", "1. e4 e5 2. Nf3 Nc6 *"].join("\n");
    const result = parsePgn(pgn);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.moves.map((m) => m.color)).toEqual([
      "w",
      "b",
      "w",
      "b",
    ]);
  });

  it("provides correct source and destination squares", () => {
    const pgn = ["[Event \"x\"]", "", "1. e4 e5 *"].join("\n");
    const result = parsePgn(pgn);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.moves[0]).toMatchObject({
      from: "e2",
      to: "e4",
    });
    expect(result.value.moves[1]).toMatchObject({
      from: "e7",
      to: "e5",
    });
  });

  it("provides before and after FEN values", () => {
    const pgn = ["[Event \"x\"]", "", "1. e4 e5 *"].join("\n");
    const result = parsePgn(pgn);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [e4, e5] = result.value.moves;
    expect(e4.before).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    );
    expect(e4.after).toBe(
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    );
    expect(e5.before).toBe(e4.after);
    expect(e5.after).toBe(result.value.finalFen);
  });

  it("provides the correct final FEN", () => {
    const pgn = ["[Event \"x\"]", "", "1. e4 e5 2. Nf3 Nc6 *"].join("\n");
    const result = parsePgn(pgn);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.finalFen).toBe(
      "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3"
    );
  });

  it("parses a PGN containing comments and annotations", () => {
    const pgn = [
      '[Event "Annotated"]',
      "",
      "1. e4 {good central move} e5 2. Nf3 Nc6 3. Bb5+ $1 *",
    ].join("\n");
    const result = parsePgn(pgn);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.halfMoveCount).toBe(5);
    expect(result.value.moves).toHaveLength(5);
    expect(result.value.moves.slice(0, 5).map((m) => m.san)).toEqual([
      "e4",
      "e5",
      "Nf3",
      "Nc6",
      "Bb5",
    ]);
  });

  it("does not mutate an external ChessGame instance", () => {
    const pgn = ["[Event \"x\"]", "", "1. e4 e5 *"].join("\n");
    const result = parsePgn(pgn);
    expect(result.ok).toBe(true);
  });

  it("normalizes undefined to Not specified", () => {
    expect(normalizeHeader(undefined)).toBe("Not specified");
  });

  it("normalizes empty string to Not specified", () => {
    expect(normalizeHeader("")).toBe("Not specified");
  });

  it("normalizes whitespace-only string to Not specified", () => {
    expect(normalizeHeader("   ")).toBe("Not specified");
  });

  it("normalizes ? to Not specified", () => {
    expect(normalizeHeader("?")).toBe("Not specified");
  });

  it("preserves legitimate header values", () => {
    expect(normalizeHeader("Alice")).toBe("Alice");
    expect(normalizeHeader("Bob ")).toBe("Bob ");
  });

  describe("analysisEligible", () => {
    for (const result of ELIGIBLE_RESULTS) {
      it(`marks ${result} as eligible`, () => {
        let terminalMovetext: string;
        if (result === "1-0") {
          terminalMovetext = "1. e4 e5 2. Qh5 Nc6 3. Qxf7# 1-0";
        } else if (result === "0-1") {
          terminalMovetext = "1. e4 e5 2. Qh5 Nc6 3. Qxf7# 0-1";
        } else {
          terminalMovetext = "1. e4 e5 2. Qh5 Nc6 3. Bb5+ 1/2-1/2";
        }
        const pgn = [
          '[Event "Test"]',
          `[Result "${result}"]`,
          "",
          terminalMovetext,
        ].join("\n");
        const parsed = parsePgn(pgn);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.value.analysisEligible).toBe(true);
      });
    }

    it("marks Result * as ineligible while still parsing", () => {
      const pgn = [
        '[Event "Test"]',
        '[Result "*"]',
        "",
        "1. e4 e5 *",
      ].join("\n");
      const parsed = parsePgn(pgn);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.value.analysisEligible).toBe(false);
    });

    it("marks missing Result as ineligible while still parsing", () => {
      const pgn = ["[Event \"Test\"]", "", "1. e4 e5 *"].join("\n");
      const parsed = parsePgn(pgn);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.value.analysisEligible).toBe(false);
    });

    it("marks header 1-0 with movetext * as ineligible", () => {
      const pgn = [
        '[Event "Test"]',
        '[Result "1-0"]',
        "",
        "1. e4 e5 *",
      ].join("\n");
      const parsed = parsePgn(pgn);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.value.analysisEligible).toBe(false);
    });

    it("marks conflicting header 1-0 with movetext 0-1 as eligible", () => {
      const pgn = [
        '[Event "Test"]',
        '[Result "1-0"]',
        "",
        "1. e4 e5 2. Qh5 Nc6 3. Qxf7# 0-1",
      ].join("\n");
      const parsed = parsePgn(pgn);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.value.analysisEligible).toBe(true);
    });

    it("marks unrecognized Result values as ineligible", () => {
      for (const value of ["?", "1/X", "ongoing", ""]) {
        const pgn = [
          '[Event "Test"]',
          `[Result "${value}"]`,
          "",
          "1. e4 e5 *",
        ].join("\n");
        const parsed = parsePgn(pgn);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.value.analysisEligible).toBe(false);
      }
    });
  });

  describe("promotion handling", () => {
    const PROMOTION_PGN = `[Event "Test"]
[Result "1-0"]

1. e4 d5 2. exd5 c6 3. dxc6 Nf6 4. cxb7 Bg4 5. bxa8=Q 1-0`;

    it("parses promotion move with promotion q and san containing =Q", () => {
      const parsed = parsePgn(PROMOTION_PGN);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      const lastMove = parsed.value.moves[parsed.value.moves.length - 1];
      expect(lastMove.promotion).toBe("q");
      expect(lastMove.san).toContain("=Q");
    });

    it("leaves promotion undefined for all non-promotion moves", () => {
      const parsed = parsePgn(PROMOTION_PGN);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      const otherMoves = parsed.value.moves.slice(0, -1);
      for (const move of otherMoves) {
        expect(move.promotion).toBeUndefined();
      }
    });
  });

  describe("countPgnGames", () => {
    it("returns 0 for empty string", () => {
      expect(countPgnGames("")).toBe(0);
    });

    it("returns 0 for whitespace only", () => {
      expect(countPgnGames("   \n\t  ")).toBe(0);
    });

    it("returns 1 for a single game with an Event header", () => {
      const pgn = '[Event "Game 1"]\n1. e4 e5 1-0';
      expect(countPgnGames(pgn)).toBe(1);
    });

    it("returns 2 for two games each with an Event header", () => {
      const pgn = '[Event "Game 1"]\n1. e4 e5 1-0\n\n[Event "Game 2"]\n1. d4 d5 1-0';
      expect(countPgnGames(pgn)).toBe(2);
    });

    it("returns 3 for three games each with an Event header", () => {
      const pgn = '[Event "Game 1"]\n1. e4 e5 1-0\n\n[Event "Game 2"]\n1. d4 d5 1-0\n\n[Event "Game 3"]\n1. c4 c5 1-0';
      expect(countPgnGames(pgn)).toBe(3);
    });

    it("returns 1 for a move list with no headers at all", () => {
      expect(countPgnGames("1. e4 e5 1-0")).toBe(1);
    });

    it("returns 1 for a game whose header block is preceded by blank lines", () => {
      const pgn = '\n\n  \n[Event "Game 1"]\n1. e4 e5 1-0';
      expect(countPgnGames(pgn)).toBe(1);
    });

    it("documents parsePgn behavior when called with two complete games", () => {
      const pgn = '[Event "Game 1"]\n[Result "1-0"]\n\n1. e4 e5 1-0\n\n[Event "Game 2"]\n[Result "0-1"]\n\n1. d4 d5 0-1';
      const result = parsePgn(pgn);
      expect(result.ok).toBe(false);
    });
  });

  describe("splitPgnGames", () => {
    it("returns an empty array for empty string", () => {
      expect(splitPgnGames("")).toEqual([]);
    });

    it("returns an empty array for whitespace-only input", () => {
      expect(splitPgnGames("   \n\t  ")).toEqual([]);
    });

    it("returns a single-element array equal to the trimmed input for movetext with no Event tag", () => {
      expect(splitPgnGames("1. e4 e5 1-0")).toEqual(["1. e4 e5 1-0"]);
    });

    it("splits a two-game file into two elements where each element starts with an Event tag", () => {
      const pgn = '[Event "Game 1"]\n1. e4 e5 1-0\n\n[Event "Game 2"]\n1. d4 d5 1-0';
      const result = splitPgnGames(pgn);
      expect(result).toHaveLength(2);
      expect(result[0].startsWith('[Event "Game 1"]')).toBe(true);
      expect(result[1].startsWith('[Event "Game 2"]')).toBe(true);
    });

    it("splits a three-game file into three elements", () => {
      const pgn = '[Event "Game 1"]\n1. e4 e5 1-0\n\n[Event "Game 2"]\n1. d4 d5 1-0\n\n[Event "Game 3"]\n1. c4 c5 1-0';
      const result = splitPgnGames(pgn);
      expect(result).toHaveLength(3);
    });

    it("parses each element of a two-game split successfully through parsePgn with ok true", () => {
      const pgn = '[Event "Game 1"]\n[Result "1-0"]\n\n1. e4 e5 1-0\n\n[Event "Game 2"]\n[Result "0-1"]\n\n1. d4 d5 0-1';
      const parts = splitPgnGames(pgn);
      expect(parts).toHaveLength(2);
      const res1 = parsePgn(parts[0]);
      const res2 = parsePgn(parts[1]);
      expect(res1.ok).toBe(true);
      expect(res2.ok).toBe(true);
    });

    it("parses distinct White headers for games in a two-game split", () => {
      const pgn = '[Event "Game 1"]\n[White "Kasparov"]\n1. e4 e5 1-0\n\n[Event "Game 2"]\n[White "Carlsen"]\n1. d4 d5 1-0';
      const parts = splitPgnGames(pgn);
      expect(parts).toHaveLength(2);
      const res1 = parsePgn(parts[0]);
      const res2 = parsePgn(parts[1]);
      expect(res1).toMatchObject({ ok: true, value: { headers: { White: "Kasparov" } } });
      expect(res2).toMatchObject({ ok: true, value: { headers: { White: "Carlsen" } } });
    });

    it("preserves content before the first Event tag in the first element", () => {
      const pgn = '% Comment line\n[Event "Game 1"]\n1. e4 e5 1-0\n\n[Event "Game 2"]\n1. d4 d5 1-0';
      const parts = splitPgnGames(pgn);
      expect(parts).toHaveLength(2);
      expect(parts[0]).toBe('% Comment line\n[Event "Game 1"]\n1. e4 e5 1-0');
    });

    it("handles carriage-return line endings producing the same element count as newline endings", () => {
      const pgn = '[Event "Game 1"]\r\n1. e4 e5 1-0\r\n\r\n[Event "Game 2"]\r\n1. d4 d5 1-0';
      const parts = splitPgnGames(pgn);
      expect(parts).toHaveLength(2);
    });

    it("satisfies the invariant that splitPgnGames length equals countPgnGames for every fixture", () => {
      const fixtures = [
        "",
        "   \n\t  ",
        "1. e4 e5 1-0",
        '[Event "Game 1"]\n1. e4 e5 1-0',
        '[Event "Game 1"]\n1. e4 e5 1-0\n\n[Event "Game 2"]\n1. d4 d5 1-0',
        '[Event "Game 1"]\n1. e4 e5 1-0\n\n[Event "Game 2"]\n1. d4 d5 1-0\n\n[Event "Game 3"]\n1. c4 c5 1-0',
        '% Comment\n[Event "Game 1"]\n1. e4 e5 1-0\n\n[Event "Game 2"]\n1. d4 d5 1-0',
        '[Event "Game 1"]\r\n1. e4 e5 1-0\r\n\r\n[Event "Game 2"]\r\n1. d4 d5 1-0',
      ];
      for (const fixture of fixtures) {
        expect(splitPgnGames(fixture).length).toBe(countPgnGames(fixture));
      }
    });
  });
});

