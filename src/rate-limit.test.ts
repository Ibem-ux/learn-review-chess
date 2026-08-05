import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("a fresh key allows the first request", () => {
    let clock = 1000;
    const limiter = createRateLimiter({ now: () => clock });
    const decision = limiter.check("user-1");
    expect(decision.allowed).toBe(true);
    expect(decision.retryAfterSeconds).toBe(0);
    clock += 0;
  });

  it("capacity consecutive requests are all allowed", () => {
    let clock = 1000;
    const limiter = createRateLimiter({ now: () => clock });
    for (let i = 0; i < 20; i++) {
      const decision = limiter.check("user-1");
      expect(decision.allowed).toBe(true);
    }
    clock += 0;
  });

  it("the request after capacity is rejected", () => {
    let clock = 1000;
    const limiter = createRateLimiter({ now: () => clock });
    for (let i = 0; i < 20; i++) {
      limiter.check("user-1");
    }
    const decision = limiter.check("user-1");
    expect(decision.allowed).toBe(false);
    clock += 0;
  });

  it("a rejected decision reports retryAfterSeconds of at least 1", () => {
    let clock = 1000;
    const limiter = createRateLimiter({ now: () => clock });
    for (let i = 0; i < 20; i++) {
      limiter.check("user-1");
    }
    const decision = limiter.check("user-1");
    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    clock += 0;
  });

  it("waiting long enough refills one token and the next request is allowed", () => {
    let clock = 1000;
    const limiter = createRateLimiter({ now: () => clock });
    for (let i = 0; i < 20; i++) {
      limiter.check("user-1");
    }
    const rejected = limiter.check("user-1");
    expect(rejected.allowed).toBe(false);

    clock += 2000;
    const refilled = limiter.check("user-1");
    expect(refilled.allowed).toBe(true);
    expect(refilled.retryAfterSeconds).toBe(0);
  });

  it("refill is clamped to capacity after a long idle period", () => {
    let clock = 1000;
    const limiter = createRateLimiter({ now: () => clock });
    for (let i = 0; i < 20; i++) {
      limiter.check("user-1");
    }
    clock += 1000000;
    for (let i = 0; i < 20; i++) {
      const decision = limiter.check("user-1");
      expect(decision.allowed).toBe(true);
    }
    const extra = limiter.check("user-1");
    expect(extra.allowed).toBe(false);
  });

  it("two different keys have independent buckets", () => {
    let clock = 1000;
    const limiter = createRateLimiter({ now: () => clock });
    for (let i = 0; i < 20; i++) {
      limiter.check("key-a");
    }
    expect(limiter.check("key-a").allowed).toBe(false);
    expect(limiter.check("key-b").allowed).toBe(true);
    clock += 0;
  });

  it("a custom capacity of 1 rejects the second immediate request", () => {
    let clock = 1000;
    const limiter = createRateLimiter({ capacity: 1, now: () => clock });
    const first = limiter.check("user-1");
    expect(first.allowed).toBe(true);
    const second = limiter.check("user-1");
    expect(second.allowed).toBe(false);
    clock += 0;
  });

  it("exceeding maxKeys evicts the oldest key, proven by that key regaining a full bucket while a newer key stays depleted", () => {
    let clock = 1000;
    const limiter = createRateLimiter({ capacity: 2, maxKeys: 2, now: () => clock });
    limiter.check("key-1");
    limiter.check("key-1");

    clock = 1100;
    limiter.check("key-2");
    limiter.check("key-2");

    clock = 1200;
    limiter.check("key-3");

    clock = 1300;
    const key2Check = limiter.check("key-2");
    expect(key2Check.allowed).toBe(false);

    const key1Check = limiter.check("key-1");
    expect(key1Check.allowed).toBe(true);
  });

  it("retryAfterSeconds shrinks as the clock advances toward a full token", () => {
    let clock = 1000;
    const limiter = createRateLimiter({ capacity: 1, refillPerSecond: 0.5, now: () => clock });
    limiter.check("user-1");
    const firstReject = limiter.check("user-1");
    expect(firstReject.allowed).toBe(false);
    expect(firstReject.retryAfterSeconds).toBe(2);

    clock += 1000;
    const secondReject = limiter.check("user-1");
    expect(secondReject.allowed).toBe(false);
    expect(secondReject.retryAfterSeconds).toBe(1);
  });
});
