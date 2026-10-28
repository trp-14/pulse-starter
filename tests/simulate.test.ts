import { describe, expect, it } from 'vitest';
import * as simulateRoute from '@/app/api/simulate/route';
import * as kpisRoute from '@/app/api/kpis/route';
import { apiErrorSchema, kpisSchema, simulateResultSchema } from '@/lib/validation';

const URL_ = 'http://localhost:3000/api/simulate';
const SAME_ORIGIN = 'http://localhost:3000';

function post(init: { headers?: Record<string, string>; body?: string } = {}) {
  return new Request(URL_, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: SAME_ORIGIN, ...init.headers },
    body: init.body ?? '{}',
  });
}

async function errorCode(response: Response): Promise<string> {
  return apiErrorSchema.parse(await response.json()).error.code;
}

describe('POST /api/simulate', () => {
  it('creates 10–20 orders, returns 201 and invalidates the KPI cache', async () => {
    const before = kpisSchema.parse(await (await kpisRoute.GET(new Request(`${SAME_ORIGIN}/api/kpis`))).json());
    const response = await simulateRoute.POST(post());
    expect(response.status).toBe(201);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const result = simulateResultSchema.parse(await response.json());
    expect(result.created).toBeGreaterThanOrEqual(10);
    expect(result.created).toBeLessThanOrEqual(20);

    const after = kpisSchema.parse(await (await kpisRoute.GET(new Request(`${SAME_ORIGIN}/api/kpis`))).json());
    const createdNonCancelled = result.orders.filter((order) => order.status !== 'cancelled').length;
    expect(after.ordersToday).toBe(before.ordersToday + createdNonCancelled);
  });

  it('honours an explicit count within the cap', async () => {
    const result = simulateResultSchema.parse(await (await simulateRoute.POST(post({ body: '{"count":12}' }))).json());
    expect(result.created).toBe(12);
  });

  it.each([
    ['a foreign Origin', { Origin: 'https://evil.example' }],
    ['Origin "null"', { Origin: 'null' }],
    ['a cross-site fetch', { 'Sec-Fetch-Site': 'cross-site' }],
  ])('rejects %s with 403', async (_label, headers) => {
    const response = await simulateRoute.POST(post({ headers }));
    expect(response.status).toBe(403);
    expect(await errorCode(response)).toBe('forbidden');
  });

  it('rejects requests with neither Origin nor Referer', async () => {
    const request = new Request(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect((await simulateRoute.POST(request)).status).toBe(403);
  });

  it('accepts a same-origin Referer when Origin is absent', async () => {
    const request = new Request(URL_, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Referer: `${SAME_ORIGIN}/` },
      body: '{}',
    });
    expect((await simulateRoute.POST(request)).status).toBe(201);
  });

  it.each(['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x'])(
    'rejects Content-Type %s with 415',
    async (contentType) => {
      expect((await simulateRoute.POST(post({ headers: { 'Content-Type': contentType } }))).status).toBe(415);
    },
  );

  it('rejects oversized bodies with 413', async () => {
    const response = await simulateRoute.POST(post({ body: JSON.stringify({ pad: 'x'.repeat(5_000) }) }));
    expect(response.status).toBe(413);
  });

  it.each([
    ['unknown keys', '{"count":12,"admin":true}'],
    ['count over the cap', '{"count":500}'],
    ['count under the minimum', '{"count":1}'],
    ['malformed JSON', '{"count":'],
    ['a non-object body', '[1,2,3]'],
  ])('rejects %s with 400', async (_label, body) => {
    expect((await simulateRoute.POST(post({ body }))).status).toBe(400);
  });

  it('only allows POST', async () => {
    const response = await simulateRoute.GET();
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('POST');
  });
});
