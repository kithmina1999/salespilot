'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useAppStore } from '@/lib/store';
import { Zap, ArrowRight, Clock, Bot, Sparkles, AlertTriangle, X, MessageCircle } from 'lucide-react';
import Link from 'next/link';

type Phase = 'comfortable' | 'urgent' | 'expiring';

type TimeLeft = {
  d: number;
  h: number;
  m: number;
  s: number;
};

type PhaseMeta = {
  badge: string;
  badgeIcon: ReactNode;
  dismissible: boolean;
};

function getPhase(daysLeft: number): Phase {
  if (daysLeft >= 4) return 'comfortable';
  if (daysLeft >= 1) return 'urgent';
  return 'expiring';
}

const FEATURES_AT_RISK = [
  { icon: <Bot size={11} />, label: 'AI Replies' },
  { icon: <Sparkles size={11} />, label: 'AI Rule Gen' },
  { icon: <MessageCircle size={11} />, label: 'Unlimited FAQs' },
];

const PHASE_META: Record<Phase, PhaseMeta> = {
  comfortable: {
    badge: 'Free Trial Active',
    badgeIcon: <Sparkles size={12} />,
    dismissible: true,
  },
  urgent: {
    badge: 'Trial Ending Soon',
    badgeIcon: <Clock size={12} />,
    dismissible: true,
  },
  expiring: {
    badge: 'AI Offline',
    badgeIcon: <AlertTriangle size={12} />,
    dismissible: false,
  },
};

