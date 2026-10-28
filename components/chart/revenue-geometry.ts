// D3 does the math only (scales, paths, ticks, nearest point). React renders; GSAP animates.
import { bisector, max } from 'd3-array';
import { scaleLinear, scaleUtc } from 'd3-scale';
import { area, curveMonotoneX, line } from 'd3-shape';
import type { RevenueBucket } from '@/types';
import { formatCompactCurrency, formatHour } from '@/lib/format';
import { zonedParts } from '@/lib/time';

export const CHART_HEIGHT = 240;
export const CHART_MARGIN = { top: 16, right: 16, bottom: 30, left: 52 } as const;
const X_TICK_EVERY_HOURS = 4;
const Y_TICKS = 4;

export interface ChartPoint {
  x: number;
  y: number;
  bucket: RevenueBucket;
}

export interface RevenueGeometry {
  innerWidth: number;
  innerHeight: number;
  linePath: string;
  areaPath: string;
  points: ChartPoint[];
  yTicks: Array<{ y: number; label: string }>;
  xTicks: Array<{ x: number; label: string }>;
}

export function buildRevenueGeometry(buckets: readonly RevenueBucket[], width: number): RevenueGeometry {
  const innerWidth = Math.max(0, width - CHART_MARGIN.left - CHART_MARGIN.right);
  const innerHeight = CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;
  const first = buckets[0];
  const last = buckets.at(-1);
  if (!first || !last) {
    return { innerWidth, innerHeight, linePath: '', areaPath: '', points: [], yTicks: [], xTicks: [] };
  }

  const x = scaleUtc()
    .domain([new Date(first.hourStart), new Date(last.hourStart)])
    .range([0, innerWidth]);
  const peak = max(buckets, (bucket) => bucket.revenue) ?? 0;
  const y = scaleLinear()
    .domain([0, peak > 0 ? peak * 1.1 : 100])
    .nice(Y_TICKS)
    .range([innerHeight, 0]);

  const points = buckets.map((bucket) => ({ x: x(new Date(bucket.hourStart)), y: y(bucket.revenue), bucket }));
  const lineGenerator = line<ChartPoint>()
    .x((point) => point.x)
    .y((point) => point.y)
    .curve(curveMonotoneX);
  const areaGenerator = area<ChartPoint>()
    .x((point) => point.x)
    .y0(innerHeight)
    .y1((point) => point.y)
    .curve(curveMonotoneX);

  return {
    innerWidth,
    innerHeight,
    linePath: lineGenerator(points) ?? '',
    areaPath: areaGenerator(points) ?? '',
    points,
    yTicks: y.ticks(Y_TICKS).map((value) => ({ y: y(value), label: formatCompactCurrency(value) })),
    // Ticks on store-local hours divisible by 4, labelled in the store time zone (identical on server and client).
    xTicks: points
      .filter((point) => zonedParts(new Date(point.bucket.hourStart)).hour % X_TICK_EVERY_HOURS === 0)
      .map((point) => ({ x: point.x, label: formatHour(point.bucket.hourStart) })),
  };
}

const byX = bisector<ChartPoint, number>((point) => point.x);

/** Index of the point nearest to plot-space `px`: the crosshair snaps to an hour, readers never aim at a line. */
export function nearestPointIndex(points: readonly ChartPoint[], px: number): number {
  if (points.length === 0) return -1;
  return Math.min(points.length - 1, Math.max(0, byX.center(points, px)));
}
