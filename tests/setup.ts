// Every test runs against the dedicated MySQL test database (never the app DB).
Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? "mysql://root:root@127.0.0.1:3306/rocksms_test",
  APP_URL: "http://localhost:3000",
  TRUST_PROXY: "false",
  SMS_PROVIDER: "none",
  PLATFORM_CURRENCY: "USD",
  PROVIDER_CURRENCY: "USD",
  PROVIDER_FX_RATE: "1",
  PRICE_MARKUP_PERCENT: "20",
  PRICE_MIN_MARGIN: "0.01",
  PAYMENT_PROVIDER: "none",
  TOPUP_MAX_AMOUNT: "1000",
  TOPUP_FEE_PERCENT: "0",
  TOPUP_FEE_FIXED: "0",
  PAYMENT_EXPIRY_MINUTES: "60",
});
