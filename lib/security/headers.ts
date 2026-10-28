// Security headers. Static ones are applied to every response by next.config.ts; the CSP needs a
// fresh nonce per request, so proxy.ts builds it. Pure functions, so they're unit-tested directly.

/**
 * Content-Security-Policy with a per-request nonce.
 * - script-src: only scripts carrying this request's nonce ('strict-dynamic' lets them load
 *   Next's chunks). Development additionally needs 'unsafe-eval' for React Refresh.
 * - style-src: stylesheets from 'self' + nonce'd <style>. GSAP and React change styles through the
 *   CSSOM (element.style), which CSP does not block; server-rendered markup has no style attributes.
 *   Development uses 'unsafe-inline' instead of a nonce (a nonce would make browsers ignore it).
 */
export function buildCsp(nonce: string, isDev: boolean): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    isDev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  return directives.join('; ');
}

/** 128 bits from the platform CSPRNG, base64-encoded. */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

const PERMISSIONS_POLICY = [
  'accelerometer=()',
  'browsing-topics=()',
  'camera=()',
  'display-capture=()',
  'geolocation=()',
  'gyroscope=()',
  'magnetometer=()',
  'microphone=()',
  'midi=()',
  'payment=()',
  'usb=()',
  'xr-spatial-tracking=()',
].join(', ');

/** Headers that are the same for every response. */
export const STATIC_SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  // Legacy twin of frame-ancestors 'none' for older browsers and scanners.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];
