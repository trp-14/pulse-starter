'use client';

import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { RevenueSeries } from '@/types';
import { useElementWidth } from '@/hooks/useElementWidth';
import { gsap, MOTION, useGSAP } from '@/hooks/useGsap';
import { usePolling } from '@/hooks/usePolling';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { formatCurrency, formatHourRange, formatInteger } from '@/lib/format';
import { revenueSeriesSchema } from '@/lib/validation/responses';
import { InlineError } from '@/components/ui/InlineError';
import { buildRevenueGeometry, CHART_HEIGHT, CHART_MARGIN, nearestPointIndex } from './revenue-geometry';

export const REVENUE_POLL_MS = 30_000;
const FALLBACK_WIDTH = 720;
const TOOLTIP_WIDTH = 176;

const svgId = (raw: string): string => raw.replace(/[^\w-]/g, '');

function nextIndex(key: string, current: number | null, count: number): number | null {
  const from = current ?? count - 1;
  if (key === 'ArrowLeft') return Math.max(0, from - 1);
  if (key === 'ArrowRight') return Math.min(count - 1, from + 1);
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

export function RevenueChart({ initial }: { initial: RevenueSeries }) {
  const { data, error, refresh } = usePolling('/api/revenue', revenueSeriesSchema, initial, REVENUE_POLL_MS);
  const [containerRef, width, measured] = useElementWidth<HTMLDivElement>(FALLBACK_WIDTH);
  const geometry = useMemo(() => buildRevenueGeometry(data.buckets, width), [data.buckets, width]);
  const [active, setActive] = useState<number | null>(null);
  const baseId = svgId(useId());
  const areaGradient = `${baseId}-area`;
  const sphereGradient = `${baseId}-sphere`;
  const revealClip = `${baseId}-reveal`;
  const point = active === null ? undefined : geometry.points.at(active);
  const reduced = useReducedMotion();
  const plotRef = useRef<SVGGElement>(null);
  const clipRectRef = useRef<SVGRectElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const drawn = useRef({ revealed: false, buckets: data.buckets, line: geometry.linePath, area: geometry.areaPath });

  // Load: the line "draws in" left to right through a clip whose scaleX is animated (transform only).
  // New data: the paths morph from the previous series (24 points each, same command structure).
  // A width change alone just redraws (React has already set the new `d`).
  useGSAP(
    () => {
      if (!measured || !plotRef.current || !clipRectRef.current) return;
      const previous = drawn.current;
      drawn.current = { revealed: true, buckets: data.buckets, line: geometry.linePath, area: geometry.areaPath };

      if (!previous.revealed) {
        if (reduced) gsap.fromTo(plotRef.current, { opacity: 0 }, { opacity: 1, duration: MOTION.fade });
        else
          gsap.fromTo(
            clipRectRef.current,
            { scaleX: 0 },
            { scaleX: 1, transformOrigin: '0% 50%', duration: 1.1, ease: 'power2.out', delay: 0.25 },
          );
        return;
      }
      if (previous.buckets === data.buckets) return;
      if (reduced) {
        gsap.fromTo(plotRef.current, { opacity: 0.4 }, { opacity: 1, duration: MOTION.fade });
        return;
      }
      gsap.fromTo(lineRef.current, { attr: { d: previous.line } }, { attr: { d: geometry.linePath }, duration: 0.8, ease: 'power2.inOut' });
      gsap.fromTo(areaRef.current, { attr: { d: previous.area } }, { attr: { d: geometry.areaPath }, duration: 0.8, ease: 'power2.inOut' });
    },
    { dependencies: [measured, data.buckets, geometry.linePath, geometry.areaPath, reduced] },
  );

  const onPointerMove = (event: PointerEvent<SVGRectElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setActive(nearestPointIndex(geometry.points, event.clientX - bounds.left));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = nextIndex(event.key, active, geometry.points.length);
    if (next === null) return;
    event.preventDefault();
    setActive(next);
  };

  const tooltipX = point
    ? Math.min(Math.max(point.x + CHART_MARGIN.left + 14, 0), Math.max(0, width - TOOLTIP_WIDTH))
    : 0;

  return (
    <section className="tile chart-tile" aria-labelledby={`${baseId}-title`} data-reveal>
      <header className="tile-header">
        <h2 id={`${baseId}-title`} className="tile-title">
          Revenue · last 24 hours
        </h2>
        <p className="tile-meta tabular-nums">{formatCurrency(data.total)}</p>
      </header>

      {error ? (
        <InlineError
          message="The chart couldn’t refresh."
          requestId={error.requestId}
          lastUpdated={data.generatedAt}
          onRetry={refresh}
        />
      ) : null}

      <div
        ref={containerRef}
        className="chart-well"
        tabIndex={0}
        role="group"
        aria-label="Hourly revenue chart. Use the left and right arrow keys to read each hour."
        onKeyDown={onKeyDown}
        onFocus={() => setActive((current) => current ?? geometry.points.length - 1)}
        onBlur={() => setActive(null)}
      >
        <svg width={width} height={CHART_HEIGHT} className={measured ? 'chart-svg' : 'chart-svg is-pending'} aria-hidden="true">
          <defs>
            <linearGradient id={areaGradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" className="chart-area-stop-top" />
              <stop offset="100%" className="chart-area-stop-bottom" />
            </linearGradient>
            <radialGradient id={sphereGradient} cx="32%" cy="28%" r="75%">
              <stop offset="0%" className="chart-sphere-stop-highlight" />
              <stop offset="45%" className="chart-sphere-stop-mid" />
              <stop offset="100%" className="chart-sphere-stop-edge" />
            </radialGradient>
          </defs>
          <g transform={`translate(${CHART_MARGIN.left},${CHART_MARGIN.top})`}>
            {geometry.yTicks.map((tick) => (
              <g key={tick.label}>
                <line className="chart-grid" x1={0} x2={geometry.innerWidth} y1={tick.y} y2={tick.y} />
                <text className="chart-axis tabular-nums" x={-10} y={tick.y} dy="0.32em" textAnchor="end">
                  {tick.label}
                </text>
              </g>
            ))}
            {geometry.xTicks.map((tick) => (
              <text
                key={tick.label}
                className="chart-axis tabular-nums"
                x={tick.x}
                y={geometry.innerHeight + 22}
                textAnchor="middle"
              >
                {tick.label}
              </text>
            ))}
            <clipPath id={revealClip}>
              <rect ref={clipRectRef} x={-4} y={-8} width={geometry.innerWidth + 8} height={geometry.innerHeight + 16} />
            </clipPath>
            <g ref={plotRef} clipPath={`url(#${revealClip})`}>
              <path ref={areaRef} className="chart-area" d={geometry.areaPath} fill={`url(#${areaGradient})`} />
              <path ref={lineRef} className="chart-line" d={geometry.linePath} />
            </g>
            {point ? (
              <g className="chart-hover">
                <line className="chart-crosshair" x1={point.x} x2={point.x} y1={0} y2={geometry.innerHeight} />
                <circle className="chart-dot" cx={point.x} cy={point.y} r={7} fill={`url(#${sphereGradient})`} />
              </g>
            ) : null}
            <rect
              className="chart-hit"
              width={geometry.innerWidth}
              height={geometry.innerHeight}
              fill="transparent"
              onPointerMove={onPointerMove}
              onPointerLeave={() => setActive(null)}
            />
          </g>
        </svg>

        {point ? (
          <div
            className="chart-tooltip glass"
            style={{ transform: `translate(${tooltipX}px, ${Math.max(point.y - 24, 0)}px)` }}
          >
            <p className="chart-tooltip-label tabular-nums">{formatHourRange(point.bucket.hourStart)}</p>
            <p className="chart-tooltip-value tabular-nums">{formatCurrency(point.bucket.revenue)}</p>
            <p className="chart-tooltip-meta tabular-nums">
              {formatInteger(point.bucket.orders)} {point.bucket.orders === 1 ? 'order' : 'orders'}
            </p>
          </div>
        ) : null}
      </div>

      <p className="sr-only" aria-live="polite">
        {point
          ? `${formatHourRange(point.bucket.hourStart)}: ${formatCurrency(point.bucket.revenue)}, ${point.bucket.orders} orders`
          : ''}
      </p>
      <div className="sr-only">
        <table>
        <caption>Revenue per hour, last 24 hours</caption>
        <thead>
          <tr>
            <th scope="col">Hour</th>
            <th scope="col">Revenue</th>
            <th scope="col">Orders</th>
          </tr>
        </thead>
        <tbody>
          {data.buckets.map((bucket) => (
            <tr key={bucket.hourStart}>
              <th scope="row">{formatHourRange(bucket.hourStart)}</th>
              <td>{formatCurrency(bucket.revenue)}</td>
              <td>{bucket.orders}</td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </section>
  );
}
