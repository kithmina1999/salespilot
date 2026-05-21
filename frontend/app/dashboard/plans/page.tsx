'use client';

import Link from 'next/link';
import { History, TrendingUp } from 'lucide-react';
import PlanCompareTable from '@/components/usage/PlanCompareTable';
import { useRouter } from 'next/navigation';
import BillingPageHeader from '@/components/billing/BillingPageHeader';

export default function PlansPage() {
  const router = useRouter();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 pb-12 animate-in fade-in duration-500">
      <BillingPageHeader
        icon={TrendingUp}
        title="Plans & Pricing"
        description="Compare plans and upgrade to unlock more features for your AI assistant."
        actions={(
          <Link
            href="/dashboard/billing/history"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-bold text-foreground transition-colors hover:bg-accent"
          >
            <History size={15} /> Payment History
          </Link>
        )}
      />

      <PlanCompareTable
        onUpgrade={(plan) => {
          router.push(`/dashboard/checkout?plan=${plan}&cycle=monthly`);
        }}
      />
    </div>
  );
}
