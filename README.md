# Pulse · Live Control Room

Pulse is a live operations dashboard for a fictional lifestyle/apparel store: today's revenue and orders, a 24-hour revenue chart, a 7 × 24 order heatmap, low-stock alerts, a live order feed and a searchable orders table, all updating in near real time. One button simulates a rush hour so you can watch it react. It is built as a portfolio piece, so it puts craft first: a "Frutiger Aero × Neumorphism" visual language with Day and Night themes, motion that only animates what changes, accessible markup, and security that holds up to SAST, DAST and a manual pentest.

**Live demo:** `<add link>`

![Pulse dashboard screenshot](docs/screenshot.png) <!-- add a screenshot -->

![Rush mode](docs/rush-mode.gif) <!-- add a short GIF of rush mode -->

## Tech stack

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router, server components, route handlers, `proxy.ts`), React 19, TypeScript (strict) |
| Styling | Tailwind CSS v4 + CSS custom properties (design tokens, Day/Night via `light-dark()`) |
| Data | PostgreSQL on Neon (`@neondatabase/serverless`, HTTP + tagged templates) |
| Cache & rate limiting | Redis on Upstash (`@upstash/redis`, `@upstash/ratelimit`) |
| Charts | D3 modules for math only (`d3-scale`, `d3-shape`, `d3-array`), React renders the SVG |
| Motion | GSAP 3 + `@gsap/react` (`useGSAP`), Flip plugin |
| Validation | zod 4 at every boundary (query, body, headers, cookies, env, cache, API responses in the browser) |
| Quality | ESLint 9 (Next, `eslint-plugin-security`, `eslint-plugin-sonarjs`), Vitest (125 tests) |
| Hosting target | Vercel (Hobby), serverless-compatible |

## Local setup

Requirements: Node.js **20.9+** (22 LTS recommended) and npm.

```bash
npm install
npm run dev          # http://localhost:3000
```

That's enough to see everything: **with no environment variables Pulse runs in mock mode**, with an in-memory store seeded with the same synthetic shop, a `Map`-based cache and a no-op rate limiter.

To use the real services:

1. Copy `.env.example` to `.env.local` and fill in:
   ```
   DATABASE_URL=              # Neon connection string (postgres://…)
   UPSTASH_REDIS_REST_URL=    # https://….upstash.io
   UPSTASH_REDIS_REST_TOKEN=
   ```
2. Create the schema and seed ~30 products and ~300 orders over the last 7 days (**this truncates the tables**):
   ```bash
   npm run db:seed
   ```
3. `npm run dev`. The data layer switches to Neon/Upstash automatically; no code changes needed.

Each service is chosen independently: `DATABASE_URL` alone gives you real Postgres with an in-memory cache. Malformed values fail at startup with a message naming the variable, never its value.

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint (incl. security + sonarjs rules) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest suite (validation, 405s, cross-origin, 429, CSP, contrast, data layer…) |
| `npm run db:seed` | Apply `db/schema.sql` and seed Neon |

## API

All endpoints return JSON with `Cache-Control: no-store` and an `X-Request-Id` header. Every route answers only its documented method; anything else gets **405** with an `Allow` header. Every route is rate-limited to **60 requests/min per IP** (**429** with `Retry-After`). Errors always have the same shape, with a generic message and the request ID (never internals):

```json
{ "error": { "code": "invalid_request", "message": "The request parameters are invalid.", "requestId": "b1aefe2c-37f4-449c-9ed8-77b4349b4ff3" } }
```

Endpoints without parameters reject any query string (400). Unknown `/api/*` paths return a JSON 404.

### `GET /api/kpis`
Revenue and orders today (store time zone, cancelled orders excluded), average order value, and orders currently pending. Redis-cached for **10 s**; invalidated by every simulated rush.

```json
{ "revenueToday": 2252, "ordersToday": 19, "pendingOrders": 21, "averageOrderValue": 118.53, "generatedAt": "2026-10-28T08:51:49.441Z" }
```

### `GET /api/orders/recent`
The newest 10 orders, for the live feed.

```json
{
  "orders": [
    { "id": 300, "customerName": "Nadia Reyes", "status": "pending", "total": 64, "itemCount": 2, "createdAt": "2026-10-28T08:32:25.313Z" }
  ],
  "generatedAt": "2026-10-28T08:51:49.484Z"
}
```

### `GET /api/orders`
The orders table with server-side filtering, search, sorting and pagination.

| Param | Rules | Default |
|---|---|---|
| `status` | `pending` \| `paid` \| `shipped` \| `cancelled` | all |
| `from`, `to` | `YYYY-MM-DD` (store time zone, inclusive), `to ≥ from`, range ≤ 31 days | none |
| `q` | customer name contains, 1–100 chars, case-insensitive | none |
| `page` | integer 1–10,000 | `1` |
| `pageSize` | integer 1–100 | `20` |
| `sort` | `created_at` \| `total` \| `customer_name` | `created_at` |
| `dir` | `asc` \| `desc` | `desc` |

Unknown or repeated parameters → 400.

```http
GET /api/orders?status=paid&q=kim&pageSize=2
```
```json
{
  "items": [
    { "id": 293, "customerName": "Chloe Kim", "status": "paid", "total": 130, "itemCount": 2, "createdAt": "2026-10-28T05:50:42.871Z" },
    { "id": 110, "customerName": "Dewi Kim", "status": "paid", "total": 178, "itemCount": 2, "createdAt": "2026-10-23T18:09:58.148Z" }
  ],
  "page": 1, "pageSize": 2, "total": 2, "totalPages": 1
}
```

### `GET /api/revenue`
The last 24 hours of revenue in hourly buckets (oldest first, the current hour last, empty hours as zero).

