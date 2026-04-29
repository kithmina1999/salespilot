'use client';

import { Check, X, ChevronRight, Zap, Infinity } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';

type PlanKey = 'starter' | 'pro';

interface Props {
  onUpgrade: (plan: PlanKey) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatLKR(n: number) {
  return `Rs. ${n.toLocaleString('en-LK')}`;
}

/** Format a plan limit value for display. -1 = unlimited, 0 = locked. */
function fmtLimit(n: number, unit = '/mo'): React.ReactNode {
  if (n === -1) return <Infinity size={13} className="inline mx-auto" />;
  if (n === 0)  return <X size={13} className="text-zinc-700 mx-auto" />;
  return `${n.toLocaleString()}${unit}`;
}

function fmtBytes(bytes: number): string {
  if (bytes <= 0) return '—';
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(0)} GB` : `${mb.toFixed(0)} MB`;
}

// ── Column header ─────────────────────────────────────────────────────────────

function PlanHeader({ name, badge, accent }: { name: string; badge?: string; accent: string }) {
  return (
    <div className="text-center px-1">
      {badge && (
        <div className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border mb-1 ${accent}`}>
          {badge}
        </div>
      )}
      <p className={`text-base font-black ${badge ? 'text-white' : 'text-zinc-500'}`}>{name}</p>
    </div>
  );
}

// ── Feature row ───────────────────────────────────────────────────────────────

function FeatureRow({
  label, free, starter, pro,
}: {
  label: string;
  free: React.ReactNode;
  starter: React.ReactNode;
  pro: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[2fr_1fr_1.5fr_1.5fr] items-center py-2.5 border-b border-zinc-800/60 last:border-0">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className="text-xs text-zinc-600 text-center">{free}</span>
      <span className="text-xs text-center font-semibold text-zinc-300">{starter}</span>
      <span className="text-xs text-center font-semibold text-zinc-300">{pro}</span>
    </div>
  );
}

// ── CTA button ────────────────────────────────────────────────────────────────

