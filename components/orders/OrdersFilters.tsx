'use client';

import { useEffect, useRef, useState } from 'react';
import { ORDER_STATUSES, type OrderStatus, type OrdersQuery } from '@/types';
import { MAX_SEARCH_LENGTH } from '@/lib/validation/orders';
import { statusLabel } from './StatusPill';

const SEARCH_DEBOUNCE_MS = 300;
const STATUS_OPTIONS: ReadonlyArray<OrderStatus | undefined> = [undefined, ...ORDER_STATUSES];

interface OrdersFiltersProps {
  query: OrdersQuery;
  onFilter: (patch: Partial<OrdersQuery>) => void;
}

export function OrdersFilters({ query, onFilter }: OrdersFiltersProps) {
  const [search, setSearch] = useState(query.q ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onSearch = (value: string) => {
    setSearch(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onFilter({ q: value.trim() || undefined }), SEARCH_DEBOUNCE_MS);
  };

  return (
    <div className="orders-filters">
      <fieldset className="segmented" aria-label="Filter by status">
        <legend className="sr-only">Status</legend>
        {STATUS_OPTIONS.map((status) => (
          <label key={status ?? 'all'} className="segmented-option">
            <input
              type="radio"
              name="order-status"
              value={status ?? ''}
              checked={query.status === status}
              onChange={() => onFilter({ status })}
            />
            <span>{status ? statusLabel(status) : 'All'}</span>
          </label>
        ))}
      </fieldset>

      <label className="field">
        <span className="field-label">Search customer</span>
        <input
          type="search"
          value={search}
          maxLength={MAX_SEARCH_LENGTH}
          placeholder="e.g. Hartono"
          autoComplete="off"
          onChange={(event) => onSearch(event.target.value)}
        />
      </label>

      <label className="field">
        <span className="field-label">From</span>
        <input
          type="date"
          value={query.from ?? ''}
          max={query.to}
          onChange={(event) => onFilter({ from: event.target.value || undefined })}
        />
      </label>

      <label className="field">
        <span className="field-label">To</span>
        <input
          type="date"
          value={query.to ?? ''}
          min={query.from}
          onChange={(event) => onFilter({ to: event.target.value || undefined })}
        />
      </label>
    </div>
  );
}
