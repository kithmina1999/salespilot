'use client';

import { useState, useEffect } from 'react';
import { Clock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface Props {
  onUpgrade: () => void;
}

// ── Trial duration constant (must match backend, default 14 days) ──────────────
const TRIAL_TOTAL_MS = 14 * 24 * 60 * 60 * 1000;

// ── Real-time countdown hook ───────────────────────────────────────────────────
function useCountdownMs(expiresAt: string | null): number {
  const [msLeft, setMsLeft] = useState<number>(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!expiresAt) { setMsLeft(0); return; }
    const tick = () => setMsLeft(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return mounted ? msLeft : 0;
}

// ── Human-readable time label ─────────────────────────────────────────────────
function formatTimeLeft(ms: number): { top: string; bottom: string } {
  if (ms <= 0) return { top: '0', bottom: 'Expired' };
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (d > 0)  return { top: `${d}d`,   bottom: `${h}h left` };
  if (h > 0)  return { top: `${h}h`,   bottom: `${m}m left` };
  if (m > 0)  return { top: `${m}m`,   bottom: `${sec}s left` };
  return       { top: `${sec}s`, bottom: 'left' };
}

// ── SVG countdown ring ────────────────────────────────────────────────────────
function TrialRing({ expiresAt }: { expiresAt: string }) {
  const msLeft  = useCountdownMs(expiresAt);
  const pct     = Math.max(0, Math.min(1, msLeft / TRIAL_TOTAL_MS));
  const daysLeft = Math.floor(msLeft / 86400000);
  const isUrgent = daysLeft <= 3;

  const R = 26;
  const size = 72;
  const cx = size / 2;
  const circumference = 2 * Math.PI * R;
  const offset = circumference * (1 - pct);
  const strokeColor = isUrgent ? '#ef4444' : '#f59e0b';
  const textColor   = isUrgent ? 'text-red-400' : 'text-amber-400';

  const { top, bottom } = formatTimeLeft(msLeft);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* SVG ring — rotate-90 so arc starts at 12 o'clock */}
      <svg
        width={size} height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        style={{ position: 'absolute', inset: 0 }}
      >
        {/* Background track */}
        <circle
          cx={cx} cy={cx} r={R}
          fill="none" stroke="#27272a" strokeWidth="5"
        />
        {/* Animated progress arc */}
        <circle
          cx={cx} cy={cx} r={R}
          fill="none"
          stroke={strokeColor}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out, stroke 0.5s' }}
        />
      </svg>

      {/* Text in centre (un-rotated) */}
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

// ── Plan Status Card ──────────────────────────────────────────────────────────

export default function PlanStatusCard({ onUpgrade }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const business = useAppStore((s) => s.business);
  const usage    = useAppStore((s) => s.usage);
  const pricing  = useAppStore((s) => s.pricing);

  const plan    = business?.plan ?? 'free';
  const isPaid  = plan === 'starter' || plan === 'pro';

  // Use exact timestamp for precise ring; fall back to days-remaining integer
  const trialExpiresAt  = usage?.trial_expires_at ?? null;
  const trialDaysApprox = pricing?.trial_days_remaining ?? 0;
  const isOnTrial       = !isPaid && (trialExpiresAt
    ? new Date(trialExpiresAt).getTime() > Date.now()
    : trialDaysApprox > 0);

  const daysLeft     = pricing?.days_remaining ?? null;
  const planExpiry   = usage?.plan_expires_at ?? null;
  const expiryLabel  = planExpiry
    ? new Date(planExpiry).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const planLabel = plan === 'pro' ? 'Pro' : plan === 'starter' ? 'Starter' : 'Free';

  // For urgency check in non-ring text
  const trialMsLeft   = trialExpiresAt ? Math.max(0, new Date(trialExpiresAt).getTime() - Date.now()) : 0;
  const trialDaysExact = Math.floor(trialMsLeft / 86400000);
  const isUrgent      = isOnTrial && trialDaysExact <= 3;

  return (
    <div className={`rounded-2xl border p-6 transition-all duration-300 ${
      isPaid    ? 'bg-emerald-500/5 border-emerald-500/20' :
      isOnTrial ? 'bg-amber-500/5 border-amber-500/20' :
                  'bg-zinc-900/50 border-zinc-800'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">

          {/* Trial ring (real-time) */}
          {isOnTrial && trialExpiresAt && (
            <TrialRing expiresAt={trialExpiresAt} />
          )}

          {/* Paid checkmark icon */}
          {isPaid && (
            <div className="shrink-0 w-[52px] h-[52px] rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
          )}

          <div>
            {/* Plan label + badges */}
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
              Current Plan
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black text-white">{planLabel}</h2>
              {isPaid && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Active
                </span>
              )}
              {isOnTrial && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isUrgent
                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }`}>
                  Trial
                </span>
              )}
            </div>

            {/* Paid plan expiry */}
            {isPaid && expiryLabel && (
              <p className="text-sm text-zinc-500 mt-1.5 flex items-center gap-1.5">
                <Clock size={12} className="text-emerald-500/60 shrink-0" />
                {daysLeft !== null ? `${daysLeft} days left` : ''} · Renews {expiryLabel}
              </p>
            )}

            {/* Trial urgency message */}
            {isOnTrial && mounted && (
              <p className={`text-sm mt-1.5 leading-snug ${isUrgent ? 'text-red-400 font-semibold' : 'text-zinc-400'}`}>
                {isUrgent
                  ? `⚠️ Trial ends in ${trialDaysExact} day${trialDaysExact === 1 ? '' : 's'} — your AI bot goes silent after.`
                  : `Trial active. Upgrade to keep the bot running beyond your trial.`}
              </p>
            )}

            {/* Free plan (no trial) */}
            {plan === 'free' && !isOnTrial && (
              <p className="text-sm text-zinc-500 mt-1.5">
                Upgrade to unlock AI replies and serve more customers automatically.
              </p>
            )}
          </div>
        </div>

        {/* Upgrade CTA */}
        {!isPaid && (
          <button
            onClick={onUpgrade}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-black transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            Upgrade <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
