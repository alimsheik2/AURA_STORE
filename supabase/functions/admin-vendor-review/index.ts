import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
Deno.serve(async req=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
 const auth=req.headers.get('Authorization'); if(!auth) return new Response('Unauthorized',{status:401,headers:corsHeaders});
 const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}});
 const {data:{user}}=await client.auth.getUser(); if(!user) return new Response('Unauthorized',{status:401,headers:corsHeaders});
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const {data:me}=await admin.from('profiles').select('role').eq('id',user.id).single(); if(me?.role!=='admin') return new Response('Forbidden',{status:403,headers:corsHeaders});
 const body=await req.json();
 const {vendor_id,status,rejection_reason,commission_rate,action}=body;
 if(action==='document_url'){
   const {data:kyc}=await admin.from('vendor_kyc').select('document_path').eq('user_id',vendor_id).maybeSingle();
   if(!kyc?.document_path) return new Response(JSON.stringify({ok:false,error:'No document'}),{status:404,headers:{...corsHeaders,'Content-Type':'application/json'}});
   const {data:signed,error}=await admin.storage.from('vendor-kyc').createSignedUrl(kyc.document_path,300);
   if(error) return new Response(JSON.stringify({ok:false,error:error.message}),{status:500,headers:{...corsHeaders,'Content-Type':'application/json'}});
   return new Response(JSON.stringify({ok:true,url:signed?.signedUrl}),{headers:{...corsHeaders,'Content-Type':'application/json'}});
 }
 if(!['approved','rejected','pending'].includes(status)) return new Response('Invalid status',{status:400,headers:corsHeaders});
 await admin.from('vendor_kyc').update({status,rejection_reason:rejection_reason??null,reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq('user_id',vendor_id);
 await admin.from('profiles').update({status:status==='approved'?'active':status==='rejected'?'rejected':'pending'}).eq('id',vendor_id);
 await admin.from('shops').update({status:status==='approved'?'approved':status==='rejected'?'suspended':'pending'}).eq('owner_id',vendor_id);
 if(status==='approved' && commission_rate!=null) await admin.from('vendor_commissions').upsert({vendor_id,commission_rate,updated_by:user.id});
 await admin.from('audit_logs').insert({actor_id:user.id,action:'vendor.kyc_reviewed',entity_type:'vendor',entity_id:vendor_id,metadata:{status,commission_rate}});
 return new Response(JSON.stringify({ok:true}),{headers:{...corsHeaders,'Content-Type':'application/json'}});
});
