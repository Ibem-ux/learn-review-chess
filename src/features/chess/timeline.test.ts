import { describe, expect, it } from "vitest";
import { parsePgn } from "@/features/chess/pgn";
import {
  buildTimeline,
  getTimelineStep,
  type ReviewTimeline,
} from "@/features/chess/timeline";

function parseShortGame(): ReturnType<typeof parsePgn> {
  const pgn = [
    '[Event "Test"]',
    '[Site "Local"]',
    '[White "Alice"]',
    '[Black "Bob"]',
    "",
    "1. e4 e5 2. Nf3 Nc6 *",
  ].join("\n");
  return parsePgn(pgn);
}

function timelineOf(): ReviewTimeline {
  const result = parseShortGame();
  if (!result.ok) throw new Error("expected successful parse");
  return buildTimeline(result.value);
}

describe("buildTimeline", () => {
  it("has length equal to halfMoveCount + 1", () => {
    const timeline = timelineOf();
    expect(timeline.steps).toHaveLength(5);
    expect(timeline.totalPlies).toBe(4);
    expect(timeline.steps.length).toBe(timeline.totalPlies + 1);
  });

  it("starts at the initial position (ply 0)", () => {
    const timeline = timelineOf();
    const step = timeline.steps[0];
    expect(step.ply).toBe(0);
    expect(step.move).toBeNull();
    expect(step.fen).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    );
  });

  it("uses the first move after FEN at step 1", () => {
    const timeline = timelineOf();
    const step = timeline.steps[1];
    expect(step.ply).toBe(1);
    expect(step.fen).toBe(
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    );
    expect(step.move?.san).toBe("e4");
  });

  it("uses the corresponding move after FEN at an intermediate step", () => {
    const timeline = timelineOf();
    const step = timeline.steps[3];
    expect(step.ply).toBe(3);
    expect(step.move?.san).toBe("Nf3");
    expect(step.fen).toBe(
      "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2"
    );
  });

  it("ends at the final FEN", () => {
    const timeline = timelineOf();
    const last = timeline.steps[timeline.steps.length - 1];
    expect(last.ply).toBe(timeline.totalPlies);
    expect(last.fen).toBe(timeline.finalFen);
    expect(last.fen).toBe(
      "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3"
    );
  });

  it("associates each non-initial step with its move in SAN order", () => {
    const timeline = timelineOf();
    const sans = timeline.steps
      .filter((step) => step.move !== null)
      .map((step) => step.move!.san);
    expect(sans).toEqual(["e4", "e5", "Nf3", "Nc6"]);
  });

  it("does not mutate the parsed input", () => {
    const result = parseShortGame();
    if (!result.ok) throw new Error("expected successful parse");
    const before = JSON.stringify(result.value);
    buildTimeline(result.value);
    expect(JSON.stringify(result.value)).toBe(before);
  });

  it("produces one initial/final position for a zero-move game", () => {
    const result = parsePgn('[Event "Empty"]\n\n');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.halfMoveCount).toBe(0);
    const timeline = buildTimeline(result.value);
    expect(timeline.steps).toHaveLength(1);
    expect(timeline.totalPlies).toBe(0);
    expect(timeline.steps[0].move).toBeNull();
    expect(timeline.initialFen).toBe(timeline.finalFen);
    expect(timeline.initialFen).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    );
  });
});

describe("getTimelineStep", () => {
  const timeline = timelineOf();

  it("returns the requested in-range step", () => {
    const result = getTimelineStep(timeline, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.step.ply).toBe(2);
    expect(result.step.move?.san).toBe("e5");
  });

  it("rejects negative ply", () => {
    const result = getTimelineStep(timeline, -1);
    expect(result.ok).toBe(false);
  });

  it("rejects out-of-range ply", () => {
    const result = getTimelineStep(timeline, timeline.totalPlies + 1);
    expect(result.ok).toBe(false);
  });

  it("rejects non-integer ply", () => {
    const result = getTimelineStep(timeline, 1.5);
    expect(result.ok).toBe(false);
  });

  it("never throws for invalid input", () => {
    expect(() => getTimelineStep(timeline, -5)).not.toThrow();
    expect(() => getTimelineStep(timeline, 99)).not.toThrow();
    expect(() => getTimelineStep(timeline, Number.NaN)).not.toThrow();
  });
});
