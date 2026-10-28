import 'server-only';
import type { Heatmap } from '@/types';
import { getRepository } from '@/lib/db';
import { lastDateKeys, weekdayLabel } from '@/lib/time';
import { heatmapSchema } from '@/lib/validation/responses';
import { CACHE_KEYS, readThrough, type ServiceContext } from './cache';

export const HEATMAP_DAYS = 7;
/** A 7×24 aggregate changes slowly; one minute of staleness is invisible and saves a GROUP BY per poll. */
export const HEATMAP_CACHE_TTL_SECONDS = 60;

async function computeHeatmap(now: Date): Promise<Heatmap> {
  const dates = lastDateKeys(now, HEATMAP_DAYS);
  const sparse = await getRepository().getOrderCountsByDayHour(dates[0] ?? '');
  const counts = new Map(sparse.map((cell) => [`${cell.dateKey}:${cell.hour}`, cell.count]));
  const days = dates.map((date) => ({
    date,
    label: weekdayLabel(date),
    counts: Array.from({ length: 24 }, (_, hour) => counts.get(`${date}:${hour}`) ?? 0),
  }));
  return {
    days,
    max: Math.max(0, ...days.flatMap((day) => day.counts)),
    generatedAt: now.toISOString(),
  };
}

export function getHeatmap(context: ServiceContext): Promise<Heatmap> {
  return readThrough(CACHE_KEYS.heatmap, HEATMAP_CACHE_TTL_SECONDS, heatmapSchema, () => computeHeatmap(new Date()), context);
}
