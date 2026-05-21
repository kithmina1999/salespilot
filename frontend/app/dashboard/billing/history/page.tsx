'use client';

import Link from 'next/link';
import { History, KeyRound, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useBillingStatus } from '@/hooks/useBillingStatus';
import BillingPageHeader from '@/components/billing/BillingPageHeader';

const STATUS_LABELS: Record<string, { label: string; classes: string }> = {
  pending:  { label: '⏳ Under Review', classes: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  approved: { label: '✅ Approved',     classes: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
  rejected: { label: '❌ Rejected',     classes: 'bg-red-500/15 text-red-400 border-red-500/25' },
};

function formatLKR(n: number) {
  return `Rs. ${n.toLocaleString('en-LK')}`;
}

export default function PaymentHistoryPage() {
  const router = useRouter();
  const { paymentStatus, isLoading } = useBillingStatus();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 pb-12 animate-in fade-in duration-500">
      <BillingPageHeader
        icon={History}
        title="Payment History"
        description="View your recent subscription payments and their status."
        actions={(
          <>
            <Link
              href="/dashboard/plans"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-bold text-foreground transition-colors hover:bg-accent"
            >
              <TrendingUp size={15} /> Plans
            </Link>
            <Link
              href="/dashboard/activate-code"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-black shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400"
            >
              <KeyRound size={15} /> Activate Code
            </Link>
          </>
        )}
      />

      <div className="max-w-5xl">
        {isLoading ? (
          <div className="h-32 rounded-2xl bg-secondary animate-pulse" />
        ) : !paymentStatus || !paymentStatus.has_proof ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">No payment history found.</p>
            <button
              onClick={() => router.push('/dashboard/plans')}
              className="mt-4 px-6 py-2 rounded-xl bg-emerald-500 text-black font-bold text-sm hover:bg-emerald-400 transition-colors"
            >
              View Plans
            </button>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="space-y-3">
              {[paymentStatus].map((p, i) => {
                const status = STATUS_LABELS[p.status] ?? { label: p.status, classes: 'bg-secondary text-muted-foreground border-border' };
                return (
                  <div key={i} className="flex items-center justify-between p-4 bg-background rounded-xl border border-border/60 gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-sm font-bold text-foreground capitalize">
                        {p.billing_cycle} Plan — {formatLKR(p.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Submitted{' '}
                        {new Date(p.submitted_at).toLocaleDateString('en-LK', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </p>
                      {p.status === 'rejected' && p.admin_note && (
                        <p className="text-xs text-red-400 mt-1">Reason: {p.admin_note}</p>
                      )}
                    </div>

                    <div className="shrink-0">
                      {p.status === 'approved' ? (
                        <button
                          onClick={() => router.push('/dashboard/activate-code')}
                          className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-full border transition-colors hover:opacity-80 ${status.classes}`}
                        >
                          {status.label} · Activate →
                        </button>
                      ) : (
                        <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-full border ${status.classes}`}>
                          {status.label}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
