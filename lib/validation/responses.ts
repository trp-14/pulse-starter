// Response schemas, used wherever JSON crosses a boundary as `unknown`: the browser
// parsing API responses and the server reading values back from Redis.
// Each one `satisfies` its type in types/index.ts, so the two can't drift apart.

import { z } from 'zod';
import type {
  ApiErrorBody,
  Heatmap,
  Kpis,
  LowStockResponse,
  OrderSummary,
  OrdersPage,
  RecentOrdersResponse,
  RevenueSeries,
  SimulateResult,
} from '@/types';
import { orderStatusSchema } from './orders';

const isoDateTime = z.iso.datetime({ offset: true });

export const orderSummarySchema = z.object({
  id: z.number().int(),
  customerName: z.string(),
  status: orderStatusSchema,
  total: z.number(),
  itemCount: z.number().int(),
  createdAt: isoDateTime,
}) satisfies z.ZodType<OrderSummary>;

export const kpisSchema = z.object({
  revenueToday: z.number(),
  ordersToday: z.number().int(),
  averageOrderValue: z.number(),
  pendingOrders: z.number().int(),
  generatedAt: isoDateTime,
}) satisfies z.ZodType<Kpis>;

export const recentOrdersSchema = z.object({
  orders: z.array(orderSummarySchema),
  generatedAt: isoDateTime,
}) satisfies z.ZodType<RecentOrdersResponse>;

export const ordersPageSchema = z.object({
  items: z.array(orderSummarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
}) satisfies z.ZodType<OrdersPage>;

export const revenueSeriesSchema = z.object({
  buckets: z.array(z.object({ hourStart: isoDateTime, revenue: z.number(), orders: z.number().int() })),
  total: z.number(),
  generatedAt: isoDateTime,
}) satisfies z.ZodType<RevenueSeries>;

export const heatmapSchema = z.object({
  days: z.array(
    z.object({
      date: z.iso.date(),
      label: z.string(),
      counts: z.array(z.number().int()).length(24),
    }),
  ),
  max: z.number().int(),
  generatedAt: isoDateTime,
}) satisfies z.ZodType<Heatmap>;

export const lowStockSchema = z.object({
  products: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      sku: z.string(),
      stock: z.number().int(),
      lowStockThreshold: z.number().int(),
    }),
  ),
  generatedAt: isoDateTime,
}) satisfies z.ZodType<LowStockResponse>;

export const simulateResultSchema = z.object({
  created: z.number().int(),
  orders: z.array(orderSummarySchema),
}) satisfies z.ZodType<SimulateResult>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    retryAfterSeconds: z.number().int().optional(),
  }),
}) satisfies z.ZodType<ApiErrorBody>;
