import 'server-only';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { Cache, RateLimiter } from './types';

/** Each Redis REST call is aborted after this long. */
export const REDIS_TIMEOUT_MS = 1_500;

export function createUpstashClient(url: string, token: string): Redis {
  return new Redis({
    url,
    token,
    retry: { retries: 1, backoff: () => 100 },
    signal: () => AbortSignal.timeout(REDIS_TIMEOUT_MS),
    enableTelemetry: false,
  });
}

export function createUpstashCache(redis: Redis): Cache {
  return {
    async get(key, schema) {
      const value: unknown = await redis.get(key);
      if (value === null) return null;
      const parsed = schema.safeParse(value);
      return parsed.success ? parsed.data : null;
    },
    async set(key, value, ttlSeconds) {
      await redis.set(key, value, { ex: ttlSeconds });
    },
    async del(...keys) {
      if (keys.length > 0) await redis.del(...keys);
    },
  };
}

export function createUpstashRateLimiter(redis: Redis, prefix: string, limit: number, window: '1 m'): RateLimiter {
  const ratelimit = new Ratelimit({
    redis,
    prefix,
    limiter: Ratelimit.slidingWindow(limit, window),
    analytics: false,
    // If Redis is slow the request is allowed through: availability over strictness for a demo.
    timeout: REDIS_TIMEOUT_MS,
  });
  return {
    async limit(identifier) {
      const result = await ratelimit.limit(identifier);
      return { success: result.success, limit: result.limit, remaining: result.remaining, resetAt: result.reset };
    },
  };
}
