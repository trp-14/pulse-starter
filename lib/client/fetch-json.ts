import type { z } from 'zod';
import { apiErrorSchema } from '@/lib/validation/responses';

export const CLIENT_TIMEOUT_MS = 10_000;

export class ApiRequestError extends Error {
  readonly status: number;
  readonly requestId: string | null;
  readonly retryAfterSeconds: number | null;

  constructor(status: number, message: string, requestId: string | null, retryAfterSeconds: number | null) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.requestId = requestId;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const GENERIC_MESSAGE = 'We couldn’t load this right now.';

/** Fetches JSON and validates it with `schema`; API errors become `ApiRequestError`. */
export async function fetchJson<T>(url: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(CLIENT_TIMEOUT_MS);
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    credentials: 'same-origin',
    signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
    headers: { Accept: 'application/json', ...init.headers },
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    const error = parsed.success ? parsed.data.error : null;
    throw new ApiRequestError(
      response.status,
      error?.message ?? GENERIC_MESSAGE,
      error?.requestId ?? response.headers.get('X-Request-Id'),
      error?.retryAfterSeconds ?? null,
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiRequestError(response.status, GENERIC_MESSAGE, response.headers.get('X-Request-Id'), null);
  }
  return parsed.data;
}

export const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError');
