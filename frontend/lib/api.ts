// All API calls use relative paths — routed through Next.js rewrites to the Go backend.
// This eliminates CORS entirely (same origin). See next.config.ts rewrites.

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/api/v1/auth/')) {
      // Global 401 catching: Session is dead. Drop credentials and kick to login.
      localStorage.removeItem('token');
      localStorage.removeItem('onboarding_passed');
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax';
      document.cookie = 'onboarding_passed=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax';
      window.location.href = '/login';
      // Throw so that .catch()/.finally() in callers still fire (cleanup runs),
      // while the redirect is already in-flight.
      throw new DOMException('Session expired', 'AbortError');
    }
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Request failed');
  }
  return res.json();
}
