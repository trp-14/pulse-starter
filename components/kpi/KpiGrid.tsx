'use client';

import type { Kpis } from '@/types';
import { formatCurrency, formatInteger } from '@/lib/format';
import { KpiCard } from './KpiCard';

export function KpiGrid({ initial }: { initial: Kpis }) {
  const kpis = initial;
  return (
    <section aria-label="Key metrics" className="kpi-grid">
      <KpiCard hero label="Revenue today" value={formatCurrency(kpis.revenueToday)} hint="Excludes cancelled orders" />
      <KpiCard label="Orders today" value={formatInteger(kpis.ordersToday)} />
      <KpiCard label="Avg order value" value={formatCurrency(kpis.averageOrderValue)} />
      <KpiCard label="Pending" value={formatInteger(kpis.pendingOrders)} hint="Awaiting payment" />
    </section>
  );
}
