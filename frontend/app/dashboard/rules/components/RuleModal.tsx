'use client';

import { useState } from 'react';
import {
  ChevronDown, Sparkles, Loader2, AlertTriangle, ShieldAlert, Wand2, Lock as LockIcon, X,
} from 'lucide-react';
import { LANG_META, Rule, parseResponses } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Create / Edit modal
// ─────────────────────────────────────────────────────────────────────────────

interface RuleModalProps {
  mode: 'create' | 'edit_custom' | 'clone_common';
  form: { category: string; keywords: string; responses: Record<string, string>; is_active: boolean };
  setForm: React.Dispatch<React.SetStateAction<{
    category: string;
    keywords: string;
    responses: Record<string, string>;
    is_active: boolean;
  }>>;
  botLangs: string[];
  seedOriginalLine: string;
  generalizedIntent: string;
  drafting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  onAutoDraft: () => void;
  t: (key: string) => string;
}

export function RuleModal({
  mode,
  form,
  setForm,
  botLangs,
  seedOriginalLine,
  generalizedIntent,
  drafting,
  onSubmit,
  onClose,
  onAutoDraft,
  t,
}: RuleModalProps) {
  const [activeResponseLang, setActiveResponseLang] = useState<string>(botLangs[0] || 'en');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [translating, setTranslating] = useState(false);

  const handleTranslate = async () => {
    const enText = form.responses['en'];
    if (!enText) {
      import('sonner').then((m) => m.toast.error('Please fill the English response first to translate.'));
      return;
    }

    setTranslating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/rules/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          text: enText,
          target_lang: LANG_META[activeResponseLang]?.label || activeResponseLang,
        }),
      });
      if (!res.ok) throw new Error('Translation failed');
      const data = await res.json();
      setForm((prev) => ({
        ...prev,
        responses: { ...prev.responses, [activeResponseLang]: data.translated_text },
      }));
      import('sonner').then((m) => m.toast.success('Translated successfully ✨'));
    } catch (err: any) {
      import('sonner').then((m) => m.toast.error(err.message));
    } finally {
      setTranslating(false);
    }
  };

  const activeMeta = LANG_META[activeResponseLang] ?? {
    label: activeResponseLang,
    nativeLabel: '',
    flag: '',
    color: 'text-muted-foreground',
    placeholder: '',
  };
  const activeIsFilled = !!form.responses[activeResponseLang]?.trim();
  const isEnabled = botLangs.includes(activeResponseLang);
  const missingEnabled = botLangs.filter((l) => !form.responses[l]?.trim());

  const title = {
    create: t('rules.create_rule'),
    edit_custom: t('rules.edit_rule'),
    clone_common: t('rules.override_rule'),
  }[mode];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 bg-background border border-border flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 sticky top-0 bg-background border-b border-border/60 z-10">
          <h2 className="text-xl font-semibold">{title}</h2>
          {mode === 'clone_common' && (
            <p className="text-xs text-blue-750 dark:text-blue-400 bg-blue-500/10 p-2 rounded border border-blue-200 dark:border-blue-500/20 mt-2 inline-block">
              Saving this will create a custom override specifically for your bot.
            </p>
          )}
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-5 p-6">
          {/* Inbox seed reference block */}
          {seedOriginalLine && (
            <div className="rounded-xl border border-amber-500/20 dark:border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/8 p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert size={12} /> Customer asked
                </span>
                <button
                  type="button"
                  onClick={onAutoDraft}
                  disabled={drafting}
                  className="text-[11px] px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black rounded-lg font-bold transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {drafting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  {drafting ? 'Generalizing...' : 'Generalize & Draft ✨'}
                </button>
              </div>
              <p className="text-sm text-amber-950 dark:text-amber-200/80 italic leading-relaxed">&ldquo;{seedOriginalLine}&rdquo;</p>
              {generalizedIntent && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400/80 mt-1 flex items-center gap-1">
                  <Sparkles size={10} /> Generalized as:
                  <span className="font-semibold ml-1">{generalizedIntent}</span>
                </p>
              )}
              <p className="text-[11px] text-amber-600/80 dark:text-amber-500/60">
                Click &ldquo;Generalize &amp; Draft&rdquo; to let AI fill keywords + responses, or type your own below.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm mb-1.5 text-muted-foreground font-medium">Category</label>
              <input
                required
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Shipping"
                className="w-full px-4 py-2.5 bg-background border rounded-xl text-sm outline-none focus:border-zinc-500 border-border transition-colors text-foreground placeholder:text-zinc-600"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm mb-1.5 text-muted-foreground font-medium">
                Trigger Keywords{' '}
                <span className="text-xs text-muted-foreground font-normal italic ml-2">(Comma separated)</span>
              </label>
              <input
                required
                autoFocus
                type="text"
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                placeholder={seedOriginalLine ? "Type or click 'Generalize & Draft'..." : 'e.g. delivery, shipping, how long'}
                className="w-full px-4 py-2.5 bg-background border rounded-xl text-sm outline-none focus:border-zinc-500 border-border transition-colors text-foreground placeholder:text-zinc-600"
              />
            </div>
          </div>

          {/* Multi-language response editor */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              {/* Language dropdown */}
              <div className="relative flex-1">
                <button
                  type="button"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-secondary/60 border border-border/50 text-sm font-medium hover:border-zinc-600 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        activeIsFilled
                          ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]'
                          : 'bg-zinc-600'
                      }`}
                    />
                    <span className="text-base leading-none">{activeMeta.flag}</span>
                    <span className={activeMeta.color}>{activeMeta.label}</span>
                    {activeMeta.nativeLabel && activeMeta.nativeLabel !== activeMeta.label && (
                      <span className="text-muted-foreground text-[11px]">{activeMeta.nativeLabel}</span>
                    )}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-muted-foreground transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {dropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-background border border-border rounded-xl z-30 overflow-hidden shadow-2xl">
                    {Object.keys(LANG_META).map((lang) => {
                      const enabled = botLangs.includes(lang);
                      const isFilled = !!form.responses[lang]?.trim();
                      const isActive = lang === activeResponseLang;
                      const m = LANG_META[lang];
                      return (
                        <button
                          key={lang}
                          type="button"
                          disabled={!enabled}
                          onClick={() => {
                            if (!enabled) return;
                            setActiveResponseLang(lang);
                            setDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors text-left ${
                            !enabled
                              ? 'opacity-35 cursor-not-allowed'
                              : isActive
                              ? 'bg-secondary'
                              : 'hover:bg-secondary/60'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${isFilled ? 'bg-emerald-400' : 'bg-zinc-600'}`}
                          />
                          <span className="text-base">{m.flag}</span>
                          <span className={enabled ? m.color : 'text-muted-foreground'}>{m.label}</span>
                          <span className="text-zinc-600 text-[11px]">{m.nativeLabel}</span>
                          {!enabled && <LockIcon size={10} className="ml-auto text-zinc-600" />}
                          {enabled && isFilled && <span className="ml-auto text-[10px] text-emerald-400 font-bold">✓</span>}
                          {enabled && !isFilled && <span className="ml-auto text-[10px] text-amber-500/70">empty</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Auto-Draft button (plain mode only) */}
              {!seedOriginalLine && (
                <button
                  type="button"
                  onClick={onAutoDraft}
                  disabled={drafting || !form.keywords.trim()}
                  className="text-[11px] px-2.5 py-2 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-xl font-medium transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  {drafting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-amber-500" />}
                  Auto-Draft
                </button>
              )}
            </div>

            <div className="relative">
              <textarea
                rows={8}
                required={activeResponseLang === 'en'}
                disabled={!isEnabled}
                value={form.responses[activeResponseLang] || ''}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    responses: { ...prev.responses, [activeResponseLang]: e.target.value },
                  }))
                }
                placeholder={activeMeta.placeholder || 'Type the bot response...'}
                className={`w-full px-4 py-3 bg-background border rounded-xl text-sm outline-none transition-colors resize-y leading-relaxed ${
                  !isEnabled
                    ? 'opacity-40 cursor-not-allowed text-muted-foreground border-border'
                    : form.responses[activeResponseLang]?.trim()
                    ? 'text-foreground border-border focus:border-zinc-500'
                    : 'text-foreground border-amber-500/30 focus:border-amber-500/60'
                }`}
              />
              {activeResponseLang !== 'en' && isEnabled && (
                <button
                  type="button"
                  onClick={handleTranslate}
                  disabled={translating || !form.responses['en']}
                  className="absolute bottom-3 right-3 text-[10px] px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 rounded-lg font-bold transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {translating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  {translating ? 'Translating...' : 'Auto-Translate'}
                </button>
              )}
            </div>
            {missingEnabled.length > 0 && (
              <p className="text-[10px] text-amber-700 dark:text-amber-400/80 mt-1.5 flex items-center gap-1">
                <AlertTriangle size={10} />
                Missing responses for:{' '}
                {missingEnabled.map((l) => `${LANG_META[l]?.flag} ${LANG_META[l]?.label}`).join(', ')}
              </p>
            )}
            {form.is_active && missingEnabled.length > 0 && (
              <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 p-3 flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <div className="text-xs text-red-900 dark:text-red-200/90 leading-relaxed">
                  <span className="font-bold text-red-650 dark:text-red-400 block mb-0.5">Activation Blocked</span>
                  Complete all bot languages before activating this rule:{' '}
                  <span className="font-semibold">
                    {missingEnabled.map((l) => `${LANG_META[l]?.flag || ''} ${LANG_META[l]?.label || l}`).join(', ')}
                  </span>
                  . You can uncheck "Rule Active" to save it as a draft/paused rule.
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t pt-5 mt-2 border-border">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active-toggle"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4 rounded border-gray-600 bg-transparent text-foreground focus:ring-white transition-all accent-white"
              />
              <div className="flex flex-col">
                <label htmlFor="active-toggle" className="text-sm font-medium cursor-pointer select-none">
                  Rule Active
                </label>
                <span className="text-[10px] text-gray-400 max-w-[200px]">
                  Turn off to make the bot ignore these keywords entirely.
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={form.is_active && missingEnabled.length > 0}
                className="px-5 py-2 flex items-center justify-center rounded-lg text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors shadow-md"
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule View Dialog
// ─────────────────────────────────────────────────────────────────────────────

interface RuleViewDialogProps {
  rule: Rule;
  botLangs: string[];
  onClose: () => void;
}

export function RuleViewDialog({ rule, botLangs, onClose }: RuleViewDialogProps) {
  const responses = parseResponses(rule.responses, rule.response, rule.sinhala_response);
  const responseLangs = Array.from(new Set([...botLangs, ...Object.keys(responses)])).filter(Boolean);
  const keywords = rule.keywords.split(',').map((k) => k.trim()).filter(Boolean);

  let typeLabel = 'FAQ';
  if (rule.knowledge_type === 'product_catalog') {
    typeLabel = 'Product';
  } else if (rule.source_type === 'payment_settings') {
    typeLabel = 'Payment';
  } else if (rule.source_type === 'delivery_settings') {
    typeLabel = 'Delivery';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl shadow-2xl bg-background border border-border flex flex-col max-h-[92vh] overflow-hidden">
        <div className="px-6 py-5 border-b border-border/60 flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded-md border border-border bg-background text-[10px] font-bold uppercase text-muted-foreground">
                {typeLabel}
              </span>
              {rule.system_managed && (
                <span className="px-2 py-0.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-150 dark:bg-zinc-900 text-[10px] font-bold uppercase text-zinc-600 dark:text-zinc-400">
                  System
                </span>
              )}
              <span
                className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase ${
                  rule.is_active
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                    : 'border-border bg-background text-muted-foreground'
                }`}
              >
                {rule.is_active ? 'Active' : 'Paused'}
              </span>
            </div>
            <h2 className="text-xl font-semibold">{rule.category || 'General'}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Trigger Keywords</h3>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((kw, idx) => (
                <span
                  key={`${kw}-${idx}`}
                  className="px-2 py-1 rounded-md border border-border bg-background text-xs font-mono text-muted-foreground"
                >
                  {kw}
                </span>
              ))}
            </div>
          </section>

          {rule.source_type && rule.source_type !== 'manual' && (
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-background p-3">
                <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Source</span>
                <span className="text-sm text-foreground">{rule.source_type.replace('_', ' ')}</span>
              </div>
              <div className="rounded-xl border border-border bg-background p-3">
                <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Source ID</span>
                <span className="text-sm text-foreground">{rule.source_id ?? '-'}</span>
              </div>
              <div className="rounded-xl border border-border bg-background p-3">
                <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Hits</span>
                <span className="text-sm text-foreground">{rule.usage_count || 0}</span>
              </div>
            </section>
          )}

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Responses</h3>
            {responseLangs.map((lang) => {
              const meta = LANG_META[lang];
              const text = responses[lang]?.trim();
              return (
                <div key={lang} className="rounded-xl border border-border bg-background overflow-hidden">
                  <div className="px-4 py-2 border-b border-border/60 flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">
                      {meta?.flag ? `${meta.flag} ` : ''}
                      {meta?.label || lang}
                    </span>
                    {!text && <span className="text-[10px] text-amber-400 uppercase font-bold">Missing</span>}
                  </div>
                  <div className="p-4 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap min-h-16">
                    {text || 'No response configured.'}
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Generate modal
// ─────────────────────────────────────────────────────────────────────────────

interface AIGenerateModalProps {
  plan: string;
  ruleGenerationCount: number;
  generating: boolean;
  generateIntent: string;
  setGenerateIntent: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function AIGenerateModal({
  plan,
  ruleGenerationCount,
  generating,
  generateIntent,
  setGenerateIntent,
  onSubmit,
  onClose,
}: AIGenerateModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 bg-background border border-border flex flex-col overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-border/80 bg-background relative">
          <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
            <Sparkles className="text-amber-400" size={22} /> AI Rule Generator
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Describe the topic, and AI will build the FAQ structure and draft warm, natural responses.
          </p>
        </div>

        <form onSubmit={onSubmit} className="p-6">
          <label className="block text-sm font-medium mb-3 text-foreground">What should this rule cover?</label>
          <textarea
            required
            autoFocus
            rows={3}
            value={generateIntent}
            onChange={(e) => setGenerateIntent(e.target.value)}
            placeholder="e.g. Tell customers we only accept cash on delivery and no bank transfers..."
            className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm outline-none focus:border-amber-500/50 transition-colors resize-none text-foreground leading-relaxed shadow-inner"
          />

          <div className="flex items-center justify-between mt-6">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-600">Pro Feature</span>
              <span
                className={`text-[11px] font-medium mt-0.5 ${
                  plan === 'starter' ? 'text-muted-foreground' : 'text-amber-500/80'
                }`}
              >
                {plan === 'starter' ? `${ruleGenerationCount} / 30 generations used` : 'Unlimited Generations'}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-secondary transition-colors text-muted-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={generating}
                className="px-6 py-2.5 flex items-center justify-center gap-2 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.02] shadow-lg transition-all disabled:opacity-50 disabled:hover:scale-100 min-w-[140px]"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-500" />}
                {generating ? 'Generating...' : 'Generate 🚀'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
