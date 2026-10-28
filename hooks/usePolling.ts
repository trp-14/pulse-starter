'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { z } from 'zod';
import { ApiRequestError, fetchJson, isAbortError } from '@/lib/client/fetch-json';
import { onDashboardRefresh } from '@/lib/client/events';

export const POLL_INTERVAL_MS = 5_000;

/** Next delay: the normal interval, or the server's Retry-After when rate limited. */
export function nextPollDelay(error: ApiRequestError | null, intervalMs: number): number {
  if (error?.retryAfterSeconds) return Math.max(intervalMs, error.retryAfterSeconds * 1000);
  return intervalMs;
}

const isVisible = (): boolean => document.visibilityState === 'visible';

export interface PollingState<T> {
  data: T;
  error: ApiRequestError | null;
  /** True while the tab is hidden and polling is paused. */
  paused: boolean;
  refresh: () => void;
}

/**
 * Polls `url` every `intervalMs` while the tab is visible. Hidden tab → timer cleared and
 * in-flight request aborted; visible again → fetch immediately, then resume the interval.
 */
export function usePolling<T>(
  url: string,
  schema: z.ZodType<T>,
  initial: T,
  intervalMs: number = POLL_INTERVAL_MS,
): PollingState<T> {
  const [data, setData] = useState<T>(initial);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [paused, setPaused] = useState(false);
  const tickRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let lastError: ApiRequestError | null = null;

    const schedule = () => {
      clearTimeout(timer);
      if (isVisible()) timer = setTimeout(tick, nextPollDelay(lastError, intervalMs));
    };

    async function tick() {
      clearTimeout(timer);
      controller?.abort();
      const current = new AbortController();
      controller = current;
      try {
        setData(await fetchJson(url, schema, { signal: current.signal }));
        lastError = null;
        setError(null);
      } catch (caught) {
        if (current.signal.aborted && isAbortError(caught)) return;
        lastError = caught instanceof ApiRequestError ? caught : new ApiRequestError(0, 'We couldn’t refresh this.', null, null);
        setError(lastError);
      }
      if (controller === current) schedule();
    }

    const onVisibilityChange = () => {
      setPaused(!isVisible());
      if (isVisible()) {
        void tick();
      } else {
        clearTimeout(timer);
        controller?.abort();
      }
    };

    tickRef.current = () => void tick();
    document.addEventListener('visibilitychange', onVisibilityChange);
    const offRefresh = onDashboardRefresh(() => void tick());
    schedule();

    return () => {
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      offRefresh();
    };
  }, [url, schema, intervalMs]);

  const refresh = useCallback(() => tickRef.current(), []);
  return { data, error, paused, refresh };
}
