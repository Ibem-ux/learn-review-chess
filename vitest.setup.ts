import { afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/dom";

configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  vi.useRealTimers();
});
