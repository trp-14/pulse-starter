# SECURITY — Pulse

Pulse is a public demo dashboard built to hold up under SAST (ESLint security rules, SonarLint-style
checks), DAST (e.g. OWASP ZAP) and a manual pentest. This document lists what it protects, every
control, how each control is verified, and the risks that were accepted on purpose.

OWASP references use the **OWASP Top 10:2025** categories.

## Threat Model
- **Apa yang dilindungi:**
  - **Availability and integrity of the demo:** the dashboard must stay up and its data believable. Nobody should be able to flood it with orders, wipe stock, or make it unusable for the next visitor.
  - **The free-tier backends (Neon Postgres, Upstash Redis):** they must not be exhausted by scripted traffic. Exhausting them would take the demo down and could cost the owner money.
  - **Secrets:** `DATABASE_URL` and the Upstash REST token. They must never reach the browser, logs, error responses or the repository.
  - **Visitors' browsers:** no script injection, clickjacking or cross-site request forgery through the app.
- **Dari siapa:**
  - Anonymous internet users and bots: scanners, scrapers and scripted abuse of the one write endpoint (`POST /api/simulate`).
  - Malicious third-party sites trying to make a visitor's browser call the API (CSRF) or frame the app (clickjacking).
  - Out of scope: a compromised hosting provider, a compromised owner machine, or volumetric DDoS (left to Vercel's edge).
- **Asumsi:** public demo, data sintetis, tanpa login.
  - All data is synthetic (fictional products, customer names and orders); there is no PII and no payment data.
  - Production runs on Vercel, which sets `x-real-ip` / `x-forwarded-for` at its edge, so client IPs can be trusted there.
  - Production has `DATABASE_URL` and Upstash configured. Mock mode (no env vars) is for local development only.

## Controls (map ke OWASP Top 10)
| Control | Spec section | OWASP | Diverifikasi oleh |
|---|---|---|---|
| Every API route accepts only its intended method; anything else returns **405** with an `Allow` header. Pages accept only GET/HEAD (no server actions), enforced in `proxy.ts`. `OPTIONS` returns 405 (no CORS). | HTTP methods | A01 Broken Access Control, A02 Security Misconfiguration | `tests/api-routes.test.ts`, `tests/simulate.test.ts`, `tests/security-headers.test.ts` (proxy), `curl -X POST /` → 405 |
| GET for reads, POST for the single write. No sensitive data in query strings (only filters and pagination). | HTTP methods | A01 | Code review of `app/api/**/route.ts` |
| **Strict zod validation** of every input: query (`.strict()`, unknown keys rejected, repeated keys rejected, enums, `q` ≤ 100 chars, `pageSize` ≤ 100, `page` ≤ 10,000, date range ≤ 31 days, ISO dates), body (`.strict()`, `count` 10–20), headers used (`Content-Type`, `Origin`/`Referer`, client IP) and the theme cookie. Invalid input → generic 400. | Input & data | A05 Injection, A06 Insecure Design | `tests/validation.test.ts`, `tests/api-routes.test.ts`, `tests/simulate.test.ts` |
| **Parameterized SQL only**: Neon tagged templates (values always sent as parameters). Sortable columns come from a zod enum mapped to fixed SQL fragments (no `sql.unsafe`, no string building). `ILIKE` input escapes `\ % _`. | Input & data | A05 Injection | `lib/db/neon-repository.ts` review; manual scan: 0 `sql.unsafe`, 0 string-built SQL. The only raw SQL text is the seed script executing the repo's own static `db/schema.sql` (no user input). |
| **Timeouts on every external call**: Postgres `SET LOCAL statement_timeout = 5000` in every transaction + 8s HTTP abort; Redis 1.5s abort + 1 retry; rate limiter timeout 1.5s; browser fetches 10s. | Input & data | A10 Mishandling of Exceptional Conditions, A06 | Code review (`neon-repository.ts`, `lib/redis/upstash.ts`, `lib/client/fetch-json.ts`) |
| **No `dangerouslySetInnerHTML`, `eval`, `new Function`**, enforced by ESLint (`react/no-danger`, `no-eval`, `no-implied-eval`, `no-new-func`). Zod runs `jitless`, so not even a probing `new Function` happens in the browser. | Input & data | A05 Injection (XSS) | `npm run lint`; manual scan (0 hits); CDP runtime check: 0 CSP violations |
| **CSRF / cross-origin guard** on `POST /api/simulate`: `Origin` (or `Referer` fallback) must match the app's own host; requests with neither, with `Origin: null`, or with `Sec-Fetch-Site: cross-site` → 403. | Write endpoint protection | A01 Broken Access Control | `tests/simulate.test.ts` (4 rejection cases + Referer fallback) |
| `Content-Type: application/json` required on the write endpoint (HTML forms cannot send it cross-site without a CORS preflight, which is denied) → 415 otherwise. | Write endpoint protection | A01, A05 | `tests/simulate.test.ts` (3 cases) |
| **Request body size limit**: 1 KB, enforced while streaming (works even without or with a false `Content-Length`) → 413. | Write endpoint protection | A06 Insecure Design, A10 | `tests/simulate.test.ts` |
| **Write rate limit**: 5 simulations/min per IP (Upstash sliding window) + hard cap of 20 orders per request. Fails **closed** (503) if Redis is unreachable. | Write endpoint protection | A06 Insecure Design | `tests/rate-limit.test.ts` (6th call → 429 + `Retry-After`, per-IP isolation) |
| **General rate limit** on every API route: 60 requests/min per IP → **429 + `Retry-After`**. Fails open (availability) if Redis is unreachable. Clients back off by `Retry-After`. | Rate limiting | A06 Insecure Design | `tests/rate-limit.test.ts` (61st call → 429), `tests/cache.test.ts` (poll back-off) |
| **Content-Security-Policy with a per-request nonce** (`proxy.ts`): `default-src 'self'`; `script-src 'self' 'nonce-…' 'strict-dynamic'`; `style-src 'self' 'nonce-…'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`; `connect-src 'self'`; `font-src 'self'` (fonts self-hosted by `next/font`). No `unsafe-inline`/`unsafe-eval` in production. Server-rendered HTML contains no `style` attributes; GSAP/React change styles through the CSSOM. | Security headers | A05 Injection (XSS), A02 Security Misconfiguration | `tests/security-headers.test.ts`; Chrome DevTools Protocol run with a `securitypolicyviolation` listener: **0 violations** during load, rush mode and palette use (a deliberate positive control is caught) |
| `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone, geolocation, payment, usb, sensors, topics… all disabled), `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `X-Frame-Options: DENY`. | Security headers | A02 Security Misconfiguration, A04 Cryptographic Failures (HSTS) | `tests/security-headers.test.ts`; `curl -I` against `next start` |
| `poweredByHeader: false` (no `X-Powered-By`). | Security headers | A02 | `tests/security-headers.test.ts`; `curl -I` |
| **`Cache-Control: no-store`** on every API response (route wrapper and `next.config` headers), including 4xx/5xx and 405. | Security headers | A02, A04 | `tests/api-routes.test.ts`, `tests/simulate.test.ts`, `tests/security-headers.test.ts` |
| **Same-origin only**: no `Access-Control-Allow-Origin` header anywhere; preflights get 405. | Security headers (CORS) | A01, A02 | `tests/security-headers.test.ts`; manual scan |
| **Generic errors + request ID**: clients only ever see a fixed message, an error code and a request ID (`X-Request-Id` header and body). Stack traces, SQL errors and internals go to the server log only. Unknown `/api/*` paths return the same JSON shape (404). Custom `not-found`, `error` and `global-error` pages show a generic message and an opaque digest. | Errors & logging | A10 Mishandling of Exceptional Conditions, A09 | `tests/api-routes.test.ts`, `tests/security-headers.test.ts` (API 404) |
| **Structured server logs** (`lib/logger.ts`): JSON lines, always with the request ID; keys that look like secrets (`token`, `password`, `authorization`, `cookie`, `database_url`, `connection`…) are redacted at any depth; no `console.*` in app code (ESLint `no-console`). | Errors & logging | A09 Logging & Alerting Failures | `tests/logger.test.ts`; `npm run lint` |
| **A failing dependency never takes the page down**: first paint loads each tile independently; a failed tile is logged and rendered as a skeleton that loads on the client. Cache outages fall back to the database. | Errors & logging | A10 Mishandling of Exceptional Conditions | `tests/cache.test.ts` (Redis down); code review (`app/(dashboard)/page.tsx`, `components/ui/Deferred.tsx`) |
| **Env validated with zod at startup** (`instrumentation.ts` → `lib/env.ts`): malformed values fail fast with a message naming the variable, never its value. Empty values select mock mode. | Secrets & config | A02 Security Misconfiguration | `npm run db:seed` with an invalid `DATABASE_URL` → clear failure without the value |
| **`server-only`** in `lib/env.ts`, `lib/db/*`, `lib/redis/*`, `lib/logger.ts`, `lib/api/*`, `lib/services/*`: importing them from client code fails the build. No `NEXT_PUBLIC_` variables. `.env*` ignored by git (except `.env.example`). | Secrets & config | A04 Cryptographic Failures (secret exposure), A02 | `npm run build`; manual scan (0 `NEXT_PUBLIC_`); `.gitignore` |
| **Cached values are re-validated** with zod when read back from Redis (a tampered or stale-shape entry counts as a miss). | Input & data | A08 Software or Data Integrity Failures | `tests/cache.test.ts` |
| **Minimal, audited dependencies**: lockfile kept; `npm audit` clean; ESLint with `eslint-plugin-security` and `eslint-plugin-sonarjs` clean; `vitest` pinned to a patched release (4.1.12; ≤ 4.1.10 had critical advisories). | Dependencies & static analysis | A03 Software Supply Chain Failures | `npm audit --omit=dev` → 0; `npm run lint` → 0 problems |

## Accepted Risks
- No authentication (public demo, synthetic data) — alasan + cara menambah auth di real store (session cookie httpOnly/Secure/SameSite, role-based access untuk write endpoint)
  - **Why it is acceptable here:** the dashboard is a portfolio demo with fictional data. Anyone may look at it, and the only write action (simulating orders) is harmless, capped per request and rate-limited per IP.
  - **How a real store would add it:** server-side sessions (e.g. Auth.js or a managed IdP) stored in an `HttpOnly; Secure; SameSite=Lax` cookie (`__Host-` prefix), checked in `proxy.ts` for pages and in the API route wrapper for every endpoint. Role-based access: viewers can read; only an `operator`/`admin` role can call write endpoints. Writes keep the existing Origin + JSON content-type checks, plus a per-session CSRF token or a SameSite=Strict cookie. Rate limits move from per-IP to per-user. Auth events (login, failed login, role changes) are logged with the request ID.
- **Client IP trust:** rate limits key on `x-real-ip` / the first `x-forwarded-for` entry. On Vercel these are set by the edge and cannot be spoofed. Behind a different proxy they could be, which would let a client dodge per-IP limits. Mitigation if re-hosted: only trust the header your proxy sets.
- **General rate limiter fails open:** if Upstash is unreachable, the 60/min limit is skipped so the dashboard keeps working. The write endpoint's limiter fails closed instead (503).
- **Mock mode has no rate limiting** (no-op limiter, per the spec) and keeps data in memory per server instance. It exists for local development only; production must have the Upstash and Neon variables set.
- **The theme cookie (`pulse-theme`) is readable by JavaScript** (not `HttpOnly`) because the client sets it. It holds only `day` or `night`, is validated with a zod enum on the server, and carries no authority.
- **`img-src` allows `data:` and `blob:`**, reserved for future inline icons/exports; no user-controlled URLs are ever rendered.
- **HSTS `preload`** is sent. Submitting the domain to the preload list is a separate, manual and hard-to-undo step. Only do it once every subdomain serves HTTPS.
- **The seed script runs raw SQL text** from `db/schema.sql` (static, version-controlled DDL, no input). It is a CLI tool and is never deployed as an endpoint.
- **Volumetric DDoS** is out of scope for the app; it relies on Vercel's platform protection. App-level limits only stop single-IP abuse.

## Static & Dynamic Analysis
- ESLint (`eslint-plugin-security`, `eslint-plugin-sonarjs`): `npm run lint` → **0 errors, 0 warnings**, with `next/core-web-vitals`, `next/typescript`, `security/recommended`, `sonarjs/recommended`, plus `no-console`, `@typescript-eslint/no-explicit-any`, `react/no-danger`, `no-eval`, `no-implied-eval`, `no-new-func` and a ban on `d3`/`d3-selection` imports. Findings fixed along the way included nested template literals in SQL code, an unsafe regex in Content-Type parsing (replaced by splitting) and generic object-injection sinks (replaced by `Map`/`switch`).
- `npm audit --omit=dev`: **0 vulnerabilities** (full `npm audit`, including dev dependencies: also 0).
- Semgrep: **not available** on the build machine (no `semgrep`, `pipx` or Docker). Installing it would have meant changing the system outside the project, which this build did not do. Run it before release: `pipx run semgrep --config auto` or `docker run --rm -v "$PWD:/src" semgrep/semgrep semgrep --config auto`.
- Additional checks done instead:
  - A manual pattern scan of all source files (0 hits for `dangerouslySetInnerHTML`, `eval(`, `innerHTML`, `document.write`, `console.*`, `sql.unsafe`, `any`, `@ts-ignore`, `eslint-disable`, `Access-Control-Allow-Origin`, `NEXT_PUBLIC_`, `Math.random`).
  - `tsc --noEmit` in strict mode with `noUncheckedIndexedAccess`.
  - 125 Vitest tests, including the security suite: validation, 405 + `Allow`, cross-origin POST rejection, 415/413, 429 + `Retry-After`, CSP/headers, logger redaction.
  - A real-browser run over the Chrome DevTools Protocol under the production CSP, with a `securitypolicyviolation` listener: 0 violations.
- DAST: an OWASP ZAP baseline scan was not run here (no Docker). Recommended against the deployed URL: `docker run -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t https://<your-domain>`.

## Reporting a Vulnerability
Please report security issues privately. Do not open a public issue.

- Use GitHub's **"Report a vulnerability"** (private security advisory) on this repository, or email **security@&lt;your-domain&gt;** *(owner: replace with a real address before publishing)*.
- Include the affected URL or endpoint, steps to reproduce, the impact you observed, and any request IDs from the responses (`X-Request-Id`).
- Expect an acknowledgement within 3 working days and a fix or mitigation plan within 14 days for confirmed issues. Please allow that time before any public disclosure.
- In scope: this application and its API. Out of scope: volumetric DoS, social engineering, the hosting providers themselves, and reports that only list missing best-practice headers without a demonstrated impact.
