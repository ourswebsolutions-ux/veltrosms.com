# VirtuMSG

Virtual numbers for receiving SMS verification codes. Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · **Prisma 7 + MySQL/MariaDB**.

Numbers, prices and SMS come from an upstream provider's API (sms-activate compatible, documented at https://grizzlysms.com/docs); VirtuMSG resells them with its own accounts, wallet and API.

## Getting started

```bash
npm install                          # also generates the Prisma client
cp .env.example .env.local           # set DATABASE_URL and GRIZZLY_API_KEY
npm run db:migrate                   # create tables in your MySQL database
npm run db:seed:admin                # administrator account (ADMIN_EMAIL, see .env.example)
npm run db:seed                      # optional (development): test account dev@rocksms.test
npm run catalog:sync                 # load countries/services/prices from the provider
npm run dev                          # http://localhost:3000
```

Without `GRIZZLY_API_KEY` the site runs but shows "numbers coming soon" states: every provider call (including prices) requires a valid key.

| Script | Purpose |
| --- | --- |
| `dev` / `build` / `start` | Next.js |
| `lint` / `typecheck` / `test` | ESLint, `tsc`, Vitest (needs the `rocksms_test` MySQL database) |
| `db:migrate` / `db:migrate:dev` / `db:seed` / `db:studio` | Prisma |
| `catalog:sync` | Refresh countries, services and prices from the provider now (also happens automatically every `CATALOG_SYNC_MINUTES`) |
| `orders:sweep` | Finalize expired orders and refund those without SMS — **run every minute from cron** |
| `wallet:adjust` | Staff-only credit/debit: `npm run wallet:adjust -- --email a@b.c --amount 10 --reason "Top-up #42"` |
| `payments:reconcile` | Re-check open/recent top-ups with the payment provider (late webhooks, closed browsers) — **run every few minutes from cron** |
| `db:seed:admin` | **Admin seeder** — creates/repairs the administrator from `ADMIN_EMAIL` (default zh613781@gmail.com). Uses `ADMIN_PASSWORD` if set, otherwise emails a password-setup link. Idempotent and production-safe; never overwrites an existing password unless `ADMIN_RESET_PASSWORD=true` |
| `db:seed:ready-made` | Creates the default **Ready Made** offer (WhatsApp · All countries · active) at `READY_MADE_DEFAULT_PRICE`, only if it doesn't exist; never changes an existing offer. Offers are managed in Admin → Ready Made Accounts |
| `admin:role` | Grant/revoke admin rights, or create the admin account: `npm run admin:role -- --email you@example.com [--create] [--revoke]` |
| `provider:check` | Read-only operator check: provider connectivity, **our provider balance**, catalog size |

Environment variables are documented in [.env.example](.env.example).

## How it works

```
Browser / API client
   │  pages, server actions, /api/* route handlers (session or API key auth)
   ▼
server/services      auth · wallet · orders · catalog · account · api keys
   │        │
   ▼        ▼
 Prisma   server/providers   ← SmsProvider interface
 (MySQL)     └ grizzly/        adapter for the documented handler_api.php
```

- **Catalog:** synced from the provider into `countries` / `services` / `prices` (cost + marked-up customer price). Pages read the database; live price levels per service come from `getPricesV2` (cached 60 s).
- **Buying a number:** server re-quotes the price → one DB transaction creates the order **and** debits the wallet → provider `getNumberV2` → on any failure the charge is refunded. A client `Idempotency-Key` makes retries safe.
- **SMS:** active orders are polled (`getStatus` / `getStatusV2`); codes are stored in `sms_messages`. Cancel (`setStatus 8`) and expiry refund exactly once.

### Money & ledger

- Amounts are `DECIMAL(18,4)` in MySQL and integer ten-thousandths in code (`src/lib/money.ts`) — no floating point.
- `server/services/wallet.service.ts` is the only code that changes balances: row lock (`SELECT … FOR UPDATE`) → idempotency check by unique `reference` → funds check → balance + ledger row, all in one transaction.
- The database also enforces `balance >= 0` and an **append-only** `transactions` table (triggers block UPDATE/DELETE).
- No endpoint credits a wallet directly. Deposits come only from verified top-up payments (below); staff corrections use `wallet:adjust`.

### Top-ups (payments)

- **Current method: manual Easypaisa / JazzCash** (`PAYMENT_PROVIDER=manual`). Customers send money to the account on Add funds, submit the transaction ID, and an administrator approves or rejects it in `/admin/topups`; approval credits the wallet exactly once. Details and the plan for the Easypaisa/JazzCash APIs: [docs/PAYMENTS.md](docs/PAYMENTS.md).
- `server/payments/` holds the provider contract (`types.ts`) and the registry. Gateway ("redirect") providers plug in there; the gateway flow below is implemented and tested with a fake provider, ready for them.
- `server/services/payment.service.ts`: the server validates the amount (limits, whole cents), computes the fee and creates the payment with a unique reference and idempotency key, then sends the customer to the provider's checkout.
- The wallet is credited only by `settle()`, after the provider's own status says **paid** and amount, currency, provider id and reference match. It runs under a row lock and credits through the ledger with the unique reference `payment:<id>:credit` — exactly once, however often it's confirmed. Mismatches are flagged (`needs_review`), never credited.
- Webhooks (`POST /api/payments/webhook/<provider>`) are signature-checked, de-duplicated by event id, and only trigger a re-check with the provider. The return page, "Check status" and `payments:reconcile` use the same path.
- The database blocks changing a payment's amounts/currency/owner and moving a paid payment back.

