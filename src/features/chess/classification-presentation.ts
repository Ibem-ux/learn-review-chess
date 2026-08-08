import type { MoveClassification } from "./move-classification";

export const CLASSIFICATION_COLORS: Record<MoveClassification, string> = {
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

export const CLASSIFICATION_LABELS: Record<MoveClassification, string> = {
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
