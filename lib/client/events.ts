// Tiny typed event bus so unrelated widgets (the Simulate button, the pollers, the command
// palette, the orders table) can talk without prop drilling or a global store.
import { z } from 'zod';
import type { OrderStatus, OrderSummary } from '@/types';
import { orderStatusSchema } from '@/lib/validation/orders';
import { orderSummarySchema } from '@/lib/validation/responses';

const REFRESH_EVENT = 'pulse:refresh';
const RUSH_EVENT = 'pulse:rush';
const SIMULATE_EVENT = 'pulse:simulate';
const ORDERS_STATUS_EVENT = 'pulse:orders-status';
const PALETTE_EVENT = 'pulse:palette';

const rushDetail = z.array(orderSummarySchema);
const statusDetail = z.object({ status: orderStatusSchema.optional() });

function listen(name: string, listener: (event: Event) => void): () => void {
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}

/** Ask every live widget to refetch now instead of waiting for its next poll. */
export function requestDashboardRefresh(): void {
  window.dispatchEvent(new Event(REFRESH_EVENT));
}

export const onDashboardRefresh = (listener: () => void): (() => void) => listen(REFRESH_EVENT, listener);

/** A rush was simulated: RUSH MODE visuals start and the ticker shows these orders. */
export function announceRush(orders: OrderSummary[]): void {
  window.dispatchEvent(new CustomEvent<OrderSummary[]>(RUSH_EVENT, { detail: orders }));
}

export function onRush(listener: (orders: OrderSummary[]) => void): () => void {
  return listen(RUSH_EVENT, (event) => {
    if (!(event instanceof CustomEvent)) return;
    const parsed = rushDetail.safeParse(event.detail);
    if (parsed.success) listener(parsed.data);
  });
}

/** Command palette → Simulate button. */
export function requestSimulate(): void {
  window.dispatchEvent(new Event(SIMULATE_EVENT));
}

export const onSimulateRequest = (listener: () => void): (() => void) => listen(SIMULATE_EVENT, listener);

/** Command palette → orders table: filter by status (undefined = all). */
export function requestOrdersStatus(status: OrderStatus | undefined): void {
  window.dispatchEvent(new CustomEvent(ORDERS_STATUS_EVENT, { detail: { status } }));
}

export function onOrdersStatus(listener: (status: OrderStatus | undefined) => void): () => void {
  return listen(ORDERS_STATUS_EVENT, (event) => {
    if (!(event instanceof CustomEvent)) return;
    const parsed = statusDetail.safeParse(event.detail);
    if (parsed.success) listener(parsed.data.status);
  });
}

/** Header button → command palette. */
export function requestPalette(): void {
  window.dispatchEvent(new Event(PALETTE_EVENT));
}

export const onPaletteRequest = (listener: () => void): (() => void) => listen(PALETTE_EVENT, listener);
