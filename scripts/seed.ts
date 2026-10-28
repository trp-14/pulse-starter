// Seeds Neon with the same synthetic shop the mock mode uses.
//   npm run db:seed      (reads DATABASE_URL from .env.local or the environment)
// Destructive: truncates products, orders and order_items in the configured database.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ENV_FILE = path.resolve(process.cwd(), '.env.local');
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const out = (line: string) => process.stdout.write(`${line}\n`);
const fail = (line: string) => {
  process.stderr.write(`${line}\n`);
  process.exit(1);
};

/** Splits the repo's own static DDL file into statements (no functions or $$ bodies in it). */
function schemaStatements(): string[] {
  const file = readFileSync(path.resolve(process.cwd(), 'db/schema.sql'), 'utf8');
  return file
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

async function main(): Promise<void> {
  // Imported after the env file is loaded: lib/env validates process.env at import time.
  const { env } = await import('@/lib/env');
  if (env.db.mode !== 'real') {
    fail('DATABASE_URL is not set. Add it to .env.local (see .env.example), or keep using mock mode without seeding.');
    return;
  }

  const { neon } = await import('@neondatabase/serverless');
  const { generateDataset } = await import('@/lib/db/fake-data');
  const sql = neon(env.db.url);
  const { products, orders, items } = generateDataset(new Date());

  out('Applying db/schema.sql…');
  // Trusted, version-controlled DDL with no parameters: the one place raw SQL text is executed.
  for (const statement of schemaStatements()) {
    await sql.query(statement);
  }

  out(`Seeding ${products.length} products, ${orders.length} orders, ${items.length} order items…`);
  await sql.transaction([
    sql`SET LOCAL statement_timeout = 30000`,
    sql`TRUNCATE order_items, orders, products RESTART IDENTITY CASCADE`,
    sql`
      INSERT INTO products (id, name, sku, price, stock, low_stock_threshold, image_url, created_at)
      SELECT * FROM unnest(
        ${products.map((p) => p.id)}::int[],
        ${products.map((p) => p.name)}::text[],
        ${products.map((p) => p.sku)}::text[],
        ${products.map((p) => p.price)}::numeric[],
        ${products.map((p) => p.stock)}::int[],
        ${products.map((p) => p.lowStockThreshold)}::int[],
        ${products.map((p) => p.imageUrl)}::text[],
        ${products.map((p) => p.createdAt.toISOString())}::timestamptz[]
      )`,
    sql`
      INSERT INTO orders (id, customer_name, status, total, created_at)
      SELECT * FROM unnest(
        ${orders.map((o) => o.id)}::int[],
        ${orders.map((o) => o.customerName)}::text[],
        ${orders.map((o) => o.status)}::text[],
        ${orders.map((o) => o.total)}::numeric[],
        ${orders.map((o) => o.createdAt.toISOString())}::timestamptz[]
      )`,
    sql`
      INSERT INTO order_items (id, order_id, product_id, quantity, unit_price)
      SELECT * FROM unnest(
        ${items.map((i) => i.id)}::int[],
        ${items.map((i) => i.orderId)}::int[],
        ${items.map((i) => i.productId)}::int[],
        ${items.map((i) => i.quantity)}::int[],
        ${items.map((i) => i.unitPrice)}::numeric[]
      )`,
    // Explicit ids were inserted, so move each identity sequence past them.
    sql`SELECT setval(pg_get_serial_sequence('products', 'id'), (SELECT max(id) FROM products))`,
    sql`SELECT setval(pg_get_serial_sequence('orders', 'id'), (SELECT max(id) FROM orders))`,
    sql`SELECT setval(pg_get_serial_sequence('order_items', 'id'), (SELECT max(id) FROM order_items))`,
  ]);

  out('Done. Start the app with `npm run dev`.');
}

main().catch((error: unknown) => {
  fail(`Seed failed: ${error instanceof Error ? error.message : 'unknown error'}`);
});
