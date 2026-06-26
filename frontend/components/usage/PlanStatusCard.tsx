'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface Props {
  onUpgrade: () => void;
}

const TRIAL_TOTAL_MS = 14 * 24 * 60 * 60 * 1000;

function useClockNow() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(id);
  }, []);

  return now;
}

function useCountdownMs(expiresAt: string | null): number {
  const now = useClockNow();
  return expiresAt ? Math.max(0, new Date(expiresAt).getTime() - now) : 0;
}

function formatTimeLeft(ms: number): { top: string; bottom: string } {
  if (ms <= 0) return { top: '0', bottom: 'Expired' };
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (d > 0) return { top: `${d}d`, bottom: `${h}h left` };
  if (h > 0) return { top: `${h}h`, bottom: `${m}m left` };
  if (m > 0) return { top: `${m}m`, bottom: `${sec}s left` };
  return { top: `${sec}s`, bottom: 'left' };
}

function TrialRing({ expiresAt }: { expiresAt: string }) {
  const msLeft = useCountdownMs(expiresAt);
  const pct = Math.max(0, Math.min(1, msLeft / TRIAL_TOTAL_MS));
  const daysLeft = Math.floor(msLeft / 86400000);
  const isUrgent = daysLeft <= 3;

  const radius = 26;
  const size = 72;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const strokeColor = isUrgent ? '#ef4444' : '#f59e0b';
  const textColor = isUrgent ? 'text-red-400' : 'text-amber-400';
  const { top, bottom } = formatTimeLeft(msLeft);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        style={{ position: 'absolute', inset: 0 }}
      >
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#27272a" strokeWidth="5" />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out, stroke 0.5s' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0">
        <span className={`text-[13px] font-black leading-none tabular-nums ${textColor}`}>
          {top}
        </span>
        <span className={`text-[8px] font-bold leading-none mt-0.5 ${isUrgent ? 'text-red-500/60' : 'text-amber-500/50'}`}>
          {bottom}
        </span>
      </div>
    </div>
  );
}

function formatRemaining(seconds: number | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  if (seconds >= 86400) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h`;
  }
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
  return `${Math.max(1, Math.floor(seconds / 60))}m`;
}

export default function PlanStatusCard({ onUpgrade }: Props) {
  const now = useClockNow();
  const business = useAppStore((s) => s.business);
  const usage = useAppStore((s) => s.usage);
  const pricing = useAppStore((s) => s.pricing);

  const plan = business?.plan ?? 'free';
  const isPaid = plan === 'starter' || plan === 'pro';
  const billingStatus = pricing?.status ?? (isPaid ? 'paid_active' : 'free');
  const returnedToFree = billingStatus === 'expired_to_free' || billingStatus === 'trial_expired_to_free';
  const isGrace = billingStatus === 'paid_grace' || pricing?.grace_period === true;
  const isOnTrial = billingStatus === 'trial_active' || usage?.active_trial === true;
  const expiresAt = isGrace
    ? pricing?.grace_ends_at ?? pricing?.expires_at ?? null
    : pricing?.expires_at ?? usage?.trial_expires_at ?? null;
  const secondsRemaining = pricing?.seconds_remaining ?? (expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000)) : 0);
  const timeLabel = formatRemaining(secondsRemaining);
  const planExpiry = usage?.plan_expires_at ?? null;
  const expiryLabel = planExpiry
    ? new Date(planExpiry).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const planLabel = returnedToFree
    ? 'Free'
    : isGrace && plan === 'pro'
    ? 'Pro'
    : isGrace && plan === 'starter'
    ? 'Starter'
    : isOnTrial
    ? 'Free Trial'
    : plan === 'pro'
    ? 'Pro'
    : plan === 'starter'
    ? 'Starter'
    : 'Free';
  const trialDaysExact = Math.floor((secondsRemaining * 1000) / 86400000);
  const isUrgent = isOnTrial && trialDaysExact <= 3;

  return (
    <div className={`rounded-2xl border p-6 transition-all duration-300 ${
      isGrace ? 'bg-amber-500/5 border-amber-500/25' :
      isPaid && !returnedToFree ? 'bg-emerald-500/5 border-emerald-500/20' :
      isOnTrial ? 'bg-amber-500/5 border-amber-500/20' :
      'bg-card border-border'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {isOnTrial && expiresAt && !returnedToFree && (
            <TrialRing expiresAt={expiresAt} />
          )}

          {isGrace ? (
            <div className="shrink-0 w-[52px] h-[52px] rounded-xl bg-amber-500/15 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
          ) : isPaid && !returnedToFree && (
            <div className="shrink-0 w-[52px] h-[52px] rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
          )}

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              Current Plan
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black text-foreground">{planLabel}</h2>
              {isGrace && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Grace period
                </span>
              )}
              {isPaid && !returnedToFree && !isGrace && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Active
                </span>
              )}
              {returnedToFree && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                  Free tier
                </span>
              )}
              {isOnTrial && !returnedToFree && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isUrgent
                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }`}>
                  Trial
                </span>
              )}
            </div>

            {isGrace && (
              <p className="text-sm text-amber-300 mt-1.5 flex items-center gap-1.5 leading-snug">
                <Clock size={12} className="text-amber-400/70 shrink-0" />
                {expiryLabel ? `Plan expired on ${expiryLabel}. ` : 'Plan expired. '}
                AI access ends{timeLabel ? ` in ${timeLabel}` : ' soon'}.
              </p>
            )}

            {isPaid && !returnedToFree && !isGrace && expiryLabel && (
              <p className="text-sm text-muted-foreground mt-1.5 flex items-center gap-1.5">
                <Clock size={12} className="text-emerald-500/60 shrink-0" />
                {timeLabel ? `Renews in ${timeLabel}` : 'Active'} ({expiryLabel})
              </p>
            )}

            {isOnTrial && !returnedToFree && (
              <p className={`text-sm mt-1.5 leading-snug ${isUrgent ? 'text-red-400 font-semibold' : 'text-muted-foreground'}`}>
                {isUrgent
                  ? `Trial ends ${timeLabel ? `in ${timeLabel}` : 'soon'}. Free-tier limits apply after.`
                  : 'Trial active. Upgrade to keep the bot running beyond your trial.'}
              </p>
            )}

            {returnedToFree && (
              <p className="text-sm text-muted-foreground mt-1.5">
                Your previous plan ended. Free-tier limits are active, and you can subscribe again anytime.
              </p>
            )}

            {plan === 'free' && !isOnTrial && !returnedToFree && (
              <p className="text-sm text-muted-foreground mt-1.5">
                Upgrade to unlock AI replies and serve more customers automatically.
              </p>
            )}
          </div>
        </div>

        {(!isPaid || returnedToFree || isGrace) && (
          <button
            onClick={onUpgrade}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-black transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            {isGrace ? 'Renew' : 'Upgrade'} <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
