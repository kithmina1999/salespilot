'use client';
import { Edit2, Trash, BarChart3, ShieldAlert } from 'lucide-react';
import LangDropdown from './LangDropdown';
import { Rule, LANG_META, parseResponses } from '../types';

interface RuleCardProps {
  rule: Rule;
  overridesCommon: boolean;
  botLangs: string[];
  cardPreviewLang: string;
  onPreviewLangChange: (lang: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
}

export default function RuleCard({
  rule: r,
  overridesCommon,
  botLangs,
  cardPreviewLang,
  onPreviewLangChange,
  onEdit,
  onDelete,
  onToggleStatus,
}: RuleCardProps) {
  const responseMap = parseResponses(r.responses, r.response, r.sinhala_response);

  // Resolve preview language with fallback chain
  const previewLang =
    (responseMap[cardPreviewLang] ? cardPreviewLang : null) ||
    botLangs.find(l => responseMap[l]) ||
    'en';
  const previewText = responseMap[previewLang] || '';
  const previewMeta = LANG_META[previewLang];

  return (
    <div className="p-5 border rounded-2xl relative flex flex-col justify-between transition-all hover:border-zinc-700 border-zinc-800 bg-zinc-900/50 shadow-sm">

      {/* "Overrides Default" badge */}
      {overridesCommon && (
        <div className="absolute top-0 right-0 bg-blue-500/20 text-blue-400 text-[10px] font-bold px-2 py-1 rounded-bl-lg rounded-tr-xl flex items-center gap-1 border-b border-l border-blue-500/30">
          <ShieldAlert size={10} /> Overrides Default
        </div>
      )}

      <div>
        {/* Keywords + edit/delete */}
        <div className="flex justify-between items-start mb-3 mt-1">
          <div className="flex flex-wrap gap-1.5 max-w-[80%]">
            {r.keywords.split(',').map((kw, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-full text-[11px] border bg-white/5 whitespace-nowrap text-zinc-300 border-zinc-800"
              >
                {kw.trim()}
              </span>
            ))}
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={onEdit}
              className="p-1.5 rounded hover:bg-white/10 text-gray-400 transition-colors"
              title="Edit rule"
            >
              <Edit2 size={13} />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded hover:bg-white/10 text-red-400 transition-colors"
              title="Delete rule"
            >
              <Trash size={13} />
            </button>
          </div>
        </div>

        {/* Response preview */}
        <div className="text-sm text-gray-300 leading-relaxed bg-black/30 p-3 rounded-lg border border-white/5 mt-3 mb-7 whitespace-pre-wrap min-h-[56px]">
          {previewText ? (
            <>
              {previewText}
              {previewMeta && (
                <span className={`ml-2 text-[9px] font-bold align-middle opacity-50 ${previewMeta.color}`}>
                  {previewMeta.flag}
                </span>
              )}
            </>
          ) : (
            <span className="text-zinc-600 italic text-xs">
              No {previewMeta?.label} response yet
            </span>
          )}
        </div>
      </div>

      {/* Card footer */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">

        {/* Active/Disabled toggle */}
        <button
          onClick={onToggleStatus}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium transition-all border ${
            r.is_active
              ? 'text-green-400 bg-green-400/10 border-green-400/20 hover:bg-green-400/20'
              : 'text-gray-400 bg-white/5 border-white/10 hover:bg-white/10'
          }`}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              r.is_active
                ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]'
                : 'bg-gray-500'
            }`}
          />
          {r.is_active ? 'Active' : 'Disabled'}
        </button>

        {/* Right: lang dropdown + hits */}
        <div className="flex items-center gap-2">
          <LangDropdown
            responseMap={responseMap}
            botLangs={botLangs}
            cardPreviewLang={cardPreviewLang}
            onSelect={onPreviewLangChange}
          />

          <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] text-gray-400 font-medium">
            <BarChart3 size={12} className="text-blue-400" />
            <span>{r.usage_count || 0} hits</span>
          </div>

          {!r.is_active && (
            <span className="text-[10px] text-gray-500 italic">Ignored</span>
          )}
        </div>
      </div>
    </div>
  );
}
