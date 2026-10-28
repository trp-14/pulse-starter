'use client';

import { useState } from 'react';
import type { OrderSortField, OrdersPage, OrdersQuery } from '@/types';
import { formatCurrency, formatDateTime, formatInteger } from '@/lib/format';
import { InlineError } from '@/components/ui/InlineError';
import { OrdersFilters } from './OrdersFilters';
import { OrdersPagination } from './OrdersPagination';
import { StatusPill } from './StatusPill';
import { hasActiveFilters, useOrdersTable } from './use-orders-table';

interface SortHeaderProps {
  field: OrderSortField;
  label: string;
  query: OrdersQuery;
  onSort: (field: OrderSortField) => void;
  numeric?: boolean;
}

function SortHeader({ field, label, query, onSort, numeric = false }: SortHeaderProps) {
  const active = query.sort === field;
  let ariaSort: 'ascending' | 'descending' | 'none' = 'none';
  if (active) ariaSort = query.dir === 'asc' ? 'ascending' : 'descending';
  return (
    <th scope="col" aria-sort={ariaSort} className={numeric ? 'num' : undefined}>
      <button type="button" className="sort-button" onClick={() => onSort(field)}>
        {label}
        <span aria-hidden="true" className="sort-indicator">
          {active && query.dir === 'asc' ? '▲' : '▼'}
        </span>
      </button>
    </th>
  );
}

export function OrdersTable({ initial }: { initial: OrdersPage }) {
  const table = useOrdersTable(initial);
  const [resetKey, setResetKey] = useState(0);
  const { query, page, loading, error } = table;

  const onSort = (field: OrderSortField) => {
    const dir = query.sort === field && query.dir === 'desc' ? 'asc' : 'desc';
    void table.filter({ sort: field, dir });
  };

  const clearFilters = () => {
    setResetKey((key) => key + 1);
    void table.clear();
  };

  return (
    <section className="tile orders-tile" aria-labelledby="orders-title" id="orders" data-reveal>
      <header className="tile-header">
        <h2 id="orders-title" className="tile-title">
          Orders
        </h2>
        <p className="tile-meta" aria-live="polite">
          {formatInteger(page.total)} {page.total === 1 ? 'order' : 'orders'}
        </p>
      </header>

      <OrdersFilters key={resetKey} query={query} onFilter={(patch) => void table.filter(patch)} />

      {error ? (
        <InlineError message={error.message} requestId={error.requestId} onRetry={() => void table.retry()} />
      ) : null}

      {page.items.length > 0 ? (
        <div className="table-scroll">
          <table className="orders-table" aria-busy={loading}>
            <caption className="sr-only">Orders, page {page.page} of {page.totalPages}</caption>
            <thead>
              <tr>
                <th scope="col">Order</th>
                <SortHeader field="customer_name" label="Customer" query={query} onSort={onSort} />
                <th scope="col">Status</th>
                <th scope="col" className="num">
                  Items
                </th>
                <SortHeader field="total" label="Total" query={query} onSort={onSort} numeric />
                <SortHeader field="created_at" label="Placed" query={query} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {page.items.map((order) => (
                <tr key={order.id}>
                  <td className="tabular-nums">#{order.id}</td>
                  <td>{order.customerName}</td>
                  <td>
                    <StatusPill status={order.status} />
                  </td>
                  <td className="num tabular-nums">{order.itemCount}</td>
                  <td className="num tabular-nums">{formatCurrency(order.total)}</td>
                  <td className="tabular-nums">
                    <time dateTime={order.createdAt}>{formatDateTime(order.createdAt)}</time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !loading && (
          <div className="empty-state">
            <span className="search-orb" aria-hidden="true" />
            <p>No orders match these filters</p>
            {hasActiveFilters(query) ? (
              <button type="button" className="btn-gloss" onClick={clearFilters}>
                Clear filters
              </button>
            ) : null}
          </div>
        )
      )}

      <OrdersPagination
        page={page.page}
        totalPages={page.totalPages}
        disabled={loading}
        onPage={(number) => void table.goToPage(number)}
      />
    </section>
  );
}