function Countdown({ timeLeft, compact = false }: { timeLeft: TimeLeft; compact?: boolean }) {
  const segments = compact
    ? [
        { label: 'd', value: timeLeft.d },
        { label: 'h', value: timeLeft.h },
        { label: 'm', value: timeLeft.m },
      ]
    : [
        { label: 'd', value: timeLeft.d },
        { label: 'h', value: timeLeft.h },
        { label: 'm', value: timeLeft.m },
        { label: 's', value: timeLeft.s },
      ];

  return (
    <div className="flex items-center gap-1 shrink-0" aria-hidden="true">
      {segments.map((seg, i) => (
        <span key={seg.label} className="flex items-center gap-0.5">
          {i > 0 && <span className="trial-banner__count-divider text-xs">:</span>}
          <span className="trial-banner__count-cell inline-flex flex-col items-center justify-center rounded-md font-black tabular-nums min-w-[26px] py-0.5 lg:min-w-[30px] lg:py-1">
            {String(seg.value).padStart(2, '0')}
            <span className="trial-banner__count-label text-[0.5rem] leading-none lg:text-[0.55rem]">
              {seg.label}
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}

function CTA({ phase, monthlyPrice, compact = false }: { phase: Phase; monthlyPrice?: string; compact?: boolean }) {
  const label = phase === 'expiring' ? 'Reactivate' : 'Subscribe';
  const desktopLabel = monthlyPrice ? `${label} - LKR ${monthlyPrice}/mo` : label;

  return (
    <Link
      href="/dashboard/usage"
      className="trial-banner__cta flex items-center justify-center gap-1.5 rounded-lg text-[12px] font-black px-3 py-1.5 transition-all whitespace-nowrap shrink-0 lg:px-4 lg:py-2"
      aria-label={desktopLabel}
    >
      <Zap size={compact ? 11 : 12} className="trial-banner__cta-zap" />
      <span>{compact ? label : desktopLabel}</span>
      <ArrowRight size={compact ? 11 : 12} className="trial-banner__cta-arrow" />
    </Link>
  );
}

export default function TrialBanner() {
  const usage = useAppStore((s) => s.usage);
  const pricing = useAppStore((s) => s.pricing);
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const paidPlanExpiresAt = usage?.plan_expires_at ? Date.parse(usage.plan_expires_at) : null;
  const hasPaidPlan = Boolean(paidPlanExpiresAt && paidPlanExpiresAt > now);
  const trialExpiresAt = !hasPaidPlan && usage?.trial_expires_at ? Date.parse(usage.trial_expires_at) : null;
  const expiresAt = trialExpiresAt !== null && Number.isFinite(trialExpiresAt) ? trialExpiresAt : null;
  const diff = expiresAt !== null ? Math.max(expiresAt - now, 0) : null;
  const timeLeft = diff === null ? null : {
    d: Math.floor(diff / (1000 * 60 * 60 * 24)),
    h: Math.floor((diff / (1000 * 60 * 60)) % 24),
    m: Math.floor((diff / 1000 / 60) % 60),
    s: Math.floor((diff / 1000) % 60),
  };
  const isExpired = Boolean(expiresAt !== null && expiresAt <= now);

  if (expiresAt === null) return null;
  if (dismissed && !isExpired) return null;

  const daysLeft = timeLeft?.d ?? 0;
  const phase = isExpired ? 'expiring' : getPhase(daysLeft);
  const meta = PHASE_META[phase];
  const monthlyPrice = pricing?.starter?.monthly?.toLocaleString();

  return (
    <div className="trial-banner shrink-0 border-b transition-colors duration-500" data-phase={phase}>
      <div className="relative z-10">
        <div className="px-3 pt-2.5 pb-1.5 lg:hidden flex items-center justify-between gap-2">
          <div
            className={`trial-banner__badge ${phase === 'expiring' ? 'trial-banner__badge--scan' : ''} flex items-center gap-1.5 shrink-0 max-w-[calc(100%_-_2.5rem)] px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase`}
          >
            {meta.badgeIcon}
            <span className="truncate">{meta.badge}</span>
          </div>

          {meta.dismissible && (
            <button
              onClick={() => setDismissed(true)}
              className="trial-banner__dismiss p-1.5 rounded-lg transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="px-3 pb-3 lg:hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
          <div className="flex-1 min-w-0">
            {phase === 'comfortable' && (
              <p className="text-xs sm:text-sm font-semibold text-muted-foreground leading-snug">
                <span className="trial-banner__accent-text">{daysLeft}d full access left.</span>
                {monthlyPrice && <span className="hidden sm:inline"> LKR {monthlyPrice}/mo after trial.</span>}
              </p>
            )}
            {phase === 'urgent' && (
              <p className="text-xs sm:text-sm font-bold text-foreground leading-snug">
                Only <span className="trial-banner__accent-text">{daysLeft}d left</span>. AI stops soon.
              </p>
            )}
            {phase === 'expiring' && (
              <p className="text-xs sm:text-sm font-bold leading-snug trial-banner__accent-text">
                Trial expired. AI is offline.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 sm:justify-start">
            {!isExpired && timeLeft && <Countdown timeLeft={timeLeft} compact />}
            <CTA phase={phase} monthlyPrice={monthlyPrice} compact />
          </div>
        </div>

        <div className="hidden lg:flex px-5 py-3.5 items-center gap-4 max-w-7xl mx-auto">
          <div
            className={`trial-banner__badge ${phase === 'expiring' ? 'trial-banner__badge--scan' : ''} flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase whitespace-nowrap`}
          >
            {meta.badgeIcon}
            <span>{meta.badge}</span>
          </div>

          <div className="flex-1 min-w-0">
            {phase === 'comfortable' && (
              <p className="text-sm font-semibold text-muted-foreground">
                Your AI assistant is running.{' '}
                <span className="trial-banner__accent-text">{daysLeft} days of full access remaining.</span>
                {monthlyPrice && <span className="text-muted-foreground/75 text-xs font-normal ml-2">LKR {monthlyPrice}/mo to continue</span>}
              </p>
            )}

            {phase === 'urgent' && (
              <div>
                <p className="text-sm font-bold text-foreground">
                  Only <span className="trial-banner__accent-text">{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</span> - these features will stop working:
                </p>
                <div className="flex items-center gap-4 mt-1">
                  {FEATURES_AT_RISK.map((f) => (
                    <span key={f.label} className="flex items-center gap-1 text-[11px] font-bold trial-banner__accent-text">
                      {f.icon} {f.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {phase === 'expiring' && (
              <p className="text-sm font-bold trial-banner__accent-text">
                Your Starter Trial has expired and AI is disabled. Upgrade to a paid plan to reactivate your AI Assistant, unlock up to 5,000 AI replies, and get unlimited inbound messages.
              </p>
            )}
          </div>

          {!isExpired && timeLeft && <Countdown timeLeft={timeLeft} />}

          <CTA phase={phase} monthlyPrice={monthlyPrice} />

          {meta.dismissible && (
            <button
              onClick={() => setDismissed(true)}
              className="trial-banner__dismiss p-1.5 rounded-lg transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
