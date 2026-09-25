# Production setup

## Required before launch
1. Create a Supabase project and run migrations in filename order.
2. Configure Auth email/SMTP (Resend is recommended) and deploy `auth-otp`.
3. Add Edge Function secrets: `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `OTP_FROM_EMAIL`, `TURNSTILE_SECRET_KEY`, and payment provider secrets when enabled.
4. Configure Cloudflare Turnstile and add `VITE_TURNSTILE_SITE_KEY` to the frontend. The login/signup screens accept the server-side token flow; add the Turnstile widget before exposing the site publicly.
5. Configure shipping/tax rows and platform settings from the admin panel. There is intentionally no automatic free-shipping-over-$50 rule.
6. Configure Stripe/PayPal merchant accounts and webhooks before enabling those methods. The UI and server schema support the methods, but credentials/webhooks are environment-specific.
7. Deploy the frontend and Supabase Edge Functions. For true HttpOnly refresh cookies, put a BFF/SSR boundary (for example Cloudflare Pages Functions) in front of Supabase Auth; the current SPA uses the standard Supabase browser session.
8. Create the first admin only through a trusted server/database migration; never expose admin self-registration.

## Security checklist
- RLS enabled on all application tables.
- Vendor KYC documents are private and admin access uses short-lived signed URLs.
- Client cannot directly write order financial totals, wallet ledger or vendor balances.
- Checkout calculates prices, tax, shipping and commissions on the server and uses an idempotency key.
- Non-variation products now have server-enforced inventory stock.
- Vendor publication requires approved shop, positive price, complete core fields and at least one image.
- Payment secrets are never stored in frontend code or public settings.
