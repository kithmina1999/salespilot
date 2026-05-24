'use client';
import { AlertTriangle, Cpu } from 'lucide-react';
import type { RulesStats, RuleEntry } from '@/hooks/useRulesPage';

interface RulesStatsRowProps {
  stats: RulesStats;
  customRules: RuleEntry[];
}

export function RulesStatsRow({ stats, customRules }: RulesStatsRowProps) {
  const totalHits = customRules.reduce((sum, r) => sum + (r.usage_count || 0), 0);

  const faqContribution =
    stats.system_quota_used + stats.ai_quota_used === 0
      ? '0%'
      : Math.round((stats.system_quota_used / (stats.system_quota_used + stats.ai_quota_used)) * 100) + '%';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Total FAQs */}
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-col justify-center">
        <span className="text-muted-foreground text-xs font-bold mb-1">Total FAQs</span>
        <span className="text-2xl font-black text-foreground">{customRules.length}</span>
      </div>

      {/* Total Hits */}
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-col justify-center">
        <span className="text-muted-foreground text-xs font-bold mb-1">Total Hits</span>
        <span className="text-2xl font-black text-foreground">{totalHits}</span>
      </div>

      {/* FAQ Contribution */}
      <div className="rounded-2xl border bg-green-500/10 border-green-500/20 p-5 flex flex-col justify-center relative overflow-hidden">
        <span className="text-green-400 text-xs font-bold mb-1">FAQ Contribution</span>
        <span className="text-2xl font-black text-foreground relative z-10">{faqContribution}</span>
        <span className="text-[10px] text-green-500/60 mt-1 relative z-10">Queries handled without AI</span>
        <Cpu className="absolute -right-4 -bottom-4 w-20 h-20 text-green-500/5 rotate-12" />
      </div>

      {/* Sinhala Coverage */}
      <div
        className={`rounded-2xl border p-5 flex flex-col justify-center ${
          stats.no_sinhala_coverage > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-card border-border'
        }`}
      >
        <span
          className={`${
            stats.no_sinhala_coverage > 0 ? 'text-amber-400' : 'text-muted-foreground'
          } text-xs font-bold mb-1 flex items-center gap-1.5`}
        >
          {stats.no_sinhala_coverage > 0 ? <AlertTriangle size={12} /> : null}
          No Sinhala Coverage
        </span>
        <span className="text-2xl font-black text-foreground">{stats.no_sinhala_coverage}</span>
        <span
          className={`text-[10px] mt-1 ${
            stats.no_sinhala_coverage > 0 ? 'text-amber-500/60' : 'text-muted-foreground'
          }`}
        >
          {stats.no_sinhala_coverage > 0 ? 'Update these for better bot UX' : 'All good!'}
        </span>
      </div>
    </div>
  );
}
