/**
 * hooks/_shared.ts
 * Shared utilities (API_URL, fetcher) used by all hooks.
 * Import from here — never duplicate in individual hook files.
 */

// Authenticated browser requests must stay same-origin so the app-domain
// HttpOnly session cookie is sent on hosted deployments.
export const API_URL = '';

// Public/backend origin for values that must leave the app origin, such as
// webhook callback URLs and backend-hosted assets.
export const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export const jsonHeaders = { 'Content-Type': 'application/json' };

export async function apiFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
