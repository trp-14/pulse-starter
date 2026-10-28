import { connection } from 'next/server';
import { FeedTile, HeatmapTile, KpiTile, RevenueTile, StockTile } from '@/components/dashboard/Tiles';
import { OrdersTable } from '@/components/orders/OrdersTable';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { Header } from '@/components/ui/Header';
import { PageReveal } from '@/components/ui/PageReveal';
import { logger } from '@/lib/logger';
import { getServerTheme } from '@/lib/server/theme';
import { getHeatmap } from '@/lib/services/heatmap';
import { getKpis } from '@/lib/services/kpis';
import { getRecentOrders, listOrders } from '@/lib/services/orders';
import { getRevenueSeries } from '@/lib/services/revenue';
import { getLowStock } from '@/lib/services/stock';
import { STORE_TIME_ZONE } from '@/lib/time';
import { DEFAULT_ORDERS_QUERY } from '@/lib/validation/orders';

/** A failed tile must not take the page down: log it and let that tile load on the client. */
async function settle<T>(name: string, load: Promise<T>, requestId: string): Promise<T | null> {
  try {
    return await load;
  } catch (error) {
    logger.error('First-paint load failed', requestId, { tile: name, error });
    return null;
  }
}

export default async function DashboardPage() {
  // Live data: render per request (no build-time prerender), straight from the services, so first paint has data.
  await connection();
  const context = { requestId: crypto.randomUUID() };
  const { requestId } = context;
  const [theme, kpis, recent, revenue, heatmap, lowStock, orders] = await Promise.all([
    getServerTheme(),
    settle('kpis', getKpis(context), requestId),
    settle('recent', getRecentOrders(), requestId),
    settle('revenue', getRevenueSeries(), requestId),
    settle('heatmap', getHeatmap(context), requestId),
    settle('lowStock', getLowStock(), requestId),
    settle('orders', listOrders(DEFAULT_ORDERS_QUERY), requestId),
  ]);

  return (
    <>
      <Header serverTheme={theme} />
      <PageReveal />
      <CommandPalette />
      <main id="dashboard" className="bento" tabIndex={-1}>
        <KpiTile initial={kpis} />
        <RevenueTile initial={revenue} />
        <FeedTile initial={recent} />
        <HeatmapTile initial={heatmap} />
        <StockTile initial={lowStock} />
        <OrdersTable initial={orders} />
      </main>
      <footer className="site-footer">
        Pulse · synthetic demo data · times shown in store time ({STORE_TIME_ZONE})
      </footer>
    </>
  );
}
