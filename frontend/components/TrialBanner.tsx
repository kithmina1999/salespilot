'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Zap, ArrowRight, Clock, Bot, Sparkles, AlertTriangle, X, MessageCircle } from 'lucide-react';
import Link from 'next/link';

type Phase = 'comfortable' | 'urgent' | 'expiring';

function getPhase(daysLeft: number): Phase {
  if (daysLeft >= 4) return 'comfortable';
  if (daysLeft >= 1) return 'urgent';
  return 'expiring';
}

const FEATURES_AT_RISK = [
  { icon: <Bot size={11} />,            label: 'AI Replies' },
  { icon: <Sparkles size={11} />,       label: 'AI Rule Gen' },
  { icon: <MessageCircle size={11} />,  label: 'Unlimited FAQs' },
];

export default function TrialBanner() {
  const usage = useAppStore((s) => s.usage);
  const pricing = useAppStore((s) => s.pricing);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Read trial data from store (no fetch needed — DashboardGuard already called fetchAll)
  useEffect(() => {
    if (!usage) return;
    const hasPaidPlan = usage.plan_expires_at && new Date(usage.plan_expires_at) > new Date();
    if (hasPaidPlan) return;
    if (usage.trial_expires_at) {
      const exp = new Date(usage.trial_expires_at);
      setExpiresAt(exp);
      if (exp <= new Date()) setIsExpired(true);
    }
  }, [usage]);


  useEffect(() => {
    if (!expiresAt) return;
    function tick() {
      const diff = expiresAt!.getTime() - Date.now();
      if (diff <= 0) { setTimeLeft({ d: 0, h: 0, m: 0, s: 0 }); setIsExpired(true); return; }
      setTimeLeft({
        d: Math.floor(diff / (1000 * 60 * 60 * 24)),
        h: Math.floor((diff / (1000 * 60 * 60)) % 24),
        m: Math.floor((diff / 1000 / 60) % 60),
        s: Math.floor((diff / 1000) % 60),
      });
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (!expiresAt) return null;
  if (dismissed && !isExpired) return null;

  const daysLeft = timeLeft?.d ?? 0;
  const phase = isExpired ? 'expiring' : getPhase(daysLeft);
  
  const monthlyPrice = pricing?.starter?.monthly?.toLocaleString() || '1,490';

  // ── Per-phase style tokens ────────────────────────────────────
  const style = {
    comfortable: {
      accent: '#818cf8', accentBg: 'rgba(99,102,241,0.10)', accentBorder: 'rgba(99,102,241,0.22)',
      gradientFrom: 'rgba(99,102,241,0.08)', borderColor: 'rgba(99,102,241,0.15)',
      ctaBg: 'rgba(245,158,11,0.14)', ctaBorder: 'rgba(245,158,11,0.30)', ctaColor: '#fbbf24',
      ctaHoverBg: 'rgba(245,158,11,0.26)',
      badge: 'Free Trial Active', badgeIcon: <Sparkles size={12} />, dismissible: true,
    },
    urgent: {
      accent: '#fb923c', accentBg: 'rgba(251,146,60,0.12)', accentBorder: 'rgba(251,146,60,0.30)',
      gradientFrom: 'rgba(251,146,60,0.09)', borderColor: 'rgba(251,146,60,0.20)',
      ctaBg: 'rgba(245,158,11,0.20)', ctaBorder: 'rgba(245,158,11,0.40)', ctaColor: '#fde68a',
      ctaHoverBg: 'rgba(245,158,11,0.32)',
      badge: 'Trial Ending Soon', badgeIcon: <Clock size={12} />, dismissible: true,
    },
    expiring: {
      accent: '#f87171', accentBg: 'rgba(239,68,68,0.12)', accentBorder: 'rgba(239,68,68,0.30)',
      gradientFrom: 'rgba(239,68,68,0.09)', borderColor: 'rgba(239,68,68,0.20)',
      ctaBg: 'rgba(239,68,68,0.20)', ctaBorder: 'rgba(239,68,68,0.40)', ctaColor: '#fca5a5',
      ctaHoverBg: 'rgba(239,68,68,0.32)',
      badge: 'AI Offline', badgeIcon: <AlertTriangle size={12} />, dismissible: false,
    },
  }[phase];

  return (
    <div
      className="shrink-0 border-b transition-all duration-500"
      style={{
        background: `linear-gradient(90deg, ${style.gradientFrom} 0%, rgba(13,13,18,0.99) 30%, rgba(13,13,18,0.99) 70%, ${style.gradientFrom} 100%)`,
        borderColor: style.borderColor,
      }}
    >
      {/* ── Row 1: Badge + Dismiss (always visible) ── */}
      <div className="px-4 pt-3 pb-1 lg:hidden flex items-center justify-between gap-3">
        <div
          className="flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest"
          style={{ background: style.accentBg, border: `1px solid ${style.accentBorder}`, color: style.accent }}
        >
          {style.badgeIcon}
          <span>{style.badge}</span>
        </div>
        {style.dismissible && (
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-white/5 transition-all shrink-0"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── Row 2: Message + Countdown + CTA (small/tablet) ── */}
      <div className="px-4 pb-3 lg:hidden flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        {/* Message */}
        <div className="flex-1 min-w-0">
          {phase === 'comfortable' && (
            <p className="text-sm font-semibold text-zinc-300">
              <span style={{ color: style.accent }}>{daysLeft} days</span> of full access remaining.
              <span className="text-zinc-600 text-xs font-normal ml-1">· LKR {monthlyPrice}/mo</span>
            </p>
          )}
          {phase === 'urgent' && (
            <p className="text-sm font-bold text-zinc-200">
              Only <span style={{ color: style.accent }}>{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</span> — AI features stop working soon.
            </p>
          )}
          {phase === 'expiring' && (
            <p className="text-sm font-bold" style={{ color: style.accent }}>
              Your AI has stopped. Customers get no reply.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Countdown */}
          {!isExpired && timeLeft && (
            <div className="flex items-center gap-1 shrink-0">
              {[
                { label: 'd', value: timeLeft.d },
                { label: 'h', value: timeLeft.h },
                { label: 'm', value: timeLeft.m },
                { label: 's', value: timeLeft.s },
              ].map((seg, i) => (
                <span key={seg.label} className="flex items-center gap-0.5">
                  {i > 0 && <span className="text-zinc-700 text-xs">:</span>}
                  <span
                    className="inline-flex flex-col items-center justify-center rounded-md font-black tabular-nums min-w-[26px] py-0.5"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: style.accent, fontSize: '0.72rem' }}
                  >
                    {String(seg.value).padStart(2, '0')}
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.44rem', lineHeight: 1 }}>{seg.label}</span>
                  </span>
                </span>
              ))}
            </div>
          )}
          {/* CTA */}
          <Link
            href="/dashboard/usage"
            className="flex items-center gap-1.5 text-[12px] font-black px-3 py-1.5 rounded-xl transition-all whitespace-nowrap"
            style={{ background: style.ctaBg, border: `1px solid ${style.ctaBorder}`, color: style.ctaColor }}
            onMouseEnter={(e) => { e.currentTarget.style.background = style.ctaHoverBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = style.ctaBg; }}
          >
            <Zap size={11} />
            {phase === 'expiring' ? 'Reactivate' : 'Subscribe'}
            <ArrowRight size={11} />
          </Link>
        </div>
      </div>

      {/* ── Desktop: single row (lg+) ── */}
      <div className="hidden lg:flex px-5 py-3.5 items-center gap-4 max-w-7xl mx-auto">
        {/* Phase badge */}
        <div
          className="flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest whitespace-nowrap"
          style={{ background: style.accentBg, border: `1px solid ${style.accentBorder}`, color: style.accent }}
        >
          {style.badgeIcon}
          <span>{style.badge}</span>
        </div>

        {/* Main message */}
        <div className="flex-1 min-w-0">
          {phase === 'comfortable' && (
            <p className="text-sm font-semibold text-zinc-300">
              Your AI assistant is running.{' '}
              <span style={{ color: style.accent }}>{daysLeft} days of full access remaining.</span>
              <span className="text-zinc-600 text-xs font-normal ml-2">· LKR {monthlyPrice}/mo to continue</span>
            </p>
          )}
          {phase === 'urgent' && (
            <div>
              <p className="text-sm font-bold text-zinc-200">
                Only <span style={{ color: style.accent }}>{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</span> —
                {' '}these features will stop working:
              </p>
              <div className="flex items-center gap-4 mt-1">
                {FEATURES_AT_RISK.map((f) => (
                  <span key={f.label} className="flex items-center gap-1 text-[11px] font-bold" style={{ color: style.accent }}>
                    {f.icon} {f.label}
                  </span>
                ))}
              </div>
            </div>
          )}
          {phase === 'expiring' && (
            <p className="text-sm font-bold" style={{ color: style.accent }}>
              Your AI has stopped. Customers messaging you right now are getting no reply.
            </p>
          )}
        </div>

        {/* Countdown */}
        {!isExpired && timeLeft && (
          <div className="flex items-center gap-1 shrink-0">
            {[
              { label: 'd', value: timeLeft.d },
              { label: 'h', value: timeLeft.h },
              { label: 'm', value: timeLeft.m },
              { label: 's', value: timeLeft.s },
            ].map((seg, i) => (
              <span key={seg.label} className="flex items-center gap-0.5">
                {i > 0 && <span className="text-zinc-700 text-xs mr-0.5">:</span>}
                <span
                  className="inline-flex flex-col items-center justify-center rounded-md font-black tabular-nums min-w-[30px] py-1"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: style.accent, fontSize: '0.78rem' }}
                >
                  {String(seg.value).padStart(2, '0')}
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.48rem', fontFamily: 'inherit', lineHeight: 1 }}>
                    {seg.label}
                  </span>
                </span>
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <Link
          href="/dashboard/usage"
          className="flex items-center gap-1.5 text-[12px] font-black px-4 py-2 rounded-xl transition-all whitespace-nowrap shrink-0"
          style={{ background: style.ctaBg, border: `1px solid ${style.ctaBorder}`, color: style.ctaColor }}
          onMouseEnter={(e) => { e.currentTarget.style.background = style.ctaHoverBg; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = style.ctaBg; }}
        >
          <Zap size={12} />
          {phase === 'expiring' ? `Reactivate · LKR ${monthlyPrice}/mo` : `Subscribe · LKR ${monthlyPrice}/mo`}
          <ArrowRight size={12} />
        </Link>

        {/* Dismiss */}
        {style.dismissible && (
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-lg text-zinc-700 hover:text-zinc-400 hover:bg-white/5 transition-all shrink-0"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
