import 'server-only';
import { neon, type NeonQueryFunction, type NeonQueryPromise } from '@neondatabase/serverless';
import { z } from 'zod';
import { ORDER_STATUSES, type OrderSortField, type OrdersQuery, type OrderSummary } from '@/types';
import { STORE_TIME_ZONE } from '@/lib/time';
import type { DayHourCount, KpiTotals, NewOrderInput, Repository } from './repository';

/** Postgres aborts any single statement after this long. */
export const STATEMENT_TIMEOUT_MS = 5_000;
/** The HTTP request to Neon is aborted after this long (covers network + queueing). */
export const HTTP_TIMEOUT_MS = 8_000;

type Sql = NeonQueryFunction<false, false>;
type Query = NeonQueryPromise<false, false>;

const timestamp = z.union([z.date(), z.string()]).transform((value) => new Date(value).toISOString());

const orderRow = z.object({
  id: z.number().int(),
  customer_name: z.string(),
  status: z.enum(ORDER_STATUSES),
  total: z.number(),
  item_count: z.number().int(),
  created_at: timestamp,
});
const orderRows = z.array(orderRow);
const countRows = z.tuple([z.object({ total: z.number().int() })]);
const kpiRows = z.tuple([
  z.object({ revenue_today: z.number(), orders_today: z.number().int(), pending_orders: z.number().int() }),
]);
const revenueRows = z.array(z.object({ hour_start: timestamp, revenue: z.number(), orders: z.number().int() }));
const heatmapRows = z.array(z.object({ date_key: z.string(), hour: z.number().int(), count: z.number().int() }));
const lowStockRows = z.array(
  z.object({
    id: z.number().int(),
    name: z.string(),
    sku: z.string(),
    stock: z.number().int(),
    low_stock_threshold: z.number().int(),
  }),
);
const sellableRows = z.array(z.object({ id: z.number().int(), price: z.number(), stock: z.number().int() }));

const toSummary = (row: z.infer<typeof orderRow>): OrderSummary => ({
  id: row.id,
  customerName: row.customer_name,
  status: row.status,
  total: row.total,
  itemCount: row.item_count,
  createdAt: row.created_at,
});

const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (match) => `\\${match}`);

/** Whitelisted ORDER BY columns, as composable SQL fragments (never raw strings). */
function sortColumn(sql: Sql, field: OrderSortField): Query {
  switch (field) {
    case 'total':
      return sql`o.total`;
    case 'customer_name':
      return sql`o.customer_name`;
    case 'created_at':
      return sql`o.created_at`;
  }
}

function orderFilters(sql: Sql, query: OrdersQuery): Query {
  const conditions: Query[] = [];
  if (query.status) conditions.push(sql`o.status = ${query.status}`);
  if (query.q) {
    const pattern = '%' + escapeLike(query.q) + '%';
    conditions.push(sql`o.customer_name ILIKE ${pattern}`);
  }
  if (query.from) {
    conditions.push(sql`o.created_at >= (${query.from}::date::timestamp AT TIME ZONE ${STORE_TIME_ZONE})`);
  }
  if (query.to) {
    conditions.push(sql`o.created_at < ((${query.to}::date + 1)::timestamp AT TIME ZONE ${STORE_TIME_ZONE})`);
  }
  return conditions.reduce((all, condition) => sql`${all} AND ${condition}`, sql`TRUE`);
}

const orderColumns = (sql: Sql): Query => sql`
  o.id, o.customer_name, o.status, o.total::float8 AS total, o.created_at,
  COALESCE((SELECT sum(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id), 0)::int AS item_count`;

