'use client';
import { Plus, ExternalLink, MessageSquare, ShieldAlert, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import type { RulesStats } from '@/hooks/useRulesPage';

type GapItem = RulesStats['top_unmatched'][number];

interface KnowledgeGapsInboxProps {
  gaps: GapItem[];
  onCreateFAQFromGap: (message: string, gapId: number) => void;
  onNavigate: (url: string) => void;
  onMarkNotNeeded: (id: number) => void;
}

export function KnowledgeGapsInbox({
  gaps,
  onCreateFAQFromGap,
  onNavigate,
  onMarkNotNeeded,
}: KnowledgeGapsInboxProps) {
  if (!gaps?.length) return null;

  return (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 relative pt-2">
      {/* Header banner */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-amber-500/20 bg-amber-500/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert size={18} className="text-amber-500" />
            <h2 className="text-lg font-bold text-amber-500">Knowledge Gaps</h2>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-[10px] font-black text-amber-400 ml-2 tracking-wide uppercase">
              {gaps.length} Gaps
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Your bot failed to answer these questions recently. Resolve them to rules, update your
            product catalog, or update your settings to guarantee 24/7 resolution.
          </p>
        </div>
      </div>

      {/* Gap cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto max-h-[360px] pr-2 custom-scrollbar">
        {gaps.map((gap, idx) => (
          <GapCard
            key={gap.id || idx}
            gap={gap}
            onCreateFAQ={() => onCreateFAQFromGap(gap.message, gap.id)}
            onNavigate={onNavigate}
            onMarkNotNeeded={() => onMarkNotNeeded(gap.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Individual gap card ─────────────────────────────────────────────────────

interface GapCardProps {
  gap: GapItem;
  onCreateFAQ: () => void;
  onNavigate: (url: string) => void;
  onMarkNotNeeded: () => void;
}

function GapCard({ gap, onCreateFAQ, onNavigate, onMarkNotNeeded }: GapCardProps) {
  // Resolve primary action based on suggested_action
  let primaryBtnLabel = 'Create FAQ';
  let primaryBtnIcon = <Plus size={14} />;
  let primaryBtnAction = onCreateFAQ;

  if (gap.suggested_action === 'update_payment_settings') {
    primaryBtnLabel = 'Configure Payments';
    primaryBtnIcon = <ExternalLink size={13} />;
    primaryBtnAction = () => onNavigate(`/dashboard/settings?tab=payments&gap_id=${gap.id}`);
  } else if (gap.suggested_action === 'update_delivery_settings') {
    primaryBtnLabel = 'Configure Delivery';
    primaryBtnIcon = <ExternalLink size={13} />;
    primaryBtnAction = () => onNavigate(`/dashboard/settings?tab=general&gap_id=${gap.id}`);
  } else if (gap.suggested_action === 'update_product_catalog') {
    primaryBtnLabel = 'Update Catalog';
    primaryBtnIcon = <ExternalLink size={13} />;
    primaryBtnAction = () => onNavigate(`/dashboard/products?gap_id=${gap.id}`);
  } else if (gap.suggested_action === 'review_order_flow') {
    primaryBtnLabel = 'Review Order Flow';
    primaryBtnIcon = <MessageSquare size={13} />;
    primaryBtnAction = () =>
      toast.info(
        'Order flow rules are standard and cannot be modified directly. Please check active cart states.'
      );
  }

  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 flex flex-col justify-between shadow-lg relative group transition-all hover:border-amber-500/30">
      {/* Hit count badge */}
      <div className="absolute top-0 right-0 bg-amber-500/20 text-amber-400 text-[10px] font-black px-3 py-1.5 rounded-bl-xl flex items-center gap-1 shadow-sm">
        {gap.count} {gap.count === 1 ? 'hit' : 'hits'}
      </div>

      {/* Content */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700/50 px-2 py-0.5 rounded-full font-mono font-semibold">
            {gap.router_intent || 'unknown'}
          </span>
          {gap.suggested_knowledge_type && (
            <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-md font-semibold tracking-wide uppercase">
              {gap.suggested_knowledge_type.replace('_', ' ')}
            </span>
          )}
        </div>

        <p className="text-sm text-foreground leading-relaxed italic line-clamp-3">
          &quot;{gap.message}&quot;
        </p>

        {gap.ai_reply_text && (
          <details className="mt-3 text-xs bg-black/20 rounded-xl p-2.5 border border-amber-500/5 group/details">
            <summary className="cursor-pointer text-amber-400 font-bold select-none list-none flex items-center justify-between">
              <span>AI Replied</span>
              <ChevronDown
                size={12}
                className="text-amber-500/70 transition-transform group-open/details:rotate-180 animate-in fade-in"
              />
            </summary>
            <p className="text-zinc-400/90 mt-1.5 leading-relaxed break-words whitespace-pre-wrap max-h-24 overflow-y-auto custom-scrollbar font-mono text-[11px]">
              {gap.ai_reply_text}
            </p>
          </details>
        )}
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-col gap-2 shrink-0">
        <button
          onClick={primaryBtnAction}
          className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black text-[13px] font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.15)] hover:scale-[1.01]"
        >
          {primaryBtnIcon}
          {primaryBtnLabel}
        </button>
        <button
          onClick={onMarkNotNeeded}
          className="w-full py-2 bg-transparent hover:bg-amber-500/5 text-amber-500/80 hover:text-amber-400 border border-amber-500/10 hover:border-amber-500/20 text-[12px] font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5"
        >
          Mark Not Needed
        </button>
      </div>
    </div>
  );
}
