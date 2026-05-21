'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, CreditCard } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useAppStore } from '@/lib/store';
import PlanStatusCard from '@/components/usage/PlanStatusCard';
import UsageMeterGrid from '@/components/usage/UsageMeterGrid';
import { DashboardSectionHeader } from '@/components/dashboard';
import BillingPageHeader from '@/components/billing/BillingPageHeader';

export default function UsagePage() {
  const usageLoaded = useAppStore((s) => s.usageLoaded);
  const fetchUsage  = useAppStore((s) => s.fetchUsage);
  const router = useRouter();

  // Ensure usage + billing data is fresh
  useEffect(() => {
    if (!usageLoaded) fetchUsage();
  }, [usageLoaded, fetchUsage]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 pb-12 animate-in fade-in duration-500">
      <BillingPageHeader
        icon={CreditCard}
        title="Usage & Plan"
        description="Monitor your monthly limits and active subscription status."
        actions={(
          <Link
            href="/dashboard/plans"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-black shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400"
          >
            View Plans <ArrowRight size={15} />
          </Link>
        )}
      />

      <div className="space-y-5">
        <DashboardSectionHeader
          title="My Plan"
          description="Limits reset monthly. Locked items require a paid plan or active trial."
        />

        <PlanStatusCard onUpgrade={() => router.push('/dashboard/plans')} />
        <UsageMeterGrid />
      </div>
    </div>
  );
}
