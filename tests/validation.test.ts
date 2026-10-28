import { describe, expect, it } from 'vitest';
import { MAX_PAGE_SIZE, ordersQuerySchema, searchParamsToObject } from '@/lib/validation';

describe('ordersQuerySchema', () => {
  it('applies defaults', () => {
    expect(ordersQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20, sort: 'created_at', dir: 'desc' });
  });

  it('treats empty strings as absent', () => {
    expect(ordersQuerySchema.parse({ status: '', q: '  ', from: '' })).toEqual(ordersQuerySchema.parse({}));
  });

  it.each([
    ['unknown key', { admin: 'true' }],
    ['bad status', { status: 'refunded' }],
    ['pageSize over the cap', { pageSize: String(MAX_PAGE_SIZE + 1) }],
    ['non-integer page', { page: '1.5' }],
    ['zero page', { page: '0' }],
    ['search too long', { q: 'x'.repeat(101) }],
    ['malformed date', { from: '2026-13-40' }],
    ['reversed range', { from: '2026-10-20', to: '2026-10-10' }],
    ['range over 31 days', { from: '2026-01-01', to: '2026-03-01' }],
    ['unwhitelisted sort column', { sort: 'id; DROP TABLE orders' }],
  ])('rejects %s', (_label, input) => {
    expect(ordersQuerySchema.safeParse(input).success).toBe(false);
  });
});

describe('searchParamsToObject', () => {
  it('flattens unique keys', () => {
    expect(searchParamsToObject(new URLSearchParams('status=paid&page=2'))).toEqual({
      ok: true,
      value: { status: 'paid', page: '2' },
    });
  });

  it('rejects repeated keys', () => {
    expect(searchParamsToObject(new URLSearchParams('status=paid&status=pending'))).toEqual({
      ok: false,
      key: 'status',
    });
  });
});
