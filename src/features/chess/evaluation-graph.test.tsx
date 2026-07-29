import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EvaluationGraph } from "@/features/chess/evaluation-graph";
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
    expect(segment?.getAttribute("points")).toBe("0.0,20.0 50.0,10.0 100.0,30.0");
  });

  it("advantage 1 maps to y 0 and advantage 0 maps to y 40", () => {
    const points = [
      makePoint(0, 1),
      makePoint(1, 0),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />);
    const segment = container.querySelector('[data-testid="evaluation-graph-segment"]');
    expect(segment?.getAttribute("points")).toBe("0.0,0.0 100.0,40.0");
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
    expect(marker?.getAttribute("cx")).toBe("0.0");
    expect(marker?.getAttribute("cy")).toBe("20.0");
    const cursor = container.querySelector('[data-testid="evaluation-graph-cursor"]');
    expect(cursor?.getAttribute("x1")).toBe("0.0");
    expect(cursor?.getAttribute("x2")).toBe("0.0");
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
    const buttons = container.querySelectorAll('[data-ply]');
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

  it("a marker for a point with san renders a title whose text content is exactly that san", () => {
    const points = [
      makePoint(0, 0.5, { san: "e4" }),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />);
    const marker = container.querySelector('[data-testid="evaluation-graph-marker"]');
    const title = marker?.querySelector("title");
    expect(title?.textContent).toBe("e4");
  });

  it("a marker for a point with san null renders no title element", () => {
    const points = [
      makePoint(0, 0.5, { san: null }),
    ];
    const { container } = render(<EvaluationGraph points={points} currentPly={0} onSelectPly={() => {}} />);
    const marker = container.querySelector('[data-testid="evaluation-graph-marker"]');
    expect(marker?.querySelector("title")).toBeNull();
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
});
