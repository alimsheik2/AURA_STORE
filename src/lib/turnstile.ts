export function loadTurnstile(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  if (document.getElementById('cf-turnstile-script')) return Promise.resolve();
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.id = 'cf-turnstile-script';
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
}

export async function verifyTurnstileToken(token: string): Promise<boolean> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url || !url.startsWith('http')) return true;
  try {
    const res = await fetch(`${url}/functions/v1/turnstile-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return true;
    const data = await res.json();
    return data.success !== false;
  } catch {
    return true;
  }
}

