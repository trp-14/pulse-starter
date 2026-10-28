import 'server-only';
import { z } from 'zod';
import { apiError } from './http';

export const MAX_JSON_BODY_BYTES = 1_024;

const urlHeader = z.url().max(2_048);
/** `application/json`, optionally with `charset=utf-8`; parsed by splitting, not by regex. */
const jsonContentType = z
  .string()
  .max(100)
  .refine((value) => {
    const [mediaType, ...parameters] = value.split(';').map((part) => part.trim().toLowerCase());
    return mediaType === 'application/json' && parameters.every((parameter) => parameter === 'charset=utf-8');
  });
const contentLength = z.coerce.number().int().min(0);

function hostOf(value: string | null): string | null {
  const parsed = urlHeader.safeParse(value);
  return parsed.success ? new URL(parsed.data).host : null;
}

/**
 * CSRF / cross-origin guard for write endpoints. The browser-set `Origin` (or `Referer`
 * when Origin is absent) must name this app's own host; requests with neither are rejected.
 */
export function rejectCrossOrigin(request: Request, requestId: string): Response | null {
  const ownHost = new URL(request.url).host;
  if (request.headers.get('sec-fetch-site') === 'cross-site') return forbidden(requestId);
  const origin = request.headers.get('origin');
  const sourceHost = origin === null ? hostOf(request.headers.get('referer')) : hostOf(origin);
  return sourceHost === ownHost ? null : forbidden(requestId);
}

const forbidden = (requestId: string) =>
  apiError(403, 'forbidden', 'This request is not allowed from this origin.', requestId);

export function requireJsonContentType(request: Request, requestId: string): Response | null {
  if (jsonContentType.safeParse(request.headers.get('content-type')).success) return null;
  return apiError(415, 'unsupported_media_type', 'Requests must be sent as application/json.', requestId);
}

const tooLarge = (requestId: string) => apiError(413, 'payload_too_large', 'The request body is too large.', requestId);

export type BodyResult = { ok: true; value: unknown } | { ok: false; response: Response };

/**
 * Reads and JSON-parses the body, never buffering more than `maxBytes`, whether or not
 * the client sent an honest Content-Length.
 */
export async function readJsonBody(request: Request, requestId: string, maxBytes = MAX_JSON_BODY_BYTES): Promise<BodyResult> {
  const declared = contentLength.safeParse(request.headers.get('content-length') ?? undefined);
  if (declared.success && declared.data > maxBytes) return { ok: false, response: tooLarge(requestId) };

  const chunks: Uint8Array[] = [];
  let size = 0;
  if (request.body) {
    const reader = request.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return { ok: false, response: tooLarge(requestId) };
      }
      chunks.push(value);
    }
  }

  const text = new TextDecoder().decode(Buffer.concat(chunks));
  try {
    return { ok: true, value: text.trim() === '' ? {} : JSON.parse(text) };
  } catch {
    return { ok: false, response: apiError(400, 'invalid_json', 'The request body must be valid JSON.', requestId) };
  }
}
