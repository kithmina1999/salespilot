'use client';
import { Edit2 } from 'lucide-react';
import type { RuleEntry } from '@/hooks/useRulesPage';
import type { Rule } from '../types';

interface TemplateLibraryProps {
  commonRules: RuleEntry[];
  customRules: RuleEntry[];
  responseLang: string;
  loading: boolean;
  onClone: (rule: Rule) => void;
}

export function TemplateLibrary({
  commonRules,
  customRules,
  responseLang,
  loading,
  onClone,
}: TemplateLibraryProps) {
  if (loading) {
    return (
      <div className="p-8 text-center text-sm border rounded-xl opacity-50 col-span-full border-border">
        Loading...
      </div>
    );
  }

  if (commonRules.length === 0) {
    return (
      <div className="p-10 border border-dashed rounded-xl flex items-center justify-center opacity-50 border-border">
        <p className="text-sm">No templates available yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {commonRules.map((r) => {
        const isOverridden = customRules.some((cr) => cr.keywords === r.keywords);

        return (
          <div
            key={r.ID}
            className={`p-5 border rounded-2xl flex flex-col transition-all border-border bg-card shadow-sm ${
              isOverridden
                ? 'opacity-30 grayscale'
                : 'opacity-80 hover:opacity-100 hover:border-border'
            }`}
          >
            {/* Keywords */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex flex-wrap gap-1.5 max-w-[70%]">
                {r.keywords.split(',').map((kw, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-full text-[11px] border bg-transparent text-gray-400 border-border"
                  >
                    {kw.trim()}
                  </span>
                ))}
              </div>

              {!isOverridden ? (
                <button
                  onClick={() => onClone(r as unknown as Rule)}
                  className="flex items-center gap-1.5 text-[11px] text-foreground border px-2 py-1 rounded-lg bg-secondary hover:bg-border transition-colors border-border"
                >
                  <Edit2 size={12} /> Clone
                </button>
              ) : (
                <span className="text-[10px] uppercase font-bold text-gray-500">Cloned</span>
              )}
            </div>

            {/* Response preview */}
            <div className="text-sm text-gray-400 leading-relaxed bg-black/20 p-3 rounded-lg border border-transparent mt-2 whitespace-pre-wrap">
              {responseLang !== 'english_first' && r.sinhala_response
                ? r.sinhala_response
                : r.response}
              {responseLang !== 'english_first' && r.sinhala_response && (
                <span className="ml-2 text-[10px] text-green-400 font-bold align-middle">
                  සිංහල
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
