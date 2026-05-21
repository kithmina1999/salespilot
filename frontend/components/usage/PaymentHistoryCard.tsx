'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface PaymentStatus {
  has_proof: boolean;
  status: string;
  billing_cycle: string;
  amount: number;
  activation_code: string;
  admin_note: string;
  submitted_at: string;
  reviewed_at: string | null;
}

type Tab = 'plan' | 'subscribe' | 'activate';

interface Props {
  onTabSwitch: (t: Tab) => void;
}

function formatLKR(n: number) {
  return `Rs. ${n.toLocaleString('en-LK')}`;
}

const STATUS_LABELS: Record<string, { label: string; classes: string }> = {
  pending:  { label: '⏳ Under Review', classes: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  approved: { label: '✅ Approved',     classes: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
  rejected: { label: '❌ Rejected',     classes: 'bg-red-500/15 text-red-400 border-red-500/25' },
};

export default function PaymentHistoryCard({ onTabSwitch }: Props) {
  const [proofs, setProofs] = useState<PaymentStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<PaymentStatus>('/api/v1/billing/payment-status')
      .then(d => { if (d.has_proof) setProofs([d]); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || proofs.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Payment History</p>
      <div className="space-y-3">
        {proofs.map((p, i) => {
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
                    onClick={() => onTabSwitch('activate')}
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
  );
}
