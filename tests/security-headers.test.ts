import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import * as catchAll from '@/app/api/[...path]/route';
import { buildCsp, createNonce, STATIC_SECURITY_HEADERS } from '@/lib/security/headers';
import { apiErrorSchema } from '@/lib/validation';
import nextConfig from '@/next.config';
import { proxy } from '@/proxy';

const directive = (csp: string, name: string): string =>
  csp
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `)) ?? '';

describe('Content-Security-Policy', () => {
  const nonce = 'abc123XYZ+/=';
  const csp = buildCsp(nonce, false);

  it('locks scripts and styles to this request’s nonce in production', () => {
    expect(directive(csp, 'script-src')).toBe(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`);
    expect(directive(csp, 'style-src')).toBe(`style-src 'self' 'nonce-${nonce}'`);
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toContain('*');
  });

  it.each([
    ['default-src', "default-src 'self'"],
    ['frame-ancestors', "frame-ancestors 'none'"],
    ['object-src', "object-src 'none'"],
    ['base-uri', "base-uri 'self'"],
    ['form-action', "form-action 'self'"],
    ['font-src', "font-src 'self'"],
    ['connect-src', "connect-src 'self'"],
  ])('sets %s', (name, expected) => {
    expect(directive(csp, name)).toBe(expected);
  });

  it('relaxes only what development tooling needs', () => {
    const dev = buildCsp(nonce, true);
    expect(directive(dev, 'script-src')).toContain("'unsafe-eval'");
    expect(directive(dev, 'connect-src')).toContain('ws:');
    expect(directive(dev, 'frame-ancestors')).toBe("frame-ancestors 'none'");
  });

  it('creates unpredictable 128-bit nonces', () => {
    const nonces = new Set(Array.from({ length: 50 }, createNonce));
    expect(nonces.size).toBe(50);
    for (const value of nonces) expect(value).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});

describe('proxy', () => {
  it('sends a nonce-based CSP and forwards the same nonce to Next', () => {
    const response = proxy(new NextRequest('http://localhost:3000/'));
    const csp = response.headers.get('Content-Security-Policy') ?? '';
    const forwarded = response.headers.get('x-middleware-request-x-nonce') ?? '';
    expect(forwarded).not.toBe('');
    expect(directive(csp, 'script-src')).toContain(`'nonce-${forwarded}'`);
    expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(csp);
  });

  it('uses a fresh nonce for every request', () => {
    const first = proxy(new NextRequest('http://localhost:3000/')).headers.get('x-middleware-request-x-nonce');
    const second = proxy(new NextRequest('http://localhost:3000/')).headers.get('x-middleware-request-x-nonce');
    expect(first).not.toBe(second);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])('rejects %s on pages with 405 + Allow', (method) => {
    const response = proxy(new NextRequest('http://localhost:3000/', { method }));
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET, HEAD');
  });

  it('leaves API method handling to the route handlers', () => {
    const response = proxy(new NextRequest('http://localhost:3000/api/simulate', { method: 'POST' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Security-Policy')).not.toBeNull();
  });
});

describe('static security headers (next.config)', () => {
  it.each([
    ['Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload'],
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['Cross-Origin-Opener-Policy', 'same-origin'],
    ['X-Frame-Options', 'DENY'],
  ])('%s is %s', (key, value) => {
    expect(STATIC_SECURITY_HEADERS).toContainEqual({ key, value });
  });

  it('disables powerful browser features and the X-Powered-By header', async () => {
    const permissions = STATIC_SECURITY_HEADERS.find((header) => header.key === 'Permissions-Policy')?.value ?? '';
    for (const feature of ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()']) {
      expect(permissions).toContain(feature);
    }
    expect(nextConfig.poweredByHeader).toBe(false);
    const rules = (await nextConfig.headers?.()) ?? [];
    expect(rules.find((rule) => rule.source === '/:path*')?.headers).toEqual([...STATIC_SECURITY_HEADERS]);
    expect(rules.find((rule) => rule.source === '/api/:path*')?.headers).toContainEqual({
      key: 'Cache-Control',
      value: 'no-store',
    });
  });

  it('never allows cross-origin reads (no Access-Control-Allow-Origin anywhere)', () => {
    expect(STATIC_SECURITY_HEADERS.map((header) => header.key.toLowerCase())).not.toContain(
      'access-control-allow-origin',
    );
  });
});

describe('CSP compatibility', () => {
  it('runs Zod jitless, so it never probes `new Function` (blocked by our CSP)', async () => {
    const { z } = await import('zod');
    await import('@/lib/validation');
    expect(z.config().jitless).toBe(true);
  });
});

describe('unknown API paths', () => {
  it('return a JSON 404 with no-store instead of an HTML page', async () => {
    const response = await catchAll.GET(new Request('http://localhost:3000/api/admin'));
    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(apiErrorSchema.parse(await response.json()).error.code).toBe('not_found');
  });
});
