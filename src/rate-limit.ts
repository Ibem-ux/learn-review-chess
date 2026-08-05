export const RATE_LIMIT_CAPACITY = 20;
export const RATE_LIMIT_REFILL_PER_SECOND = 0.5;
export const RATE_LIMIT_MAX_KEYS = 10000;

export type RateLimitDecision = {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
};

export type RateLimiter = { check: (key: string) => RateLimitDecision };

interface KeyState {
  tokens: number;
  lastRefill: number;
}

export function createRateLimiter(options: {
  readonly capacity?: number;
  readonly refillPerSecond?: number;
  readonly maxKeys?: number;
  readonly now: () => number;
}): RateLimiter {
  const capacity = options.capacity ?? RATE_LIMIT_CAPACITY;
  const refillPerSecond = options.refillPerSecond ?? RATE_LIMIT_REFILL_PER_SECOND;
  const maxKeys = options.maxKeys ?? RATE_LIMIT_MAX_KEYS;
  const now = options.now;

  const entries = new Map<string, KeyState>();

  return {
    check(key: string): RateLimitDecision {
      const currentTime = now();
      let entry = entries.get(key);

      if (!entry) {
        if (entries.size >= maxKeys) {
          let oldestKey: string | null = null;
          let oldestTime = Infinity;
          for (const [k, v] of entries) {
            if (v.lastRefill < oldestTime) {
              oldestTime = v.lastRefill;
              oldestKey = k;
            }
          }
          if (oldestKey !== null) {
            entries.delete(oldestKey);
          }
        }

        entry = {
          tokens: capacity,
          lastRefill: currentTime,
        };
        entries.set(key, entry);
      } else {
        const elapsedSeconds = (currentTime - entry.lastRefill) / 1000;
        entry.tokens = Math.min(capacity, entry.tokens + elapsedSeconds * refillPerSecond);
        entry.lastRefill = currentTime;
      }

      if (entry.tokens >= 1) {
        entry.tokens -= 1;
        return {
          allowed: true,
          retryAfterSeconds: 0,
        };
      }

      const needed = 1 - entry.tokens;
      const rawSeconds = Math.ceil(needed / refillPerSecond);
      const retryAfterSeconds = Math.max(1, rawSeconds);

      return {
        allowed: false,
        retryAfterSeconds,
      };
    },
  };
}
