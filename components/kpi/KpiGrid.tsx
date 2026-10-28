'use client';

import type { Kpis } from '@/types';
import { usePolling } from '@/hooks/usePolling';
import { formatCurrency, formatInteger } from '@/lib/format';
import { kpisSchema } from '@/lib/validation/responses';
import { InlineError } from '@/components/ui/InlineError';
import { KpiCard } from './KpiCard';

export function KpiGrid({ initial }: { initial: Kpis }) {
  const { data: kpis, error, refresh } = usePolling('/api/kpis', kpisSchema, initial);
  return (
    <section aria-label="Key metrics" className="kpi-grid">
      <KpiCard hero label="Revenue today" value={formatCurrency(kpis.revenueToday)} hint="Excludes cancelled orders" />
      <KpiCard label="Orders today" value={formatInteger(kpis.ordersToday)} />
      <KpiCard label="Avg order value" value={formatCurrency(kpis.averageOrderValue)} />
      <KpiCard label="Pending" value={formatInteger(kpis.pendingOrders)} hint="Awaiting payment" />
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
