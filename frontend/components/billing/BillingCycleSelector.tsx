'use client';

export default function BillingCycleSelector({
  cycle,
  setCycle,
  monthlyPrice,
  annualPrice,
}: {
  cycle: 'monthly' | 'annual';
  setCycle: (c: 'monthly' | 'annual') => void;
  monthlyPrice: number;
  annualPrice: number;
}) {
  const savingsPct = monthlyPrice > 0 && annualPrice > 0
    ? Math.round((1 - annualPrice / (monthlyPrice * 12)) * 100)
    : 0;
  const annualMonthlyEquiv = Math.round(annualPrice / 12);

  function formatLKR(n: number) {
    if (!n) return '-';
    return `Rs. ${n.toLocaleString('en-LK')}`;
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Billing cycle</p>
      <div className="grid grid-cols-2 gap-3">
        {(['monthly', 'annual'] as const).map(c => {
          const btnPrice = c === 'monthly' ? monthlyPrice : annualPrice;

          return (
            <button
              key={c}
              type="button"
              onClick={() => setCycle(c)}
              className={`relative p-4 rounded-xl border text-left transition-all ${
                cycle === c
                  ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.08)]'
                  : 'border-border bg-black/40 hover:border-border'
              }`}
            >
              {c === 'annual' && (
                <span className={`absolute -top-3.5 left-3 text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${cycle === c ? 'bg-emerald-500 text-black' : 'bg-secondary text-muted-foreground'} whitespace-nowrap`}>
                  {savingsPct}% off
                </span>
              )}
              <p className="text-xs font-bold text-muted-foreground mb-1 capitalize mt-1">{c}</p>
              <p className="text-xl font-black text-foreground">{formatLKR(btnPrice)}</p>
              {c === 'annual' && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{formatLKR(annualMonthlyEquiv)}/mo</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
