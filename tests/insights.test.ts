import { describe, expect, it } from 'vitest';
import * as heatmapRoute from '@/app/api/orders/heatmap/route';
import * as recentRoute from '@/app/api/orders/recent/route';
import * as lowStockRoute from '@/app/api/products/low-stock/route';
import * as revenueRoute from '@/app/api/revenue/route';
import { buildRevenueGeometry, nearestPointIndex } from '@/components/chart/revenue-geometry';
import { busiestSlot, heatmapLayout, intensityScale } from '@/components/heatmap/heatmap-geometry';
import { formatHourRange, formatRelative } from '@/lib/format';
import { getRevenueSeries } from '@/lib/services/revenue';
import { HOUR_MS } from '@/lib/time';
import { heatmapSchema, lowStockSchema, recentOrdersSchema, revenueSeriesSchema } from '@/lib/validation';
import type { RevenueBucket } from '@/types';

const get = (path: string) => new Request(`http://localhost:3000${path}`);

describe('insight endpoints', () => {
  it('GET /api/revenue returns 24 contiguous hourly buckets', async () => {
    const response = await revenueRoute.GET(get('/api/revenue'));
    expect(response.status).toBe(200);
    const series = revenueSeriesSchema.parse(await response.json());
    expect(series.buckets).toHaveLength(24);
    series.buckets.slice(1).forEach((bucket, index) => {
      expect(Date.parse(bucket.hourStart) - Date.parse(series.buckets.at(index)?.hourStart ?? '')).toBe(HOUR_MS);
    });
    expect(series.total).toBeCloseTo(series.buckets.reduce((sum, bucket) => sum + bucket.revenue, 0), 2);
  });

  it('GET /api/orders/heatmap returns 7 days × 24 hours with the right max', async () => {
    const response = await heatmapRoute.GET(get('/api/orders/heatmap'));
    const heatmap = heatmapSchema.parse(await response.json());
    expect(heatmap.days).toHaveLength(7);
    expect(heatmap.max).toBe(Math.max(...heatmap.days.flatMap((day) => day.counts)));
    expect(heatmap.days.map((day) => day.date)).toEqual([...heatmap.days.map((day) => day.date)].sort());
  });

  it('GET /api/orders/recent returns the newest 10', async () => {
    const recent = recentOrdersSchema.parse(await (await recentRoute.GET(get('/api/orders/recent'))).json());
    expect(recent.orders).toHaveLength(10);
  });

  it('GET /api/products/low-stock only returns products at or under threshold', async () => {
    const low = lowStockSchema.parse(await (await lowStockRoute.GET(get('/api/products/low-stock'))).json());
    expect(low.products.length).toBeGreaterThan(0);
    expect(low.products.every((product) => product.stock <= product.lowStockThreshold)).toBe(true);
  });

  it.each([
    ['revenue', revenueRoute],
    ['heatmap', heatmapRoute],
    ['recent', recentRoute],
    ['low-stock', lowStockRoute],
  ])('%s rejects query params and non-GET methods', async (_name, route) => {
    expect((await route.GET(get('/api/x?foo=1'))).status).toBe(400);
    const response = await route.POST();
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET, HEAD');
  });

  it('fills empty hours with zero revenue', async () => {
    const far = new Date('2030-01-01T12:30:00Z');
    const series = await getRevenueSeries(far);
    expect(series.total).toBe(0);
    expect(series.buckets.at(-1)?.hourStart).toBe('2030-01-01T12:00:00.000Z');
  });
});

describe('revenue geometry', () => {
  const buckets: RevenueBucket[] = Array.from({ length: 24 }, (_, i) => ({
    hourStart: new Date(Date.UTC(2026, 9, 27, 9) + i * HOUR_MS).toISOString(),
    revenue: i * 10,
    orders: i,
  }));

  it('builds paths, ticks and one point per bucket', () => {
    const geometry = buildRevenueGeometry(buckets, 600);
    expect(geometry.points).toHaveLength(24);
    expect(geometry.linePath.startsWith('M')).toBe(true);
    expect(geometry.areaPath.endsWith('Z')).toBe(true);
    expect(geometry.yTicks[0]?.label).toBe('$0');
    expect(geometry.xTicks).toHaveLength(6);
  });

  it('snaps the crosshair to the nearest hour', () => {
    const { points } = buildRevenueGeometry(buckets, 600);
    const third = points[3];
    if (!third) throw new Error('missing point');
    expect(nearestPointIndex(points, third.x + 2)).toBe(3);
    expect(nearestPointIndex(points, -50)).toBe(0);
    expect(nearestPointIndex(points, 10_000)).toBe(23);
    expect(nearestPointIndex([], 10)).toBe(-1);
  });
});

describe('heatmap geometry', () => {
  it('fits 24 columns and clamps cell size', () => {
    expect(heatmapLayout(600, 7).cell).toBeGreaterThan(12);
    expect(heatmapLayout(200, 7).cell).toBe(12);
    expect(heatmapLayout(5_000, 7).cell).toBe(30);
  });

  it('maps counts to 0..1 intensity', () => {
    const intensity = intensityScale(20);
    expect(intensity(0)).toBe(0);
    expect(intensity(10)).toBe(0.5);
    expect(intensity(40)).toBe(1);
    expect(intensityScale(0)(0)).toBe(0);
  });

  it('finds the busiest slot', () => {
    const counts = Array.from({ length: 24 }, (_, hour) => (hour === 19 ? 18 : 1));
    const slot = busiestSlot({ days: [{ date: '2026-10-24', label: 'Sat', counts }], max: 18, generatedAt: '' });
    expect(slot).toEqual({ label: 'Sat', hour: 19, count: 18 });
  });
});

describe('format', () => {
  it('formats relative times', () => {
    const now = Date.parse('2026-10-28T10:00:00Z');
    expect(formatRelative('2026-10-28T09:59:48Z', now)).toBe('12s ago');
    expect(formatRelative('2026-10-28T09:55:00Z', now)).toBe('5m ago');
    expect(formatRelative('2026-10-28T07:00:00Z', now)).toBe('3h ago');
    expect(formatRelative('2026-10-26T10:00:00Z', now)).toBe('2d ago');
  });

  it('formats an hour range in the store time zone', () => {
    expect(formatHourRange('2026-10-28T12:00:00.000Z')).toBe('19:00–20:00');
  });
});
