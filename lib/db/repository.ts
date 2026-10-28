import 'server-only';
import type { DataMode } from '@/lib/env';
import type { LowStockProduct, OrderStatus, OrderSummary, OrdersPage, OrdersQuery, RevenueBucket } from '@/types';
import type { LineItemDraft } from './fake-data';

export interface KpiTotals {
  revenueToday: number;
  ordersToday: number;
  pendingOrders: number;
}

/** One sparse heatmap row: orders placed on a store-local date during a store-local hour. */
export interface DayHourCount {
  dateKey: string;
  hour: number;
  count: number;
}

export interface SellableProduct {
  id: number;
  price: number;
  stock: number;
}

export interface NewOrderInput {
  customerName: string;
  status: OrderStatus;
  total: number;
  createdAt: Date;
  items: LineItemDraft[];
}

/**
 * The single data-access contract. Two implementations: Neon (real) and in-memory (mock).
 * Aggregations return sparse rows; services fill gaps, so both implementations stay small.
 */
export interface Repository {
  readonly mode: DataMode;
  /** Totals for the store-local calendar day `todayKey` (YYYY-MM-DD). Cancelled orders are excluded from revenue/count. */
  getKpiTotals(todayKey: string): Promise<KpiTotals>;
  getRecentOrders(limit: number): Promise<OrderSummary[]>;
  listOrders(query: OrdersQuery): Promise<OrdersPage>;
  /** Non-cancelled revenue per hour since `since`; hours without orders are omitted. */
  getHourlyRevenue(since: Date): Promise<RevenueBucket[]>;
  /** Order counts per store-local date and hour, from `sinceKey` (inclusive); empty cells omitted. */
  getOrderCountsByDayHour(sinceKey: string): Promise<DayHourCount[]>;
  getLowStock(limit: number): Promise<LowStockProduct[]>;
  getSellableProducts(): Promise<SellableProduct[]>;
  /** Inserts orders with their items and decrements stock (never below zero), atomically. */
  createOrders(orders: NewOrderInput[]): Promise<OrderSummary[]>;
}
