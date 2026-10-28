'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { z } from 'zod';
import { ApiRequestError, fetchJson, isAbortError } from '@/lib/client/fetch-json';
import { InlineError } from './InlineError';

const RETRY_MS = 5_000;

/**
 * Fetches a tile's data once on the client (retrying every 5s until it succeeds), for tiles whose
 * server-side load failed. Polling stays the tile's own job once it mounts.
 */
function useFirstLoad<T>(url: string, schema: z.ZodType<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let retry: ReturnType<typeof setTimeout> | undefined;
    fetchJson(url, schema, { signal: controller.signal })
      .then(setData)
      .catch((caught: unknown) => {
        if (controller.signal.aborted && isAbortError(caught)) return;
        setError(caught instanceof ApiRequestError ? caught : new ApiRequestError(0, 'We couldn’t load this.', null, null));
        retry = setTimeout(() => setAttempt((count) => count + 1), RETRY_MS);
      });
    return () => {
      controller.abort();
      clearTimeout(retry);
    };
  }, [url, schema, attempt]);

  return { data, error, retry: () => setAttempt((count) => count + 1) };
}

interface DeferredProps<T> {
  initial: T | null;
  url: string;
  schema: z.ZodType<T>;
  /** A skeleton shaped like the tile; the error slot renders inside it so the grid stays intact. */
  skeleton: (errorSlot: ReactNode) => ReactNode;
  children: (data: T) => ReactNode;
}

function FirstLoad<T>({ url, schema, skeleton, children }: Omit<DeferredProps<T>, 'initial'>) {
  const { data, error, retry } = useFirstLoad(url, schema);
  if (data !== null) return <>{children(data)}</>;
  return (
    <>
      {skeleton(
        error ? <InlineError message={error.message} requestId={error.requestId} onRetry={retry} /> : null,
      )}
    </>
  );
}

/** Renders the tile with server data when it exists; otherwise a skeleton until the client has it. */
export function Deferred<T>({ initial, url, schema, skeleton, children }: DeferredProps<T>) {
  if (initial !== null) return <>{children(initial)}</>;
  return <FirstLoad url={url} schema={schema} skeleton={skeleton}>{children}</FirstLoad>;
}
