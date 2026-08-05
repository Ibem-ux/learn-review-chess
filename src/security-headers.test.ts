import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
} from "./security-headers";

describe("security-headers", () => {
  it("CSP contains default-src 'self'", () => {
    const csp = buildContentSecurityPolicy({ dev: false });
    expect(csp).toContain("default-src 'self'");
  });

  it("CSP script-src contains 'wasm-unsafe-eval'", () => {
    const csp = buildContentSecurityPolicy({ dev: false });
    expect(csp).toContain("'wasm-unsafe-eval'");
  });

  it("CSP contains worker-src 'self'", () => {
    const csp = buildContentSecurityPolicy({ dev: false });
    expect(csp).toContain("worker-src 'self'");
  });

  it("CSP contains frame-ancestors 'none'", () => {
    const csp = buildContentSecurityPolicy({ dev: false });
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("CSP contains both object-src 'none' and base-uri 'self'", () => {
    const csp = buildContentSecurityPolicy({ dev: false });
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it("dev true puts 'unsafe-eval' in script-src and dev false does not", () => {
    const devCsp = buildContentSecurityPolicy({ dev: true });
    const prodCsp = buildContentSecurityPolicy({ dev: false });
    expect(devCsp).toContain("'unsafe-eval'");
    expect(prodCsp.includes("'unsafe-eval'")).toBe(false);
  });

  it("buildSecurityHeaders contains the five non-CSP keys with exact expected values", () => {
    const headers = buildSecurityHeaders({ dev: false });
    const headerMap = new Map(headers.map((h) => [h.key, h.value]));
    expect(headerMap.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headerMap.get("X-Frame-Options")).toBe("DENY");
    expect(headerMap.get("Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains");
    expect(headerMap.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
  });

  it("no header key appears more than once in buildSecurityHeaders", () => {
    const headers = buildSecurityHeaders({ dev: false });
    const keys = headers.map((h) => h.key);
    const uniqueKeys = new Set(keys);
    expect(keys.length).toBe(uniqueKeys.size);
  });
});
