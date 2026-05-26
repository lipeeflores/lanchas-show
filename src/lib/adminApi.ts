/**
 * Helpers for authenticated admin API calls. Stores the session token returned
 * by POST /api/admin/login in localStorage and attaches it as a Bearer token
 * to subsequent fetches. On 401 the token is cleared and the user is redirected
 * back to the login screen.
 */

const TOKEN_KEY = 'lanchas_show_admin_token';

export function getAdminToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('lanchas_show_auth');
}

export function isAdminAuthenticated(): boolean {
  return !!getAdminToken();
}

export async function adminLogin(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success || !data.token) {
      return { ok: false, error: data.error || 'Credenciais inválidas.' };
    }
    setAdminToken(data.token);
    localStorage.setItem('lanchas_show_auth', 'true');
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Falha ao conectar ao servidor.' };
  }
}

export async function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getAdminToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) {
    clearAdminSession();
    if (typeof window !== 'undefined' && !window.location.pathname.endsWith('/admin')) {
      window.location.href = '/admin';
    }
  }
  return res;
}

// ──────────────────────────────────────────────────────────────────
// REST convenience wrappers — return { data, error } in the same shape
// the Supabase client uses, so existing call-sites can switch over
// with minimal diff.
// ──────────────────────────────────────────────────────────────────

interface AdminResult<T = any> {
  data: T | null;
  error: { message: string } | null;
}

async function parseResult<T>(res: Response): Promise<AdminResult<T>> {
  let body: any = null;
  try { body = await res.json(); } catch { body = null; }
  if (!res.ok || !body || body.success === false) {
    return {
      data: null,
      error: { message: body?.error || `Falha na requisição (${res.status})` }
    };
  }
  return { data: (body.data ?? null) as T, error: null };
}

export async function adminPost<T = any>(url: string, body: any = {}): Promise<AdminResult<T>> {
  const res = await adminFetch(url, { method: 'POST', body: JSON.stringify(body) });
  return parseResult<T>(res);
}

export async function adminPatch<T = any>(url: string, body: any = {}): Promise<AdminResult<T>> {
  const res = await adminFetch(url, { method: 'PATCH', body: JSON.stringify(body) });
  return parseResult<T>(res);
}

export async function adminPut<T = any>(url: string, body: any = {}): Promise<AdminResult<T>> {
  const res = await adminFetch(url, { method: 'PUT', body: JSON.stringify(body) });
  return parseResult<T>(res);
}

export async function adminDelete<T = any>(url: string): Promise<AdminResult<T>> {
  const res = await adminFetch(url, { method: 'DELETE' });
  return parseResult<T>(res);
}
