/**
 * hooks/_shared.ts
 * Shared utilities (API_URL, fetcher) used by all hooks.
 * Import from here — never duplicate in individual hook files.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export const jsonHeaders = { 'Content-Type': 'application/json' };

export async function apiFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
