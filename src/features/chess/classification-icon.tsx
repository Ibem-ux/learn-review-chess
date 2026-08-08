import type { MoveClassification } from "./move-classification";

const COLORS: Record<MoveClassification, string> = {
  brilliant: "#22d3ee",
  great: "#818cf8",
  best: "#22c55e",
  excellent: "#14b8a6",
  good: "#eab308",
  "missed-win": "#d946ef",
  inaccuracy: "#f97316",
  mistake: "#ef4444",
  blunder: "#991b1b",
  unclassified: "#64748b",
};

const LABELS: Record<MoveClassification, string> = {
  brilliant: "Brilliant move",
  great: "Great move",
  best: "Best move",
  excellent: "Excellent move",
  good: "Good move",
  "missed-win": "Missed Win",
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder",
  unclassified: "Unclassified",
};

function renderGlyph(
  classification: MoveClassification,
  color: string
): React.ReactElement {
  switch (classification) {
    case "brilliant":
      return (
        <>
          <circle cx="8" cy="8" r="7" fill={color} />
          <rect x="5.25" y="3.5" width="1.5" height="5" fill="white" />
          <circle cx="6" cy="10.5" r="0.8" fill="white" />
          <rect x="9.25" y="3.5" width="1.5" height="5" fill="white" />
          <circle cx="10" cy="10.5" r="0.8" fill="white" />
        </>
      );
    case "great":
      return (
        <>
          <circle cx="8" cy="8" r="7" fill={color} />
          <rect x="7.25" y="3.5" width="1.5" height="5" fill="white" />
          <circle cx="8" cy="10.5" r="0.8" fill="white" />
        </>
      );
    case "best":
      return (
        <>
          <circle cx="8" cy="8" r="7" fill={color} />
          <path d="M8 4 L12 10 H4 Z" fill="white" />
        </>
      );
    case "excellent":
      return (
        <>
          <circle cx="8" cy="8" r="7" fill={color} />
          <circle cx="8" cy="8" r="2.5" fill="white" />
        </>
      );
    case "good":
      return (
        <>
          <circle cx="8" cy="8" r="7" fill={color} />
          <rect x="4" y="7.5" width="8" height="1" fill="white" />
        </>
      );
    case "missed-win":
      return (
        <>
          <circle cx="8" cy="8" r="7" fill={color} />
          <path d="M8 12 L12 6 H4 Z" fill="white" />
        </>
      );
    case "inaccuracy":
      return (
        <>
          <rect x="1" y="1" width="14" height="14" rx="3" fill={color} />
          <rect x="7.25" y="3" width="1.5" height="10" fill="white" />
        </>
      );
    case "mistake":
      return (
        <>
          <rect x="1" y="1" width="14" height="14" rx="3" fill={color} />
          <path d="M4 4 L12 12" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case "blunder":
      return (
        <>
          <rect x="1" y="1" width="14" height="14" rx="3" fill={color} />
          <path d="M4 4 L12 12" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 4 L4 12" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case "unclassified":
      return (
        <circle
          cx="8"
          cy="8"
          r="7"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
        />
      );
    default:
      throw new Error(`Unsupported classification: ${classification}`);
  }
}

export type ClassificationIconProps = {
  readonly classification: MoveClassification;
  readonly size?: number;
  readonly className?: string;
};

export function ClassificationIcon({
  classification,
  size = 16,
  className,
}: ClassificationIconProps): React.ReactElement {
  const validSize = Number.isFinite(size) && size > 0 ? size : 16;
  const color = COLORS[classification];

  return (
    <svg
      width={validSize}
      height={validSize}
      viewBox="0 0 16 16"
      className={className}
      aria-hidden="true"
      focusable="false"
      data-classification={classification}
    >
      <title>{LABELS[classification]}</title>
      {renderGlyph(classification, color)}
    </svg>
  );
}
