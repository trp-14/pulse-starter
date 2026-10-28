import 'server-only';
import type { OrdersPage, OrdersQuery, RecentOrdersResponse } from '@/types';
import { getRepository } from '@/lib/db';

export const RECENT_ORDERS_LIMIT = 10;

export async function getRecentOrders(now: Date = new Date()): Promise<RecentOrdersResponse> {
  return { orders: await getRepository().getRecentOrders(RECENT_ORDERS_LIMIT), generatedAt: now.toISOString() };
}

export function listOrders(query: OrdersQuery): Promise<OrdersPage> {
  return getRepository().listOrders(query);
}
