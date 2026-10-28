'use client';

import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import type { Heatmap } from '@/types';
import { useElementWidth } from '@/hooks/useElementWidth';
import { usePolling } from '@/hooks/usePolling';
import { formatHourIndex } from '@/lib/format';
import { zonedParts } from '@/lib/time';
import { heatmapSchema } from '@/lib/validation/responses';
import { InlineError } from '@/components/ui/InlineError';
import {
  busiestSlot,
  cellOffset,
  HEADER_HEIGHT,
  heatmapLayout,
  HOURS,
  intensityScale,
  LABEL_WIDTH,
} from './heatmap-geometry';

export const HEATMAP_POLL_MS = 60_000;
const FALLBACK_WIDTH = 520;
const HOUR_LABEL_EVERY = 3;
const LEGEND_STEPS = [0, 0.25, 0.5, 0.75, 1] as const;

interface Cell {
  day: number;
  hour: number;
}

const ordersLabel = (count: number): string => `${count} ${count === 1 ? 'order' : 'orders'}`;

function moveCell(key: string, cell: Cell, rows: number): Cell | null {
  if (key === 'ArrowLeft') return { ...cell, hour: Math.max(0, cell.hour - 1) };
  if (key === 'ArrowRight') return { ...cell, hour: Math.min(HOURS - 1, cell.hour + 1) };
  if (key === 'ArrowUp') return { ...cell, day: Math.max(0, cell.day - 1) };
  if (key === 'ArrowDown') return { ...cell, day: Math.min(rows - 1, cell.day + 1) };
  return null;
}

export function OrdersHeatmap({ initial }: { initial: Heatmap }) {
  const { data, error, refresh } = usePolling('/api/orders/heatmap', heatmapSchema, initial, HEATMAP_POLL_MS);
  const [containerRef, width] = useElementWidth<HTMLDivElement>(FALLBACK_WIDTH);
  const [active, setActive] = useState<Cell | null>(null);
  const titleId = useId();
  const rows = data.days.length;
  const layout = heatmapLayout(width, rows);
  const intensity = useMemo(() => intensityScale(data.max), [data.max]);
  const busiest = useMemo(() => busiestSlot(data), [data]);
  const now = zonedParts(new Date(data.generatedAt));

  const activeDay = active ? data.days[active.day] : undefined;
  const activeCount = active ? (activeDay?.counts[active.hour] ?? 0) : 0;
  let headline = 'No orders in the last 7 days';
  if (activeDay && active) headline = `${activeDay.label} ${formatHourIndex(active.hour)} · ${ordersLabel(activeCount)}`;
  else if (busiest) headline = `Busiest: ${busiest.label} ${formatHourIndex(busiest.hour)} · ${ordersLabel(busiest.count)}`;

  const isFuture = (date: string, hour: number) => date === now.dateKey && hour > now.hour;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = moveCell(event.key, active ?? { day: rows - 1, hour: now.hour }, rows);
    if (!next) return;
    event.preventDefault();
    setActive(next);
  };

  return (
    <section className="tile heatmap-tile" aria-labelledby={titleId}>
      <header className="tile-header">
        <h2 id={titleId} className="tile-title">
          Orders heatmap
        </h2>
        <p className="tile-meta tabular-nums" aria-live="polite">
          {headline}
        </p>
      </header>

      {error ? (
        <InlineError
          message="The heatmap couldn’t refresh."
          requestId={error.requestId}
          lastUpdated={data.generatedAt}
          onRetry={refresh}
        />
      ) : null}

      <div ref={containerRef} className="heatmap-sizer">
        <div
          className="heatmap-well"
          tabIndex={0}
          role="group"
          aria-label="Orders by day and hour. Use the arrow keys to read each cell."
          onKeyDown={onKeyDown}
          onFocus={() => setActive((current) => current ?? { day: rows - 1, hour: now.hour })}
          onBlur={() => setActive(null)}
        >
          <svg width={layout.width} height={layout.height} className="heatmap-svg" aria-hidden="true">
            {Array.from({ length: HOURS / HOUR_LABEL_EVERY }, (_, i) => i * HOUR_LABEL_EVERY).map((hour) => (
              <text
                key={hour}
                className="heatmap-axis tabular-nums"
                x={LABEL_WIDTH + cellOffset(hour, layout.cell)}
                y={HEADER_HEIGHT - 6}
              >
                {formatHourIndex(hour).slice(0, 2)}
              </text>
            ))}
            {data.days.map((day, dayIndex) => {
              const y = HEADER_HEIGHT + cellOffset(dayIndex, layout.cell);
              return (
                <g key={day.date}>
                  <text className="heatmap-axis" x={0} y={y + layout.cell / 2} dy="0.32em">
                    {day.label}
                  </text>
                  {day.counts.map((count, hour) => {
                    const isActive = active?.day === dayIndex && active.hour === hour;
                    const future = isFuture(day.date, hour);
                    let className = 'heat-cell';
                    if (future) className += ' is-future';
                    if (isActive) className += ' is-active';
                    return (
                      <g
                        key={hour}
                        className={className}
                        transform={`translate(${LABEL_WIDTH + cellOffset(hour, layout.cell)},${y})`}
                        onPointerEnter={() => setActive({ day: dayIndex, hour })}
                        onPointerLeave={() => setActive(null)}
                      >
                        <rect className="heat-cell-base" width={layout.cell} height={layout.cell} rx={4} />
                        <rect
                          className="heat-cell-fill"
                          width={layout.cell}
                          height={layout.cell}
                          rx={4}
                          fillOpacity={future ? 0 : intensity(count)}
                        />
                        <rect className="heat-cell-highlight" x={3} y={1} width={layout.cell - 6} height={1} rx={0.5} />
                        <rect className="heat-cell-ring" width={layout.cell} height={layout.cell} rx={4} />
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="heatmap-legend" aria-hidden="true">
        <span>Fewer</span>
        <svg width={LEGEND_STEPS.length * 16} height={12}>
          {LEGEND_STEPS.map((step, index) => (
            <g key={step} transform={`translate(${index * 16},0)`}>
              <rect className="heat-cell-base" width={12} height={12} rx={3} />
              <rect className="heat-cell-fill" width={12} height={12} rx={3} fillOpacity={step} />
            </g>
          ))}
        </svg>
        <span>More</span>
      </div>

      <table className="sr-only">
        <caption>Orders per hour for the last 7 days</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            {Array.from({ length: HOURS }, (_, hour) => (
              <th key={hour} scope="col">
                {formatHourIndex(hour)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.days.map((day) => (
            <tr key={day.date}>
              <th scope="row">
                {day.label} {day.date}
              </th>
              {day.counts.map((count, hour) => (
                <td key={hour}>{count}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
