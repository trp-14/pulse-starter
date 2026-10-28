'use client';

import type { Kpis } from '@/types';
import { usePolling } from '@/hooks/usePolling';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useRushMode } from '@/hooks/useRushMode';
import { formatCurrency, formatInteger } from '@/lib/format';
import { kpisSchema } from '@/lib/validation/responses';
import { InlineError } from '@/components/ui/InlineError';
import { KpiCard } from './KpiCard';

export function KpiGrid({ initial }: { initial: Kpis }) {
  const { data: kpis, error, refresh } = usePolling('/api/kpis', kpisSchema, initial);
  const reduced = useReducedMotion();
  const rush = useRushMode();

  return (
    <section aria-label="Key metrics" className="kpi-grid">
      <KpiCard
        hero
        rush={rush.active}
        label="Revenue today"
        value={kpis.revenueToday}
        format={formatCurrency}
        hint="Excludes cancelled orders"
        reduced={reduced}
      />
      <KpiCard
        label="Orders today"
        value={kpis.ordersToday}
        format={formatInteger}
        hint="Since midnight"
        reduced={reduced}
      />
      <KpiCard
        label="Avg order value"
        value={kpis.averageOrderValue}
        format={formatCurrency}
        hint="Today"
        reduced={reduced}
      />
      <KpiCard label="Pending" value={kpis.pendingOrders} format={formatInteger} hint="Awaiting payment" reduced={reduced} />
      {error ? (
        <InlineError
          message="Live metrics are paused: we couldn’t refresh them."
          requestId={error.requestId}
          lastUpdated={kpis.generatedAt}
          onRetry={refresh}
        />
      ) : null}
    </section>
  );
}
