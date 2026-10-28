import 'server-only';
import type { RevenueBucket, RevenueSeries } from '@/types';
import { getRepository } from '@/lib/db';
import { roundMoney } from '@/lib/money';
import { HOUR_MS, startOfHour } from '@/lib/time';

export const REVENUE_HOURS = 24;

/** Last 24 hourly buckets, oldest first, ending with the current (partial) hour; empty hours are zero. */
export async function getRevenueSeries(now: Date = new Date()): Promise<RevenueSeries> {
  const firstHour = startOfHour(now).getTime() - (REVENUE_HOURS - 1) * HOUR_MS;
  const sparse = await getRepository().getHourlyRevenue(new Date(firstHour));
  const byHour = new Map(sparse.map((bucket) => [bucket.hourStart, bucket]));

  const buckets: RevenueBucket[] = Array.from({ length: REVENUE_HOURS }, (_, index) => {
    const hourStart = new Date(firstHour + index * HOUR_MS).toISOString();
    return byHour.get(hourStart) ?? { hourStart, revenue: 0, orders: 0 };
  });

  return {
    buckets,
    total: roundMoney(buckets.reduce((sum, bucket) => sum + bucket.revenue, 0)),
    generatedAt: now.toISOString(),
  };
}
