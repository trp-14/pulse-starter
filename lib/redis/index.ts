import 'server-only';
import { env } from '@/lib/env';
import { createMemoryCache, createNoopRateLimiter } from './memory';
import { createUpstashCache, createUpstashClient, createUpstashRateLimiter } from './upstash';
import type { Cache, RateLimiters } from './types';

export type { Cache, RateLimiter, RateLimiters, RateLimitResult } from './types';

export const API_RATE_LIMIT_PER_MINUTE = 60;
export const SIMULATE_RATE_LIMIT_PER_MINUTE = 5;

interface RedisServices {
  cache: Cache;
  rateLimiters: RateLimiters;
}

let services: RedisServices | undefined;

function createServices(): RedisServices {
  if (env.redis.mode === 'mock') {
    return {
      cache: createMemoryCache(),
      rateLimiters: {
        api: createNoopRateLimiter(API_RATE_LIMIT_PER_MINUTE),
        simulate: createNoopRateLimiter(SIMULATE_RATE_LIMIT_PER_MINUTE),
      },
    };
  }
  const redis = createUpstashClient(env.redis.url, env.redis.token);
  return {
    cache: createUpstashCache(redis),
    rateLimiters: {
      api: createUpstashRateLimiter(redis, 'pulse:rl:api', API_RATE_LIMIT_PER_MINUTE, '1 m'),
      simulate: createUpstashRateLimiter(redis, 'pulse:rl:simulate', SIMULATE_RATE_LIMIT_PER_MINUTE, '1 m'),
    },
  };
}

function getServices(): RedisServices {
  services ??= createServices();
  return services;
}

/** Upstash when both UPSTASH_* vars are set, otherwise an in-memory Map cache. */
export const getCache = (): Cache => getServices().cache;

/** Upstash sliding-window limiters, or no-op limiters in mock mode. */
export const getRateLimiters = (): RateLimiters => getServices().rateLimiters;
