import type { GraphPoint } from "./evaluation-graph-model";

export type EvaluationBarProps = {
  readonly point: GraphPoint | null;
  readonly orientation: "white" | "black";
};

export function EvaluationBar({
  point,
  orientation,
}: EvaluationBarProps): React.ReactElement {
  const { label, fillPercentage } = (() => {
    if (!point || !point.hasValue) {
      return { label: "Evaluation unavailable", fillPercentage: 50 };
    }

    const clampedCp = point.clampedCp;
    if (clampedCp === null) {
      return { label: "Evaluation unavailable", fillPercentage: 50 };
    }

    const advantage = point.advantage;
    if (advantage === null) {
      return { label: "Evaluation unavailable", fillPercentage: 50 };
    }

    if (point.isMate) {
      const mateFor = clampedCp > 0 ? "White" : "Black";
      return {
        label: `Evaluation: forced mate for ${mateFor}`,
        fillPercentage: parseFloat((advantage * 100).toFixed(1)),
      };
    }

    if (clampedCp === 0) {
      return { label: "Evaluation: equal", fillPercentage: 50 };
    }

    const ahead = clampedCp > 0 ? "White" : "Black";
    const pawns = (Math.abs(clampedCp) / 100).toFixed(1);
    return {
      label: `Evaluation: ${ahead} ahead by ${pawns} pawns`,
      fillPercentage: parseFloat((advantage * 100).toFixed(1)),
    };
  })();

  const fillStyle: React.CSSProperties =
    orientation === "white"
      ? { height: `${fillPercentage}%`, bottom: "0" }
      : { height: `${fillPercentage}%`, top: "0" };

  return (
    <div
      data-testid="evaluation-bar"
      role="img"
      aria-label={label}
      className="relative h-64 w-4 overflow-hidden rounded border border-black/[.15] dark:border-white/[.2] bg-black dark:bg-zinc-900"
    >
      <div
        data-testid="evaluation-bar-fill"
        className="absolute inset-x-0 bg-white dark:bg-zinc-100"
        style={fillStyle}
      />
    </div>
  );
}
