import { describe, expect, it } from 'vitest';
import * as kpisRoute from '@/app/api/kpis/route';
import * as ordersRoute from '@/app/api/orders/route';
import { apiErrorSchema, kpisSchema, ordersPageSchema } from '@/lib/validation';

const BASE = 'http://localhost:3000';
const get = (path: string) => new Request(`${BASE}${path}`);

describe('GET /api/kpis', () => {
  it('returns typed KPIs with no-store and a request ID', async () => {
    const response = await kpisRoute.GET(get('/api/kpis'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(kpisSchema.safeParse(await response.json()).success).toBe(true);
  });

  it('rejects unexpected query parameters', async () => {
    const response = await kpisRoute.GET(get('/api/kpis?debug=1'));
    expect(response.status).toBe(400);
    const body = apiErrorSchema.parse(await response.json());
    expect(body.error.requestId).toBe(response.headers.get('X-Request-Id'));
  });
});

describe('GET /api/orders', () => {
  it('returns a filtered page', async () => {
    const response = await ordersRoute.GET(get('/api/orders?status=paid&pageSize=5'));
    expect(response.status).toBe(200);
    const page = ordersPageSchema.parse(await response.json());
    expect(page.pageSize).toBe(5);
    expect(page.items.every((order) => order.status === 'paid')).toBe(true);
  });

  it.each([
    '/api/orders?pageSize=101',
    '/api/orders?status=refunded',
    '/api/orders?sort=password',
    '/api/orders?status=paid&status=pending',
    '/api/orders?from=2026-01-01&to=2026-06-01',
  ])('returns a generic 400 for %s', async (path) => {
    const response = await ordersRoute.GET(get(path));
    expect(response.status).toBe(400);
    const body = apiErrorSchema.parse(await response.json());
    expect(body.error.message).toBe('The request parameters are invalid.');
  });
});

describe('method guards', () => {
  it.each([
    ['POST', kpisRoute.POST],
    ['PUT', kpisRoute.PUT],
    ['PATCH', ordersRoute.PATCH],
    ['DELETE', ordersRoute.DELETE],
    ['OPTIONS', ordersRoute.OPTIONS],
  ])('%s returns 405 with Allow: GET, HEAD', async (_method, handler) => {
    const response = await handler();
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET, HEAD');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
