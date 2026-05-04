'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Banknote, KeyRound } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { apiFetch } from '@/lib/api';

import PlanStatusCard    from '@/components/usage/PlanStatusCard';
import UsageMeterGrid    from '@/components/usage/UsageMeterGrid';
import PlanCompareTable  from '@/components/usage/PlanCompareTable';
import PaymentHistoryCard from '@/components/usage/PaymentHistoryCard';
import SubscribeTab      from '@/components/usage/SubscribeTab';
import ActivateTab       from '@/components/usage/ActivateTab';
import { DashboardSectionHeader, SegmentedControl } from '@/components/dashboard';

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UsagePage() {
  const usageLoaded = useAppStore((s) => s.usageLoaded);
  const fetchUsage  = useAppStore((s) => s.fetchUsage);
  const business    = useAppStore((s) => s.business);

  const [tab, setTab] = useState<Tab>('plan');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  // Tracks which plan the user clicked from the comparison table CTA
  const [upgradeInitialPlan, setUpgradeInitialPlan] = useState<'starter' | 'pro'>('starter');

  // Ensure usage + billing data is fresh
  useEffect(() => {
    if (!usageLoaded) fetchUsage();
  }, [usageLoaded, fetchUsage]);

  // Load payment status (not stored globally — it's billing-specific)
  function loadPaymentStatus() {
    apiFetch<PaymentStatus>('/api/v1/billing/payment-status')
      .then(setPaymentStatus)
      .catch(() => {});
  }

  useEffect(() => { loadPaymentStatus(); }, []);

  // Handle redirect params — e.g. /usage?tab=subscribe from TrialBanner
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'subscribe') setTab('subscribe');
    if (params.get('tab') === 'activate')  setTab('activate');
  }, []);

  // Auto-jump to activate tab when an approved code is waiting
  useEffect(() => {
    if (paymentStatus?.status === 'approved' && paymentStatus.activation_code) {
      setTab('activate');
    }
  }, [paymentStatus]);

  function handleRefresh() {
    loadPaymentStatus();
    fetchUsage(); // Sync store in case plan changed
  }

  // Badge on Activate tab when code is ready
  const activateBadge =
    paymentStatus?.status === 'approved' && paymentStatus.activation_code;

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: boolean }[] = [
    { id: 'plan',      label: 'My Plan',      icon: <TrendingUp size={15} /> },
    { id: 'subscribe', label: 'Subscribe',     icon: <Banknote size={15} /> },
    { id: 'activate',  label: 'Activate Code', icon: <KeyRound size={15} />, badge: !!activateBadge },
  ];

  const plan = business?.plan ?? 'free';
  const isPaid = plan === 'starter' || plan === 'pro';

  return (
    <div className="max-w-7xl mx-auto w-full pb-12">
      <div className="max-w-3xl mx-auto">

      {/* Page header */}
      <div className="pb-6 mb-8 border-b border-zinc-800">
        <h1 className="text-3xl font-black tracking-tight text-zinc-100 flex items-center gap-3">
          <TrendingUp className="w-7 h-7 text-emerald-400" />
          Usage &amp; Plan
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Monitor monthly limits, subscribe to a plan, or activate an approved billing code.
        </p>
      </div>

      <SegmentedControl
        label="Usage and billing section"
        options={tabs.map(t => ({
          value: t.id,
          label: t.label,
          icon: (
            <span className="relative inline-flex">
              {t.icon}
              {t.badge && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-emerald-400" />}
            </span>
          ),
        }))}
        value={tab}
        onChange={setTab}
        className="mb-8"
      />

      {/* ── Tab: My Plan ── */}
      {tab === 'plan' && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <DashboardSectionHeader
            title="My Plan"
            description="Limits reset monthly. Locked items require a paid plan or active trial."
          />

          {/* Plan status with trial ring */}
          <PlanStatusCard onUpgrade={() => setTab('subscribe')} />

          {/* All usage meters */}
          <UsageMeterGrid />

          {/* Payment proof history */}
          <PaymentHistoryCard onTabSwitch={setTab} />

          {/* Compact plan comparison — only shown for free/trial/starter users */}
          {plan !== 'pro' && (
            <PlanCompareTable onUpgrade={(selectedPlan) => {
              setUpgradeInitialPlan(selectedPlan);
              setTab('subscribe');
            }} />
          )}
        </div>
      )}

      {/* ── Tab: Subscribe ── */}
      {tab === 'subscribe' && (
        <SubscribeTab
          paymentStatus={paymentStatus}
          onRefresh={handleRefresh}
          onActivateTab={() => setTab('activate')}
          initialPlan={upgradeInitialPlan}
        />
      )}

      {/* ── Tab: Activate Code ── */}
      {tab === 'activate' && (
        <ActivateTab
          prefilledCode={
            paymentStatus?.status === 'approved' ? paymentStatus.activation_code : ''
          }
          onActivated={handleRefresh}
          onGoSubscribe={() => setTab('subscribe')}
        />
      )}
      </div>
    </div>
  );
}
