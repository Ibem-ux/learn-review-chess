import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  EvaluationGraph,
  GRAPH_X_INSET,
  GRAPH_Y_INSET,
  MARKER_DENSITY_LIMIT,
} from "@/features/chess/evaluation-graph";
import type { GraphPoint } from "@/features/chess/evaluation-graph-model";

function makePoint(
  ply: number,
  advantage: number,
  overrides: Partial<GraphPoint> = {},
): GraphPoint {
  return {
    ply,
    hasValue: true,
    clampedCp: Math.round((advantage - 0.5) * 2000),
    advantage,
    isMate: false,
    san: null,
    ...overrides,
  };
}

describe("EvaluationGraph", () => {
  it("empty array renders the empty state and no svg", () => {
    const { container } = render(<EvaluationGraph points={[]} currentPly={0} onSelectPly={() => {}} />);
    expect(screen.getByTestId("evaluation-graph-empty")).toHaveTextContent("No analysis yet.");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("a fully evaluated series of 5 renders exactly one polyline", () => {
    const points = [
      makePoint(0, 0.5),
      makePoint(1, 0.6),
      makePoint(2, 0.7),
      makePoint(3, 0.8),
      makePoint(4, 0.9),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />);
    const segments = container.querySelectorAll('[data-testid="evaluation-graph-segment"]');
    expect(segments.length).toBe(1);
  });

  it("a gap in the middle renders exactly two polylines", () => {
    const points = [
      makePoint(0, 0.5),
      makePoint(1, 0.6),
      makePoint(2, 0, { hasValue: false }),
      makePoint(3, 0.7),
      makePoint(4, 0.8),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />);
    const segments = container.querySelectorAll('[data-testid="evaluation-graph-segment"]');
    expect(segments.length).toBe(2);
  });

  it("two separate gaps render three polylines", () => {
    const points = [
      makePoint(0, 0.5),
      makePoint(1, 0.6),
      makePoint(2, 0, { hasValue: false }),
      makePoint(3, 0.7),
      makePoint(4, 0.8),
      makePoint(5, 0, { hasValue: false }),
      makePoint(6, 0.9),
      makePoint(7, 1.0),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />);
    const segments = container.querySelectorAll('[data-testid="evaluation-graph-segment"]');
    expect(segments.length).toBe(3);
  });

  it("an isolated evaluated point between two gaps renders one marker and zero polylines", () => {
    const points = [
      makePoint(0, 0, { hasValue: false }),
      makePoint(1, 0.5),
      makePoint(2, 0, { hasValue: false }),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />);
    const segments = container.querySelectorAll('[data-testid="evaluation-graph-segment"]');
    const markers = container.querySelectorAll('[data-testid="evaluation-graph-marker"]');
    expect(segments.length).toBe(0);
    expect(markers.length).toBe(1);
  });

  it("a polyline's points attribute contains the exact expected coordinate string for a known small series", () => {
    const points = [
      makePoint(0, 0.5),
      makePoint(1, 0.75),
      makePoint(2, 0.25),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />);
    const segment = container.querySelector('[data-testid="evaluation-graph-segment"]');
    expect(segment?.getAttribute("points")).toBe("1.0,20.0 50.0,10.8 99.0,29.3");
  });

  it("advantage 1 maps to the top inset and advantage 0 maps to the bottom inset", () => {
    const points = [
      makePoint(0, 1),
      makePoint(1, 0),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />);
    const segment = container.querySelector('[data-testid="evaluation-graph-segment"]');
    expect(segment?.getAttribute("points")).toBe("1.0,1.5 99.0,38.5");
  });

  it("the midline is present", () => {
    const points = [makePoint(0, 0.5)];
    const { container } = render(<EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />);
    const midline = container.querySelector('[data-testid="evaluation-graph-midline"]');
    expect(midline).not.toBeNull();
    expect(midline?.getAttribute("y1")).toBe("20");
    expect(midline?.getAttribute("y2")).toBe("20");
  });

  it("the cursor appears at the correct x for currentPly", () => {
    const points = [
      makePoint(0, 0.5),
      makePoint(1, 0.6),
      makePoint(2, 0.7),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={1} onSelectPly={() => {}} />);
    const cursor = container.querySelector('[data-testid="evaluation-graph-cursor"]');
    expect(cursor).not.toBeNull();
    expect(cursor?.getAttribute("x1")).toBe("50.0");
    expect(cursor?.getAttribute("x2")).toBe("50.0");
  });

  it("no cursor when currentPly matches no point", () => {
    const points = [
      makePoint(0, 0.5),
      makePoint(1, 0.6),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={99} onSelectPly={() => {}} />);
    const cursor = container.querySelector('[data-testid="evaluation-graph-cursor"]');
    expect(cursor).toBeNull();
  });

  it("one button per point, including unevaluated ones", () => {
    const points = [
      makePoint(0, 0.5),
      makePoint(1, 0, { hasValue: false }),
      makePoint(2, 0.6),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />);
    const buttons = container.querySelectorAll('button[data-ply]');
    expect(buttons.length).toBe(3);
    expect(buttons[0].getAttribute("data-ply")).toBe("0");
    expect(buttons[1].getAttribute("data-ply")).toBe("1");
    expect(buttons[2].getAttribute("data-ply")).toBe("2");
  });

  it("clicking a button calls onSelectPly with the right ply", () => {
    const onSelectPly = vi.fn();
    const points = [
      makePoint(0, 0.5),
      makePoint(1, 0.6),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={0} onSelectPly={onSelectPly} />);
    const buttons = container.querySelectorAll('button[data-ply]');
    fireEvent.click(buttons[1] as HTMLElement);
    expect(onSelectPly).toHaveBeenCalledWith(1);
  });

  it("the currentPly button has aria-current true", () => {
    const points = [
      makePoint(0, 0.5),
      makePoint(1, 0.6),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={1} onSelectPly={() => {}} />);
    const buttons = container.querySelectorAll('button[data-ply]');
    expect(buttons[1].getAttribute("aria-current")).toBe("true");
    expect(buttons[0].getAttribute("aria-current")).toBeNull();
  });

  it("a single-point series does not produce NaN in any attribute", () => {
    const points = [makePoint(0, 0.5)];
    const { container } = render(<EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />);
    const marker = container.querySelector('[data-testid="evaluation-graph-marker"]');
    expect(marker).not.toBeNull();
    expect(marker?.getAttribute("style")).toContain("left: 50%");
    expect(marker?.getAttribute("style")).toContain("top: 50%");
    const cursor = container.querySelector('[data-testid="evaluation-graph-cursor"]');
    expect(cursor?.getAttribute("x1")).toBe("50.0");
    expect(cursor?.getAttribute("x2")).toBe("50.0");
  });

  it("the last point's button calls onSelectPly with the last ply when clicked", () => {
    const onSelectPly = vi.fn();
    const points = [
      makePoint(0, 0.5),
      makePoint(1, 0.6),
      makePoint(2, 0.7),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={0} onSelectPly={onSelectPly} />);
    const buttons = container.querySelectorAll('button[data-ply]');
    fireEvent.click(buttons[2] as HTMLElement);
    expect(onSelectPly).toHaveBeenCalledWith(2);
  });

  it("overlay buttons use flex columns and carry no inline positioning", () => {
    const points = [
      makePoint(0, 0.5),
      makePoint(1, 0.6),
      makePoint(2, 0.7),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />);
    const buttons = container.querySelectorAll('button[data-ply]');
    const lastButton = buttons[buttons.length - 1];
    expect(lastButton.getAttribute("style")).toBeNull();
    expect(lastButton.getAttribute("class")).toContain("flex-1");
  });

  it("a fully evaluated series of 5 renders exactly 5 markers", () => {
    const points = [
      makePoint(0, 0.5),
      makePoint(1, 0.6),
      makePoint(2, 0.7),
      makePoint(3, 0.8),
      makePoint(4, 0.9),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />);
    const markers = container.querySelectorAll('[data-testid="evaluation-graph-marker"]');
    expect(markers.length).toBe(5);
  });

  it("a series with one gap renders markers only for evaluated points", () => {
    const points = [
      makePoint(0, 0.5),
      makePoint(1, 0.6),
      makePoint(2, 0, { hasValue: false }),
      makePoint(3, 0.7),
      makePoint(4, 0.8),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />);
    const markers = container.querySelectorAll('[data-testid="evaluation-graph-marker"]');
    expect(markers.length).toBe(4);
  });

  it("a marker for a point with san renders a title attribute whose text content is exactly that san", () => {
    const points = [
      makePoint(0, 0.5, { san: "e4" }),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />);
    const marker = container.querySelector('[data-testid="evaluation-graph-marker"]');
    expect(marker?.getAttribute("title")).toBe("e4");
  });

  it("a marker for a point with san null renders no title attribute", () => {
    const points = [
      makePoint(0, 0.5, { san: null }),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />);
    const marker = container.querySelector('[data-testid="evaluation-graph-marker"]');
    expect(marker?.getAttribute("title")).toBeNull();
  });

  it("an overlay button for a point with san has aria-label including the san, and one with san null does not", () => {
    const points = [
      makePoint(0, 0.5, { san: null }),
      makePoint(3, 0.6, { san: "Nf3" }),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />);
    const buttons = container.querySelectorAll('button[data-ply]');
    expect(buttons[0].getAttribute("aria-label")).toBe("Go to ply 0");
    expect(buttons[1].getAttribute("aria-label")).toBe("Go to ply 3, Nf3");
  });

  it("an overlay button for a point with san renders an evaluation-graph-label whose text content is exactly that san", () => {
    const points = [
      makePoint(0, 0.5, { san: "Nf3" }),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />);
    const button = container.querySelector('button[data-ply="0"]');
    const label = button?.querySelector('[data-testid="evaluation-graph-label"]');
    expect(label?.textContent).toBe("Nf3");
  });

  it("an overlay button for a point with san null renders no evaluation-graph-label element", () => {
    const points = [
      makePoint(0, 0.5, { san: null }),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />);
    const button = container.querySelector('button[data-ply="0"]');
    const labels = button?.querySelectorAll('[data-testid="evaluation-graph-label"]');
    expect(labels?.length).toBe(0);
  });

  it("a marker for a point with san is styled as a rounded circle", () => {
    const points = [
      makePoint(0, 0.5, { san: "e4" }),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />);
    const marker = container.querySelector('[data-testid="evaluation-graph-marker"]');
    expect(marker?.getAttribute("class")).toContain("rounded-full");
  });

  it("an overlay button's className is exactly flex-1 h-full group relative", () => {
    const points = [
      makePoint(0, 0.5, { san: "Nf3" }),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />);
    const button = container.querySelector('button[data-ply="0"]');
    expect(button?.getAttribute("class")).toBe("flex-1 h-full group relative");
  });

  it("a marker element carries a border style", () => {
    const points = [
      makePoint(0, 0.5, { san: "e4" }),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />);
    const marker = container.querySelector('[data-testid="evaluation-graph-marker"]');
    expect(marker?.getAttribute("class")).toContain("border");
  });

  it("markers are not SVG circles, carry data-ply, and use percentage style positioning", () => {
    const points = [
      makePoint(0, 0.5, { san: "e4" }),
      makePoint(1, 0.75, { san: "e5" }),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />);
    const markers = container.querySelectorAll('[data-testid="evaluation-graph-marker"]');
    expect(markers[0].tagName.toLowerCase()).not.toBe("circle");
    expect(markers[0].getAttribute("data-ply")).toBe("0");
    expect(markers[0].getAttribute("style")).toContain("left:");
    expect(markers[0].getAttribute("style")).toContain("top:");
  });
});

describe("marker density limit (task B4)", () => {
  it("a series of exactly MARKER_DENSITY_LIMIT fully evaluated points renders exactly MARKER_DENSITY_LIMIT markers", () => {
    const points = Array.from({ length: MARKER_DENSITY_LIMIT }, (_, i) =>
      makePoint(i, 0.5)
    );
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const markers = container.querySelectorAll('[data-testid="evaluation-graph-marker"]');
    expect(markers.length).toBe(MARKER_DENSITY_LIMIT);
  });

  // 49 is hardcoded rather than derived from MARKER_DENSITY_LIMIT + 1 because:
  // 1. Deriving it would make the M1 mutation proof unprovable (raising the limit would also raise the fixture size and the test would pass).
  // 2. A very large limit made the derived fixture exhaust the V8 heap.
  // Consequence: If MARKER_DENSITY_LIMIT is ever changed, these hardcoded fixtures must be revisited.
  it("a series of MARKER_DENSITY_LIMIT + 1 fully evaluated points, with currentPly set to an evaluated ply, renders exactly 1 marker, and that marker's data-ply equals currentPly", () => {
    const points = Array.from({ length: 49 }, (_, i) =>
      makePoint(i, 0.5)
    );
    const { container } = render(
      <EvaluationGraph points={points} currentPly={10} onSelectPly={() => {}} />
    );
    const markers = container.querySelectorAll('[data-testid="evaluation-graph-marker"]');
    expect(markers.length).toBe(1);
    expect(markers[0].getAttribute("data-ply")).toBe("10");
  });

  it("a series of MARKER_DENSITY_LIMIT + 1 points where the current ply has hasValue false renders exactly 0 markers", () => {
    const points = Array.from({ length: 49 }, (_, i) =>
      makePoint(i, 0.5, { hasValue: i !== 5 })
    );
    const { container } = render(
      <EvaluationGraph points={points} currentPly={5} onSelectPly={() => {}} />
    );
    const markers = container.querySelectorAll('[data-testid="evaluation-graph-marker"]');
    expect(markers.length).toBe(0);
  });

  it("a series of MARKER_DENSITY_LIMIT + 1 points with a currentPly matching no point renders exactly 0 markers", () => {
    const points = Array.from({ length: 49 }, (_, i) =>
      makePoint(i, 0.5)
    );
    const { container } = render(
      <EvaluationGraph points={points} currentPly={999} onSelectPly={() => {}} />
    );
    const markers = container.querySelectorAll('[data-testid="evaluation-graph-marker"]');
    expect(markers.length).toBe(0);
  });

  it("in the over-limit case, the polyline segment count and each segment's points attribute are unchanged from the equivalent under-limit computation", () => {
    const count = 49;
    const points = Array.from({ length: count }, (_, i) =>
      makePoint(i, 0.5)
    );
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const segments = container.querySelectorAll('[data-testid="evaluation-graph-segment"]');
    expect(segments.length).toBe(1);
    const expectedPointsStr = points
      .map((_, i) => `${(1 + (i / (count - 1)) * 98).toFixed(1)},20.0`)
      .join(" ");
    expect(segments[0].getAttribute("points")).toBe(expectedPointsStr);
  });

  it("in the over-limit case, one overlay button per point is still rendered", () => {
    const count = 49;
    const points = Array.from({ length: count }, (_, i) =>
      makePoint(i, 0.5)
    );
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const buttons = container.querySelectorAll("button[data-ply]");
    expect(buttons.length).toBe(count);
  });

  it("the single marker rendered in the over-limit case carries the exact required className string", () => {
    const points = Array.from({ length: 49 }, (_, i) =>
      makePoint(i, 0.5)
    );
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const markers = container.querySelectorAll('[data-testid="evaluation-graph-marker"]');
    expect(markers.length).toBe(1);
    expect(markers[0].getAttribute("class")).toBe(
      "absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-50 bg-zinc-900"
    );
  });
});

describe("two-section fill and coordinate inset (task B6)", () => {
  it("a fully evaluated series of 5 renders exactly 1 white region", () => {
    const points = [
      makePoint(0, 0.5),
      makePoint(1, 0.6),
      makePoint(2, 0.7),
      makePoint(3, 0.8),
      makePoint(4, 0.9),
    ];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const whiteRegions = container.querySelectorAll(
      '[data-testid="evaluation-graph-white-region"]'
    );
    expect(whiteRegions.length).toBe(1);
  });

  it("a fully evaluated series of 5 renders exactly 1 black region", () => {
    const points = [
      makePoint(0, 0.5),
      makePoint(1, 0.6),
      makePoint(2, 0.7),
      makePoint(3, 0.8),
      makePoint(4, 0.9),
    ];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const blackRegions = container.querySelectorAll(
      '[data-testid="evaluation-graph-black-region"]'
    );
    expect(blackRegions.length).toBe(1);
  });

  it("a series with one gap renders exactly 2 white regions and exactly 2 black regions", () => {
    const points = [
      makePoint(0, 0.5),
      makePoint(1, 0.6),
      makePoint(2, 0, { hasValue: false }),
      makePoint(3, 0.7),
      makePoint(4, 0.8),
    ];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const whiteRegions = container.querySelectorAll(
      '[data-testid="evaluation-graph-white-region"]'
    );
    const blackRegions = container.querySelectorAll(
      '[data-testid="evaluation-graph-black-region"]'
    );
    expect(whiteRegions.length).toBe(2);
    expect(blackRegions.length).toBe(2);
  });

  it("an isolated evaluated point between two gaps renders 0 white regions, 0 black regions, and 1 marker", () => {
    const points = [
      makePoint(0, 0, { hasValue: false }),
      makePoint(1, 0.5),
      makePoint(2, 0, { hasValue: false }),
    ];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const whiteRegions = container.querySelectorAll(
      '[data-testid="evaluation-graph-white-region"]'
    );
    const blackRegions = container.querySelectorAll(
      '[data-testid="evaluation-graph-black-region"]'
    );
    const markers = container.querySelectorAll(
      '[data-testid="evaluation-graph-marker"]'
    );
    expect(whiteRegions.length).toBe(0);
    expect(blackRegions.length).toBe(0);
    expect(markers.length).toBe(1);
  });

  it("the white region's points attribute for the known 3-point series is exactly \"1.0,20.0 50.0,10.8 99.0,29.3 99.0,40.0 1.0,40.0\"", () => {
    const points = [
      makePoint(0, 0.5),
      makePoint(1, 0.75),
      makePoint(2, 0.25),
    ];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const whiteRegion = container.querySelector(
      '[data-testid="evaluation-graph-white-region"]'
    );
    expect(whiteRegion?.getAttribute("points")).toBe(
      "1.0,20.0 50.0,10.8 99.0,29.3 99.0,40.0 1.0,40.0"
    );
  });

  it("the black region's points attribute for the same series is exactly \"1.0,20.0 50.0,10.8 99.0,29.3 99.0,0.0 1.0,0.0\"", () => {
    const points = [
      makePoint(0, 0.5),
      makePoint(1, 0.75),
      makePoint(2, 0.25),
    ];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const blackRegion = container.querySelector(
      '[data-testid="evaluation-graph-black-region"]'
    );
    expect(blackRegion?.getAttribute("points")).toBe(
      "1.0,20.0 50.0,10.8 99.0,29.3 99.0,0.0 1.0,0.0"
    );
  });

  it("the white region className is exactly \"fill-zinc-50\" and the black region className is exactly \"fill-zinc-700\"", () => {
    const points = [makePoint(0, 0.5), makePoint(1, 0.75)];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const whiteRegion = container.querySelector(
      '[data-testid="evaluation-graph-white-region"]'
    );
    const blackRegion = container.querySelector(
      '[data-testid="evaluation-graph-black-region"]'
    );
    expect(whiteRegion?.getAttribute("class")).toBe(
      "fill-zinc-50"
    );
    expect(blackRegion?.getAttribute("class")).toBe(
      "fill-zinc-700"
    );
  });

  it("within the svg, both regions appear before the polyline in DOM order, asserted by comparing indices of the svg's children rather than by any visual assumption", () => {
    const points = [makePoint(0, 0.5), makePoint(1, 0.75)];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const svg = container.querySelector("svg");
    if (!svg) throw new Error("svg element not found");
    const children = Array.from(svg.children);
    const blackIdx = children.findIndex(
      (el) => el.getAttribute("data-testid") === "evaluation-graph-black-region"
    );
    const whiteIdx = children.findIndex(
      (el) => el.getAttribute("data-testid") === "evaluation-graph-white-region"
    );
    const polylineIdx = children.findIndex(
      (el) => el.getAttribute("data-testid") === "evaluation-graph-segment"
    );
    expect(blackIdx).toBeGreaterThanOrEqual(0);
    expect(whiteIdx).toBeGreaterThanOrEqual(0);
    expect(polylineIdx).toBeGreaterThanOrEqual(0);
    expect(blackIdx).toBeLessThan(polylineIdx);
    expect(whiteIdx).toBeLessThan(polylineIdx);
  });

  it("a marker at advantage 1 has style exactly containing \"top: 3.75%\" and a marker at advantage 0 has style exactly containing \"top: 96.25%\"", () => {
    const points = [makePoint(0, 1), makePoint(1, 0)];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const markers = container.querySelectorAll(
      '[data-testid="evaluation-graph-marker"]'
    );
    expect(markers[0]?.getAttribute("style")).toContain("top: 3.75%");
    expect(markers[1]?.getAttribute("style")).toContain("top: 96.25%");
  });

  it("neither region element carries a stroke attribute", () => {
    const points = [makePoint(0, 0.5), makePoint(1, 0.75)];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const whiteRegion = container.querySelector(
      '[data-testid="evaluation-graph-white-region"]'
    );
    const blackRegion = container.querySelector(
      '[data-testid="evaluation-graph-black-region"]'
    );
    expect(whiteRegion?.getAttribute("stroke")).toBeNull();
    expect(blackRegion?.getAttribute("stroke")).toBeNull();
  });
});

describe("theme-independent surface and two-tone fills (task B7)", () => {
  it("the white region className is exactly \"fill-zinc-50\"", () => {
    const points = [makePoint(0, 0.5), makePoint(1, 0.75)];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const whiteRegion = container.querySelector(
      '[data-testid="evaluation-graph-white-region"]'
    );
    if (!whiteRegion) throw new Error("whiteRegion not found");
    expect(whiteRegion.getAttribute("class")).toBe("fill-zinc-50");
  });

  it("the black region className is exactly \"fill-zinc-700\"", () => {
    const points = [makePoint(0, 0.5), makePoint(1, 0.75)];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const blackRegion = container.querySelector(
      '[data-testid="evaluation-graph-black-region"]'
    );
    if (!blackRegion) throw new Error("blackRegion not found");
    expect(blackRegion.getAttribute("class")).toBe("fill-zinc-700");
  });

  it("neither region className contains a dark: variant", () => {
    const points = [makePoint(0, 0.5), makePoint(1, 0.75)];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const whiteRegion = container.querySelector(
      '[data-testid="evaluation-graph-white-region"]'
    );
    const blackRegion = container.querySelector(
      '[data-testid="evaluation-graph-black-region"]'
    );
    if (!whiteRegion) throw new Error("whiteRegion not found");
    if (!blackRegion) throw new Error("blackRegion not found");
    expect(whiteRegion.getAttribute("class")).not.toContain("dark:");
    expect(blackRegion.getAttribute("class")).not.toContain("dark:");
  });

  it("the svg className is exactly the R1 string and carries no dark: variant", () => {
    const points = [makePoint(0, 0.5), makePoint(1, 0.75)];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const svg = container.querySelector("svg");
    if (!svg) throw new Error("svg element not found");
    const className = svg.getAttribute("class") ?? "";
    expect(className).toBe(
      "h-40 w-full rounded border border-zinc-500 bg-zinc-700"
    );
    expect(className).not.toContain("dark:");
  });

  it("each segment renders one outline polyline and one inner polyline", () => {
    const points = [
      makePoint(0, 0.5),
      makePoint(1, 0.6),
      makePoint(2, 0.7),
      makePoint(3, 0.8),
      makePoint(4, 0.9),
    ];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const outlines = container.querySelectorAll(
      '[data-testid="evaluation-graph-segment-outline"]'
    );
    const inners = container.querySelectorAll(
      '[data-testid="evaluation-graph-segment"]'
    );
    expect(outlines.length).toBe(1);
    expect(inners.length).toBe(1);
  });

  it("the outline polyline is stroke-zinc-50 and the inner polyline is stroke-zinc-900", () => {
    const points = [makePoint(0, 0.5), makePoint(1, 0.75)];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const outline = container.querySelector(
      '[data-testid="evaluation-graph-segment-outline"]'
    );
    const inner = container.querySelector(
      '[data-testid="evaluation-graph-segment"]'
    );
    if (!outline) throw new Error("outline polyline not found");
    if (!inner) throw new Error("inner polyline not found");
    expect(outline.getAttribute("class")).toBe("stroke-zinc-50");
    expect(inner.getAttribute("class")).toBe("stroke-zinc-900");
  });

  it("the outline strokeWidth is exactly 2.5 and the inner strokeWidth is exactly 1.5", () => {
    const points = [makePoint(0, 0.5), makePoint(1, 0.75)];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const outline = container.querySelector(
      '[data-testid="evaluation-graph-segment-outline"]'
    );
    const inner = container.querySelector(
      '[data-testid="evaluation-graph-segment"]'
    );
    if (!outline) throw new Error("outline polyline not found");
    if (!inner) throw new Error("inner polyline not found");
    expect(outline.getAttribute("stroke-width")).toBe("2.5");
    expect(inner.getAttribute("stroke-width")).toBe("1.5");
  });

  it("neither polyline carries a stroke attribute of currentColor", () => {
    const points = [makePoint(0, 0.5), makePoint(1, 0.75)];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const outline = container.querySelector(
      '[data-testid="evaluation-graph-segment-outline"]'
    );
    const inner = container.querySelector(
      '[data-testid="evaluation-graph-segment"]'
    );
    if (!outline) throw new Error("outline polyline not found");
    if (!inner) throw new Error("inner polyline not found");
    expect(outline.getAttribute("stroke")).toBeNull();
    expect(inner.getAttribute("stroke")).toBeNull();
  });

  it("within the svg, DOM order is black region, white region, outline, inner line", () => {
    const points = [makePoint(0, 0.5), makePoint(1, 0.75)];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const svg = container.querySelector("svg");
    if (!svg) throw new Error("svg element not found");
    const children = Array.from(svg.children);
    const blackIdx = children.findIndex(
      (el) => el.getAttribute("data-testid") === "evaluation-graph-black-region"
    );
    const whiteIdx = children.findIndex(
      (el) => el.getAttribute("data-testid") === "evaluation-graph-white-region"
    );
    const outlineIdx = children.findIndex(
      (el) => el.getAttribute("data-testid") === "evaluation-graph-segment-outline"
    );
    const innerIdx = children.findIndex(
      (el) => el.getAttribute("data-testid") === "evaluation-graph-segment"
    );
    expect(blackIdx).toBeGreaterThanOrEqual(0);
    expect(whiteIdx).toBeGreaterThanOrEqual(0);
    expect(outlineIdx).toBeGreaterThanOrEqual(0);
    expect(innerIdx).toBeGreaterThanOrEqual(0);
    expect(blackIdx).toBeLessThan(whiteIdx);
    expect(whiteIdx).toBeLessThan(outlineIdx);
    expect(outlineIdx).toBeLessThan(innerIdx);
  });

  it("the marker className is exactly the R6 string and contains no dark: variant", () => {
    const points = [makePoint(0, 0.5), makePoint(1, 0.75)];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const marker = container.querySelector(
      '[data-testid="evaluation-graph-marker"]'
    );
    if (!marker) throw new Error("marker not found");
    const className = marker.getAttribute("class") ?? "";
    expect(className).toBe(
      "absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-50 bg-zinc-900"
    );
    expect(className).not.toContain("dark:");
  });

  it("the midline and cursor both use stroke-zinc-500 and carry no opacity attribute", () => {
    const points = [makePoint(0, 0.5), makePoint(1, 0.75)];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const midline = container.querySelector(
      '[data-testid="evaluation-graph-midline"]'
    );
    const cursor = container.querySelector(
      '[data-testid="evaluation-graph-cursor"]'
    );
    if (!midline) throw new Error("midline not found");
    if (!cursor) throw new Error("cursor not found");
    expect(midline.getAttribute("class")).toBe("stroke-zinc-500");
    expect(cursor.getAttribute("class")).toBe("stroke-zinc-500");
    expect(midline.getAttribute("opacity")).toBeNull();
    expect(cursor.getAttribute("opacity")).toBeNull();
  });

  it("the tooltip label uses bg-zinc-900 and text-zinc-50 and contains no dark: variant", () => {
    const points = [
      makePoint(0, 0.5, { san: "e4" }),
      makePoint(1, 0.75, { san: "e5" }),
    ];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const label = container.querySelector(
      '[data-testid="evaluation-graph-label"]'
    );
    if (!label) throw new Error("label not found");
    const className = label.getAttribute("class") ?? "";
    expect(className).toContain("bg-zinc-900");
    expect(className).toContain("text-zinc-50");
    expect(className).not.toContain("dark:");
  });
});

describe("Chess.com-style dark field (task B8)", () => {
  it("the svg className is exactly \"h-40 w-full rounded border border-zinc-500 bg-zinc-700\"", () => {
    const points = [makePoint(0, 0.5), makePoint(1, 0.75)];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const svg = container.querySelector("svg");
    if (!svg) throw new Error("svg element not found");
    expect(svg.getAttribute("class")).toBe(
      "h-40 w-full rounded border border-zinc-500 bg-zinc-700"
    );
  });

  it("no element inside the svg carries a class containing \"dark:\"", () => {
    const points = [makePoint(0, 0.5), makePoint(1, 0.75)];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const svg = container.querySelector("svg");
    if (!svg) throw new Error("svg element not found");
    const allSvgElements = [svg, ...Array.from(svg.querySelectorAll("*"))];
    for (const el of allSvgElements) {
      const cls = el.getAttribute("class") ?? "";
      expect(cls).not.toContain("dark:");
    }
  });

  it("the black region className is exactly \"fill-zinc-700\" and the white region className is exactly \"fill-zinc-50\"", () => {
    const points = [makePoint(0, 0.5), makePoint(1, 0.75)];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const black = container.querySelector(
      '[data-testid="evaluation-graph-black-region"]'
    );
    const white = container.querySelector(
      '[data-testid="evaluation-graph-white-region"]'
    );
    if (!black) throw new Error("black region not found");
    if (!white) throw new Error("white region not found");
    expect(black.getAttribute("class")).toBe("fill-zinc-700");
    expect(white.getAttribute("class")).toBe("fill-zinc-50");
  });

  it("the midline renders after both region polygons and both polylines in svg DOM order", () => {
    const points = [makePoint(0, 0.5), makePoint(1, 0.75)];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const svg = container.querySelector("svg");
    if (!svg) throw new Error("svg element not found");
    const children = Array.from(svg.children);
    const blackIdx = children.findIndex(
      (el) => el.getAttribute("data-testid") === "evaluation-graph-black-region"
    );
    const whiteIdx = children.findIndex(
      (el) => el.getAttribute("data-testid") === "evaluation-graph-white-region"
    );
    const outlineIdx = children.findIndex(
      (el) => el.getAttribute("data-testid") === "evaluation-graph-segment-outline"
    );
    const innerIdx = children.findIndex(
      (el) => el.getAttribute("data-testid") === "evaluation-graph-segment"
    );
    const midlineIdx = children.findIndex(
      (el) => el.getAttribute("data-testid") === "evaluation-graph-midline"
    );
    expect(blackIdx).toBeGreaterThanOrEqual(0);
    expect(whiteIdx).toBeGreaterThanOrEqual(0);
    expect(outlineIdx).toBeGreaterThanOrEqual(0);
    expect(innerIdx).toBeGreaterThanOrEqual(0);
    expect(midlineIdx).toBeGreaterThanOrEqual(0);
    expect(midlineIdx).toBeGreaterThan(blackIdx);
    expect(midlineIdx).toBeGreaterThan(whiteIdx);
    expect(midlineIdx).toBeGreaterThan(outlineIdx);
    expect(midlineIdx).toBeGreaterThan(innerIdx);
  });

  it("the midline renders before the cursor line in svg DOM order", () => {
    const points = [makePoint(0, 0.5), makePoint(1, 0.75)];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const svg = container.querySelector("svg");
    if (!svg) throw new Error("svg element not found");
    const children = Array.from(svg.children);
    const midlineIdx = children.findIndex(
      (el) => el.getAttribute("data-testid") === "evaluation-graph-midline"
    );
    const cursorIdx = children.findIndex(
      (el) => el.getAttribute("data-testid") === "evaluation-graph-cursor"
    );
    expect(midlineIdx).toBeGreaterThanOrEqual(0);
    expect(cursorIdx).toBeGreaterThanOrEqual(0);
    expect(midlineIdx).toBeLessThan(cursorIdx);
  });

  it("the midline retains x1 0, y1 20, x2 100, y2 20, strokeWidth 0.5, and className stroke-zinc-500", () => {
    const points = [makePoint(0, 0.5), makePoint(1, 0.75)];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const midline = container.querySelector(
      '[data-testid="evaluation-graph-midline"]'
    );
    if (!midline) throw new Error("midline not found");
    expect(midline.getAttribute("x1")).toBe("0");
    expect(midline.getAttribute("y1")).toBe("20");
    expect(midline.getAttribute("x2")).toBe("100");
    expect(midline.getAttribute("y2")).toBe("20");
    expect(midline.getAttribute("stroke-width")).toBe("0.5");
    expect(midline.getAttribute("class")).toBe("stroke-zinc-500");
  });

  it("the graph geometry constants are unchanged by the palette work", () => {
    expect(GRAPH_X_INSET).toBe(1);
    expect(GRAPH_Y_INSET).toBe(1.5);
    const points = [makePoint(0, 1), makePoint(1, 0)];
    const { container } = render(
      <EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />
    );
    const inner = container.querySelector(
      '[data-testid="evaluation-graph-segment"]'
    );
    if (!inner) throw new Error("inner polyline not found");
    expect(inner.getAttribute("points")).toBe("1.0,1.5 99.0,38.5");
  });
});
