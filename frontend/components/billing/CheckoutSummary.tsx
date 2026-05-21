export default function CheckoutSummary({
  plan,
  cycle,
  monthlyPrice,
  annualPrice,
}: {
  plan: string;
  cycle: string;
  monthlyPrice: number;
  annualPrice: number;
}) {
  const price = cycle === 'monthly' ? monthlyPrice : annualPrice;
  const savingsPct = monthlyPrice > 0 && annualPrice > 0
    ? Math.round((1 - annualPrice / (monthlyPrice * 12)) * 100)
    : 0;

  function formatLKR(n: number) {
    if (!n) return '-';
    return `Rs. ${n.toLocaleString('en-LK')}`;
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Order Summary</p>
      
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-black capitalize text-foreground">{plan} Plan</h3>
          <p className="text-sm text-muted-foreground capitalize">{cycle} Billing</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-foreground">{formatLKR(price)}</p>
          {cycle === 'annual' && savingsPct > 0 && (
            <p className="text-xs text-emerald-400 font-bold">You save {savingsPct}%</p>
          )}
        </div>
      </div>
      
      <div className="pt-4 border-t border-border flex justify-between items-center text-sm">
        <span className="text-muted-foreground">Total to pay today</span>
        <span className="font-bold text-foreground text-lg">{formatLKR(price)}</span>
      </div>
    </div>
  );
}