function PlanCTA({ label, onClick, variant }: { label: string; onClick: () => void; variant: 'emerald' | 'purple' }) {
  const styles = variant === 'emerald'
    ? 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20 text-black'
    : 'bg-purple-500 hover:bg-purple-400 shadow-purple-500/20 text-white';
  return (
    <button
      onClick={onClick}
      className={`w-full py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-1.5 transition-all shadow-lg active:scale-95 ${styles}`}
    >
      {variant === 'purple' && <Zap size={14} />}
      {label}
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PlanCompareTable({ onUpgrade }: Props) {
  const router   = useRouter();
  const usage    = useAppStore((s) => s.usage);
  const pricing  = useAppStore((s) => s.pricing);
  const business = useAppStore((s) => s.business);

  const plan = business?.plan ?? 'free';
  if (plan === 'pro') return null;

  // ── Pricing (from store, not hardcoded) ─────────────────────────────────────
  const starterMonthly = pricing?.starter.monthly ?? 1490;
  const starterAnnual  = pricing?.starter.annual  ?? 14900;
  const proMonthly     = pricing?.pro.monthly     ?? 3490;
  const proAnnual      = pricing?.pro.annual      ?? 34900;

  const starterSavingsPct = Math.round((1 - starterAnnual / (starterMonthly * 12)) * 100);
  const proSavingsPct     = Math.round((1 - proAnnual     / (proMonthly     * 12)) * 100);

  // ── Plan limits from backend (no hardcoding) ─────────────────────────────────
  const pl = usage?.plan_limits;
  const free    = pl?.free;
  const starter = pl?.starter;
  const pro     = pl?.pro;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">

      {/* Column headers */}
      <div className="grid grid-cols-[2fr_1fr_1.5fr_1.5fr] mb-5 items-end">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Features</p>
        <PlanHeader name="Free" accent="" />
        <PlanHeader name="Starter" badge="⭐ Popular" accent="bg-emerald-500/20 text-emerald-400 border-emerald-500/30" />
        <PlanHeader name="Pro"     badge="⚡ Power"   accent="bg-purple-500/20 text-purple-400 border-purple-500/30" />
      </div>

      {/* Feature rows — driven from backend plan_limits */}
      <FeatureRow
        label="Inbound Messages"
        free={fmtLimit(free?.system_messages ?? 300)}
        starter={<span className="text-emerald-400">{fmtLimit(starter?.system_messages ?? -1)}</span>}
        pro={<span className="text-purple-400">{fmtLimit(pro?.system_messages ?? -1)}</span>}
      />
      <FeatureRow
        label="AI Replies"
        free={fmtLimit(free?.ai_messages ?? 0)}
        starter={<span className="text-emerald-400">{fmtLimit(starter?.ai_messages ?? 1500)}</span>}
        pro={<span className="text-purple-400">{fmtLimit(pro?.ai_messages ?? 5000)}</span>}
      />
      <FeatureRow
        label="FAQ Rules"
        free={`${free?.rules ?? 10} max`}
        starter={<span className="text-emerald-400">{fmtLimit(starter?.rules ?? -1)}</span>}
        pro={<span className="text-purple-400">{fmtLimit(pro?.rules ?? -1)}</span>}
      />
      <FeatureRow
        label="AI Rule Gens"
        free={fmtLimit(free?.rule_gens ?? 3)}
        starter={<span className="text-emerald-400">{fmtLimit(starter?.rule_gens ?? 30)}</span>}
        pro={<span className="text-purple-400">{fmtLimit(pro?.rule_gens ?? 100)}</span>}
      />
      <FeatureRow
        label="Products"
        free={`${free?.products ?? 10} max`}
        starter={`${starter?.products ?? 100}`}
        pro={<span className="text-purple-400">{fmtLimit(pro?.products ?? -1)}</span>}
      />
      <FeatureRow
        label="Image Replies"
        free={<X size={13} className="text-zinc-700 mx-auto" />}
        starter={<Check size={13} className="text-emerald-400 mx-auto" />}
        pro={<Check size={13} className="text-purple-400 mx-auto" />}
      />
      <FeatureRow
        label="Storage"
        free={<X size={13} className="text-zinc-700 mx-auto" />}
        starter={fmtBytes(starter?.storage_bytes ?? 524288000)}
        pro={fmtBytes(pro?.storage_bytes ?? 1073741824)}
      />

      {/* Pricing rows */}
      <FeatureRow
        label="Monthly"
        free="Free"
        starter={
          <span className="text-white font-black">
            {formatLKR(starterMonthly)}<span className="text-zinc-500 text-[10px] font-normal">/mo</span>
          </span>
        }
        pro={
          <span className="text-white font-black">
            {formatLKR(proMonthly)}<span className="text-zinc-500 text-[10px] font-normal">/mo</span>
          </span>
        }
      />
      <FeatureRow
        label="Annual"
        free="—"
        starter={
          <div className="text-center">
            <span className="text-emerald-400 font-black">{formatLKR(starterAnnual)}</span>
            <span className="block text-[9px] text-emerald-500/60 font-bold">{starterSavingsPct}% off</span>
          </div>
        }
        pro={
          <div className="text-center">
            <span className="text-purple-400 font-black">{formatLKR(proAnnual)}</span>
            <span className="block text-[9px] text-purple-500/60 font-bold">{proSavingsPct}% off</span>
          </div>
        }
      />

      {/* CTA buttons */}
      <div className="grid grid-cols-[2fr_1fr_1.5fr_1.5fr] mt-5 gap-3">
        <div /><div />
        <PlanCTA label="Get Starter" onClick={() => onUpgrade('starter')} variant="emerald" />
        <PlanCTA label="Get Pro"     onClick={() => onUpgrade('pro')}     variant="purple" />
      </div>

      {/* Learn more */}
      <div className="mt-4 text-center">
        <button
          onClick={() => router.push('/dashboard/upgrade')}
          className="text-xs text-zinc-600 hover:text-zinc-400 flex items-center gap-1 mx-auto transition-colors"
        >
          See full plan comparison <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}
