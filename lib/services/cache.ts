import 'server-only';
import type { z } from 'zod';
import { logger } from '@/lib/logger';
import { getCache } from '@/lib/redis';

export interface ServiceContext {
  requestId: string;
}

export const CACHE_KEYS = {
  kpis: 'pulse:v1:kpis',
  heatmap: 'pulse:v1:heatmap',
} as const;

/**
 * Read-through cache. A cache outage never fails the request: it is logged and the
 * value is loaded from the database instead.
 */
export async function readThrough<T>(
  key: string,
  ttlSeconds: number,
  schema: z.ZodType<T>,
  load: () => Promise<T>,
  context: ServiceContext,
): Promise<T> {
  const cache = getCache();
  try {
    const hit = await cache.get(key, schema);
    if (hit !== null) return hit;
  } catch (error) {
    logger.warn('Cache read failed', context.requestId, { key, error });
  }

  const value = await load();
  try {
    await cache.set(key, value, ttlSeconds);
  } catch (error) {
    logger.warn('Cache write failed', context.requestId, { key, error });
  }
  return value;
}

export async function invalidate(keys: string[], context: ServiceContext): Promise<void> {
  try {
    await getCache().del(...keys);
  } catch (error) {
    // Worst case the stale value lives until its short TTL expires.
    logger.warn('Cache invalidation failed', context.requestId, { keys, error });
  }
}
