import { connection } from 'next/server';
import { RevenueChart } from '@/components/chart/RevenueChart';
import { OrdersHeatmap } from '@/components/heatmap/OrdersHeatmap';
import { KpiGrid } from '@/components/kpi/KpiGrid';
import { LiveFeed } from '@/components/orders/LiveFeed';
import { OrdersTable } from '@/components/orders/OrdersTable';
import { LowStockList } from '@/components/stock/LowStockList';
import { Header } from '@/components/ui/Header';
import { PageReveal } from '@/components/ui/PageReveal';
import { RushTicker } from '@/components/ui/RushTicker';
import { getServerTheme } from '@/lib/server/theme';
import { getHeatmap } from '@/lib/services/heatmap';
import { getKpis } from '@/lib/services/kpis';
import { getRecentOrders, listOrders } from '@/lib/services/orders';
import { getRevenueSeries } from '@/lib/services/revenue';
import { getLowStock } from '@/lib/services/stock';
import { STORE_TIME_ZONE } from '@/lib/time';
import { DEFAULT_ORDERS_QUERY } from '@/lib/validation/orders';

export default async function DashboardPage() {
  // Live data: render per request (no build-time prerender), straight from the services, so first paint has data.
  await connection();
  const context = { requestId: crypto.randomUUID() };
  const [theme, kpis, recent, revenue, heatmap, lowStock, orders] = await Promise.all([
    getServerTheme(),
    getKpis(context),
    getRecentOrders(),
    getRevenueSeries(),
    getHeatmap(context),
    getLowStock(),
    listOrders(DEFAULT_ORDERS_QUERY),
  ]);

  return (
    <>
      <Header serverTheme={theme} />
      <RushTicker />
      <PageReveal />
      <main id="dashboard" className="bento" tabIndex={-1}>
        <KpiGrid initial={kpis} />
        <RevenueChart initial={revenue} />
        <LiveFeed initial={recent} />
        <OrdersHeatmap initial={heatmap} />
        <LowStockList initial={lowStock} />
        <OrdersTable initial={orders} />
      </main>
      <footer className="site-footer">
        Pulse · synthetic demo data · times shown in store time ({STORE_TIME_ZONE})
      </footer>
    </>
  );
}
