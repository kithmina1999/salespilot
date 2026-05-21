'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Banknote, CheckCircle2, Clock, AlertCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';

import { useBillingStatus } from '@/hooks/useBillingStatus';
import { useBillingOptions } from '@/hooks/useBillingOptions';
import { useAppStore } from '@/lib/store';
import { API_URL } from '@/hooks/_shared';

import CheckoutTotals from '@/components/billing/CheckoutTotals';
import CheckoutAddons from '@/components/billing/CheckoutAddons';
import BankTransferDetails from '@/components/billing/BankTransferDetails';
import BillingCycleSelector from '@/components/billing/BillingCycleSelector';
import PaymentProofUploader from '@/components/billing/PaymentProofUploader';
import BillingPageHeader from '@/components/billing/BillingPageHeader';

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const queryPlan = searchParams.get('plan') as 'starter' | 'pro' | 'addons' | null;
  const queryCycle = searchParams.get('cycle') as 'monthly' | 'annual' | null;

  const { paymentStatus, refreshStatus } = useBillingStatus();
  const { billingOptions, isLoading: loadingOptions } = useBillingOptions();
  const pricing = useAppStore((s) => s.pricing);
  
  const [cycle, setCycle] = useState<'monthly' | 'annual'>(queryCycle ?? 'monthly');
  const [uploading, setUploading] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  useEffect(() => {
    if (!queryPlan || (queryPlan !== 'starter' && queryPlan !== 'pro' && queryPlan !== 'addons')) {
      router.replace('/dashboard/plans');
    }
  }, [queryPlan, router]);

  if (!queryPlan || (queryPlan !== 'starter' && queryPlan !== 'pro' && queryPlan !== 'addons')) {
    return null; // Will redirect
  }

  const hasPending = paymentStatus?.status === 'pending';
  const hasRejected = paymentStatus?.status === 'rejected';
  const hasApproved = paymentStatus?.status === 'approved';

  const isSubscription = queryPlan === 'starter' || queryPlan === 'pro';
  const latestCheckoutType = paymentStatus?.checkout_type ?? (paymentStatus?.plan ? 'subscription' : 'addon_only');
  const latestIsSubscriptionCheckout = latestCheckoutType === 'subscription' || latestCheckoutType === 'mixed';
  const blocksCurrentCheckout = hasPending && isSubscription && latestIsSubscriptionCheckout;

  const monthlyPrice = isSubscription ? (billingOptions?.pricing?.[queryPlan]?.monthly ?? pricing?.[queryPlan]?.monthly ?? 0) : 0;
  const annualPrice = isSubscription ? (billingOptions?.pricing?.[queryPlan]?.annual ?? pricing?.[queryPlan]?.annual ?? 0) : 0;
  const currentPrice = cycle === 'monthly' ? monthlyPrice : annualPrice;
  const bankConfigured = Boolean(billingOptions?.bank_details?.configured);

  const selectedAddonObjects = (billingOptions?.addons ?? []).filter(a => selectedAddons.includes(a.key));
  const addonsTotal = selectedAddonObjects.reduce((sum, a) => sum + a.amount, 0);
  const totalAmount = currentPrice + addonsTotal;

  async function handleProofSubmit(file: File) {
    if (!bankConfigured) { toast.error('Bank transfer details are not configured yet'); return; }
    
    setUploading(true);
    const token = localStorage.getItem('token');
    try {
      const form = new FormData();
      form.append('image', file);
      if (isSubscription) {
        form.append('billing_cycle', cycle);
        form.append('plan', queryPlan as string);
      }
      selectedAddons.forEach(addon => {
        form.append('addon_keys', addon);
      });
      
      const res = await fetch(`${API_URL}/api/v1/billing/submit-proof`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      
      toast.success("Payment proof submitted! We'll verify and send your code via email soon.");
      refreshStatus();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12 animate-in fade-in duration-500">
        <button 
          onClick={() => router.push('/dashboard/plans')}
          className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} /> Back to plans
        </button>

        <BillingPageHeader
          icon={Banknote}
          title="Checkout"
          description="Complete your subscription via bank transfer."
        />

        {hasApproved && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <CheckCircle2 size={20} className="shrink-0" />
            <div className="flex-1">
              <p className="font-bold">Payment Approved! ✅</p>
              <p className="text-sm opacity-80">
                {latestIsSubscriptionCheckout
                  ? 'Your activation code has been sent to your email.'
                  : 'Your service payment has been approved.'}
              </p>
            </div>
            {latestIsSubscriptionCheckout && (
              <button
                onClick={() => router.push('/dashboard/activate-code')}
                className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-black font-black text-sm"
              >
                Activate <ChevronRight size={14} />
              </button>
            )}
          </div>
        )}

        {hasPending && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
            <Clock size={20} className="shrink-0 animate-pulse" />
            <div>
              <p className="font-bold">Under Review ⏳</p>
              <p className="text-sm opacity-80">
                Your <strong>{paymentStatus!.billing_cycle}</strong> payment was submitted on{' '}
                {new Date(paymentStatus!.submitted_at).toLocaleDateString('en-LK', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}. We'll email your activation code once verified.
              </p>
            </div>
          </div>
        )}

        {hasRejected && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400">
            <AlertCircle size={20} className="shrink-0" />
            <div>
              <p className="font-bold">Payment Could Not Be Verified ❌</p>
              {paymentStatus?.admin_note && (
                <p className="text-sm opacity-80 mt-0.5">Reason: <strong>{paymentStatus.admin_note}</strong></p>
              )}
              <p className="text-sm opacity-70 mt-0.5">Please resubmit a clearer screenshot below.</p>
            </div>
          </div>
        )}

        {!blocksCurrentCheckout && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-6">
              {isSubscription && (
                <BillingCycleSelector
                  cycle={cycle}
                  setCycle={setCycle}
                  monthlyPrice={monthlyPrice}
                  annualPrice={annualPrice}
                />
              )}

              <CheckoutAddons
                addons={billingOptions?.addons ?? []}
                purchasedAddonKeys={billingOptions?.purchased_addons ?? []}
                selectedAddonKeys={selectedAddons}
                waStatus={billingOptions?.business_connection_status?.wa_status}
                onToggleAddon={(addon) => {
                  setSelectedAddons(prev =>
                    prev.includes(addon.key)
                      ? prev.filter(k => k !== addon.key)
                      : [...prev, addon.key]
                  );
                }}
              />

              <BankTransferDetails
                bankDetails={billingOptions?.bank_details}
                loading={loadingOptions}
                price={totalAmount}
              />
              <PaymentProofUploader
                uploading={uploading}
                onSubmit={handleProofSubmit}
                disabled={!bankConfigured || totalAmount <= 0}
                supportPhone={billingOptions?.bank_details?.support_phone}
              />
            </div>
            <div>
              <div className="sticky top-24">
                <CheckoutTotals
                  plan={queryPlan}
                  cycle={cycle}
                  monthlyPrice={monthlyPrice}
                  annualPrice={annualPrice}
                  selectedAddons={selectedAddonObjects}
                />
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground animate-pulse">Loading checkout...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
