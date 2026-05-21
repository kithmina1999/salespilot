'use client';

import { useState, useRef } from 'react';
import useSWR from 'swr';
import { Upload, Clock, CheckCircle2, AlertCircle, FileImage, ChevronRight, Loader2 } from 'lucide-react';
import { API_URL } from '@/hooks/_shared';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';

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

type Cycle = 'monthly' | 'annual';
type PlanKey = 'starter' | 'pro';

interface BankDetails {
  configured: boolean;
  bank_name: string;
  branch: string;
  account_no: string;
  account_name: string;
  support_phone: string;
}

interface BillingOptions {
  bank_details: BankDetails;
  pricing?: {
    starter?: { monthly: number; annual: number };
    pro?: { monthly: number; annual: number };
  };
}

interface Props {
  paymentStatus: PaymentStatus | null;
  onRefresh: () => void;
  onActivateTab: () => void;
  /** Pre-select a plan when navigating from the plan comparison table CTA */
  initialPlan?: PlanKey;
}

function formatLKR(n: number) {
  if (!n) return '-';
  return `Rs. ${n.toLocaleString('en-LK')}`;
}

export default function SubscribeTab({ paymentStatus, onRefresh, onActivateTab, initialPlan }: Props) {
  const pricing = useAppStore((s) => s.pricing);
  const { data: billingOptions, isLoading: loadingBillingOptions } = useSWR<BillingOptions>(
    '/api/v1/billing/options',
    (path: string) => apiFetch<BillingOptions>(path),
    { revalidateOnFocus: false }
  );

  const [selectedPlan, setSelectedPlan] = useState<PlanKey>(initialPlan ?? 'starter');
  const [syncedInitialPlan, setSyncedInitialPlan] = useState<PlanKey | undefined>(initialPlan);
  const [cycle, setCycle] = useState<Cycle>('monthly');

  if (initialPlan && initialPlan !== syncedInitialPlan) {
    setSyncedInitialPlan(initialPlan);
    if (selectedPlan !== initialPlan) setSelectedPlan(initialPlan);
  } else if (!initialPlan && syncedInitialPlan) {
    setSyncedInitialPlan(undefined);
  }
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasPending = paymentStatus?.status === 'pending';
  const hasRejected = paymentStatus?.status === 'rejected';
  const hasApproved = paymentStatus?.status === 'approved';

  // Dynamic prices from backend via store
  const plans: Record<PlanKey, { label: string; monthly: number; annual: number }> = {
    starter: {
      label: 'Starter',
      monthly: billingOptions?.pricing?.starter?.monthly ?? pricing?.starter?.monthly ?? 0,
      annual: billingOptions?.pricing?.starter?.annual ?? pricing?.starter?.annual ?? 0,
    },
    pro: {
      label: 'Pro',
      monthly: billingOptions?.pricing?.pro?.monthly ?? pricing?.pro?.monthly ?? 0,
      annual: billingOptions?.pricing?.pro?.annual ?? pricing?.pro?.annual ?? 0,
    },
  };

  const currentPlan = plans[selectedPlan];
  const price = cycle === 'monthly' ? currentPlan.monthly : currentPlan.annual;
  const savingsPct = currentPlan.monthly > 0 && currentPlan.annual > 0
    ? Math.round((1 - currentPlan.annual / (currentPlan.monthly * 12)) * 100)
    : 0;
  const bankDetails = billingOptions?.bank_details;
  const bankConfigured = Boolean(bankDetails?.configured);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast.error('Only image files are accepted'); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bankConfigured) { toast.error('Bank transfer details are not configured yet'); return; }
    if (!file) { toast.error('Please select your payment screenshot'); return; }
    setUploading(true);
    const token = localStorage.getItem('token');
    try {
      const form = new FormData();
      form.append('image', file);
      form.append('billing_cycle', cycle);
      form.append('plan', selectedPlan);
      const res = await fetch(
        `${API_URL}/api/v1/billing/submit-proof`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      toast.success("Payment proof submitted! We'll verify and send your code via email soon.");
      setFile(null); setPreview(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Status banners */}
      {hasApproved && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
          <CheckCircle2 size={20} className="shrink-0" />
          <div className="flex-1">
            <p className="font-bold">Payment Approved! ✅</p>
            <p className="text-sm opacity-80">Your activation code has been sent to your email.</p>
          </div>
          <button
            onClick={onActivateTab}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-black font-black text-sm"
          >
            Activate <ChevronRight size={14} />
          </button>
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

      {/* Form — hidden while pending/approved */}
      {!hasPending && !hasApproved && (
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* How it works */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">How to subscribe</p>
            <ol className="space-y-3">
              {[
                { n: '1', t: 'Pick a plan & cycle', d: 'Choose Starter or Pro, and whether to pay monthly or annually.' },
                { n: '2', t: 'Transfer via bank', d: 'Use your registered WhatsApp number as the payment reference.' },
                { n: '3', t: 'Upload screenshot', d: 'Take a photo of your bank receipt and upload it below.' },
                { n: '4', t: 'Get your code by email', d: 'We verify and send your activation code within a few hours.' },
              ].map(s => (
                <li key={s.n} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                    {s.n}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{s.t}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Plan selector (Starter / Pro) */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Choose plan</p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {(Object.keys(plans) as PlanKey[]).map(pk => (
                <button
                  key={pk}
                  type="button"
                  onClick={() => setSelectedPlan(pk)}
                  className={`relative p-4 rounded-xl border text-left transition-all ${
                    selectedPlan === pk
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-border bg-black/40 hover:border-border'
                  }`}
                >
                  {pk === 'starter' && (
                    <span className={`absolute -top-2.5 left-3 text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${selectedPlan === pk ? 'bg-emerald-500 text-black' : 'bg-secondary text-muted-foreground'}`}>
                      Popular
                    </span>
                  )}
                  <p className="text-sm font-black text-foreground mt-1">{plans[pk].label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    From {formatLKR(plans[pk].monthly)}/mo
                  </p>
                </button>
              ))}
            </div>

            {/* Cycle selector (Monthly / Annual) */}
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Billing cycle</p>
            <div className="grid grid-cols-2 gap-3">
              {(['monthly', 'annual'] as Cycle[]).map(c => {
                // Each button shows ITS OWN price, not the selected cycle's price
                const btnPrice = c === 'monthly' ? currentPlan.monthly : currentPlan.annual;
                const btnMonthlyEquiv = Math.round(currentPlan.annual / 12);

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
                        2 months free · {savingsPct}% off
                      </span>
                    )}
                    <p className="text-xs font-bold text-muted-foreground mb-1 capitalize mt-1">{c}</p>
                    <p className="text-xl font-black text-foreground">{formatLKR(btnPrice)}</p>
                    {c === 'annual' && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{formatLKR(btnMonthlyEquiv)}/mo</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bank details */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Bank Account Details</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {(bankConfigured && bankDetails ? [
                ['Bank', bankDetails.bank_name],
                ['Branch', bankDetails.branch],
                ['Account No', bankDetails.account_no],
                ['Account Name', bankDetails.account_name],
              ] : []).map(([label, val]) => (
                <div key={label}>
                  <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider mb-0.5">{label}</p>
                  <p className="text-foreground font-mono font-bold">{val}</p>
                </div>
              ))}
            </div>
            {loadingBillingOptions && (
              <div className="h-10 rounded-lg bg-secondary animate-pulse" />
            )}
            {!loadingBillingOptions && !bankConfigured && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
                Bank transfer details are being configured. Payment proof upload is paused until the platform owner adds the account details.
              </div>
            )}
            <div className="pt-3 border-t border-border text-xs text-muted-foreground space-y-1">
              <p className='text-foreground text-lg'><span className="text-emerald-400 text-lg font-bold">Transfer Amount: </span>{formatLKR(price)}/=</p>
              <p><span className="text-emerald-400 font-bold">Reference: </span>Your WhatsApp number (e.g. 0771234567)</p>
            </div>
          </div>

          {/* Screenshot upload */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Upload Payment Screenshot</p>

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-xl border-2 border-dashed transition-all ${
                preview
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-border hover:border-zinc-600 bg-background'
              } flex flex-col items-center justify-center min-h-[150px] p-6`}
            >
              {preview ? (
                <div className="flex flex-col items-center gap-3">
                  <img src={preview} alt="Preview" className="max-h-40 rounded-lg object-contain shadow-lg" />
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5"><FileImage size={12} /> {file?.name}</p>
                  <p className="text-xs text-emerald-400 font-bold">Click to change</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                    <Upload size={20} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-muted-foreground">Click to upload screenshot</p>
                    <p className="text-xs text-zinc-600 mt-1">JPG, PNG — Max 5 MB</p>
                  </div>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

            <button
              type="submit"
              disabled={uploading || !file || !bankConfigured}
              className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-secondary disabled:text-zinc-600 text-black font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:shadow-none"
            >
              {uploading
                ? <><Loader2 size={16} className="animate-spin" /> Submitting...</>
                : <><Upload size={16} /> Submit Payment Proof</>
              }
            </button>

            {bankDetails?.support_phone && (
            <p className="text-xs text-zinc-600 text-center">
              Prefer WhatsApp?{' '}
              <a
                href={`https://wa.me/${bankDetails.support_phone}?text=Hi%2C+I%27ve+paid+for+SalesPilot`}
                target="_blank" rel="noreferrer"
                className="text-emerald-400 hover:underline"
              >
                Send screenshot on WhatsApp →
              </a>
            </p>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
