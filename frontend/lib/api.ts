// All API calls use relative paths — routed through Next.js rewrites to the Go backend.
// This eliminates CORS entirely (same origin). See next.config.ts rewrites.

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/api/v1/auth/')) {
      // Global 401 catching: Session is dead. Drop credentials and kick to login.
      clearLegacyAuthStorage();
      void fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
      document.cookie = 'onboarding_passed=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax';
      window.location.href = '/auth/login';
      // Throw so that .catch()/.finally() in callers still fire (cleanup runs),
      // while the redirect is already in-flight.
      throw new DOMException('Session expired', 'AbortError');
    }
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Request failed');
  }
  return res.json();
}

export function clearLegacyAuthStorage() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('onboarding_passed');

  const persisted = localStorage.getItem('salespilot-app');
  if (!persisted) return;

  try {
    const parsed = JSON.parse(persisted);
    if (parsed?.state && 'token' in parsed.state) {
      delete parsed.state.token;
      localStorage.setItem('salespilot-app', JSON.stringify(parsed));
    }
  } catch {
    localStorage.removeItem('salespilot-app');
  }
}
