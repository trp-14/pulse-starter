'use client';

import { useId, useState } from 'react';
import type { OrderSummary, RecentOrdersResponse } from '@/types';
import { useNow } from '@/hooks/useNow';
import { usePolling } from '@/hooks/usePolling';
import { formatCurrency, formatRelative } from '@/lib/format';
import { recentOrdersSchema } from '@/lib/validation/responses';
import { InlineError } from '@/components/ui/InlineError';
import { Avatar } from './Avatar';
import { StatusPill } from './StatusPill';

function FeedRow({ order, now }: { order: OrderSummary; now: number }) {
  return (
    <li className="feed-row" data-order-id={order.id}>
      <Avatar name={order.customerName} />
      <div className="feed-main">
        <p className="feed-name">{order.customerName}</p>
        <p className="feed-meta tabular-nums">
          #{order.id} · {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
        </p>
      </div>
      <div className="feed-side">
        <p className="feed-total tabular-nums">{formatCurrency(order.total)}</p>
        <p className="feed-time tabular-nums">
          <time dateTime={order.createdAt}>{formatRelative(order.createdAt, now)}</time>
        </p>
      </div>
      <StatusPill status={order.status} />
    </li>
  );
}

const newOrdersLabel = (count: number): string => {
  if (count === 0) return '';
  return count === 1 ? '1 new order' : `${count} new orders`;
};

export function LiveFeed({ initial }: { initial: RecentOrdersResponse }) {
  const { data, error, paused, refresh } = usePolling('/api/orders/recent', recentOrdersSchema, initial);
  const now = useNow(Date.parse(initial.generatedAt));
  const titleId = useId();
  const [previous, setPrevious] = useState(data.orders);
  const [announcement, setAnnouncement] = useState('');

  // Adjust state when the polled list changes (React's "store info from previous renders" pattern):
  // announce only what's new, never re-read the whole list to screen readers.
  if (previous !== data.orders) {
    const known = new Set(previous.map((order) => order.id));
    setPrevious(data.orders);
    setAnnouncement(newOrdersLabel(data.orders.filter((order) => !known.has(order.id)).length));
  }

  return (
    <section className="tile feed-tile" aria-labelledby={titleId}>
      <header className="tile-header">
        <h2 id={titleId} className="tile-title">
          Live orders
        </h2>
        <span className={paused ? 'live-pill is-paused' : 'live-pill'}>
          <span className="live-orb" aria-hidden="true" />
          {paused ? 'Paused' : 'Live'}
        </span>
      </header>

      {error ? (
        <InlineError
          message="The live feed couldn’t refresh."
          requestId={error.requestId}
          lastUpdated={data.generatedAt}
          onRetry={refresh}
        />
      ) : null}

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {data.orders.length > 0 ? (
        <ol className="feed-list">
          {data.orders.map((order) => (
            <FeedRow key={order.id} order={order} now={now} />
          ))}
        </ol>
      ) : (
        <p className="empty-state">No orders yet. Try “Simulate rush hour”.</p>
      )}
    </section>
  );
}
