import 'server-only';
import type { LowStockResponse } from '@/types';
import { getRepository } from '@/lib/db';

export const LOW_STOCK_LIMIT = 8;

export async function getLowStock(now: Date = new Date()): Promise<LowStockResponse> {
  return { products: await getRepository().getLowStock(LOW_STOCK_LIMIT), generatedAt: now.toISOString() };
}
