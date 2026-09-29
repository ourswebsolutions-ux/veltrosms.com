# Payments — developer notes

## Current method: manual Easypaisa / JazzCash

- Provider: `ManualPaymentProvider` (`src/server/payments/manual/manual-provider.ts`), selected by `PAYMENT_PROVIDER=manual` (default).
- Receiving account (shown on Add funds, editable in **Admin → Settings → Manual payments**):
  **Muhammad Usman — 03246623395** (Easypaisa / JazzCash), WhatsApp help **03246623395**.
- Flow:
  1. Customer sends money to that account and submits **amount + method + transaction ID** (+ optional note) at `/profile/top-up`.
  2. `createManualTopUp()` stores a `payments` row: `provider = "manual"`, `status = PENDING`, `provider_payment_id = <transaction ID>` (unique per provider → the same transaction ID can never be claimed twice). **Nothing is credited.** Audit: `topup.created`; optional email to `ADMIN_NOTIFY_EMAIL`.
  3. An administrator checks the Easypaisa/JazzCash statement and approves or rejects in `/admin/topups`.
  4. `approveManualTopUp()` — one DB transaction: row lock → must be `PENDING` → not the admin's own request → ledger credit with the unique reference `payment:<id>:credit` → status `PAID` + reviewer + time. Audit: `topup.approved`, `wallet.credited`. Double clicks, parallel tabs and retries end with **one** credit (lock + status check + unique ledger reference).
  5. `rejectManualTopUp()` — `REJECTED` + reason + reviewer + time; never credited. Audit: `topup.rejected`. The database refuses to change a rejected (or paid) request afterwards.
- Payment proof uploads are **not** collected (no file storage in this app); verification uses the transaction ID.

## Future: Easypaisa API / JazzCash API

Do not change the wallet. Add an adapter:

1. Implement `PaymentProvider` (`src/server/payments/types.ts`) with `flow: "redirect"`:
   `createPayment` (create at the gateway, return hosted checkout URL), `getPayment` (authoritative status),
   `findPaymentByReference` (recover lost create responses), `verifyWebhook` (signature check) and, if supported, `refundPayment`.
2. Add a value to `PAYMENT_PROVIDER` in `src/server/env.ts` plus the gateway's credentials (merchant ID, API key, hash/webhook secret) as server-only env vars, and one `case` in `src/server/payments/registry.ts`.
3. Everything else already exists and is tested with a fake gateway: amount/fee validation, idempotent creation, redirect to checkout, the return page, `POST /api/payments/webhook/<provider>`, `settle()` (credits only when the gateway's own status says paid **and** amount, currency, id and reference match), mismatch → `needs_review`, and `npm run payments:reconcile`.

Never credit a wallet from a browser redirect or client message; only `settle()` (gateway) or an administrator approval (manual) may do so.
