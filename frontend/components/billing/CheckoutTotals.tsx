import { BillingAddon } from '@/hooks/useBillingOptions';

interface CheckoutTotalsProps {
  plan: string;
  cycle: string;
  monthlyPrice: number;
  annualPrice: number;
  selectedAddons: BillingAddon[];
}

export default function CheckoutTotals({
  plan,
  cycle,
  monthlyPrice,
  annualPrice,
  selectedAddons,
}: CheckoutTotalsProps) {
  const isSubscription = plan === 'starter' || plan === 'pro';
  const planPrice = isSubscription ? (cycle === 'monthly' ? monthlyPrice : annualPrice) : 0;

  const monthlyAddons = selectedAddons.filter((a) => a.billing_type === 'monthly');
  const monthlyAddonsTotal = monthlyAddons.reduce((sum, a) => sum + a.amount, 0);

  const oneTimeAddons = selectedAddons.filter((a) => a.billing_type === 'one_time');
  const oneTimeTotal = oneTimeAddons.reduce((sum, a) => sum + a.amount, 0);

  const grandTotal = planPrice + monthlyAddonsTotal + oneTimeTotal;

  function formatLKR(n: number) {
    if (!n) return '-';
    return `Rs. ${n.toLocaleString('en-LK')}`;
  }

  const savingsPct = isSubscription && monthlyPrice > 0 && annualPrice > 0
    ? Math.round((1 - annualPrice / (monthlyPrice * 12)) * 100)
    : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Order Summary</p>

      <div className="space-y-4">
        {isSubscription && (
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold capitalize text-foreground">{plan} Plan</p>
              <p className="text-xs text-muted-foreground capitalize">{cycle} Billing</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-foreground">{formatLKR(planPrice)}</p>
              {cycle === 'annual' && savingsPct > 0 && (
                <p className="text-[10px] text-emerald-400 font-bold">Save {savingsPct}%</p>
              )}
            </div>
          </div>
        )}

        {monthlyAddons.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-semibold text-muted-foreground">Monthly Add-ons</p>
            {monthlyAddons.map((addon) => (
              <div key={addon.key} className="flex items-center justify-between text-sm">
                <span>{addon.name}</span>
                <span className="font-medium">{formatLKR(addon.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {oneTimeAddons.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-semibold text-muted-foreground">One-time Services</p>
            {oneTimeAddons.map((addon) => (
              <div key={addon.key} className="flex items-center justify-between text-sm">
                <span>{addon.name}</span>
                <span className="font-medium">{formatLKR(addon.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-border flex justify-between items-center">
        <span className="font-semibold text-foreground">Total to pay today</span>
        <span className="text-xl font-black text-primary">{formatLKR(grandTotal)}</span>
      </div>
    </div>
  );
}