### Provider integration

- Adapter: `src/server/providers/grizzly/` on the shared `http-client.ts` (timeouts, pacing via `PROVIDER_MAX_RPS`, retries **only** for read calls, 429/5xx/HTML handling). Every response is schema-validated; invalid rows are dropped, malformed responses fail as `INVALID_RESPONSE`.
- Verified live (read-only): `getBalance`, `getCountries` (incl. `visible`), `getServicesList`, `getPrices` (unfiltered only), `getPricesV3` (inventory/tiers), `getActiveActivations`. Purchase/status/cancel follow the documented formats.
- Purchases: pre-flight check of our provider balance (no charge if the provider can't deliver) → atomic order + debit → `getNumberV2` (never retried) → ambiguous failures are reconciled via `getActiveActivations` before refunding. Refunds happen only on provider-confirmed state.
- Every call is logged to `provider_requests` (action, order/user, provider ref, success, category, HTTP status, duration, attempt) — never the API key; response bodies only for failures.

### API

Documented on the `/api` page. Catalog: `GET /api/countries`, `/api/services`, `/api/numbers?service=`. Session endpoints: `GET /api/orders/{id}/sms`, `GET|POST /api/payments`, `GET /api/payments/options`, `GET /api/payments/{id}`, `POST /api/payments/{id}/verify`, `GET /api/wallet`, `/api/wallet/transactions`, `/api/orders`, `/api/statistics`, `POST /api/orders`, `/api/orders/{id}/cancel|finish|resend`. The same operations are available with an API key (Settings → API key) under `/api/v1/...` using `Authorization: Bearer rk_live_…`.

### Authentication

Email/password with verification, reset, server-side sessions (HTTP-only cookie, hashed token), rate limits and anti-enumeration — see `src/server/auth/` and `src/server/services/auth.service.ts`.

### Account area

- `/profile` (overview, active numbers, recent orders and wallet activity), `/profile/orders/{id}` (order details, SMS, charges/refunds), `/profile/history` (transactions, orders, SMS, payments — paginated, filtered in the database, date presets or a custom range in UTC days), `/profile/statistics` (aggregated from orders, SMS, ledger and payments for a date range), `/profile/top-up`, `/profile/settings`.
- Settings: name, **email change** (current password required; the new address confirms from its inbox via `/confirm-email`, the old address is notified, all sessions are then revoked; whether an address is taken is never revealed), password change (other devices logged out), per-device session revoke, and per-browser preferences (theme, SMS sound).
- Every read is scoped to the signed-in user; another user's order/payment id is a plain 404.

### Admin panel (`/admin`)

- Access: role `ADMIN`, re-read from the database on every request. Non-admins get a 404 on pages and 403 from `/api/admin/*`; admin APIs accept only the session cookie (never API keys) and same-origin JSON for writes. The first admin is granted from the server shell: `npm run admin:role -- --email you@example.com`.
- Sections: dashboard, users (status, role, force logout, API-key revoke, audited wallet adjustments), orders (provider refresh/cancel through the normal refund rules), payments (provider re-check, closing "needs review" — no "mark paid"), providers (health, balance, request stats; secrets shown only as set/not set), countries & services (local enable/feature switches over provider data), pricing (the single markup rule; saving reprices stored prices), logs (admin audit, security events, provider failures, payment webhooks, wallet adjustments), settings (maintenance mode, WhatsApp top-up contact).
- Every sensitive admin action is written to `audit_logs` (append-only via triggers; secrets are scrubbed from metadata).

### Design system

Tokens in `src/app/globals.css`; components in `src/components/{ui,layout,marketplace,orders,profile,forms}`. Brand and navigation live in `src/config/site.ts`.

## Production checklist

- **Environment** (server only, never committed): `DATABASE_URL`, `APP_URL` (https — makes the session cookie `__Host-` + `Secure`), `TRUST_PROXY` behind a proxy, `SMTP_*` + `MAIL_FROM`, `SMS_PROVIDER` + `GRIZZLY_API_KEY`, `PAYMENT_PROVIDER`, `ADMIN_NOTIFY_EMAIL`. Sessions are random tokens stored hashed in the database, so there is no signing secret to manage.
- `npm run db:migrate` (never `db:migrate:dev` against production), `npm run build`, `npm start`.
- First admin: `npm run admin:role -- --email <you> --create`.
- Cron: `orders:sweep` every minute, `payments:reconcile` every few minutes (gateway providers), `catalog:sync` is automatic.
- Keep the SMS provider account funded; check Admin → Providers.
# vritumsg-project
# vritumsg-project
# veltrosms.com
