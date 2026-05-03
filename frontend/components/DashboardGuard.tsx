'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export default function DashboardGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const token = useAppStore((s) => s.token);
  const fetchAll = useAppStore((s) => s.fetchAll);
  const clearSession = useAppStore((s) => s.clearSession);

  useEffect(() => {
    // 1. No token at all — kick to login
    const rawToken = token || localStorage.getItem('token');
    if (!rawToken) {
      clearSession();
      router.replace('/login');
      return;
    }

    // 2. Always fetch fresh data from the API on mount.
    // We intentionally do NOT skip based on `businessLoaded` because that flag
    // is set by setSession() at login time (before any real fetch), and skipping
    // here would mean usage/billing/plan data is never loaded for the session.
    const timeout = setTimeout(() => {
      // Hard 6s timeout — let user through if token exists
      setLoading(false);
    }, 6000);

    fetchAll()
      .then(() => {
        // Re-read from store after fetch
        const biz = useAppStore.getState().business;
        if (biz && !biz.onboarding_complete) {
          router.replace('/onboarding');
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        // Network error — let them through
        setLoading(false);
      })
      .finally(() => {
        clearTimeout(timeout);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 size={32} className="animate-spin text-emerald-500" />
      </div>
    );
  }

  return <>{children}</>;
}
