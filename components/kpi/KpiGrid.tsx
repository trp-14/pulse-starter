'use client';

import { useRef } from 'react';
import type { Kpis } from '@/types';
import { usePolling } from '@/hooks/usePolling';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useRushMode } from '@/hooks/useRushMode';
import { formatCurrency, formatInteger } from '@/lib/format';
import { kpisSchema } from '@/lib/validation/responses';
import { InlineError } from '@/components/ui/InlineError';
import { KpiCard } from './KpiCard';
import { KpiPager } from './KpiPager';

const LABELS = {
  revenue: 'Revenue today',
  orders: 'Orders today',
  aov: 'Avg order value',
  pending: 'Pending',
} as const;

export function KpiGrid({ initial }: { initial: Kpis }) {
  const { data: kpis, error, refresh } = usePolling('/api/kpis', kpisSchema, initial);
  const reduced = useReducedMotion();
  const rush = useRushMode();
  const rowRef = useRef<HTMLElement>(null);

  return (
    <div className="kpi-block">
      <section aria-label="Key metrics" className="kpi-grid" ref={rowRef}>
        <KpiCard
          hero
          rush={rush.active}
          label={LABELS.revenue}
          value={kpis.revenueToday}
          format={formatCurrency}
          hint="Excludes cancelled orders"
          reduced={reduced}
        />
        <KpiCard label={LABELS.orders} value={kpis.ordersToday} format={formatInteger} hint="Since midnight" reduced={reduced} />
        <KpiCard label={LABELS.aov} value={kpis.averageOrderValue} format={formatCurrency} hint="Today" reduced={reduced} />
        <KpiCard label={LABELS.pending} value={kpis.pendingOrders} format={formatInteger} hint="Awaiting payment" reduced={reduced} />
      </section>
      <KpiPager rowRef={rowRef} labels={Object.values(LABELS)} />
      {error ? (
        <InlineError
          message="Live metrics are paused: we couldn’t refresh them."
          requestId={error.requestId}
          lastUpdated={kpis.generatedAt}
          onRetry={refresh}
        />
      ) : null}
    </div>
  );
}
