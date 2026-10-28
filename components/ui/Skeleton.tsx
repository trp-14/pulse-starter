// Skeletons shaped like the real content. Used when a tile has no data yet (its server-side load
// failed and it is fetching on the client) and while charts measure their width.
import type { ReactNode } from 'react';

type PillWidth = 30 | 45 | 60 | 80;

/** A raised tile with its real title and a skeleton body, in the tile's own grid slot. */
export function TileSkeleton({
  title,
  className,
  errorSlot,
  children,
}: {
  title: string;
  className: string;
  errorSlot: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={`tile ${className}`} aria-busy="true" aria-label={`${title} (loading)`}>
      <header className="tile-header">
        <h2 className="tile-title">{title}</h2>
      </header>
      {errorSlot}
      {children}
    </section>
  );
}

export function Pill({ width = 60, tall = false }: { width?: PillWidth; tall?: boolean }) {
  return <span className={`skeleton-pill sk-w-${width}${tall ? ' sk-tall' : ''}`} aria-hidden="true" />;
}

/** Soft pill rows: live feed, low stock and the orders table. */
export function RowsSkeleton({ rows, label }: { rows: number; label: string }) {
  return (
    <div className="skeleton-rows" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton-row" aria-hidden="true">
          <span className="skeleton-dot" />
          <Pill width={index % 2 === 0 ? 45 : 60} />
          <Pill width={30} />
        </div>
      ))}
    </div>
  );
}

/** KPI glass card placeholder. */
export function KpiSkeleton({ hero = false }: { hero?: boolean }) {
  return (
    <div className={hero ? 'kpi kpi-hero glass skeleton-kpi' : 'kpi glass skeleton-kpi'} role="status" aria-label="Loading metric">
      <Pill width={45} />
      <Pill width={hero ? 60 : 80} tall />
      <Pill width={30} />
    </div>
  );
}

/** A faint curve in the inset well, standing in for the revenue chart. */
export function ChartCurveSkeleton() {
  return (
    <svg className="skeleton-curve" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M0 30 C 12 22, 20 34, 32 24 S 52 10, 64 20 S 84 30, 100 12"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** The heatmap's empty 7 × 24 grid. */
export function HeatmapGridSkeleton() {
  return (
    <div className="skeleton-heatmap" aria-hidden="true">
      {Array.from({ length: 7 * 24 }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}
