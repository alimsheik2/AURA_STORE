import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...corsHeaders,'Content-Type':'application/json'}});

async function stripeVerify(secret:string, sig:string, raw:string) {
  // Signature verification is delegated to Stripe's official signing scheme using Web Crypto.
  const parts = Object.fromEntries(sig.split(',').map(x => x.split('=')));
  if (!parts.t || !parts.v1) throw new Error('Invalid Stripe signature');
  const age = Math.abs(Date.now()/1000 - Number(parts.t)); if (!Number.isFinite(age) || age > 300) throw new Error('Expired Stripe signature');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${parts.t}.${raw}`));
  const hex = [...new Uint8Array(signed)].map(b=>b.toString(16).padStart(2,'0')).join('');
  if (hex !== parts.v1) throw new Error('Invalid Stripe signature');
}

Deno.serve(async req=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST') return json({error:'Method not allowed'},405);
 const provider = req.headers.get('x-payment-provider') || (req.headers.get('paypal-transmission-id') ? 'paypal' : 'stripe');
 const raw = await req.text();
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 try {
   if(provider==='stripe') {
     await stripeVerify(Deno.env.get('STRIPE_WEBHOOK_SECRET')||'', req.headers.get('stripe-signature')||'', raw);
     const event=JSON.parse(raw); const obj=event.data?.object; const orderId=obj?.metadata?.order_id;
     if(!orderId) return json({ok:true,ignored:true});
     const status = event.type==='checkout.session.completed' ? 'paid' : event.type==='payment_intent.payment_failed' ? 'failed' : null;
     if(!status) return json({ok:true,ignored:true});
     await admin.rpc('apply_verified_payment_event',{p_provider:'stripe',p_provider_event_id:event.id,p_event_type:event.type,p_provider_payment_id:obj?.id||obj?.payment_intent||null,p_order_id:orderId,p_new_status:status,p_payload:event});
     return json({ok:true});
   }
   return json({error:'PayPal webhook endpoint requires PayPal transmission verification before enabling it'},501);
 } catch(e) { return json({error:e instanceof Error?e.message:'Webhook verification failed'},400); }
});
