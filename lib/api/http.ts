import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { ApiErrorBody } from '@/types';
import { logger } from '@/lib/logger';
import { getRateLimiters, type RateLimiter } from '@/lib/redis';
import { searchParamsToObject } from '@/lib/validation';

export interface ApiContext {
  requestId: string;
  ip: string;
}

type Handler = (request: Request, context: ApiContext) => Promise<Response>;

const baseHeaders = (requestId: string): Record<string, string> => ({
  'Cache-Control': 'no-store',
  'X-Request-Id': requestId,
});

export function json<T>(data: T, requestId: string, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status, headers: baseHeaders(requestId) });
}

export function apiError(
  status: number,
  code: string,
  message: string,
  requestId: string,
  options: { headers?: Record<string, string>; retryAfterSeconds?: number } = {},
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = {
    error: { code, message, requestId, ...(options.retryAfterSeconds ? { retryAfterSeconds: options.retryAfterSeconds } : {}) },
  };
  return NextResponse.json(body, { status, headers: { ...baseHeaders(requestId), ...options.headers } });
}

export const badRequest = (requestId: string) =>
  apiError(400, 'invalid_request', 'The request parameters are invalid.', requestId);

/** Strict query parsing: repeated keys, unknown keys or invalid values all yield null (→ 400). */
export function parseQuery<T>(request: Request, schema: z.ZodType<T>): T | null {
  const flat = searchParamsToObject(new URL(request.url).searchParams);
  if (!flat.ok) return null;
  const parsed = schema.safeParse(flat.value);
  return parsed.success ? parsed.data : null;
}

/** For endpoints that take no parameters at all. */
export const noQuerySchema = z.object({}).strict();

// Vercel overwrites these headers at its edge, so clients can't spoof them there.
const ipHeader = z
  .string()
  .max(64)
  .regex(/^[0-9a-fA-F:.]+$/);

export function getClientIp(request: Request): string {
  const candidates = [request.headers.get('x-real-ip'), request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()];
  for (const candidate of candidates) {
    const parsed = ipHeader.safeParse(candidate);
    if (parsed.success) return parsed.data;
  }
  return 'unknown';
}

/** Returns a 429 response when the limiter rejects, otherwise null. */
export async function enforceRateLimit(
  limiter: RateLimiter,
  context: ApiContext,
  message: string,
  failOpen: boolean,
): Promise<NextResponse<ApiErrorBody> | null> {
  try {
    const result = await limiter.limit(context.ip);
    if (result.success) return null;
    const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    return apiError(429, 'rate_limited', message, context.requestId, {
      retryAfterSeconds,
      headers: { 'Retry-After': String(retryAfterSeconds) },
    });
  } catch (error) {
    logger.warn('Rate limiter unavailable', context.requestId, { error, failOpen });
    return failOpen ? null : apiError(503, 'unavailable', 'Service is busy. Please try again shortly.', context.requestId);
  }
}

/**
 * Wraps a route handler: request ID, general per-IP rate limit, and a catch-all that
 * logs details server-side but only ever returns a generic message to the client.
 */
export function apiRoute(handler: Handler): (request: Request) => Promise<Response> {
  return async (request) => {
    const context: ApiContext = { requestId: crypto.randomUUID(), ip: getClientIp(request) };
    try {
      const limited = await enforceRateLimit(
        getRateLimiters().api,
        context,
        'Too many requests. Please slow down and try again shortly.',
        true,
      );
      return limited ?? (await handler(request, context));
    } catch (error) {
      logger.error('Unhandled API error', context.requestId, { error, path: new URL(request.url).pathname });
      return apiError(500, 'internal_error', 'Something went wrong. Please try again.', context.requestId);
    }
  };
}

/** Handler for every method a route does not support: 405 with an `Allow` header. */
export function methodNotAllowed(allow: readonly string[]): () => Promise<Response> {
  return async () => {
    const requestId = crypto.randomUUID();
    return apiError(405, 'method_not_allowed', 'This method is not allowed for this endpoint.', requestId, {
      headers: { Allow: allow.join(', ') },
    });
  };
}
