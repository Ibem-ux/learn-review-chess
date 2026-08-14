import type { GraphPoint } from "./evaluation-graph-model";
import { Fragment, type ReactElement } from "react";

export type EvaluationGraphProps = {
  readonly points: readonly GraphPoint[];
  readonly currentPly: number;
  readonly onSelectPly: (ply: number) => void;
};

// Insets keep the 1.5-unit line stroke and the 10px marker dots inside the 672x160 box.
// Vertical inset is driven by the marker, not the stroke: a marker half-height is 5px, and one
// coordinate unit is 4px vertically, so 1.5 units (6px) contains it while 1.0 units (4px) does not.
export const GRAPH_X_INSET = 1;
export const GRAPH_Y_INSET = 1.5;

// Graph container is max-w-2xl (672px); markers are w-2.5 (10px); markers avoid contact when 672/(N-1) >= 14px, i.e. N <= 49; 48 is used.
export const MARKER_DENSITY_LIMIT = 48;

export function EvaluationGraph({
  points,
  currentPly,
  onSelectPly,
}: EvaluationGraphProps): ReactElement {
  if (points.length === 0) {
    return (
      <div data-testid="evaluation-graph-empty" className="text-sm text-black dark:text-zinc-50">
        No analysis yet.
      </div>
    );
  }

  const segments: { x: number; y: number; ply: number }[][] = [];
  let currentSegment: { x: number; y: number; ply: number }[] = [];
  const markers: { x: number; y: number; ply: number; san: string | null }[] = [];

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (!point.hasValue || point.advantage === null) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
      }
      currentSegment = [];
      continue;
    }

    const x =
      points.length === 1
        ? 50
        : GRAPH_X_INSET + (i / (points.length - 1)) * (100 - 2 * GRAPH_X_INSET);
    const y = GRAPH_Y_INSET + (1 - point.advantage) * (40 - 2 * GRAPH_Y_INSET);
    currentSegment.push({ x, y, ply: point.ply });
    if (
      points.length <= MARKER_DENSITY_LIMIT ||
      point.ply === currentPly
    ) {
      markers.push({ x, y, ply: point.ply, san: point.san });
    }
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  const cursorPoint = points.find((p) => p.ply === currentPly);
  const cursorIndex = cursorPoint ? points.findIndex((p) => p.ply === currentPly) : -1;
  const cursorX = cursorIndex >= 0
    ? points.length === 1
      ? 50
      : GRAPH_X_INSET + (cursorIndex / (points.length - 1)) * (100 - 2 * GRAPH_X_INSET)
    : null;

  const polylinePoints = (segment: { x: number; y: number }[]) =>
    segment.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <div data-testid="evaluation-graph" className="relative w-full text-black dark:text-zinc-100">
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        role="img"
        aria-label="Evaluation graph"
        className="h-40 w-full rounded border border-zinc-500 bg-zinc-700"
      >
        {segments.map((segment, idx) => {
          if (segment.length >= 2) {
            const firstX = segment[0].x.toFixed(1);
            const lastX = segment[segment.length - 1].x.toFixed(1);
            const segmentPoints = polylinePoints(segment);
            // The graph paints its own dark zinc-700 field and Black's region matches it, so White's
            // share reads as a near-white area against charcoal (Chess.com treatment). Contrast at the
            // dark end cannot reach 3:1 between surface and a near-black region, so the two-tone
            // outlined line carries the boundary. Unanalysed gaps therefore read as Black-favoured.
            return (
              <Fragment key={`segment-group-${idx}`}>
                <polygon
                  key={`black-region-${idx}`}
                  data-testid="evaluation-graph-black-region"
                  points={`${segmentPoints} ${lastX},0.0 ${firstX},0.0`}
                  className="fill-zinc-700"
                />
                <polygon
                  key={`white-region-${idx}`}
                  data-testid="evaluation-graph-white-region"
                  points={`${segmentPoints} ${lastX},40.0 ${firstX},40.0`}
                  className="fill-zinc-50"
                />
                <polyline
                  key={`segment-outline-${idx}`}
                  data-testid="evaluation-graph-segment-outline"
                  points={segmentPoints}
                  fill="none"
                  strokeWidth="2.5"
                  className="stroke-zinc-50"
                />
                <polyline
                  key={`segment-${idx}`}
                  data-testid="evaluation-graph-segment"
                  points={segmentPoints}
                  fill="none"
                  strokeWidth="1.5"
                  className="stroke-zinc-900"
                />
              </Fragment>
            );
          }
          return null;
        })}

        <line
          data-testid="evaluation-graph-midline"
          x1="0"
          y1="20"
          x2="100"
          y2="20"
          strokeWidth="0.5"
          className="stroke-zinc-500"
        />

        {cursorX !== null && (
          <line
            data-testid="evaluation-graph-cursor"
            x1={cursorX.toFixed(1)}
            y1="0"
            x2={cursorX.toFixed(1)}
            y2="40"
            strokeWidth="0.5"
            className="stroke-zinc-500"
          />
        )}
      </svg>

      <div className="pointer-events-none absolute inset-0">
        {markers.map((marker) => (
          <span
            key={`marker-${marker.ply}`}
            data-testid="evaluation-graph-marker"
            data-ply={marker.ply}
            style={{
              left: `${marker.x}%`,
              top: `${(marker.y / 40) * 100}%`,
            }}
            title={marker.san ?? undefined}
            className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-50 bg-zinc-900"
          />
        ))}
      </div>

      <div className="absolute inset-0 flex">
        {points.map((point) => (
          <button
            key={point.ply}
            type="button"
            data-ply={point.ply}
            aria-label={`Go to ply ${point.ply}${point.san ? `, ${point.san}` : ""}`}
            aria-current={point.ply === currentPly ? "true" : undefined}
            className="flex-1 h-full group relative"
            onClick={() => onSelectPly(point.ply)}
          >
            {point.san !== null && (
              <span
                data-testid="evaluation-graph-label"
                className="pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-900 px-1.5 py-0.5 text-xs font-medium text-zinc-50 opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100"
              >
                {point.san}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
