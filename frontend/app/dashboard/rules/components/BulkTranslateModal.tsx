import { useState, useEffect } from 'react';
import { Loader2, Check, Wand2, X, AlertTriangle } from 'lucide-react';
import { RuleEntry } from '@/hooks/useRulesPage';
import { LANG_META } from '../types';

interface BulkTranslateModalProps {
  rules: RuleEntry[];
  targetLang: string;
  sourceLang: string;
  onClose: () => void;
  onApprove: (updatedRules: RuleEntry[]) => Promise<void>;
}

export function BulkTranslateModal({ rules, targetLang, sourceLang, onClose, onApprove }: BulkTranslateModalProps) {
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  
  // Filter rules that actually need translation
  const rulesToTranslate = rules.filter(r => {
    if (r.system_managed) return false;
    let parsed: Record<string, string> = {};
    try { parsed = JSON.parse(r.responses || '{}'); } catch {}
    
    const hasTarget = !!parsed[targetLang] || (targetLang === 'si' && !!r.sinhala_response) || (targetLang === 'en' && !!r.response);
    const hasSource = !!parsed[sourceLang] || (sourceLang === 'si' && !!r.sinhala_response) || (sourceLang === 'en' && !!r.response);
    
    return !hasTarget && hasSource;
  });

  const handleTranslateAll = async () => {
    for (const rule of rulesToTranslate) {
      if (translations[rule.ID]) continue; // Skip if already translated
      
      let parsed: Record<string, string> = {};
      try { parsed = JSON.parse(rule.responses || '{}'); } catch {}
      const sourceText = parsed[sourceLang] || (sourceLang === 'en' ? rule.response : rule.sinhala_response) || '';
      
      if (!sourceText) continue;

      setLoadingIds(prev => new Set(prev).add(rule.ID));
      
      try {
        const res = await fetch('/api/v1/rules/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            text: sourceText,
            target_lang: LANG_META[targetLang]?.label || targetLang,
          }),
        });
        
        if (res.ok) {
          const data = await res.json();
          setTranslations(prev => ({ ...prev, [rule.ID]: data.translated_text }));
        }
      } catch (err) {
        console.error('Failed to translate rule', rule.ID, err);
      } finally {
        setLoadingIds(prev => {
          const next = new Set(prev);
          next.delete(rule.ID);
          return next;
        });
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const updatedRules = rulesToTranslate.filter(r => translations[r.ID]).map(r => {
      let parsed: Record<string, string> = {};
      try { parsed = JSON.parse(r.responses || '{}'); } catch {}
      
      return {
        ...r,
        responses: JSON.stringify({
          ...parsed,
          [targetLang]: translations[r.ID]
        })
      };
    });
    
    await onApprove(updatedRules);
    setSaving(false);
  };

  const getSourceText = (r: RuleEntry) => {
    let parsed: Record<string, string> = {};
    try { parsed = JSON.parse(r.responses || '{}'); } catch {}
    return parsed[sourceLang] || (sourceLang === 'en' ? r.response : r.sinhala_response) || '';
  };

  if (rulesToTranslate.length === 0) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm bg-black/40">
        <div className="bg-background border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
          <div className="text-center">
            <div className="w-12 h-12 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={24} />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">All Caught Up!</h3>
            <p className="text-sm text-muted-foreground mb-6">There are no missing translations for {LANG_META[targetLang]?.label || targetLang}.</p>
            <button onClick={onClose} className="w-full py-2.5 bg-muted hover:bg-secondary text-foreground rounded-xl transition-colors font-semibold">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm bg-black/40 animate-in fade-in duration-200">
      <div className="bg-background border border-border rounded-2xl w-full max-w-4xl shadow-2xl relative flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Wand2 className="text-amber-500" />
              Bulk Review & Translate
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Translating {rulesToTranslate.length} rules from {LANG_META[sourceLang]?.label} to {LANG_META[targetLang]?.label}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-2 rounded-xl hover:bg-muted transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{LANG_META[sourceLang]?.label} (Original)</span>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{LANG_META[targetLang]?.label} (Translation)</span>
          </div>

          {rulesToTranslate.map(rule => (
            <div key={rule.ID} className="grid grid-cols-2 gap-4 items-start p-4 bg-card rounded-xl border border-border/50">
              <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed opacity-80">
                {getSourceText(rule)}
              </div>
              <div className="relative">
                {loadingIds.has(rule.ID) ? (
                  <div className="flex items-center justify-center h-24 bg-muted rounded-xl border border-border">
                    <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                  </div>
                ) : (
                  <textarea
                    value={translations[rule.ID] || ''}
                    onChange={(e) => setTranslations(prev => ({ ...prev, [rule.ID]: e.target.value }))}
                    placeholder={`Awaiting translation...`}
                    className="w-full h-24 px-3 py-2 bg-muted border border-border rounded-xl text-sm text-foreground outline-none focus:border-amber-500/50 resize-y"
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-5 sm:p-6 border-t border-border flex items-center justify-between shrink-0 bg-background/90 backdrop-blur rounded-b-2xl">
          <button
            onClick={handleTranslateAll}
            disabled={loadingIds.size > 0 || rulesToTranslate.every(r => translations[r.ID])}
            className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 rounded-xl font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {loadingIds.size > 0 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {loadingIds.size > 0 ? 'Translating...' : 'Translate All Missing'}
          </button>
          
          <button
            onClick={handleSave}
            disabled={saving || Object.keys(translations).length === 0}
            className="px-6 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-bold transition-colors flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Approve & Save
          </button>
        </div>
      </div>
    </div>
  );
}
