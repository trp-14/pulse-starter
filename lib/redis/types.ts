import 'server-only';
import type { z } from 'zod';

export interface Cache {
  /** Returns the cached value only if it still matches `schema`; anything else counts as a miss. */
  get<T>(key: string, schema: z.ZodType<T>): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(...keys: string[]): Promise<void>;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Epoch milliseconds when the window resets. */
  resetAt: number;
}

export interface RateLimiter {
  limit(identifier: string): Promise<RateLimitResult>;
}

export interface RateLimiters {
  /** General per-IP limit applied to every API route. */
  api: RateLimiter;
  /** Extra per-IP limit for POST /api/simulate. */
  simulate: RateLimiter;
}
