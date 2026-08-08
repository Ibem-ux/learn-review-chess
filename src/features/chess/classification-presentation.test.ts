import { describe, it, expect } from "vitest";
import {
  CLASSIFICATION_LABELS,
  CLASSIFICATION_COLORS,
} from "./classification-presentation";
import { MOVE_CLASSIFICATION_ORDER } from "./move-classification";

describe("classification-presentation", () => {
  it("CLASSIFICATION_LABELS has a non-empty string for every member of MOVE_CLASSIFICATION_ORDER", () => {
    for (const classification of MOVE_CLASSIFICATION_ORDER) {
      const label = CLASSIFICATION_LABELS[classification];
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("CLASSIFICATION_COLORS has a non-empty string for every member of MOVE_CLASSIFICATION_ORDER", () => {
    for (const classification of MOVE_CLASSIFICATION_ORDER) {
      const color = CLASSIFICATION_COLORS[classification];
      expect(typeof color).toBe("string");
      expect(color.length).toBeGreaterThan(0);
    }
  });

  it("keys of each map, sorted, equal MOVE_CLASSIFICATION_ORDER sorted", () => {
    const sortedOrder = [...MOVE_CLASSIFICATION_ORDER].sort();
    const sortedLabelKeys = Object.keys(CLASSIFICATION_LABELS).sort();
    const sortedColorKeys = Object.keys(CLASSIFICATION_COLORS).sort();
    expect(sortedLabelKeys).toEqual(sortedOrder);
    expect(sortedColorKeys).toEqual(sortedOrder);
  });
});
