'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export default function DashboardGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const token = useAppStore((s) => s.token);
  const business = useAppStore((s) => s.business);
  const businessLoaded = useAppStore((s) => s.businessLoaded);
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

    // 2. Store already has data loaded — skip fetch
    if (businessLoaded && business) {
      if (!business.onboarding_complete) {
        router.replace('/onboarding');
      } else {
        setLoading(false);
      }
      return;
    }

    // 3. Fetch everything into the store with a hard 6s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      // Timeout — let user through if token exists
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
  }, [router, token, businessLoaded, business, fetchAll, clearSession]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 size={32} className="animate-spin text-emerald-500" />
      </div>
    );
  }

  return <>{children}</>;
}
