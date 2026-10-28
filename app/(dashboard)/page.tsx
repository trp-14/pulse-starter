import { connection } from 'next/server';
import { KpiGrid } from '@/components/kpi/KpiGrid';
import { OrdersTable } from '@/components/orders/OrdersTable';
import { getKpis } from '@/lib/services/kpis';
import { listOrders } from '@/lib/services/orders';
import { DEFAULT_ORDERS_QUERY } from '@/lib/validation/orders';

export default async function DashboardPage() {
  // Live data: render per request (no build-time prerender), straight from the services, so first paint has data.
  await connection();
  const context = { requestId: crypto.randomUUID() };
  const [kpis, orders] = await Promise.all([getKpis(context), listOrders(DEFAULT_ORDERS_QUERY)]);

  return (
    <main className="dashboard">
      <h1>Pulse</h1>
      <KpiGrid initial={kpis} />
      <OrdersTable initial={orders} />
    </main>
  );
}
