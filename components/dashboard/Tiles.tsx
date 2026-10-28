'use client';

// Client-side tile wrappers for the dashboard page: each renders its widget with the server's data,
// or — if that load failed — a skeleton of the same shape until the browser fetches it.
import type { Heatmap, Kpis, LowStockResponse, RecentOrdersResponse, RevenueSeries } from '@/types';
import { RevenueChart } from '@/components/chart/RevenueChart';
import { OrdersHeatmap } from '@/components/heatmap/OrdersHeatmap';
import { KpiGrid } from '@/components/kpi/KpiGrid';
import { LiveFeed } from '@/components/orders/LiveFeed';
import { LowStockList } from '@/components/stock/LowStockList';
import { Deferred } from '@/components/ui/Deferred';
import {
  ChartCurveSkeleton,
  HeatmapGridSkeleton,
  KpiSkeleton,
  RowsSkeleton,
  TileSkeleton,
} from '@/components/ui/Skeleton';
import {
  heatmapSchema,
  kpisSchema,
  lowStockSchema,
  recentOrdersSchema,
  revenueSeriesSchema,
} from '@/lib/validation/responses';

export function KpiTile({ initial }: { initial: Kpis | null }) {
  return (
    <Deferred
      initial={initial}
      url="/api/kpis"
      schema={kpisSchema}
      skeleton={(errorSlot) => (
        <div className="kpi-block">
          <section aria-label="Key metrics (loading)" aria-busy="true" className="kpi-grid">
            <KpiSkeleton hero />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </section>
          {errorSlot}
        </div>
      )}
    >
      {(data) => <KpiGrid initial={data} />}
    </Deferred>
  );
}

export function RevenueTile({ initial }: { initial: RevenueSeries | null }) {
  return (
    <Deferred
      initial={initial}
      url="/api/revenue"
      schema={revenueSeriesSchema}
      skeleton={(errorSlot) => (
        <TileSkeleton title="Revenue · last 24 hours" className="chart-tile" errorSlot={errorSlot}>
          <div className="chart-well skeleton-chart-well">
            <ChartCurveSkeleton />
          </div>
        </TileSkeleton>
      )}
    >
      {(data) => <RevenueChart initial={data} />}
    </Deferred>
  );
}

export function FeedTile({ initial }: { initial: RecentOrdersResponse | null }) {
  return (
    <Deferred
      initial={initial}
      url="/api/orders/recent"
      schema={recentOrdersSchema}
      skeleton={(errorSlot) => (
        <TileSkeleton title="Live orders" className="feed-tile" errorSlot={errorSlot}>
          <RowsSkeleton rows={8} label="Loading live orders" />
        </TileSkeleton>
      )}
    >
      {(data) => <LiveFeed initial={data} />}
    </Deferred>
  );
}

export function HeatmapTile({ initial }: { initial: Heatmap | null }) {
  return (
    <Deferred
      initial={initial}
      url="/api/orders/heatmap"
      schema={heatmapSchema}
      skeleton={(errorSlot) => (
        <TileSkeleton title="Orders heatmap" className="heatmap-tile" errorSlot={errorSlot}>
          <div className="heatmap-well skeleton-heatmap-well">
            <HeatmapGridSkeleton />
          </div>
        </TileSkeleton>
      )}
    >
      {(data) => <OrdersHeatmap initial={data} />}
    </Deferred>
  );
}

export function StockTile({ initial }: { initial: LowStockResponse | null }) {
  return (
    <Deferred
      initial={initial}
      url="/api/products/low-stock"
      schema={lowStockSchema}
      skeleton={(errorSlot) => (
        <TileSkeleton title="Low stock" className="stock-tile" errorSlot={errorSlot}>
          <RowsSkeleton rows={4} label="Loading stock levels" />
        </TileSkeleton>
      )}
    >
      {(data) => <LowStockList initial={data} />}
    </Deferred>
  );
}
