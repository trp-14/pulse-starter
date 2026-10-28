'use client';

import { useCallback, useId, useRef, useState } from 'react';
import type { OrderSummary, RecentOrdersResponse } from '@/types';
import { Flip, gsap, MOTION, useGSAP } from '@/hooks/useGsap';
import { useNow } from '@/hooks/useNow';
import { usePolling } from '@/hooks/usePolling';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useRushMode } from '@/hooks/useRushMode';
import { formatCurrency, formatRelative } from '@/lib/format';
import { recentOrdersSchema } from '@/lib/validation/responses';
import { InlineError } from '@/components/ui/InlineError';
import { Avatar } from './Avatar';
import { StatusPill } from './StatusPill';

function FeedRow({ order, now }: { order: OrderSummary; now: number }) {
  return (
    <li className="feed-row" data-order-id={order.id} data-flip-id={`order-${order.id}`}>
      <span className="feed-flash" aria-hidden="true" />
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
  const listRef = useRef<HTMLOListElement>(null);
  const orbRef = useRef<HTMLSpanElement>(null);
  const flipState = useRef<Flip.FlipState | null>(null);
  const reduced = useReducedMotion();
  const rush = useRushMode();

  // Capture row positions right before React commits the new list (the "F" of FLIP).
  const captureRows = useCallback(() => {
    if (listRef.current) flipState.current = Flip.getState(listRef.current.querySelectorAll('.feed-row'));
  }, []);

  const { data, error, paused, refresh } = usePolling(
    '/api/orders/recent',
    recentOrdersSchema,
    initial,
    undefined,
    captureRows,
  );
  const now = useNow(Date.parse(initial.generatedAt));
  const titleId = useId();
  const [previous, setPrevious] = useState(data.orders);
  const [freshIds, setFreshIds] = useState<ReadonlySet<number>>(new Set());
  const [announcement, setAnnouncement] = useState('');

  // Adjust state when the polled list changes (React's "store info from previous renders" pattern):
  // announce only what's new, never re-read the whole list to screen readers.
  if (previous !== data.orders) {
    const known = new Set(previous.map((order) => order.id));
    const fresh = data.orders.filter((order) => !known.has(order.id)).map((order) => order.id);
    setPrevious(data.orders);
    setFreshIds(new Set(fresh));
    setAnnouncement(newOrdersLabel(fresh.length));
  }

  // New orders: existing rows slide to their new place, new rows slide in from the top with an
  // aqua highlight that fades out. Reduced motion → new rows simply fade in.
  useGSAP(
    () => {
      const state = flipState.current;
      flipState.current = null;
      const list = listRef.current;
      if (!list || freshIds.size === 0) return;
      const fresh = gsap.utils
        .toArray<HTMLElement>('.feed-row', list)
        .filter((row) => freshIds.has(Number(row.dataset.orderId)));

      if (reduced || !state) {
        gsap.fromTo(fresh, { opacity: 0 }, { opacity: 1, duration: MOTION.fade });
        return;
      }
      Flip.from(state, {
        targets: list.querySelectorAll('.feed-row'),
        duration: MOTION.flip,
        ease: 'power3.out',
        onEnter: (elements) =>
          gsap.fromTo(elements, { opacity: 0, y: -24 }, { opacity: 1, y: 0, duration: MOTION.flip, ease: 'power3.out' }),
      });
      gsap.fromTo(
        fresh.map((row) => row.querySelector('.feed-flash')),
        { opacity: 1 },
        { opacity: 0, duration: 1.6, delay: 0.25, ease: 'sine.out' },
      );
    },
    { dependencies: [data.orders], scope: listRef },
  );

  // RUSH MODE: the LIVE orb pulses faster for the rush, then stops (never a permanent loop).
  useGSAP(
    () => {
      if (!rush.active || reduced || !orbRef.current) return;
      gsap.fromTo(
        orbRef.current,
        { scale: 1 },
        { scale: 1.45, duration: 0.32, ease: 'sine.inOut', yoyo: true, repeat: Math.round(MOTION.rushMs / 320) },
      );
    },
    { dependencies: [rush.active, rush.run, reduced], revertOnUpdate: true },
  );

  return (
    <section className="tile feed-tile" aria-labelledby={titleId} data-reveal>
      <header className="tile-header">
        <h2 id={titleId} className="tile-title">
          Live orders
        </h2>
        <span className={paused ? 'live-pill is-paused' : 'live-pill'}>
          <span className="live-orb" ref={orbRef} aria-hidden="true" />
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
        // Focusable so keyboard users can scroll it when the 10 rows don't fit the tile.
        <div className="feed-scroll" tabIndex={0} role="region" aria-label="Newest orders">
          <ol className="feed-list" ref={listRef}>
            {data.orders.map((order) => (
              <FeedRow key={order.id} order={order} now={now} />
            ))}
          </ol>
        </div>
      ) : (
        <p className="empty-state">No orders yet. Try “Simulate rush hour”.</p>
      )}
    </section>
  );
}
