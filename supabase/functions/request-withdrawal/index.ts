import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
Deno.serve(async req=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
 const auth=req.headers.get('Authorization'); if(!auth) return new Response('Unauthorized',{status:401,headers:corsHeaders});
 const user=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}});
 const {data:{user:me}}=await user.auth.getUser(); if(!me) return new Response('Unauthorized',{status:401,headers:corsHeaders});
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const {amount,payout_method,payout_details}=await req.json();
 const n=Number(amount); if(!Number.isFinite(n)||n<=0) return new Response('Invalid amount',{status:400,headers:corsHeaders});
 const {data:wallet}=await admin.from('vendor_wallets').select('available_balance,currency').eq('vendor_id',me.id).maybeSingle();
 if(!wallet || Number(wallet.available_balance)<n) return new Response('Insufficient balance',{status:400,headers:corsHeaders});
 const {data,error}=await admin.from('withdrawal_requests').insert({vendor_id:me.id,amount:n,currency:wallet.currency,payout_method,payout_details}).select('id,status').single();
 if(error) return new Response(error.message,{status:500,headers:corsHeaders});
 await admin.from('audit_logs').insert({actor_id:me.id,action:'wallet.withdrawal_requested',entity_type:'withdrawal',entity_id:data.id,metadata:{amount:n,payout_method}});
 return new Response(JSON.stringify(data),{headers:{...corsHeaders,'Content-Type':'application/json'}});
});
