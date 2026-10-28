import 'server-only';
import type { Cache, RateLimiter } from './types';

/** Map-backed cache with TTL. Values round-trip through JSON, like Redis, so mock and real behave alike. */
export function createMemoryCache(now: () => number = Date.now): Cache {
  const entries = new Map<string, { json: string; expiresAt: number }>();
  return {
    async get(key, schema) {
      const entry = entries.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= now()) {
        entries.delete(key);
        return null;
      }
      const parsed = schema.safeParse(JSON.parse(entry.json));
      return parsed.success ? parsed.data : null;
    },
    async set(key, value, ttlSeconds) {
      entries.set(key, { json: JSON.stringify(value), expiresAt: now() + ttlSeconds * 1000 });
    },
    async del(...keys) {
      for (const key of keys) entries.delete(key);
    },
  };
}

/** Mock mode limiter: never limits (spec). */
export function createNoopRateLimiter(limit: number): RateLimiter {
  return {
    async limit() {
      return { success: true, limit, remaining: limit, resetAt: Date.now() };
    },
  };
}

/** Fixed-window in-memory limiter, used by tests to exercise the 429 path without Redis. */
export function createMemoryRateLimiter(limit: number, windowMs: number, now: () => number = Date.now): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return {
    async limit(identifier) {
      const current = now();
      let window = windows.get(identifier);
      if (!window || window.resetAt <= current) {
        window = { count: 0, resetAt: current + windowMs };
        windows.set(identifier, window);
      }
      window.count += 1;
      return {
        success: window.count <= limit,
        limit,
        remaining: Math.max(limit - window.count, 0),
        resetAt: window.resetAt,
      };
    },
  };
}
