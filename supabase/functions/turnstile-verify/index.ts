import { corsHeaders } from '../_shared/cors.ts';
import { verifyTurnstile } from '../_shared/turnstile.ts';
Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST') return new Response('Method not allowed',{status:405,headers:corsHeaders});
  const token=(await req.json()).token;
  if(typeof token!=='string') return new Response(JSON.stringify({success:false}),{status:400,headers:{...corsHeaders,'Content-Type':'application/json'}});
  const ok=await verifyTurnstile(token,req.headers.get('CF-Connecting-IP')??undefined);
  return new Response(JSON.stringify({success:ok}),{status:ok?200:403,headers:{...corsHeaders,'Content-Type':'application/json'}});
});
