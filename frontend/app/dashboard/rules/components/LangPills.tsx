'use client';
import { LANG_META } from '../types';

interface LangPillsProps {
  /** Parsed responses map: { en: '...', si: '...' } */
  responseMap: Record<string, string>;
  /** Languages the business has enabled */
  botLangs: string[];
  /** Currently selected preview language */
  cardPreviewLang: string;
  /** Callback when user clicks a filled pill */
  onSelect: (lang: string) => void;
}

/**
 * Language coverage pill strip for rule cards.
 * - Desktop (md+): overlapping fan pills that expand on direct hover to reveal labels.
 *   Border colour encodes status: emerald = filled, amber = missing, zinc = disabled.
 * - Mobile (<md): horizontal‑scroll compact flag + status-dot pills.
 */
export default function LangPills({
  responseMap,
  botLangs,
  cardPreviewLang,
  onSelect,
}: LangPillsProps) {
  const langs = Object.keys(LANG_META);

  return (
    <>
      {/* ── DESKTOP (md+): overlapping fan pills ── */}
      <div className="hidden md:flex items-center">
        {langs.map((l, idx) => {
          const enabled     = botLangs.includes(l);
          const hasCoverage = !!(responseMap[l]?.trim());
          const isActive    = cardPreviewLang === l && hasCoverage;
          const meta        = LANG_META[l];

          const borderCls = !enabled
            ? 'border-zinc-700/40'
            : !hasCoverage
            ? 'border-amber-700/50'
            : isActive
            ? 'border-white/30'
            : 'border-emerald-600/40 hover:border-emerald-400/70';

          const styleCls = !enabled
            ? 'bg-zinc-900 text-zinc-600 opacity-25 cursor-not-allowed grayscale'
            : !hasCoverage
            ? 'bg-amber-950/20 text-amber-500/60 opacity-50 cursor-default'
            : isActive
            ? `bg-white/10 ${meta.color} cursor-pointer`
            : `bg-zinc-900 ${meta.color} hover:bg-zinc-800 cursor-pointer`;

          const marginCls = idx === 0 ? 'ml-0' : '-ml-[9px]';

          return (
            <button
              key={l}
              type="button"
              onClick={() => hasCoverage && enabled && onSelect(l)}
              title={
                !enabled      ? `${meta.label} — Enable in Settings → Language`
                : hasCoverage ? `Preview in ${meta.label}`
                :               `No ${meta.label} response set`
              }
              style={{ zIndex: langs.length - idx }}
              className={[
                'flex items-center gap-1 h-6 rounded-full border px-1.5',
                'overflow-hidden whitespace-nowrap flex-shrink-0 text-[11px] font-medium',
                // Collapsed at 26px wide; expands on individual pill hover to 100px
                'max-w-[26px] hover:max-w-[100px] hover:z-[99]',
                '[transition:max-width_160ms_ease-out,margin-left_160ms_ease-out]',
                marginCls,
                borderCls,
                styleCls,
              ].join(' ')}
            >
              <span className="text-sm leading-none shrink-0">{meta.flag}</span>
              <span className="text-[10px] font-bold leading-none">{meta.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── MOBILE (<md): horizontal scroll strip ── */}
      <div
        className="flex md:hidden items-center gap-1 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {langs.map(l => {
          const enabled     = botLangs.includes(l);
          const hasCoverage = !!(responseMap[l]?.trim());
          const isActive    = cardPreviewLang === l && hasCoverage;
          const meta        = LANG_META[l];
          return (
            <button
              key={l}
              type="button"
              onClick={() => hasCoverage && enabled && onSelect(l)}
              className={[
                'flex shrink-0 items-center gap-1 px-2 py-1 rounded-full border',
                'text-[10px] font-bold active:scale-95 transition-transform',
                !enabled
                  ? 'opacity-25 border-zinc-800 text-zinc-600 grayscale'
                  : !hasCoverage
                  ? 'opacity-40 border-amber-900/40 text-amber-600'
                  : isActive
                  ? `${meta.color} border-white/20 bg-white/10`
                  : 'text-zinc-400 border-zinc-700 bg-zinc-900 active:bg-white/10',
              ].join(' ')}
            >
              {meta.flag}
              {enabled && (
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    hasCoverage ? 'bg-emerald-400' : 'bg-amber-500'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
