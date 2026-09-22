import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function stripeSession(secret: string, origin: string, order: any) {
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', `${origin}/order-confirmed/${order.id}?payment=success`);
  params.set('cancel_url', `${origin}/order-confirmed/${order.id}?payment=cancelled`);
  params.set('metadata[order_id]', order.id);
  params.set('line_items[0][price_data][currency]', String(order.currency || 'usd').toLowerCase());
  params.set('line_items[0][price_data][product_data][name]', `AURA-STORE order #${order.id.slice(0, 8)}`);
  params.set('line_items[0][price_data][unit_amount]', String(Math.round(Number(order.total) * 100)));
  params.set('line_items[0][quantity]', '1');
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || 'Stripe session creation failed');
  return { provider_payment_id: data.id, checkout_url: data.url };
}

async function paypalOrder(clientId: string, clientSecret: string, origin: string, order: any) {
  const auth = btoa(`${clientId}:${clientSecret}`);
  const tokenRes = await fetch('https://api-m.paypal.com/v1/oauth2/token', { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  const token = await tokenRes.json();
  if (!tokenRes.ok) throw new Error('PayPal authentication failed');
  const r = await fetch('https://api-m.paypal.com/v2/checkout/orders', { method: 'POST', headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ reference_id: order.id, amount: { currency_code: order.currency || 'USD', value: Number(order.total).toFixed(2) }, custom_id: order.id }], application_context: { return_url: `${origin}/order-confirmed/${order.id}?payment=success`, cancel_url: `${origin}/order-confirmed/${order.id}?payment=cancelled` } }) });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.message || 'PayPal order creation failed');
  const approve = data.links?.find((x: any) => x.rel === 'approve')?.href;
  return { provider_payment_id: data.id, checkout_url: approve };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'Authentication required' }, 401);
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Invalid session' }, 401);
  const body = await req.json().catch(() => ({}));
  const orderId = String(body.order_id || '');
  const provider = String(body.provider || '');
  if (!orderId || !['stripe', 'paypal'].includes(provider)) return json({ error: 'Invalid payment request' }, 400);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: order, error } = await admin.from('orders').select('id,user_id,total,currency,payment_method,payment_status').eq('id', orderId).eq('user_id', user.id).single();
  if (error || !order) return json({ error: 'Order not found' }, 404);
  if (order.payment_method !== provider || order.payment_status !== 'pending') return json({ error: 'Order is not payable with this provider' }, 409);
  try {
    const origin = Deno.env.get('PUBLIC_APP_URL') || new URL(req.url).origin;
    const result = provider === 'stripe'
      ? await stripeSession(Deno.env.get('STRIPE_SECRET_KEY') || '', origin, order)
      : await paypalOrder(Deno.env.get('PAYPAL_CLIENT_ID') || '', Deno.env.get('PAYPAL_CLIENT_SECRET') || '', origin, order);
    if (!result.provider_payment_id || !result.checkout_url) throw new Error('Payment provider returned no checkout URL');
    await admin.from('orders').update({ payment_provider: provider, provider_payment_id: result.provider_payment_id }).eq('id', order.id);
    return json({ ok: true, ...result });
  } catch (e) { return json({ error: e instanceof Error ? e.message : 'Payment setup failed' }, 400); }
});
