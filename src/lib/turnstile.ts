export function loadTurnstile(): Promise<void> {
  if (document.getElementById('cf-turnstile-script')) return Promise.resolve();
  return new Promise((resolve,reject)=>{ const s=document.createElement('script'); s.id='cf-turnstile-script'; s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async=true; s.defer=true; s.onload=()=>resolve(); s.onerror=reject; document.head.appendChild(s); });
}
export async function verifyTurnstileToken(token:string) {
  const res=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/turnstile-verify`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
  if(!res.ok) throw new Error('Bot verification failed');
  return (await res.json()).success===true;
}
