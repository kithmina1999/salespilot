'use client';
import { Plus, Sparkles, Lock as LockIcon, Wand2 } from 'lucide-react';
import type { RulesStats } from '@/hooks/useRulesPage';

interface RulesPageHeaderProps {
  stats: RulesStats;
  t: (key: string) => string;
  onAddRule: () => void;
  onBulkTranslate: () => void;
  onGenerateAI: () => void;
}

export function RulesPageHeader({ stats, t, onAddRule, onBulkTranslate, onGenerateAI }: RulesPageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-semibold">{t('rules.title')}</h1>
        <p className="text-sm mt-1 text-muted-foreground">{t('rules.subtitle')}</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
        {/* AI Generate button */}
        {stats.rule_generation_count >= stats.rule_generation_limit ? (
          <button
            disabled
            title={
              stats.plan === 'free'
                ? 'Free limit reached. Upgrade to Starter or Pro for more.'
                : 'Monthly limit reached. Upgrade to Pro for unlimited generation.'
            }
            className="flex items-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold bg-amber-500/10 text-amber-500/50 border border-amber-500/20 cursor-not-allowed flex-1 sm:flex-none justify-center"
            style={{ minHeight: '44px' }}
          >
            <LockIcon size={16} />
            {stats.plan === 'free' ? 'Free Limit Reached' : 'Limit Reached'}
          </button>
        ) : (
          <button
            onClick={onGenerateAI}
            className="flex items-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold bg-linear-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black shadow-lg shadow-amber-500/20 transition-transform hover:scale-105 flex-1 sm:flex-none justify-center"
            style={{ minHeight: '44px' }}
          >
            <Sparkles size={16} /> Generate with AI
          </button>
        )}

        <button
          onClick={onBulkTranslate}
          className="flex items-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold bg-muted border border-border hover:bg-secondary text-foreground shadow-sm transition-transform hover:scale-105 flex-1 sm:flex-none justify-center"
          style={{ minHeight: '44px' }}
        >
          <Wand2 size={16} className="text-amber-500" /> Bulk Translate
        </button>

        <button
          onClick={onAddRule}
          className="flex items-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold bg-white hover:bg-zinc-200 text-black shadow-lg transition-transform hover:scale-105 flex-1 sm:flex-none justify-center"
          style={{ minHeight: '44px' }}
        >
          <Plus size={16} /> {t('rules.add_rule')}
        </button>
      </div>
    </div>
  );
}
