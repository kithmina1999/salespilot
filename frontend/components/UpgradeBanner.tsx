'use client';

import { ArrowRight, Lock, X } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

interface UpgradeBannerProps {
  message?: string;
  /** If false, banner is dismissible. If true, it is always shown (e.g. page-level gate). */
  persistent?: boolean;
  onDismiss?: () => void;
}

/**
 * UpgradeBanner — shown inline when a feature requires a higher plan.
 * Triggered either by a plan-check (e.g. plan === 'free') or by a
 * 403 API response with { upgrade_required: true }.
 *
 * Usage:
 *   <UpgradeBanner message="AI Draft requires Starter or Pro plan" />
 */
export default function UpgradeBanner({ message, persistent = false, onDismiss }: UpgradeBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    onDismiss?.();
  }

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2.5 min-w-0">
        <Lock size={15} className="shrink-0 text-amber-400" />
        <span className="leading-snug">
          {message || 'This feature is not available on your current plan.'}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/dashboard/usage"
          className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black transition-colors shadow-sm whitespace-nowrap"
        >
          Upgrade <ArrowRight size={12} />
        </Link>
        {!persistent && (
          <button
            onClick={handleDismiss}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
