import { describe, expect, it } from "vitest";
import { resolveClientKey } from "./client-key";

describe("resolveClientKey", () => {
  it("uses the only value when a single address is present", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.195" });
    expect(resolveClientKey(headers)).toBe("203.0.113.195");
  });

  it("uses the rightmost value, ignoring a client-supplied leftmost value", () => {
    const headers = new Headers({ "x-forwarded-for": "10.0.0.1, 203.0.113.195" });
    expect(resolveClientKey(headers)).toBe("203.0.113.195");
  });

  it("trims surrounding whitespace from the selected value", () => {
    const headers = new Headers({ "x-forwarded-for": "  203.0.113.195  " });
    expect(resolveClientKey(headers)).toBe("203.0.113.195");
  });

  it("ignores trailing empty entries and uses the last non-empty value", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.195, , " });
    expect(resolveClientKey(headers)).toBe("203.0.113.195");
  });

  it("returns unknown when the header is absent", () => {
    const headers = new Headers();
    expect(resolveClientKey(headers)).toBe("unknown");
  });

  it("returns unknown when the header is present but empty", () => {
    const headers = new Headers({ "x-forwarded-for": "" });
    expect(resolveClientKey(headers)).toBe("unknown");
  });

  it("returns unknown when the header contains only commas and whitespace", () => {
    const headers = new Headers({ "x-forwarded-for": " , , " });
    expect(resolveClientKey(headers)).toBe("unknown");
  });
});
