'use client';

import { useRef } from 'react';
import { gsap, MOTION, useGSAP } from '@/hooks/useGsap';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useRushMode } from '@/hooks/useRushMode';
import { formatCurrency } from '@/lib/format';

const STATIC_LIMIT = 6;

/**
 * RUSH MODE ticker: a glass bar (glass look without backdrop-filter, which is reserved for the header,
 * KPI cards, tooltips and palette) that scrolls the incoming orders across for ~8s, then eases away.
 * It lives in the header's reserved middle space (a floating overlay on mobile), so nothing shifts.
 * Reduced motion: it fades in as a static list.
 */
export function RushTicker() {
  const rush = useRushMode();
  const reduced = useReducedMotion();
  const barRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const bar = barRef.current;
      if (!bar) return;
      if (!rush.active) {
        gsap.to(bar, { autoAlpha: 0, y: reduced ? 0 : -16, duration: reduced ? MOTION.fade : 0.6, ease: 'power2.in' });
        return;
      }
      gsap.fromTo(
        bar,
        { autoAlpha: 0, y: reduced ? 0 : -16 },
        { autoAlpha: 1, y: 0, duration: reduced ? MOTION.fade : 0.5, ease: 'power3.out' },
      );
      const track = trackRef.current;
      const viewport = viewportRef.current;
      if (reduced || !track || !viewport) return;
      gsap.fromTo(
        track,
        { x: viewport.clientWidth },
        { x: -track.scrollWidth, duration: MOTION.rushMs / 1000, ease: 'none' },
      );
    },
    { dependencies: [rush.active, rush.run, reduced], scope: barRef, revertOnUpdate: true },
  );

  const orders = reduced ? rush.orders.slice(0, STATIC_LIMIT) : rush.orders;
  const hidden = reduced ? rush.orders.length - orders.length : 0;

  return (
    <div ref={barRef} className="rush-ticker glass-lite" aria-hidden={!rush.active} role="status">
      <span className="rush-label btn-gloss" aria-hidden="true">
        Rush mode
      </span>
      <span className="sr-only">{rush.active ? `Rush mode: ${rush.orders.length} new orders` : ''}</span>
      <div className={reduced ? 'rush-viewport is-static' : 'rush-viewport'} ref={viewportRef} aria-hidden="true">
        <ul className="rush-track" ref={trackRef}>
          {orders.map((order) => (
            <li key={order.id} className="rush-chip tabular-nums">
              <strong>{order.customerName}</strong> {formatCurrency(order.total)}
            </li>
          ))}
          {hidden > 0 ? <li className="rush-chip">+{hidden} more</li> : null}
        </ul>
      </div>
    </div>
  );
}
