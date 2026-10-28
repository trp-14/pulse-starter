'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OrdersPage, OrdersQuery } from '@/types';
import { ApiRequestError, fetchJson, isAbortError } from '@/lib/client/fetch-json';
import { DEFAULT_ORDERS_QUERY } from '@/lib/validation/orders';
import { ordersPageSchema } from '@/lib/validation/responses';

export function toOrdersSearchParams(query: OrdersQuery): string {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.q) params.set('q', query.q);
  if (query.page !== 1) params.set('page', String(query.page));
  if (query.pageSize !== DEFAULT_ORDERS_QUERY.pageSize) params.set('pageSize', String(query.pageSize));
  if (query.sort !== DEFAULT_ORDERS_QUERY.sort) params.set('sort', query.sort);
  if (query.dir !== DEFAULT_ORDERS_QUERY.dir) params.set('dir', query.dir);
  return params.toString();
}

export function ordersUrl(query: OrdersQuery): string {
  const search = toOrdersSearchParams(query);
  return search ? `/api/orders?${search}` : '/api/orders';
}

export const hasActiveFilters = (query: OrdersQuery): boolean =>
  Boolean(query.status || query.from || query.to || query.q);

/** Orders table state. Fetches are triggered by user events, never by effects. */
export function useOrdersTable(initialPage: OrdersPage) {
  const [query, setQuery] = useState<OrdersQuery>(DEFAULT_ORDERS_QUERY);
  const [page, setPage] = useState<OrdersPage>(initialPage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const load = useCallback(async (next: OrdersQuery) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setQuery(next);
    setLoading(true);
    setError(null);
    try {
      setPage(await fetchJson(ordersUrl(next), ordersPageSchema, { signal: controller.signal }));
    } catch (caught) {
      if (controller.signal.aborted && isAbortError(caught)) return;
      setError(caught instanceof ApiRequestError ? caught : new ApiRequestError(0, 'We couldn’t load orders.', null, null));
    } finally {
      if (controllerRef.current === controller) setLoading(false);
    }
  }, []);

  return {
    query,
    page,
    loading,
    error,
    /** Changing a filter always goes back to page 1. */
    filter: (patch: Partial<OrdersQuery>) => load({ ...query, ...patch, page: 1 }),
    goToPage: (pageNumber: number) => load({ ...query, page: pageNumber }),
    retry: () => load(query),
    clear: () => load(DEFAULT_ORDERS_QUERY),
    refresh: () => load(query),
  };
}
