import 'server-only';
import type { SimulateResult } from '@/types';
import { getRepository } from '@/lib/db';
import { buildLineItems, createRng, lineItemsTotal, randomCustomerName, randomInt } from '@/lib/db/fake-data';
import type { NewOrderInput } from '@/lib/db/repository';
import { MAX_RUSH_ORDERS, MIN_RUSH_ORDERS } from '@/lib/validation/simulate';
import { CACHE_KEYS, invalidate, type ServiceContext } from './cache';

/** Rush orders are timestamped across the last few seconds so the feed shows a burst, not one instant. */
export const RUSH_SPREAD_MS = 6_000;

const secureSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now();

export async function simulateRush(requested: number | undefined, context: ServiceContext): Promise<SimulateResult> {
  const repository = getRepository();
  const products = await repository.getSellableProducts();
  if (products.length === 0) return { created: 0, orders: [] };

  const rng = createRng(secureSeed());
  const count = Math.min(requested ?? randomInt(rng, MIN_RUSH_ORDERS, MAX_RUSH_ORDERS), MAX_RUSH_ORDERS);
  const now = Date.now();
  const step = RUSH_SPREAD_MS / count;

  const inputs: NewOrderInput[] = Array.from({ length: count }, (_, index) => {
    const items = buildLineItems(rng, products);
    return {
      customerName: randomCustomerName(rng),
      status: rng() < 0.65 ? 'paid' : 'pending',
      total: lineItemsTotal(items),
      createdAt: new Date(now - Math.round((count - 1 - index) * step)),
      items,
    };
  });

  const orders = await repository.createOrders(inputs);
  // KPIs must reflect the rush on the very next poll; the heatmap is cheap to rebuild too.
  await invalidate([CACHE_KEYS.kpis, CACHE_KEYS.heatmap], context);
  return { created: orders.length, orders: orders.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)) };
}
