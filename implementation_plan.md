# Implementation Plan – Remaining Steps (Updated)

## Goal
Complete the production‑ready hardening of the AURA STORE marketplace as outlined in the original implementation plan (items 3‑24).

## User Review Required
[!IMPORTANT]
- The plan includes schema migrations, UI components, edge‑function enhancements, and deployment steps. All open questions have been answered:
  - Turnstile integration will use placeholder env vars (`VITE_TURNSTILE_SITE_KEY="your-site-key"`, `TURNSTILE_SECRET_KEY="your-secret-key"`).
  - Default commission rate: **10 %**.
  - Shipping methods to seed: **Standard – $5**, **Express – $15**.

## Proposed Changes
---
### 3️⃣ Cloudflare Turnstile Integration
- Add `@marsidev/react-turnstile` package.
- UI: insert `<Turnstile siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY} />` into Sign‑Up and Sign‑In forms.
- Pass token to `signUp`, `signIn`, `resendSignupOtp`.
- Edge function `auth-otp` verifies token via Cloudflare API.
- Add env vars to `.env.example`.

### 4️⃣ KYC Documents Bucket & RLS
- Create private storage bucket `kyc_documents`.
- Add RLS policy: `owner_id = auth.uid()` OR `role = 'admin'` for reads.
- Update `submitVendorKyc` to upload to bucket.
- Migration SQL for bucket and policy.

### 5️⃣ Admin Revenue Dashboard
- New page `src/pages/AdminRevenue.tsx` with queries for gross orders, refunds, net revenue, commission.
- Add navigation link.

### 6️⃣ Payment Webhook Hardening
- Verify PayPal `transmission_id` & signature.
- Verify Stripe `Stripe-Signature`.
- Store processed event IDs for idempotency.
- Update edge functions `pay/paypal-webhook` and `pay/stripe-webhook`.

### 7️⃣ Checkout Process Refactor (`checkout-process` edge function)
- Consolidate price lookup, commission, stock validation.
- Use DB transaction.
- Accept `idempotency_key`; reject duplicates.

### 8️⃣ Commission Rates Table & Admin UI
- Create `commission_rates` table.
- Admin CRUD page `src/pages/AdminCommission.tsx`.
- Checkout reads latest active rate.

### 9️⃣ Refund Workflow Revamp
- Add `refund_status` enum to `orders`.
- Admin endpoint `/admin/refund` triggers provider refund via edge function.
- UI button and status badge.

### 🔟 Wallet Ledger Immutability & Trigger
- Make `wallet_ledger` rows immutable.
- DB trigger to prevent negative balances.
- Stored procedure `adjust_wallet(user_id, amount)` used by edge functions.

### 1️⃣1️⃣ Shipping Methods Table & Admin UI
- Create `shipping_methods` table.
- Admin CRUD page `src/pages/AdminShipping.tsx`.
- Seed default methods: Standard – $5, Express – $15.
- Remove hard‑coded free‑shipping rule.

### 1️⃣2️⃣ Order Tracking Enhancements
- Add `tracking_status` enum and timestamps (`shipped_at`, `delivered_at`).
- Public read‑only endpoint for customers; admin/vendor update endpoints.

### 1️⃣3️⃣ RLS Audit & Hardening
- Scan all policies, ensure vendor/admin access rules are correct.
- Create migration to upsert missing policies.

### 1️⃣4️⃣ Product Creation Validation
- Extend `supabase/functions/create-product` to validate required fields and return clear errors.

### 1️⃣5️⃣ `.env.example`
- Add all required env vars with comments, no secrets.

### 1️⃣6️⃣ Lint & Type Cleanup
- Run `npm run lint -- --fix`.
- Replace `any` with proper types.
- Remove dead imports (`Loader2`, `Store`, `ShoppingBag`, `Truck`, `FileUp`).

### 1️⃣7️⃣ Build & Verification Pipeline
- Run sequential commands on Windows:
  ```powershell
  npm ci
  npm run typecheck
  npm run lint
  npm run build
  ```
- Fix any TypeScript errors before proceeding.

### 1️⃣8️⃣ Supabase Migrations
- Create timestamped migration files for each DB change (tables, bucket, RLS policies).

### 1️⃣9️⃣ Final Security Audit Checklist
- Search repo for hard‑coded secrets, insecure patterns.
- Verify edge functions validate inputs, use parameterised queries.
- Confirm Turnstile, webhook signatures, idempotency.

### 2️⃣0️⃣ Documentation Updates
- Expand `README.md` with production setup, env vars, migration steps, deployment notes, security checklist.

### 2️⃣1️⃣ End‑to‑End Manual Verification
- Sign‑up flow with OTP resend and Turnstile.
- Vendor KYC upload.
- Checkout with commission, shipping, stock validation.
- Admin revenue dashboard.
- Refund processing and wallet balance verification.
- Order tracking updates.
- Deploy to preview Cloudflare Pages site and run smoke tests.

## Verification Plan
### Automated Tests
- Unit tests for `resendSignupOtp`, Turnstile token verification mock, `checkout-process` edge function, wallet adjustment.
- Run `npm test` after implementation.

### Manual Verification
- Follow steps in item 21 to verify end‑to‑end flows.
