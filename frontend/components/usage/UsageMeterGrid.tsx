'use client';

import { Bot, BookOpen, Sparkles, Package, HardDrive, MessageCircle, Lock, Infinity, HelpCircle } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { AppUsage } from '@/lib/store';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function Tooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex items-center cursor-help ml-1">
      <HelpCircle size={11} className="text-zinc-700 group-hover:text-muted-foreground transition-colors" />
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 text-[11px] leading-snug bg-secondary text-muted-foreground border border-border rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-normal">
        {text}
      </span>
    </span>
  );
}

// ── Animated progress bar ─────────────────────────────────────────────────────

function UsageBar({ used, limit }: { used: number; limit: number }) {
  if (limit <= 0) return null;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const color =
    pct > 90 ? 'bg-red-500' :
    pct > 70 ? 'bg-amber-500' :
    'bg-emerald-500';
  const glow =
    pct > 90 ? 'shadow-[0_0_8px_rgba(239,68,68,0.4)]' :
    pct > 70 ? 'shadow-[0_0_8px_rgba(245,158,11,0.3)]' :
    '';

  return (
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ease-out ${color} ${glow}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Single metric card ────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  used: number;
  limit: number;      // -1 = unlimited, 0 = locked/unavailable
  isLocked?: boolean;
  displayUsed?: string;
  displayLimit?: string;
}

function MetricCard({ icon, label, tooltip, used, limit, isLocked, displayUsed, displayLimit }: MetricCardProps) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const isUnlimited = limit === -1;

  return (
    <div className={`rounded-xl border p-4 space-y-2.5 transition-all ${
      isLocked
        ? 'bg-background/50 border-border/40 opacity-60'
        : 'bg-background border-border/60 hover:border-border/60'
    }`}>
      {/* Label row */}
      <div className="flex items-center justify-between">
        <span className={`flex items-center gap-1.5 text-xs font-bold ${isLocked ? 'text-zinc-600' : 'text-muted-foreground'}`}>
          {icon}
          {label}
          <Tooltip text={tooltip} />
        </span>
        <span className={`text-xs font-bold tabular-nums ${isLocked ? 'text-zinc-700' : 'text-muted-foreground'}`}>
          {isLocked ? '—' : (
            <>
              {displayUsed ?? used.toLocaleString()}
              {isUnlimited && <span className="text-zinc-600"> / ∞</span>}
              {!isUnlimited && limit > 0 && (
                <span className="text-zinc-600"> / {displayLimit ?? limit.toLocaleString()}</span>
              )}
            </>
          )}
        </span>
      </div>

      {/* Bar or status */}
      {isLocked ? (
        <div className="flex items-center gap-1.5">
          <Lock size={10} className="text-zinc-700" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-700">Upgrade to unlock</p>
        </div>
      ) : isUnlimited ? (
        <div className="flex items-center gap-1.5">
          <Infinity size={10} className="text-emerald-500/70" />
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-500/70">Unlimited</p>
        </div>
      ) : (
        <>
          <UsageBar used={used} limit={limit} />
          {pct > 85 && (
            <p className={`text-[10px] font-bold ${pct > 95 ? 'text-red-400' : 'text-amber-400'}`}>
              {pct > 95 ? '⚠️ Almost full' : `${pct}% used`}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Main Grid ─────────────────────────────────────────────────────────────────

export default function UsageMeterGrid() {
  const usage = useAppStore((s) => s.usage);
  const business = useAppStore((s) => s.business);

  const plan = business?.plan ?? 'free';
  const isPaid = plan === 'starter' || plan === 'pro';
  const isActiveTrial = usage?.active_trial ?? false;
  const usageContext = !isPaid && isActiveTrial
    ? 'Tracks current usage against trial limits. Upgrade to keep access after the trial.'
    : 'Tracks current usage against this month’s plan limits.';

  if (!usage) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Monthly Usage</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[88px] rounded-xl bg-muted border border-border/60 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const metrics: MetricCardProps[] = [
    {
      icon: <MessageCircle size={12} />,
      label: 'Inbound Messages',
      tooltip: 'Total messages received from your customers this month.',
      used: usage.system_messages_used,
      limit: usage.system_messages_limit,
      isLocked: usage.system_messages_limit === 0,
    },
    {
      icon: <Bot size={12} />,
      label: 'AI Replies',
      tooltip: 'Gemini AI fallback messages sent this month. Resets on the 1st.',
      used: usage.ai_messages_used,
      limit: usage.ai_messages_limit,
      isLocked: usage.ai_messages_limit === 0,
    },
    {
      icon: <BookOpen size={12} />,
      label: 'FAQ Rules',
      tooltip: 'Total active FAQ rules in your knowledge base.',
      used: usage.rules_used,
      limit: usage.rules_limit,
      isLocked: usage.rules_limit === 0,
    },
    {
      icon: <Sparkles size={12} />,
      label: 'AI Rule Gens',
      tooltip: 'AI-generated FAQ rules created this month.',
      used: usage.rule_generation_count,
      limit: usage.rule_generation_limit,
      isLocked: usage.rule_generation_limit === 0,
    },
    {
      icon: <Package size={12} />,
      label: 'Products',
      tooltip: 'Products listed in your catalogue.',
      used: usage.products_used,
      limit: usage.products_limit,
      isLocked: usage.products_limit === 0,
    },
    {
      icon: <HardDrive size={12} />,
      label: 'Storage',
      tooltip: 'Total media storage used (images, files).',
      used: usage.storage_used_bytes,
      limit: usage.storage_limit_bytes,
      isLocked: usage.storage_limit_bytes === 0,
      displayUsed: formatBytes(usage.storage_used_bytes),
      displayLimit: formatBytes(usage.storage_limit_bytes),
    },
  ];

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Monthly Usage</p>
          <p className="text-sm text-muted-foreground mt-1">{usageContext}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>
    </div>
  );
}
