import 'server-only';
import type { Kpis } from '@/types';
import { getRepository } from '@/lib/db';
import { roundMoney } from '@/lib/money';
import { zonedParts } from '@/lib/time';

export async function getKpis(now: Date = new Date()): Promise<Kpis> {
  const totals = await getRepository().getKpiTotals(zonedParts(now).dateKey);
  return {
    ...totals,
    averageOrderValue: totals.ordersToday > 0 ? roundMoney(totals.revenueToday / totals.ordersToday) : 0,
    generatedAt: now.toISOString(),
  };
}
