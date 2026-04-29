'use client';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Lock } from 'lucide-react';
import { LANG_META } from '../types';

interface LangDropdownProps {
  /** Parsed responses map { en: '...', si: '...' } */
  responseMap: Record<string, string>;
  /** Languages the business has enabled for the bot */
  botLangs: string[];
  /** Currently selected preview language */
  cardPreviewLang: string;
  /** Callback when user selects a different language */
  onSelect: (lang: string) => void;
}

/**
 * Compact language selector for rule card footers.
 * Shows the active language flag + status dot as a trigger button.
 * Opens a floating panel listing all 8 languages with their coverage status.
 * Works identically on desktop and mobile.
 */
export default function LangDropdown({
  responseMap,
  botLangs,
  cardPreviewLang,
  onSelect,
}: LangDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const langs = Object.keys(LANG_META);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    function onOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, [open]);

  const activeMeta       = LANG_META[cardPreviewLang];
  const activeHasCoverage = !!(responseMap[cardPreviewLang]?.trim());

  // Count how many enabled langs have no response (for the amber warning dot)
  const missingCount = botLangs.filter(l => !responseMap[l]?.trim()).length;

  return (
    <div ref={containerRef} className="relative">

      {/* ── Trigger button ── */}
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-zinc-700/80 bg-zinc-900 hover:bg-zinc-800 hover:border-zinc-600 transition-all text-[11px] font-medium select-none"
        title="Switch preview language"
      >
        {/* Active lang flag */}
        <span className="text-sm leading-none">{activeMeta?.flag ?? '🌐'}</span>

        {/* Coverage dot */}
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          activeHasCoverage ? 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.6)]' : 'bg-amber-500'
        }`} />

        {/* Missing badge */}
        {missingCount > 0 && (
          <span className="text-[9px] font-black text-amber-400/80 leading-none">
            {missingCount} missing
          </span>
        )}

        <ChevronDown
          size={11}
          className={`text-zinc-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div className="absolute bottom-full right-0 mb-1.5 w-52 bg-zinc-950 border border-zinc-800 rounded-2xl z-50 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-100">
          {/* Panel header */}
          <div className="px-3 py-2 border-b border-zinc-800/80 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Preview language
          </div>

          {langs.map(lang => {
            const enabled     = botLangs.includes(lang);
            const hasCoverage = !!(responseMap[lang]?.trim());
            const isActive    = cardPreviewLang === lang;
            const meta        = LANG_META[lang];
            const clickable   = enabled && hasCoverage;

            return (
              <button
                key={lang}
                type="button"
                disabled={!clickable}
                onClick={() => {
                  if (clickable) { onSelect(lang); setOpen(false); }
                }}
                className={[
                  'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                  !enabled
                    ? 'opacity-30 cursor-not-allowed'
                    : !hasCoverage
                    ? 'opacity-45 cursor-default'
                    : isActive
                    ? 'bg-zinc-800/80'
                    : 'hover:bg-zinc-800/50 cursor-pointer',
                ].join(' ')}
              >
                {/* Flag */}
                <span className="text-base leading-none shrink-0">{meta.flag}</span>

                {/* Labels */}
                <span className="flex flex-col min-w-0">
                  <span className={`text-[12px] font-semibold leading-tight ${enabled ? meta.color : 'text-zinc-500'}`}>
                    {meta.label}
                  </span>
                  {meta.nativeLabel !== meta.label && (
                    <span className="text-zinc-600 text-[10px] leading-tight truncate">{meta.nativeLabel}</span>
                  )}
                </span>

                {/* Status icon — right aligned */}
                <span className="ml-auto shrink-0 flex items-center">
                  {!enabled ? (
                    <Lock size={10} className="text-zinc-600" />
                  ) : hasCoverage ? (
                    <span className={`w-2 h-2 rounded-full bg-emerald-400 ${isActive ? 'shadow-[0_0_5px_rgba(52,211,153,0.7)]' : 'opacity-70'}`} />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-amber-500/70" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
