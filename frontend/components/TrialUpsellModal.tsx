'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Bot, Sparkles, Zap, ArrowRight, X, Clock, AlertTriangle, Check, MessageCircle } from 'lucide-react';
import Link from 'next/link';

// ── What the user stands to lose ────────────────────────────────
const FEATURES = [
  { icon: <Bot size={16} className="text-indigo-400" />,    label: 'AI Fallback Replies',     desc: 'Gemini AI answers questions when no FAQ matches' },
  { icon: <Sparkles size={16} className="text-amber-400" />, label: 'AI Rule Generator',       desc: 'Generate complete FAQ rules from plain language' },
  { icon: <Zap size={16} className="text-green-400" />,      label: 'Unlimited FAQ Rules',     desc: 'No cap on your knowledge base size' },
  { icon: <MessageCircle size={16} className="text-blue-400" />, label: 'Unlimited FAQ Replies', desc: 'Serve unlimited customers per month' },
];

type ModalVariant = 'urgent' | 'expired';

interface TrialUpsellModalProps {
  expiresAt: Date;
  daysLeft: number;
  variant: ModalVariant;
  onClose: () => void;
}

function TrialUpsellModal({ expiresAt, daysLeft, variant, onClose }: TrialUpsellModalProps) {
  const isExpired = variant === 'expired';

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-200 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background: 'linear-gradient(145deg, #111117 0%, #0d0d12 100%)',
          border: isExpired ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(245,158,11,0.25)',
        }}
      >
        {/* Top gradient bar */}
        <div
          className="h-1 w-full"
          style={{
            background: isExpired
              ? 'linear-gradient(90deg, #ef4444, #f97316)'
              : 'linear-gradient(90deg, #f59e0b, #6366f1)',
          }}
        />

        {/* Close button */}
        {!isExpired && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-600 hover:text-muted-foreground hover:bg-white/5 transition-all"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        )}

        <div className="p-8 space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <div
              className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-1"
              style={
                isExpired
                  ? { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }
                  : { background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }
              }
            >
              {isExpired ? <AlertTriangle size={11} /> : <Clock size={11} />}
              {isExpired ? 'Trial Ended · AI is Offline' : `${daysLeft} Day${daysLeft !== 1 ? 's' : ''} Left`}
            </div>

            <h2 className="text-2xl font-black text-foreground tracking-tight leading-tight">
              {isExpired
                ? <>Your customers are getting <span className="text-red-400">no response</span> right now.</>
                : <>Don't let your <span className="text-amber-400">AI switch off</span> mid-conversation.</>}
            </h2>

            <p className="text-sm text-muted-foreground">
              {isExpired
                ? 'Every message sent to your business right now is going unanswered. Reactivate to bring your AI assistant back online instantly.'
                : `Your Starter trial ends ${daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`}. After that, these features will stop working until you subscribe.`}
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-2">
            {FEATURES.map((f) => (
              <div key={f.label} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  {f.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">{f.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{f.desc}</p>
                </div>
                {isExpired
                  ? <span className="ml-auto shrink-0 text-[10px] font-black text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full">Offline</span>
                  : <span className="ml-auto shrink-0 text-[10px] font-black text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">At Risk</span>}
              </div>
            ))}
          </div>

          {/* Price block */}
          <div
            className="flex items-center justify-between p-4 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Starter Plan</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-foreground">LKR 4,500</span>
                <span className="text-sm text-muted-foreground font-medium">/month</span>
              </div>
              <p className="text-xs text-zinc-600 mt-0.5">or LKR 3,900/mo on quarterly · LKR 3,300/mo annual</p>
            </div>
            <div className="space-y-1 text-right">
              {['3,000 AI replies/mo', '100 AI rule gens/mo', 'Priority support'].map(f => (
                <p key={f} className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                  <Check size={11} className="text-green-400" /> {f}
                </p>
              ))}
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-2">
            <Link
              href="/dashboard/usage"
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-sm transition-all shadow-lg"
              style={
                isExpired
                  ? { background: 'linear-gradient(135deg, #ef4444, #f97316)', color: '#fff', boxShadow: '0 8px 24px rgba(239,68,68,0.25)' }
                  : { background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#000', boxShadow: '0 8px 24px rgba(245,158,11,0.25)' }
              }
              onClick={onClose}
            >
              {isExpired ? 'Reactivate My AI Now' : 'Subscribe & Keep Everything'}
              <ArrowRight size={15} />
            </Link>

            {/* "Maybe later" — only on non-expired variant */}
            {!isExpired && (
              <button
                onClick={onClose}
                className="w-full py-2.5 text-sm font-medium text-zinc-600 hover:text-muted-foreground transition-colors"
              >
                Maybe later — I'll risk losing these features
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Controller: decides when to show the modal ────────────────────
export default function TrialUpsellController() {
  const [modalState, setModalState] = useState<{ expiresAt: Date; daysLeft: number; variant: ModalVariant } | null>(null);

  useEffect(() => {
    async function evaluate() {
      try {
        const res: any = await apiFetch('/api/v1/settings/usage');
        const hasPaidPlan = res.plan_expires_at && new Date(res.plan_expires_at) > new Date();
        if (hasPaidPlan || !res.trial_expires_at) return;

        const exp = new Date(res.trial_expires_at);
        const daysLeft = Math.max(0, Math.floor((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        // Key is tied to the trial expiry timestamp so it resets for new trials
        const baseKey = `trial_modal_${exp.getTime()}`;

        if (exp <= new Date()) {
          // Trial has expired
          const key = `${baseKey}_expired`;
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, 'shown');
            setModalState({ expiresAt: exp, daysLeft: 0, variant: 'expired' });
          }
        } else if (daysLeft <= 3) {
          // Entering urgent phase for the first time
          const key = `${baseKey}_urgent`;
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, 'shown');
            setModalState({ expiresAt: exp, daysLeft, variant: 'urgent' });
          }
        }
      } catch (err) {}
    }
    // Small delay so the page renders first, then modal appears
    const t = setTimeout(evaluate, 1200);
    return () => clearTimeout(t);
  }, []);

  if (!modalState) return null;

  return (
    <TrialUpsellModal
      expiresAt={modalState.expiresAt}
      daysLeft={modalState.daysLeft}
      variant={modalState.variant}
      onClose={() => setModalState(null)}
    />
  );
}
