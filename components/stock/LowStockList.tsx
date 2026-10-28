'use client';

import { useId, useRef, useState } from 'react';
import type { LowStockProduct, LowStockResponse } from '@/types';
import { gsap, useGSAP } from '@/hooks/useGsap';
import { usePolling } from '@/hooks/usePolling';
import { useReducedMotion } from '@/hooks/useReducedMotion';
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
      <span className="stock-ring" aria-hidden="true" />
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
  const listRef = useRef<HTMLUListElement>(null);
  const reduced = useReducedMotion();
  const [previous, setPrevious] = useState(data.products);
  const [crossed, setCrossed] = useState<ReadonlySet<number>>(new Set());
  const [announcement, setAnnouncement] = useState('');

  // A product that wasn't on the list before has just crossed its threshold.
  if (previous !== data.products) {
    const known = new Set(previous.map((product) => product.id));
    const fresh = data.products.filter((product) => !known.has(product.id));
    setPrevious(data.products);
    setCrossed(new Set(fresh.map((product) => product.id)));
    setAnnouncement(fresh.length > 0 ? `Low stock: ${fresh.map((product) => product.name).join(', ')}` : '');
  }

  // Gentle shake + a single red ring pulse, once per crossing. Never loops.
  useGSAP(
    () => {
      if (crossed.size === 0 || !listRef.current) return;
      const rows = gsap.utils
        .toArray<HTMLElement>('.stock-row', listRef.current)
        .filter((row) => crossed.has(Number(row.dataset.productId)));
      const rings = rows.map((row) => row.querySelector('.stock-ring'));
      if (reduced) {
        gsap.fromTo(rings, { opacity: 0.9 }, { opacity: 0, duration: 1.2, ease: 'sine.out' });
        return;
      }
      gsap.fromTo(rows, { x: 0 }, { keyframes: { x: [0, -5, 5, -3, 3, 0] }, duration: 0.5, ease: 'sine.inOut' });
      gsap.fromTo(rings, { opacity: 0.9, scale: 0.96 }, { opacity: 0, scale: 1.06, duration: 1.1, ease: 'sine.out', delay: 0.1 });
    },
    { dependencies: [crossed], scope: listRef },
  );

  return (
    <section className="tile stock-tile" aria-labelledby={titleId} data-reveal>
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

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {data.products.length > 0 ? (
        <ul className="stock-list" ref={listRef}>
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
