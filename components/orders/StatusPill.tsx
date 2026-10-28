import type { OrderStatus } from '@/types';

export function statusLabel(status: OrderStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'paid':
      return 'Paid';
    case 'shipped':
      return 'Shipped';
    case 'cancelled':
      return 'Cancelled';
  }
}

export function StatusPill({ status }: { status: OrderStatus }) {
  return <span className={`status-pill status-${status}`}>{statusLabel(status)}</span>;
}
