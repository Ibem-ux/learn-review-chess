import type { GraphPoint } from "./evaluation-graph-model";
import type { ReactElement } from "react";

export type EvaluationGraphProps = {
  readonly points: readonly GraphPoint[];
  readonly currentPly: number;
  readonly onSelectPly: (ply: number) => void;
};

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

  const width = 100;
  const height = 40;

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

    const x = points.length === 1 ? 0 : (i / (points.length - 1)) * width;
    const y = (1 - point.advantage) * height;
    currentSegment.push({ x, y, ply: point.ply });
    markers.push({ x, y, ply: point.ply, san: point.san });
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  const cursorPoint = points.find((p) => p.ply === currentPly);
  const cursorIndex = cursorPoint ? points.findIndex((p) => p.ply === currentPly) : -1;
  const cursorX = cursorIndex >= 0
    ? points.length === 1
      ? 0
      : (cursorIndex / (points.length - 1)) * width
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
        className="h-40 w-full"
      >
        <line
          data-testid="evaluation-graph-midline"
          x1="0"
          y1="20"
          x2="100"
          y2="20"
          stroke="currentColor"
          strokeWidth="0.5"
          opacity="0.3"
        />

        {segments.map((segment, idx) => {
          if (segment.length >= 2) {
            return (
              <polyline
                key={`segment-${idx}`}
                data-testid="evaluation-graph-segment"
                points={polylinePoints(segment)}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            );
          }
          return null;
        })}

        {markers.map((marker) => (
          <circle
            key={`marker-${marker.ply}`}
            data-testid="evaluation-graph-marker"
            data-ply={marker.ply}
            cx={marker.x.toFixed(1)}
            cy={marker.y.toFixed(1)}
            r="1.6"
            fill="currentColor"
            className="stroke-white dark:stroke-zinc-900"
            strokeWidth="0.5"
          >
            {marker.san !== null && <title>{marker.san}</title>}
          </circle>
        ))}

        {cursorX !== null && (
          <line
            data-testid="evaluation-graph-cursor"
            x1={cursorX.toFixed(1)}
            y1="0"
            x2={cursorX.toFixed(1)}
            y2="40"
            stroke="currentColor"
            strokeWidth="0.5"
            opacity="0.6"
          />
        )}
      </svg>

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
                className="pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 whitespace-nowrap rounded bg-black px-1.5 py-0.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100 dark:bg-zinc-100 dark:text-black"
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
