import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyTurnstile } from '../_shared/turnstile.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
};
const makeCode = () => Math.floor(100000 + Math.random() * 900000).toString();

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;
  const email = String(body.email ?? '').trim().toLowerCase();
  const purpose = body.purpose === 'signup' ? 'signup' : 'login';
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'Valid email required' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const ip = req.headers.get('CF-Connecting-IP') ?? req.headers.get('x-forwarded-for') ?? 'unknown';
  const buckets = [`otp:${purpose}:email:${email}`, `otp:${purpose}:ip:${ip}`];
  for (const bucket of buckets) { const rl = await admin.rpc('consume_rate_limit', { p_bucket: bucket, p_limit: 3, p_window_seconds: 60 }); if (rl.error || rl.data === false) return json({ error: 'Too many OTP requests. Try again later.' }, 429); }

  if (action === 'send') {
    if (body.turnstile_token) {
      const ok = await verifyTurnstile(String(body.turnstile_token), req.headers.get('CF-Connecting-IP') ?? undefined);
      if (!ok) return json({ error: 'Bot verification failed' }, 403);
    }
    if (body.precheck_only) return json({ ok: true });
    const code = makeCode();
    const codeHash = await sha256(code);
    await admin.from('auth_otp_challenges').update({ consumed_at: new Date().toISOString() }).eq('email', email).eq('purpose', purpose).is('consumed_at', null);
    const { error } = await admin.from('auth_otp_challenges').insert({ email, purpose, code_hash: codeHash, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
    if (error) return json({ error: 'Could not create OTP' }, 500);
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('OTP_FROM_EMAIL');
    if (!resendKey || !from) return json({ error: 'Email provider is not configured' }, 500);
    const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [email], subject: `Your ShopVerse verification code`, html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px"><h2>ShopVerse verification</h2><p>Your verification code is:</p><div style="font-size:34px;font-weight:700;letter-spacing:10px;padding:18px;background:#f3f4f6;border-radius:12px;text-align:center">${code}</div><p>This code expires in 10 minutes. If you did not request it, ignore this email.</p></div>` }) });
    if (!res.ok) return json({ error: 'Could not send OTP email' }, 502);
    return json({ ok: true });
  }

  if (action === 'verify') {
    const token = String(body.token ?? '').replace(/\D/g, '');
    if (!/^\d{6}$/.test(token)) return json({ error: 'Invalid code' }, 400);
    const hash = await sha256(token);
    const { data, error } = await admin.rpc('consume_auth_otp', { p_email: email, purpose, p_code_hash: hash });
    if (error || data !== true) return json({ error: 'Invalid or expired code' }, 400);
    return json({ ok: true });
  }
  return json({ error: 'Unsupported action' }, 400);
});
