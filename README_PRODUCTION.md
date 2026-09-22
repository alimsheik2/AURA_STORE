# AURA-STORE — production-ready foundation

This build hardens the marketplace for real deployment while keeping provider credentials/configuration outside the source code.

## Included
- Customer / vendor / admin roles with protected profile role/status fields.
- Vendor KYC upload to private storage, admin review and short-lived signed document URLs.
- Vendor approval controls the shop and product publishing path.
- Product publication requires core fields, positive price, an image and an approved shop.
- Server-side checkout: database prices, tax, shipping, commission and inventory are authoritative.
- Atomic inventory handling for variation and non-variation products.
- Checkout idempotency keys to reduce duplicate orders.
- Vendor-specific commission, category commission and platform default commission.
- Tax, shipping and FX tables ready for admin configuration.
- COD enabled by default; Stripe/PayPal UI is disabled until explicitly enabled in platform settings and provider credentials/webhooks are configured.
- Order status notifications and tracking-number display.
- Refund/dispute/wallet/audit/rate-limit database foundation.
- OTP login flow with hashed, expiring, rate-limited codes.
- Private KYC documents and server-side admin access.
- Platform settings in admin panel; secrets remain Supabase Edge Function secrets.

## Required external setup
The application code cannot create merchant accounts or secret keys for you. Before taking real payments, configure:
- Supabase project + migrations
- Supabase Auth email/SMTP (Resend can be used)
- Resend API key + sender address for login OTP
- Cloudflare Turnstile site/secret keys
- Stripe and/or PayPal merchant credentials and webhook endpoints if online payment is enabled
- Tax and shipping rates for the countries/routes you actually support
- Production domain / HTTPS

## Important security note
The current frontend is a Vite SPA and therefore uses the normal Supabase browser session. True HttpOnly refresh cookies require a server/BFF/SSR boundary (for example Cloudflare Pages Functions). Do not advertise HttpOnly-cookie protection until that boundary is deployed.

There is deliberately no automatic "free shipping over $50" rule.

## Final production checklist

### Required secrets (Supabase Edge Functions only)
- `RESEND_API_KEY`
- `OTP_FROM_EMAIL`
- `TURNSTILE_SECRET_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PUBLIC_APP_URL`

Never put these values in `VITE_*` variables or commit them to Git.

### Payment endpoints
- `create-payment`: creates the server-side Stripe Checkout Session or PayPal Checkout Order after an authenticated order is created.
- `payment-webhook`: verifies Stripe webhook signatures and applies payment state changes idempotently.
- `capture-paypal`: verifies the authenticated user/order/provider ID and captures the PayPal order server-side.

Configure the Stripe webhook to call `/functions/v1/payment-webhook` and subscribe to the payment events used by the application. Keep PayPal production credentials disabled until the PayPal webhook/transmission verification is configured for the production account.

### Deployment validation
Run locally before release:

```bash
npm ci
npm run typecheck
npm run lint
npm run build
```

Then apply Supabase migrations in order and deploy the Edge Functions. Test customer signup/OTP, vendor KYC approval, product publication, COD checkout, online payment, webhook confirmation, refunds, withdrawals, tracking and admin permissions in a staging project before switching to production.