export function createNeonRepository(connectionString: string): Repository {
  const sql: Sql = neon(connectionString);

  /** Every call is one HTTP round trip: a transaction that first sets a statement timeout. */
  async function run(queries: Query[], readOnly = true): Promise<unknown[]> {
    const results: unknown[] = await sql.transaction(
      [sql`SET LOCAL statement_timeout = 5000`, ...queries],
      { readOnly, fetchOptions: { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) } },
    );
    return results.slice(1);
  }

  async function runOne(query: Query): Promise<unknown> {
    const [rows] = await run([query]);
    return rows;
  }

  function insertOrder(input: NewOrderInput): Query {
    const productIds = input.items.map((item) => item.productId);
    const quantities = input.items.map((item) => item.quantity);
    const unitPrices = input.items.map((item) => item.unitPrice);
    const units = quantities.reduce((sum, quantity) => sum + quantity, 0);
    return sql`
      WITH new_order AS (
        INSERT INTO orders (customer_name, status, total, created_at)
        VALUES (${input.customerName}, ${input.status}, ${input.total}, ${input.createdAt})
        RETURNING id, customer_name, status, total, created_at
      ), new_items AS (
        INSERT INTO order_items (order_id, product_id, quantity, unit_price)
        SELECT new_order.id, i.product_id, i.quantity, i.unit_price
        FROM new_order, unnest(${productIds}::int[], ${quantities}::int[], ${unitPrices}::numeric[])
          AS i(product_id, quantity, unit_price)
      ), stock_update AS (
        UPDATE products p SET stock = GREATEST(p.stock - i.quantity, 0)
        FROM unnest(${productIds}::int[], ${quantities}::int[]) AS i(product_id, quantity)
        WHERE p.id = i.product_id
      )
      SELECT id, customer_name, status, total::float8 AS total, ${units}::int AS item_count, created_at
      FROM new_order`;
  }

  return {
    mode: 'real',

    async getKpiTotals(todayKey: string): Promise<KpiTotals> {
      const todayStart = sql`(${todayKey}::date::timestamp AT TIME ZONE ${STORE_TIME_ZONE})`;
      const rows = kpiRows.parse(
        await runOne(sql`
          SELECT
            COALESCE(sum(total) FILTER (WHERE status <> 'cancelled' AND created_at >= ${todayStart}), 0)::float8
              AS revenue_today,
            count(*) FILTER (WHERE status <> 'cancelled' AND created_at >= ${todayStart})::int AS orders_today,
            count(*) FILTER (WHERE status = 'pending')::int AS pending_orders
          FROM orders
          WHERE created_at >= ${todayStart} OR status = 'pending'`),
      );
      const [row] = rows;
      return { revenueToday: row.revenue_today, ordersToday: row.orders_today, pendingOrders: row.pending_orders };
    },

    async getRecentOrders(limit: number) {
      const rows = await runOne(sql`
        SELECT ${orderColumns(sql)} FROM orders o ORDER BY o.created_at DESC, o.id DESC LIMIT ${limit}`);
      return orderRows.parse(rows).map(toSummary);
    },

    async listOrders(query: OrdersQuery) {
      const where = orderFilters(sql, query);
      const direction = query.dir === 'asc' ? sql`ASC` : sql`DESC`;
      const offset = (query.page - 1) * query.pageSize;
      const [countResult, pageResult] = await run([
        sql`SELECT count(*)::int AS total FROM orders o WHERE ${where}`,
        sql`
          SELECT ${orderColumns(sql)} FROM orders o WHERE ${where}
          ORDER BY ${sortColumn(sql, query.sort)} ${direction}, o.id DESC
          LIMIT ${query.pageSize} OFFSET ${offset}`,
      ]);
      const [{ total }] = countRows.parse(countResult);
      return {
        items: orderRows.parse(pageResult).map(toSummary),
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      };
    },

    async getHourlyRevenue(since: Date) {
      const rows = await runOne(sql`
        SELECT date_trunc('hour', created_at) AS hour_start, sum(total)::float8 AS revenue, count(*)::int AS orders
        FROM orders
        WHERE created_at >= ${since} AND status <> 'cancelled'
        GROUP BY 1 ORDER BY 1`);
      return revenueRows.parse(rows).map((row) => ({
        hourStart: row.hour_start,
        revenue: row.revenue,
        orders: row.orders,
      }));
    },

    async getOrderCountsByDayHour(sinceKey: string): Promise<DayHourCount[]> {
      const rows = await runOne(sql`
        SELECT to_char(created_at AT TIME ZONE ${STORE_TIME_ZONE}, 'YYYY-MM-DD') AS date_key,
               extract(hour FROM created_at AT TIME ZONE ${STORE_TIME_ZONE})::int AS hour,
               count(*)::int AS count
        FROM orders
        WHERE created_at >= (${sinceKey}::date::timestamp AT TIME ZONE ${STORE_TIME_ZONE})
        GROUP BY 1, 2`);
      return heatmapRows.parse(rows).map((row) => ({ dateKey: row.date_key, hour: row.hour, count: row.count }));
    },

    async getLowStock(limit: number) {
      const rows = await runOne(sql`
        SELECT id, name, sku, stock, low_stock_threshold
        FROM products
        WHERE stock <= low_stock_threshold
        ORDER BY stock::float8 / GREATEST(low_stock_threshold, 1), name
        LIMIT ${limit}`);
      return lowStockRows.parse(rows).map((row) => ({
        id: row.id,
        name: row.name,
        sku: row.sku,
        stock: row.stock,
        lowStockThreshold: row.low_stock_threshold,
      }));
    },

    async getSellableProducts() {
      return sellableRows.parse(await runOne(sql`SELECT id, price::float8 AS price, stock FROM products WHERE stock > 0`));
    },

    async createOrders(inputs: NewOrderInput[]) {
      if (inputs.length === 0) return [];
      const results = await run(inputs.map(insertOrder), false);
      return results.flatMap((rows) => orderRows.parse(rows).map(toSummary));
    },
  };
}
