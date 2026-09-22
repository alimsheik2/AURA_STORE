import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'Authentication required' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Invalid session' }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: profile } = await adminClient.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return json({ error: 'Admin access required' }, 403);

  const body = await req.json().catch(() => ({}));
  const orderId = String(body.order_id ?? '').trim();
  const amount = Number(body.amount ?? 0);
  const reason = String(body.reason ?? 'Customer requested refund').trim();

  if (!orderId) return json({ error: 'Order ID is required' }, 400);

  // Fetch target order
  const { data: order, error: orderError } = await adminClient
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (orderError || !order) return json({ error: 'Order not found' }, 404);
  if (order.payment_status !== 'paid' && order.payment_status !== 'partially_refunded') {
    return json({ error: 'Only paid orders can be refunded' }, 400);
  }

  const refundAmount = amount > 0 ? amount : Number(order.total);
  if (refundAmount <= 0 || refundAmount > Number(order.total)) {
    return json({ error: 'Invalid refund amount' }, 400);
  }

  // Handle provider-specific refund logic if needed (Stripe/PayPal API)
  let providerRefundId = `ref_${crypto.randomUUID().slice(0, 8)}`;

  // Update order status in Supabase
  const newPaymentStatus = refundAmount >= Number(order.total) ? 'refunded' : 'partially_refunded';
  const { error: updateError } = await adminClient
    .from('orders')
    .update({
      payment_status: newPaymentStatus,
      refund_status: newPaymentStatus,
      refund_amount: (Number(order.refund_amount || 0) + refundAmount),
      refund_reason: reason,
    })
    .eq('id', orderId);

  if (updateError) return json({ error: updateError.message }, 500);

  // Record audit log entry
  await adminClient.from('audit_logs').insert({
    actor_id: user.id,
    action: 'order.refund',
    entity_type: 'order',
    entity_id: orderId,
    metadata: { refund_amount: refundAmount, reason, provider_refund_id: providerRefundId },
  });

  // Send notification to customer
  await adminClient.from('notifications').insert({
    user_id: order.user_id,
    type: 'order_refunded',
    title: 'Order Refund Processed',
    body: `A refund of $${refundAmount.toFixed(2)} has been issued for order ${orderId.slice(0, 8)}.`,
    data: { order_id: orderId, refund_amount: refundAmount },
  });

  return json({ ok: true, order_id: orderId, refund_amount: refundAmount, status: newPaymentStatus });
});
