/**
 * hooks/useSettings.ts
 * SWR hook for the Settings page.
 *
 * Provides:
 *  - `settings` — current business settings
 *  - `saveSettings` — optimistic save with auto-rollback on failure
 *  - `revalidate` — force-refresh from server
 */

import useSWR from 'swr';
import { mutate } from 'swr';
import { toast } from 'sonner';
import { API_URL, apiFetcher } from './_shared';

// ── Cache key ─────────────────────────────────────────────────────────────────

export const SETTINGS_KEY = `${API_URL}/api/v1/settings/business`;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSettings() {
  const { data, error, isLoading, mutate: revalidate } = useSWR(
    SETTINGS_KEY,
    apiFetcher,
    { revalidateOnFocus: false }
  );

  /**
   * Optimistic save — UI reflects changes immediately.
   * On server failure: reverts and shows a toast.
   */
  async function saveSettings(updates: Record<string, unknown>) {
    await mutate(SETTINGS_KEY, { ...(data as object ?? {}), ...updates }, false);

    try {
      const res = await fetch(`${API_URL}/api/v1/settings/business`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Server error');
      toast.success('Settings saved');
      revalidate();
    } catch {
      toast.error('Failed to save settings — changes reverted');
      revalidate();
    }
  }

  return { settings: data, isLoading, error, saveSettings, revalidate };
}
