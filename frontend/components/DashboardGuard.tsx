'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export default function DashboardGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const hydrateSession = useAppStore((s) => s.hydrateSession);
  const fetchAll = useAppStore((s) => s.fetchAll);
  const clearSession = useAppStore((s) => s.clearSession);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 6000);

    hydrateSession()
      .then((ok) => {
        if (!ok) {
          clearSession();
          router.replace('/auth/login');
          return Promise.reject(new Error('unauthenticated'));
        }
        return fetchAll();
      })
      .then(() => {
        const biz = useAppStore.getState().business;
        if (biz && !biz.onboarding_complete) {
          router.replace('/onboarding');
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        setLoading(false);
      })
      .finally(() => {
        clearTimeout(timeout);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 size={32} className="animate-spin text-emerald-500" />
      </div>
    );
  }

  return <>{children}</>;
}
