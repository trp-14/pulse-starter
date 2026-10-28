import { describe, expect, it } from 'vitest';
import { pageWindow } from '@/components/orders/OrdersPagination';
import { ordersUrl, toOrdersSearchParams } from '@/components/orders/use-orders-table';
import { matches, nextOption } from '@/components/ui/CommandPalette';
import { DEFAULT_ORDERS_QUERY } from '@/lib/validation/orders';

describe('command palette', () => {
  const command = { label: 'Filter orders: Pending', hint: 'Filter' };

  it('matches every typed word, in any order, case-insensitively', () => {
    expect(matches(command, '')).toBe(true);
    expect(matches(command, 'pend')).toBe(true);
    expect(matches(command, 'PENDING filter')).toBe(true);
    expect(matches(command, 'pending shipped')).toBe(false);
  });

  it('moves the highlight with arrows, Home and End, clamped to the list', () => {
    expect(nextOption('ArrowDown', 0, 4)).toBe(1);
    expect(nextOption('ArrowDown', 4, 4)).toBe(4);
    expect(nextOption('ArrowUp', 0, 4)).toBe(0);
    expect(nextOption('Home', 3, 4)).toBe(0);
    expect(nextOption('End', 0, 4)).toBe(4);
    expect(nextOption('a', 0, 4)).toBeNull();
  });
});

describe('orders table helpers', () => {
  it('shows up to five pages centred on the current one', () => {
    expect(pageWindow(1, 15)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(8, 15)).toEqual([6, 7, 8, 9, 10]);
    expect(pageWindow(15, 15)).toEqual([11, 12, 13, 14, 15]);
    expect(pageWindow(1, 2)).toEqual([1, 2]);
  });

  it('only puts non-default values in the URL', () => {
    expect(ordersUrl(DEFAULT_ORDERS_QUERY)).toBe('/api/orders');
    expect(toOrdersSearchParams({ ...DEFAULT_ORDERS_QUERY, status: 'paid', q: 'Kim', page: 3 })).toBe(
      'status=paid&q=Kim&page=3',
    );
  });
});
