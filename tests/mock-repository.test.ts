import { beforeEach, describe, expect, it } from 'vitest';
import { createMockRepository } from '@/lib/db/mock-repository';
import { ordersQuerySchema } from '@/lib/validation';
import { zonedParts } from '@/lib/time';

const globalStore = globalThis as typeof globalThis & { __pulseMockStore?: unknown };

describe('mock repository', () => {
  beforeEach(() => {
    globalStore.__pulseMockStore = undefined;
  });

  it('returns the newest orders first', async () => {
    const recent = await createMockRepository().getRecentOrders(10);
    expect(recent).toHaveLength(10);
    const times = recent.map((order) => Date.parse(order.createdAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it('filters, searches and paginates orders', async () => {
    const repo = createMockRepository();
    const page = await repo.listOrders(ordersQuerySchema.parse({ status: 'shipped', pageSize: '7', page: '2' }));
    expect(page.items.length).toBeLessThanOrEqual(7);
    expect(page.items.every((order) => order.status === 'shipped')).toBe(true);
    expect(page.totalPages).toBe(Math.ceil(page.total / 7));

    const [first] = page.items;
    if (!first) throw new Error('expected shipped orders');
    const surname = first.customerName.split(' ')[1] ?? '';
    const search = await repo.listOrders(ordersQuerySchema.parse({ q: surname.toLowerCase() }));
    expect(search.items.every((order) => order.customerName.includes(surname))).toBe(true);
  });

  it('creates orders, decrements stock and never goes below zero', async () => {
    const repo = createMockRepository();
    const [product] = await repo.getSellableProducts();
    if (!product) throw new Error('expected sellable products');
    const created = await repo.createOrders([
      {
        customerName: 'Test Buyer',
        status: 'paid',
        total: product.price,
        createdAt: new Date(),
        items: [{ productId: product.id, quantity: product.stock + 5, unitPrice: product.price }],
      },
    ]);
    expect(created).toHaveLength(1);
    expect((await repo.getRecentOrders(1))[0]?.customerName).toBe('Test Buyer');
    const after = (await repo.getSellableProducts()).find((p) => p.id === product.id);
    expect(after).toBeUndefined();
    const low = await repo.getLowStock(50);
    expect(low.find((p) => p.id === product.id)?.stock).toBe(0);
  });

  it('counts today’s orders in the store time zone', async () => {
    const repo = createMockRepository();
    const todayKey = zonedParts(new Date()).dateKey;
    const totals = await repo.getKpiTotals(todayKey);
    expect(totals.ordersToday).toBeGreaterThanOrEqual(0);
    expect(totals.pendingOrders).toBeGreaterThan(0);
  });
});
