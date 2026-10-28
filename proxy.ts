// Next.js 16 "proxy" (the renamed middleware convention). Runs before every page and API request:
// - builds a per-request CSP nonce, hands it to Next via the request header (Next reads the nonce
//   from it for its own scripts) and sends the CSP to the browser on the response;
// - pages only answer GET/HEAD (this app has no server actions): anything else is 405 + Allow.
// Static security headers are set in next.config.ts; rate limiting lives in the API route wrapper.
import { NextResponse, type NextRequest } from 'next/server';
import { buildCsp, createNonce } from '@/lib/security/headers';

const PAGE_METHODS = ['GET', 'HEAD'];

export function proxy(request: NextRequest): NextResponse {
  const isApi = request.nextUrl.pathname.startsWith('/api/');

  if (!isApi && !PAGE_METHODS.includes(request.method)) {
    return new NextResponse(null, {
      status: 405,
      headers: { Allow: PAGE_METHODS.join(', '), 'Cache-Control': 'no-store' },
    });
  }

  const nonce = createNonce();
  const csp = buildCsp(nonce, process.env.NODE_ENV === 'development');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Everything except hashed static assets and the icon; skip link prefetches (no HTML rendered).
      source: '/((?!_next/static|_next/image|icon.svg).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
