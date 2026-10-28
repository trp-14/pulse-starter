import 'server-only';
import type { LowStockProduct, OrderSummary, OrdersPage, OrdersQuery, RevenueBucket } from '@/types';
import { roundMoney } from '@/lib/money';
import { startOfHour, zonedParts } from '@/lib/time';
import { generateDataset, type FakeOrder, type FakeProduct } from './fake-data';
import type { DayHourCount, KpiTotals, NewOrderInput, Repository, SellableProduct } from './repository';

interface MockStore {
  products: Map<number, FakeProduct>;
  /** Sorted oldest → newest. */
  orders: FakeOrder[];
  /** Units per order (sum of item quantities). */
  unitsByOrder: Map<number, number>;
  nextOrderId: number;
}

function createStore(): MockStore {
  const { products, orders, items } = generateDataset(new Date());
  const unitsByOrder = new Map<number, number>();
  for (const item of items) {
    unitsByOrder.set(item.orderId, (unitsByOrder.get(item.orderId) ?? 0) + item.quantity);
  }
  return {
    products: new Map(products.map((product) => [product.id, product])),
    orders,
    unitsByOrder,
    nextOrderId: orders.length + 1,
  };
}

// Kept on globalThis so dev hot reloads don't reset the shop mid-demo.
const globalStore = globalThis as typeof globalThis & { __pulseMockStore?: MockStore };

function store(): MockStore {
  globalStore.__pulseMockStore ??= createStore();
  return globalStore.__pulseMockStore;
}

function toSummary(order: FakeOrder): OrderSummary {
  return {
    id: order.id,
    customerName: order.customerName,
    status: order.status,
    total: order.total,
    itemCount: store().unitsByOrder.get(order.id) ?? 0,
    createdAt: order.createdAt.toISOString(),
  };
}

function matchesQuery(order: FakeOrder, query: OrdersQuery): boolean {
  if (query.status && order.status !== query.status) return false;
  if (query.q && !order.customerName.toLowerCase().includes(query.q.toLowerCase())) return false;
  if (query.from || query.to) {
    const { dateKey } = zonedParts(order.createdAt);
    if (query.from && dateKey < query.from) return false;
    if (query.to && dateKey > query.to) return false;
  }
  return true;
}

function compareOrders(query: OrdersQuery): (a: FakeOrder, b: FakeOrder) => number {
  const sign = query.dir === 'asc' ? 1 : -1;
  return (a, b) => {
    let diff: number;
    if (query.sort === 'total') diff = a.total - b.total;
    else if (query.sort === 'customer_name') diff = a.customerName.localeCompare(b.customerName);
    else diff = a.createdAt.getTime() - b.createdAt.getTime();
    return diff === 0 ? b.id - a.id : diff * sign;
  };
}

export function createMockRepository(): Repository {
  return {
    mode: 'mock',

    async getKpiTotals(todayKey: string): Promise<KpiTotals> {
      let revenueToday = 0;
      let ordersToday = 0;
      let pendingOrders = 0;
      for (const order of store().orders) {
        if (order.status === 'pending') pendingOrders += 1;
        if (order.status !== 'cancelled' && zonedParts(order.createdAt).dateKey === todayKey) {
          revenueToday += order.total;
          ordersToday += 1;
        }
      }
      return { revenueToday: roundMoney(revenueToday), ordersToday, pendingOrders };
    },

    async getRecentOrders(limit: number): Promise<OrderSummary[]> {
      return store().orders.slice(-limit).reverse().map(toSummary);
    },

    async listOrders(query: OrdersQuery): Promise<OrdersPage> {
      const matching = store().orders.filter((order) => matchesQuery(order, query)).sort(compareOrders(query));
      const offset = (query.page - 1) * query.pageSize;
      return {
        items: matching.slice(offset, offset + query.pageSize).map(toSummary),
        page: query.page,
        pageSize: query.pageSize,
        total: matching.length,
        totalPages: Math.max(1, Math.ceil(matching.length / query.pageSize)),
      };
    },

    async getHourlyRevenue(since: Date): Promise<RevenueBucket[]> {
      const buckets = new Map<string, RevenueBucket>();
      for (const order of store().orders) {
        if (order.createdAt < since || order.status === 'cancelled') continue;
        const hourStart = startOfHour(order.createdAt).toISOString();
        const bucket = buckets.get(hourStart) ?? { hourStart, revenue: 0, orders: 0 };
        bucket.revenue = roundMoney(bucket.revenue + order.total);
        bucket.orders += 1;
        buckets.set(hourStart, bucket);
      }
      return [...buckets.values()];
    },

    async getOrderCountsByDayHour(sinceKey: string): Promise<DayHourCount[]> {
      const cells = new Map<string, DayHourCount>();
      for (const order of store().orders) {
        const { dateKey, hour } = zonedParts(order.createdAt);
        if (dateKey < sinceKey) continue;
        const key = `${dateKey}:${hour}`;
        const cell = cells.get(key) ?? { dateKey, hour, count: 0 };
        cell.count += 1;
        cells.set(key, cell);
      }
      return [...cells.values()];
    },

    async getLowStock(limit: number): Promise<LowStockProduct[]> {
      return [...store().products.values()]
        .filter((product) => product.stock <= product.lowStockThreshold)
        .sort((a, b) => a.stock / Math.max(a.lowStockThreshold, 1) - b.stock / Math.max(b.lowStockThreshold, 1))
        .slice(0, limit)
        .map(({ id, name, sku, stock, lowStockThreshold }) => ({ id, name, sku, stock, lowStockThreshold }));
    },

    async getSellableProducts(): Promise<SellableProduct[]> {
      return [...store().products.values()]
        .filter((product) => product.stock > 0)
        .map(({ id, price, stock }) => ({ id, price, stock }));
    },

    async createOrders(inputs: NewOrderInput[]): Promise<OrderSummary[]> {
      const state = store();
      const created = inputs.map((input) => {
        const order: FakeOrder = {
          id: state.nextOrderId,
          customerName: input.customerName,
          status: input.status,
          total: input.total,
          createdAt: input.createdAt,
        };
        state.nextOrderId += 1;
        let units = 0;
        for (const item of input.items) {
          units += item.quantity;
          const product = state.products.get(item.productId);
          if (product) product.stock = Math.max(product.stock - item.quantity, 0);
        }
        state.unitsByOrder.set(order.id, units);
        return order;
      });
      state.orders.push(...created);
      state.orders.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id);
      return created.map(toSummary);
    },
  };
}
