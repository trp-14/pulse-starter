import 'server-only';
import type { Kpis } from '@/types';
import { getRepository } from '@/lib/db';
import { roundMoney } from '@/lib/money';
import { zonedParts } from '@/lib/time';
import { kpisSchema } from '@/lib/validation/responses';
import { CACHE_KEYS, invalidate, readThrough, type ServiceContext } from './cache';

/** Every client polls KPIs every 5s; a 10s cache means Postgres sees at most ~6 queries/min regardless of viewers. */
export const KPI_CACHE_TTL_SECONDS = 10;

async function computeKpis(now: Date): Promise<Kpis> {
  const totals = await getRepository().getKpiTotals(zonedParts(now).dateKey);
  return {
    ...totals,
    averageOrderValue: totals.ordersToday > 0 ? roundMoney(totals.revenueToday / totals.ordersToday) : 0,
    generatedAt: now.toISOString(),
  };
}

export function getKpis(context: ServiceContext): Promise<Kpis> {
  return readThrough(CACHE_KEYS.kpis, KPI_CACHE_TTL_SECONDS, kpisSchema, () => computeKpis(new Date()), context);
}

export function invalidateKpis(context: ServiceContext): Promise<void> {
  return invalidate([CACHE_KEYS.kpis], context);
}
