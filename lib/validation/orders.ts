import { z } from 'zod';
import { ORDER_SORT_FIELDS, ORDER_STATUSES, SORT_DIRECTIONS, type OrdersQuery } from '@/types';
import { DAY_MS } from '@/lib/time';

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE = 10_000;
export const MAX_SEARCH_LENGTH = 100;
export const MAX_RANGE_DAYS = 31;

const emptyToUndefined = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value);

export const orderStatusSchema = z.enum(ORDER_STATUSES);

const isoDate = z.iso.date();

export const ordersQuerySchema = z
  .object({
    status: z.preprocess(emptyToUndefined, orderStatusSchema.optional()),
    from: z.preprocess(emptyToUndefined, isoDate.optional()),
    to: z.preprocess(emptyToUndefined, isoDate.optional()),
    q: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(MAX_SEARCH_LENGTH).optional()),
    page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(MAX_PAGE).default(1)),
    pageSize: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    ),
    sort: z.preprocess(emptyToUndefined, z.enum(ORDER_SORT_FIELDS).default('created_at')),
    dir: z.preprocess(emptyToUndefined, z.enum(SORT_DIRECTIONS).default('desc')),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.from || !value.to) return;
    const span = Date.parse(value.to) - Date.parse(value.from);
    if (span < 0) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: '"to" must be on or after "from"' });
    } else if (span / DAY_MS + 1 > MAX_RANGE_DAYS) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: `date range is limited to ${MAX_RANGE_DAYS} days` });
    }
  }) satisfies z.ZodType<OrdersQuery, unknown>;

/** What an empty query string means: shared by the server's first paint and the client table. */
export const DEFAULT_ORDERS_QUERY: OrdersQuery = ordersQuerySchema.parse({});
