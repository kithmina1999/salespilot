'use client';

import Link from 'next/link';
import { History, KeyRound, TrendingUp } from 'lucide-react';
import ActivateTab from '@/components/usage/ActivateTab';
import { useBillingStatus } from '@/hooks/useBillingStatus';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import BillingPageHeader from '@/components/billing/BillingPageHeader';

export default function ActivateCodePage() {
  const router = useRouter();
  const { paymentStatus, refreshStatus } = useBillingStatus();
  const fetchUsage = useAppStore((s) => s.fetchUsage);

  const prefilledCode = paymentStatus?.status === 'approved' ? paymentStatus.activation_code : '';

  function handleActivated() {
    refreshStatus();
    fetchUsage();
    router.push('/dashboard/usage');
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 pb-12 animate-in fade-in duration-500">
      <BillingPageHeader
        icon={KeyRound}
        title="Activate Code"
        description="Redeem an activation code to instantly upgrade your plan limits."
        actions={(
          <>
            <Link
              href="/dashboard/plans"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-bold text-foreground transition-colors hover:bg-accent"
            >
              <TrendingUp size={15} /> Plans
            </Link>
            <Link
              href="/dashboard/billing/history"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-bold text-foreground transition-colors hover:bg-accent"
            >
              <History size={15} /> History
            </Link>
          </>
        )}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <ActivateTab
            prefilledCode={prefilledCode}
            onActivated={handleActivated}
            onGoSubscribe={() => router.push('/dashboard/plans')}
          />
        </div>

        <aside className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Payment Status</p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-xl border border-border/60 bg-background p-4">
              <p className="text-muted-foreground">Latest status</p>
              <p className="mt-1 text-lg font-black capitalize text-foreground">
                {paymentStatus?.has_proof ? paymentStatus.status : 'No payment found'}
              </p>
            </div>
            {paymentStatus?.status === 'approved' && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-400">
                <p className="font-bold">Code ready</p>
                <p className="mt-1 text-sm opacity-80">The approved code is pre-filled in the activation form.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
