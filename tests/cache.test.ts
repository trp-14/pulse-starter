import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createMemoryCache } from '@/lib/redis/memory';
import type { Cache } from '@/lib/redis';

const cacheHolder: { current: Cache } = { current: createMemoryCache() };

vi.mock('@/lib/redis', () => ({ getCache: () => cacheHolder.current }));

const { readThrough } = await import('@/lib/services/cache');
const { nextPollDelay } = await import('@/hooks/usePolling');
const { ApiRequestError } = await import('@/lib/client/fetch-json');

const schema = z.object({ value: z.number() });
const context = { requestId: 'test-request' };

describe('memory cache', () => {
  it('expires entries after their TTL', async () => {
    let now = 0;
    const cache = createMemoryCache(() => now);
    await cache.set('k', { value: 1 }, 10);
    now = 9_999;
    expect(await cache.get('k', schema)).toEqual({ value: 1 });
    now = 10_000;
    expect(await cache.get('k', schema)).toBeNull();
  });

  it('treats values that no longer match the schema as a miss', async () => {
    const cache = createMemoryCache();
    await cache.set('k', { value: 'not a number' }, 10);
    expect(await cache.get('k', schema)).toBeNull();
  });
});

describe('readThrough', () => {
  beforeEach(() => {
    cacheHolder.current = createMemoryCache();
  });

  it('loads once, then serves from cache until invalidated', async () => {
    const load = vi.fn(async () => ({ value: 42 }));
    expect(await readThrough('kpis', 10, schema, load, context)).toEqual({ value: 42 });
    expect(await readThrough('kpis', 10, schema, load, context)).toEqual({ value: 42 });
    expect(load).toHaveBeenCalledTimes(1);

    await cacheHolder.current.del('kpis');
    await readThrough('kpis', 10, schema, load, context);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('falls back to the loader when the cache is down', async () => {
    // The fallback logs a warning by design; keep it out of the test output.
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const failure = async () => {
      throw new Error('redis down');
    };
    cacheHolder.current = { get: failure, set: failure, del: failure };
    const load = vi.fn(async () => ({ value: 7 }));
    expect(await readThrough('kpis', 10, schema, load, context)).toEqual({ value: 7 });
    expect(load).toHaveBeenCalledTimes(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('"message":"Cache read failed"'));
    stderr.mockRestore();
  });
});

describe('nextPollDelay', () => {
  it('uses the interval normally and Retry-After when rate limited', () => {
    expect(nextPollDelay(null, 5_000)).toBe(5_000);
    expect(nextPollDelay(new ApiRequestError(429, 'slow down', 'id', 30), 5_000)).toBe(30_000);
    expect(nextPollDelay(new ApiRequestError(500, 'oops', 'id', null), 5_000)).toBe(5_000);
  });
});
