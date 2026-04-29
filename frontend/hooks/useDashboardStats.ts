/**
 * hooks/useDashboardStats.ts
 * SWR hook for the main Dashboard page stats.
 *
 * Provides:
 *  - `stats` — dashboard stats keyed by range (30d / 7d / 90d)
 *  - `isLoading`, `error`
 *
 * The `range` parameter is part of the SWR key, so switching ranges
 * fires a new request and caches each result independently.
 */

import useSWR from 'swr';
import { API_URL, apiFetcher } from './_shared';

export function useDashboardStats(range: string = '30d') {
  const { data, error, isLoading } = useSWR(
    `${API_URL}/api/v1/dashboard/stats?range=${range}`,
    apiFetcher,
    { revalidateOnFocus: false }
  );

  return { stats: data, isLoading, error };
}
