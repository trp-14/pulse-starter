'use client';

import { useId } from 'react';
import type { LowStockProduct, LowStockResponse } from '@/types';
import { usePolling } from '@/hooks/usePolling';
import { lowStockSchema } from '@/lib/validation/responses';
import { InlineError } from '@/components/ui/InlineError';

export const LOW_STOCK_POLL_MS = 30_000;

/** Stock as a share of its threshold, 0–100, drawn as an SVG width (no inline styles). */
export const stockPercent = (product: LowStockProduct): number =>
  Math.round(Math.min(1, product.stock / Math.max(product.lowStockThreshold, 1)) * 100);

function StockRow({ product }: { product: LowStockProduct }) {
  const percent = stockPercent(product);
  return (
    <li className="stock-row" data-product-id={product.id}>
      <div className="stock-head">
        <p className="stock-name">{product.name}</p>
        <p className={product.stock === 0 ? 'stock-count is-out tabular-nums' : 'stock-count tabular-nums'}>
          {product.stock === 0 ? 'Sold out' : `${product.stock} left`}
        </p>
      </div>
      <p className="stock-meta tabular-nums">
        {product.sku} · alert at {product.lowStockThreshold}
      </p>
      <svg className="stock-track" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
        <rect className="stock-track-bg" width={100} height={8} rx={4} />
        <rect className="stock-track-fill" width={Math.max(percent, 4)} height={8} rx={4} />
      </svg>
    </li>
  );
}

export function LowStockList({ initial }: { initial: LowStockResponse }) {
  const { data, error, refresh } = usePolling('/api/products/low-stock', lowStockSchema, initial, LOW_STOCK_POLL_MS);
  const titleId = useId();

  return (
    <section className="tile stock-tile" aria-labelledby={titleId}>
      <header className="tile-header">
        <h2 id={titleId} className="tile-title">
          Low stock
        </h2>
        <p className="tile-meta tabular-nums">{data.products.length > 0 ? `${data.products.length} to reorder` : ''}</p>
      </header>

      {error ? (
        <InlineError
          message="Stock levels couldn’t refresh."
          requestId={error.requestId}
          lastUpdated={data.generatedAt}
          onRetry={refresh}
        />
      ) : null}

      {data.products.length > 0 ? (
        <ul className="stock-list">
          {data.products.map((product) => (
            <StockRow key={product.id} product={product} />
          ))}
        </ul>
      ) : (
        <div className="empty-state">
          <span className="check-orb" aria-hidden="true" />
          <p>Everything’s stocked</p>
        </div>
      )}
    </section>
  );
}
