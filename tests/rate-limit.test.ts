import { describe, expect, it, vi } from 'vitest';
import { createMemoryRateLimiter } from '@/lib/redis/memory';
import type { RateLimiters } from '@/lib/redis';
import type * as RedisModule from '@/lib/redis';

// Mock mode uses no-op limiters (spec), so swap in real in-memory limiters to exercise 429s.
const limiters: RateLimiters = {
  api: createMemoryRateLimiter(60, 60_000),
  simulate: createMemoryRateLimiter(5, 60_000),
};

vi.mock('@/lib/redis', async (importOriginal) => ({
  ...(await importOriginal<typeof RedisModule>()),
  getRateLimiters: () => limiters,
}));

const simulateRoute = await import('@/app/api/simulate/route');
const ordersRoute = await import('@/app/api/orders/route');
const { apiErrorSchema } = await import('@/lib/validation');

const simulate = (ip: string) =>
  simulateRoute.POST(
    new Request('http://localhost:3000/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000', 'X-Real-IP': ip },
      body: '{}',
    }),
  );

describe('rate limiting', () => {
  it('allows 5 simulations per minute per IP, then returns 429 with Retry-After', async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await simulate('203.0.113.7')).status).toBe(201);
    }
    const limited = await simulate('203.0.113.7');
    expect(limited.status).toBe(429);
    const retryAfter = Number(limited.headers.get('Retry-After'));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
    const body = apiErrorSchema.parse(await limited.json());
    expect(body.error.code).toBe('rate_limited');
    expect(body.error.retryAfterSeconds).toBe(retryAfter);
    expect(body.error.message).toContain('5 rushes a minute');
  });

  it('tracks each IP separately', async () => {
    expect((await simulate('198.51.100.20')).status).toBe(201);
  });

  it('applies the general 60/min limit to every API route', async () => {
    const get = () => ordersRoute.GET(new Request('http://localhost:3000/api/orders', { headers: { 'X-Real-IP': '192.0.2.1' } }));
    for (let i = 0; i < 60; i += 1) {
      expect((await get()).status).toBe(200);
    }
    const limited = await get();
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).not.toBeNull();
  });
});
