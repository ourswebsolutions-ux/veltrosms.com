/**
 * Public API reference (rendered on /api). Every method listed here is live.
 * Amounts are integers in 1/10,000 of the currency unit (e.g. 3500 = 0.35).
 */
export type ApiParam = { name: string; required?: boolean; description: string };

export type ApiMethod = {
  id: string;
  title: string;
  method: "GET" | "POST";
  path: string;
  auth: boolean;
  description: string;
  params: ApiParam[];
  errors?: { code: string; description: string }[];
  example: string;
};

export type ApiSection = { id: string; label: string; methods: ApiMethod[] };

const AUTH_ERRORS = [
  { code: "401 UNAUTHORIZED", description: "Missing, invalid or revoked API key." },
  { code: "429 RATE_LIMITED", description: "Too many requests — wait and retry." },
];

export const API_SECTIONS: ApiSection[] = [
  {
    id: "activations",
    label: "Activations",
    methods: [
      {
        id: "create",
        title: "Request a number",
        method: "POST",
        path: "/api/v1/activations",
        auth: true,
        description:
          "Buys a number for a service in a country and charges your balance. Send a unique Idempotency-Key header per purchase: repeating a request with the same key returns the same activation instead of charging twice. `price` must equal a current price (see Get current prices); if it changed you get PRICE_CHANGED with the new prices.",
        params: [
          { name: "service", required: true, description: "Service code, e.g. tg (from List services)." },
          { name: "country", required: true, description: "Country id (from List services)." },
          { name: "price", required: true, description: "The price you agree to pay, in 1/10,000 units." },
          { name: "Idempotency-Key", required: true, description: "Header: 16–64 letters, digits, _ or -." },
        ],
        errors: [
          ...AUTH_ERRORS,
          { code: "402 INSUFFICIENT_FUNDS", description: "Top up your balance." },
          { code: "409 PRICE_CHANGED", description: "Price moved; `prices` lists current ones." },
          { code: "409 NO_NUMBERS", description: "Out of stock — retry or pick another country." },
          { code: "502 PROVIDER_ERROR", description: "Upstream problem; you were not charged." },
        ],
        example: `curl -X POST https://your-domain/api/v1/activations \\
  -H "Authorization: Bearer rk_live_…" \\
  -H "Idempotency-Key: 7f3c9a1e5b2d4f6a8c0e" \\
  -H "Content-Type: application/json" \\
  -d '{"service":"tg","country":"12","price":4200}'

201 { "order": { "id": "…", "phoneNumber": "1…", "status": "active",
      "price": 4200, "currency": "USD", "expiresAt": "…", … } }`,
      },
      {
        id: "status",
        title: "Get activation status",
        method: "GET",
        path: "/api/v1/activations/{id}",
        auth: true,
        description: "Returns the activation with its latest SMS code. Poll every few seconds while status is active.",
        params: [{ name: "id", required: true, description: "Activation id." }],
        errors: [...AUTH_ERRORS, { code: "404 NOT_FOUND", description: "No such activation on your account." }],
        example: `{ "order": { "id": "…", "status": "sms_received", "code": "852508",
  "smsText": "Your code is 852508", "canFinish": true, … } }`,
      },
      {
        id: "list",
        title: "List activations",
        method: "GET",
        path: "/api/v1/activations?status=active",
        auth: true,
        description: "Your activations, newest first, paginated.",
        params: [
          { name: "status", description: "active | completed | cancelled | all (default all)." },
          { name: "page / pageSize", description: "Pagination (pageSize up to 100)." },
        ],
        errors: AUTH_ERRORS,
        example: `{ "items": [ { "id": "…", "status": "active", … } ], "total": 12, "page": 1, "pageSize": 20 }`,
      },
      {
        id: "cancel",
        title: "Cancel an activation",
        method: "POST",
        path: "/api/v1/activations/{id}/cancel",
        auth: true,
        description: "Cancels an activation that hasn't received an SMS and refunds your balance. Cancelling becomes possible a short time after purchase.",
        params: [{ name: "id", required: true, description: "Activation id." }],
        errors: [...AUTH_ERRORS, { code: "409 NOT_ALLOWED", description: "Too early, or an SMS already arrived." }],
        example: `{ "order": { "id": "…", "status": "cancelled", … } }`,
      },
      {
        id: "finish",
        title: "Finish an activation",
        method: "POST",
        path: "/api/v1/activations/{id}/finish",
        auth: true,
        description: "Completes an activation after you've used the code.",
        params: [{ name: "id", required: true, description: "Activation id." }],
        errors: [...AUTH_ERRORS, { code: "409 NOT_ALLOWED", description: "No code has been received yet." }],
        example: `{ "order": { "id": "…", "status": "completed", … } }`,
      },
      {
        id: "resend",
        title: "Request another code",
        method: "POST",
        path: "/api/v1/activations/{id}/resend",
        auth: true,
        description: "Waits for another SMS on the same number, when the service supports it (canRequestAnother).",
        params: [{ name: "id", required: true, description: "Activation id." }],
        errors: [...AUTH_ERRORS, { code: "409 NOT_ALLOWED", description: "Not supported for this activation." }],
        example: `{ "order": { "id": "…", "status": "active", … } }`,
      },
    ],
  },
  {
    id: "account",
    label: "Account",
    methods: [
      {
        id: "balance",
        title: "Get balance",
        method: "GET",
        path: "/api/v1/account/balance",
        auth: true,
        description: "Your current balance.",
        params: [],
        errors: AUTH_ERRORS,
        example: `{ "balance": 125000, "currency": "USD", "updatedAt": "…" }`,
      },
      {
        id: "transactions",
        title: "Balance history",
        method: "GET",
        path: "/api/v1/account/transactions",
        auth: true,
        description: "Ledger of top-ups, purchases and refunds, newest first.",
        params: [
          { name: "type", description: "deposit | purchase | refund | adjustment" },
          { name: "from / to", description: "Dates, YYYY-MM-DD." },
          { name: "min / max", description: "Absolute amount bounds, e.g. 0.5." },
          { name: "page / pageSize", description: "Pagination (pageSize up to 100)." },
        ],
        errors: AUTH_ERRORS,
        example: `{ "items": [ { "type": "purchase", "amount": -4200, "balanceAfter": 120800, … } ], "total": 3, … }`,
      },
    ],
  },
  {
    id: "catalog",
    label: "Catalog",
    methods: [
      {
        id: "services",
        title: "List services and countries",
        method: "GET",
        path: "/api/v1/catalog/services",
        auth: false,
        description: "Services and countries currently on sale, with the codes/ids other methods use.",
        params: [],
        example: `{ "services": [{ "slug": "tg", "name": "Telegram", … }],
  "countries": [{ "id": "12", "iso2": "us", "name": "USA" }, …] }`,
      },
      {
        id: "offers",
        title: "Get current prices",
        method: "GET",
        path: "/api/v1/catalog/offers",
        auth: false,
        description: "Current prices and stock. Pass exactly one of service or country.",
        params: [
          { name: "service", description: "Service code — returns one row per country." },
          { name: "country", description: "Country id — returns one row per service." },
        ],
        errors: [{ code: "400 INVALID", description: "Neither or both parameters given." }],
        example: `{ "status": "ok", "data": [{ "country": { "id": "12", "name": "USA" },
  "minPrice": 4200, "totalAvailable": 1520, "tiers": [{ "price": 4200, "available": 1520 }] }] }`,
      },
    ],
  },
];
