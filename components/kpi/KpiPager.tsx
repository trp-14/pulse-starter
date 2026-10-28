'use client';

import { useEffect, useState, type RefObject } from 'react';
import { prefersReducedMotion } from '@/hooks/useReducedMotion';

/**
 * Mobile page indicator for the swipeable KPI row: a gloss pill for the card in view, inset dots
 * for the rest. Each dot is a button that scrolls its card into view. Hidden on wider screens.
 */
export function KpiPager({ rowRef, labels }: { rowRef: RefObject<HTMLElement | null>; labels: string[] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const cards = Array.from(row.querySelectorAll<HTMLElement>('.kpi'));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setCurrent(cards.indexOf(entry.target as HTMLElement));
        }
      },
      { root: row, threshold: 0.6 },
    );
    for (const card of cards) observer.observe(card);
    return () => observer.disconnect();
  }, [rowRef]);

  const show = (index: number) => {
    rowRef.current?.querySelectorAll<HTMLElement>('.kpi').item(index)?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  };

  return (
    <div className="kpi-pager" role="group" aria-label="Key metric cards">
      {labels.map((label, index) => (
        <button
          key={label}
          type="button"
          className={index === current ? 'kpi-pager-dot is-current' : 'kpi-pager-dot'}
          aria-label={`Show ${label}`}
          aria-current={index === current ? 'true' : undefined}
          onClick={() => show(index)}
        />
      ))}
    </div>
  );
}
