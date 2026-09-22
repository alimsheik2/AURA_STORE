# AURA STORE — Multi-Vendor E-Commerce Marketplace

A production-ready, high-performance multi-vendor marketplace platform built with React, Vite, Tailwind CSS, Supabase (PostgreSQL & Edge Functions), and Cloudflare Turnstile bot protection.

---

## 🚀 Key Features & Hardening

- **Authentication & Security:**
  - Email/password authentication with optional 6-digit OTP verification via Resend.
  - Cloudflare Turnstile integration on Sign-Up and Sign-In forms.
  - Private Supabase storage buckets (`kyc_documents`, `vendor-kyc`) secured with Row-Level Security (RLS) policies.
  - Rate limiting on sensitive auth and OTP endpoints.

- **Financial & Marketplace Operations:**
  - Configurable platform commission rates (default 10%) managed via Admin Dashboard.
  - Configurable shipping methods (Standard $5, Express $15) with dynamic cart & checkout rates.
  - Atomic, server-side checkout process (`secure_create_order`) with database row locks (`FOR UPDATE`), inventory stock validation, and idempotency protection.
  - Payment Webhook hardening for Stripe and PayPal with signature verification (`Stripe-Signature` and PayPal transmission headers).
  - Admin Revenue & Financial Analytics dashboard displaying gross revenue, refunds, commission fees, and net vendor payouts.
  - Dedicated Admin Refund endpoint (`/admin/refund`) and order refund workflows.
  - Immutable vendor wallet ledger (`wallet_ledger`) with stored procedures (`adjust_wallet`) preventing negative balances.

- **Order Management & Tracking:**
  - Extended order status tracking (`pending`, `processing`, `shipped`, `delivered`, `returned`).
  - Automated customer notifications and audit logs for order status changes and refunds.

---

## 🛠 Tech Stack

- **Frontend:** React 18, TypeScript, Vite 6, Tailwind CSS 3, Lucide Icons, i18next
- **Backend / Database:** Supabase PostgreSQL, Row-Level Security (RLS), Supabase Storage
- **Edge Functions:** Deno runtime on Supabase Edge (`auth-otp`, `turnstile-verify`, `payment-webhook`, `checkout`, `admin-refund`, `admin-vendor-review`, `capture-paypal`)
- **Deployment:** Cloudflare Pages (Frontend SPA), Supabase (Edge Functions & DB)

---

## ⚙️ Setup & Installation

### 1. Environment Variables
Copy `.env.example` to `.env` and fill in your project credentials:

```bash
cp .env.example .env
```

Required environment variables:
```env
# Supabase Configuration
VITE_SUPABASE_URL="https://your-supabase-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"

# Cloudflare Turnstile Verification
VITE_TURNSTILE_SITE_KEY="your-site-key"
TURNSTILE_SECRET_KEY="your-secret-key"

# Resend Email Integration (Edge Functions)
RESEND_API_KEY="your-resend-api-key"
OTP_FROM_EMAIL="noreply@aura.store"

# Stripe / PayPal Configuration
VITE_STRIPE_PUBLISHABLE_KEY="pk_test_your_stripe_key"
STRIPE_SECRET_KEY="sk_test_your_stripe_secret"
STRIPE_WEBHOOK_SECRET="whsec_your_stripe_webhook_secret"
PAYPAL_CLIENT_ID="your_paypal_client_id"
PAYPAL_CLIENT_SECRET="your_paypal_client_secret"
PAYPAL_WEBHOOK_ID="your_paypal_webhook_id"
```

### 2. Database Migrations
Apply all timestamped migrations in `supabase/migrations/` to your Supabase PostgreSQL instance:

```bash
npx supabase db push
```

Key migration files:
- `20260907131052_create_marketplace_schema.sql` — Core schema & initial tables.
- `20260918120000_production_marketplace.sql` — Enums, KYC, wallet, tax & shipping tables.
- `20260918150000_auth_otp_and_hardening.sql` — Auth OTP challenges & rate limits.
- `20260918151000_atomic_checkout.sql` & `20260918160000_final_hardening.sql` — Atomic checkout procedure (`secure_create_order`).
- `20260918170000_payments_and_financial_hardening.sql` — Payment event logging and vendor wallet triggers.
- `20260922150000_implementation_plan_hardening.sql` — Storage RLS, commission table, shipping table, refund & tracking columns, and safe `adjust_wallet` procedure.

### 3. Running Locally
Install dependencies and launch dev server:

```bash
npm install
npm run dev
```

---

## 🧪 Verification & Building

Run the production verification suite sequentially:

```powershell
npm run typecheck    # Verify TypeScript types with zero errors
npm run lint         # Check ESLint rules
npm run build        # Build production assets via Vite
```

---

## 🔒 Security Audit Checklist

- [x] RLS policies enforced on all user, vendor, admin, and storage tables.
- [x] Secrets and keys managed strictly via environment variables.
- [x] Edge function inputs validated and sanitized.
- [x] Payment webhooks verified using HMAC signature validation.
- [x] Checkout transactions execute inside PostgreSQL database transactions with row-level locks.
- [x] Cloudflare Turnstile bot verification on sign-in and sign-up forms.
