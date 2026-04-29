/**
 * hooks/_shared.ts
 * Shared utilities (API_URL, token, fetcher) used by all hooks.
 * Import from here — never duplicate in individual hook files.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

export async function apiFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
