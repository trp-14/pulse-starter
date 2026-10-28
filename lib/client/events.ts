// Tiny typed event bus so unrelated widgets (e.g. the Simulate button and the pollers)
// can talk without prop drilling or a global store.
import { z } from 'zod';
import type { OrderSummary } from '@/types';
import { orderSummarySchema } from '@/lib/validation/responses';

const REFRESH_EVENT = 'pulse:refresh';
const RUSH_EVENT = 'pulse:rush';
const rushDetail = z.array(orderSummarySchema);

/** Ask every live widget to refetch now instead of waiting for its next poll. */
export function requestDashboardRefresh(): void {
  window.dispatchEvent(new Event(REFRESH_EVENT));
}

export function onDashboardRefresh(listener: () => void): () => void {
  window.addEventListener(REFRESH_EVENT, listener);
  return () => window.removeEventListener(REFRESH_EVENT, listener);
}

/** A rush was simulated: RUSH MODE visuals start and the ticker shows these orders. */
export function announceRush(orders: OrderSummary[]): void {
  window.dispatchEvent(new CustomEvent<OrderSummary[]>(RUSH_EVENT, { detail: orders }));
}

export function onRush(listener: (orders: OrderSummary[]) => void): () => void {
  const handler = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const parsed = rushDetail.safeParse(event.detail);
    if (parsed.success) listener(parsed.data);
  };
  window.addEventListener(RUSH_EVENT, handler);
  return () => window.removeEventListener(RUSH_EVENT, handler);
}
