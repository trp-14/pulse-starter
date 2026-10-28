import { describe, expect, it } from 'vitest';
import { generateDataset, ORDER_COUNT, PRODUCT_COUNT } from '@/lib/db/fake-data';
import { DAY_MS, zonedParts } from '@/lib/time';

const NOW = new Date('2026-10-28T08:00:00Z');

describe('generateDataset', () => {
  const data = generateDataset(NOW);

  it('creates ~30 products and ~300 orders within the last 7 days', () => {
    expect(data.products).toHaveLength(PRODUCT_COUNT);
    expect(PRODUCT_COUNT).toBe(30);
    expect(data.orders).toHaveLength(ORDER_COUNT);
    for (const order of data.orders) {
      expect(order.createdAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
      expect(order.createdAt.getTime()).toBeGreaterThanOrEqual(NOW.getTime() - 7 * DAY_MS);
    }
  });

  it('is deterministic for the same seed and anchor time', () => {
    expect(generateDataset(NOW)).toEqual(data);
  });

  it('puts more orders in daytime than at night (store-local)', () => {
    const hours = data.orders.map((order) => zonedParts(order.createdAt).hour);
    const night = hours.filter((hour) => hour < 6).length;
    const day = hours.filter((hour) => hour >= 10 && hour < 16).length;
    expect(day).toBeGreaterThan(night * 3);
  });

  it('keeps order totals equal to the sum of their items', () => {
    for (const order of data.orders) {
      const sum = data.items
        .filter((item) => item.orderId === order.id)
        .reduce((total, item) => total + item.quantity * item.unitPrice, 0);
      expect(order.total).toBeCloseTo(sum, 2);
    }
  });

  it('includes a few low-stock products for the alerts tile', () => {
    const low = data.products.filter((product) => product.stock <= product.lowStockThreshold);
    expect(low.length).toBeGreaterThanOrEqual(3);
    expect(new Set(data.products.map((product) => product.sku)).size).toBe(PRODUCT_COUNT);
  });
});