```json
{
  "buckets": [
    { "hourStart": "2026-10-28T07:00:00.000Z", "revenue": 296, "orders": 3 },
    { "hourStart": "2026-10-28T08:00:00.000Z", "revenue": 64, "orders": 1 }
  ],
  "total": 4329,
  "generatedAt": "2026-10-28T08:51:49.546Z"
}
```
*(24 buckets in the real response.)*

### `GET /api/orders/heatmap`
Order counts for the last 7 days × 24 hours (store time zone), oldest day first. Redis-cached for **60 s**.

```json
{
  "days": [
    { "date": "2026-10-28", "label": "Wed", "counts": [1, 0, 0, 0, 0, 0, 0, 1, 2, 5, 0, 2, 3, 2, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0] }
  ],
  "max": 6,
  "generatedAt": "2026-10-28T08:51:49.570Z"
}
```
*(7 days in the real response.)*

### `GET /api/products/low-stock`
Products where `stock <= low_stock_threshold`, most critical first (max 8).

```json
{
  "products": [
    { "id": 17, "name": "Canyon Suede Chelsea Boot", "sku": "PUL-SHO-017", "stock": 4, "lowStockThreshold": 15 }
  ],
  "generatedAt": "2026-10-28T08:51:49.593Z"
}
```

### `POST /api/simulate`
Creates 10–20 random orders timestamped across the last few seconds, decrements stock (never below zero) and invalidates the KPI and heatmap caches.

- Body: `{}` or `{ "count": 10–20 }` (JSON, max 1 KB, unknown keys rejected).
- Requires `Content-Type: application/json` (otherwise **415**) and a same-origin `Origin` (or `Referer`) header (otherwise **403**).
- Rate-limited to **5 requests/min per IP** on top of the general limit → **429**: `"You can simulate 5 rushes a minute."` with `Retry-After` and `retryAfterSeconds`.

```json
{
  "created": 17,
  "orders": [
    { "id": 317, "customerName": "Hana Nguyen", "status": "paid", "total": 272, "itemCount": 2, "createdAt": "2026-10-28T08:51:49.616Z" }
  ]
}
```
*(201 Created; `orders` lists all created orders, newest first.)*

## Architecture decisions

- **Why Redis caches the KPIs.** Every open dashboard polls `/api/kpis` every 5 seconds. Without a cache, ten viewers would mean 120 aggregate queries a minute against Postgres for numbers that barely change. With a 10-second Redis cache, Postgres sees at most ~6 KPI queries a minute no matter how many people are watching. The cache is invalidated when a rush is simulated, so new orders still show up on the very next poll. If Redis is unreachable, requests fall back to the database instead of failing.
- **Why polling instead of WebSockets on Vercel.** Vercel runs route handlers as serverless functions: they start per request and can't hold long-lived connections, so a WebSocket server isn't an option there without another service. Polling every 5 seconds is reliable, works through every proxy and CDN, needs no extra infrastructure, and is cheap at this scale, especially with the KPI cache in front of the database. At larger scale (many viewers, sub-second updates) you'd move to a managed realtime service (e.g. Pusher, Ably, Supabase Realtime) and push changes instead.
- **Why the simulate endpoint is rate-limited.** It's the only endpoint that writes. Without a limit, a single script could create millions of orders, empty the stock, fill the free-tier database and ruin the demo for everyone else. 5 requests a minute per IP (plus a cap of 20 orders per request) is plenty for a human and useless for abuse. When the limit hits, the button turns into a countdown and a friendly toast explains why.
- **Why polling pauses when the tab is hidden.** A dashboard left open in a background tab would otherwise poll forever, burning Upstash and Neon free-tier quotas (and the visitor's battery) for numbers nobody sees. Hidden tab → timers stop and in-flight requests are aborted. Visible again → one immediate refresh, then the normal interval.

## Project structure

```
app/
  (dashboard)/page.tsx     server component: loads every tile in parallel for first paint
  api/*/route.ts           thin handlers: parse → validate → service → JSON
  styles/                  tokens.css (all colours), surfaces, layout, components, motion, polish
components/                kpi, chart, heatmap, orders, stock, ui (surfaces, palette, ticker…)
hooks/                     usePolling, useGsap, useReducedMotion, useCountUp, useRushMode…
lib/
  db/                      Repository interface + Neon and in-memory implementations, fake data
  redis/                   Cache + RateLimiter interfaces, Upstash and in-memory implementations
  services/                business logic (KPIs, orders, revenue, heatmap, stock, simulate, cache)
  validation/              zod schemas (requests and responses)
  api/                     route wrapper (request ID, rate limit, errors), guards (origin, body)
  security/headers.ts      CSP and security headers
  env.ts, logger.ts, time.ts, format.ts
db/schema.sql · scripts/seed.ts · proxy.ts · instrumentation.ts · tests/
```

## Accessibility & motion

- Semantic landmarks, visible focus rings, keyboard access everywhere: the chart and heatmap can be read with arrow keys, the command palette opens with ⌘K / Ctrl+K, and every chart has an equivalent data table for screen readers.
- All text meets WCAG AA (4.5:1) in Day and Night. This is enforced by `tests/contrast.test.ts`, which reads the colour tokens straight from `tokens.css`.
- Motion animates only `transform` and `opacity`, and only what changes (numbers, new orders, alerts). The sky bubbles are the only ambient loop. With `prefers-reduced-motion` everything becomes a simple fade, and the bubbles and ticker stop.

## Security

Strict zod validation, parameterized SQL, per-IP rate limits, CSRF/origin checks on the write endpoint, a nonce-based Content-Security-Policy and the usual security headers, generic errors with request IDs, and secrets that never leave the server. The threat model, every control mapped to the OWASP Top 10, and the accepted risks are in [`SECURITY.md`](SECURITY.md).
