'use client';

import { useState } from 'react';
import {
  Sparkles, X, Loader2, AlertTriangle, ShieldAlert, Wand2,
} from 'lucide-react';
import { toast } from 'sonner';

const API = 'http://localhost:8080';

interface QuickFAQModalProps {
  unmatchedMessage: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function QuickFAQModal({ unmatchedMessage, onClose, onSuccess }: QuickFAQModalProps) {
  const [form, setForm] = useState({
    keywords: '',
    response: '',
    sinhala_response: '',
    is_active: true,
  });
  const [drafting,          setDrafting]          = useState(false);
  const [saving,            setSaving]            = useState(false);
  const [generalizedIntent, setGeneralizedIntent] = useState('');

  // ── "Generalize & Draft" — matches inbox-mode in rules page ──────────────
  async function handleGeneralizeAndDraft() {
    setDrafting(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API}/api/v1/faqs/draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: unmatchedMessage, from_inbox: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setForm(prev => ({
          ...prev,
          keywords: data.keywords || prev.keywords,
          response: data.response || prev.response,
          sinhala_response: data.sinhala_response || prev.sinhala_response,
        }));
        if (data.generalized_intent) setGeneralizedIntent(data.generalized_intent);
        toast.success('✨ Intent generalized and rule drafted!');
      } else if (res.status === 403) {
        const data = await res.json();
        toast.error(data.error || 'AI Draft requires Starter or higher');
      } else {
        toast.error('Failed to draft with AI');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setDrafting(false);
    }
  }

  // ── Save + auto-resolve the unmatched message ─────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.response.trim()) { toast.error('English response is required'); return; }
    setSaving(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API}/api/v1/rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          keywords:         form.keywords,
          response:         form.response,
          sinhala_response: form.sinhala_response,
          is_active:        form.is_active,
          resolved_message: unmatchedMessage, // auto-clears inbox entry
        }),
      });
      if (res.ok) {
        toast.success('Rule created & query resolved! ✅');
        onSuccess();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save FAQ');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  }

  const missingSinhala = form.sinhala_response.trim() === '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 bg-muted border border-border flex flex-col max-h-[92vh] overflow-y-auto">

        {/* ── Header ── */}
        <div className="px-6 pt-6 pb-4 border-b border-border/60 bg-muted sticky top-0 z-10 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <ShieldAlert className="text-amber-400" size={20} />
              Convert to FAQ Rule
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Turn this unanswered query into a 24/7 automated response.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors ml-4 shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6">

          {/* ── Amber "Customer asked" seed block (matches /rules inbox mode) ── */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert size={12} /> Customer asked
              </span>
              <button
                type="button"
                onClick={handleGeneralizeAndDraft}
                disabled={drafting}
                className="text-[11px] px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black rounded-lg font-bold transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {drafting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                {drafting ? 'Generalizing...' : 'Generalize & Draft ✨'}
              </button>
            </div>
            <p className="text-sm text-amber-200/80 italic leading-relaxed">&ldquo;{unmatchedMessage}&rdquo;</p>
            {generalizedIntent && (
              <p className="text-[11px] text-amber-400/80 mt-1 flex items-center gap-1">
                <Sparkles size={10} /> Generalized as: <span className="font-semibold ml-1">{generalizedIntent}</span>
              </p>
            )}
            <p className="text-[11px] text-amber-500/60">
              Click &ldquo;Generalize &amp; Draft&rdquo; to let AI fill keywords + responses, or type your own below.
            </p>
          </div>

          {/* ── Keywords ── */}
          <div>
            <label className="block text-sm mb-1.5 text-muted-foreground font-medium">
              Trigger Keywords <span className="text-xs text-muted-foreground font-normal italic ml-2">(Comma separated)</span>
            </label>
            <input
              required
              type="text"
              value={form.keywords}
              onChange={e => setForm({ ...form, keywords: e.target.value })}
              placeholder="Type or click 'Generalize & Draft'..."
              className="w-full px-4 py-2.5 bg-background border rounded-xl text-sm outline-none focus:border-zinc-500 border-border transition-colors text-foreground placeholder:text-zinc-600"
            />
          </div>

          {/* ── Sinhala response ── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm text-muted-foreground font-medium flex items-center gap-1.5">
                Bot Response{' '}
                <span className="text-[11px] px-1.5 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded font-bold">සිංහල</span>
                {missingSinhala && (
                  <span className="text-[10px] text-amber-400 flex items-center gap-0.5 ml-1">
                    <AlertTriangle size={10} /> Recommended for Sri Lanka
                  </span>
                )}
              </label>
            </div>
            <textarea
              rows={5}
              value={form.sinhala_response}
              onChange={e => setForm({ ...form, sinhala_response: e.target.value })}
              placeholder="අපගේ බෙදාහැරීමේ ක්‍රියාවලිය..."
              className={`w-full px-4 py-3 bg-background border rounded-xl text-sm outline-none focus:border-zinc-500 transition-colors resize-y text-foreground leading-relaxed ${
                missingSinhala ? 'border-amber-500/30' : 'border-border'
              }`}
            />
          </div>

          {/* ── English response ── */}
          <div>
            <label className="text-sm mb-1.5 text-muted-foreground font-medium flex items-center gap-1.5">
              Bot Response{' '}
              <span className="text-[11px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded font-bold">English</span>
            </label>
            <textarea
              required
              rows={5}
              value={form.response}
              onChange={e => setForm({ ...form, response: e.target.value })}
              placeholder="We deliver island-wide within 3 business days..."
              className="w-full px-4 py-3 bg-background border rounded-xl text-sm outline-none focus:border-zinc-500 border-border transition-colors resize-y leading-relaxed text-foreground"
            />
          </div>

          {/* ── Active toggle + actions ── */}
          <div className="flex items-center justify-between border-t pt-5 mt-1 border-border">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="qfaq-active"
                checked={form.is_active}
                onChange={e => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4 rounded border-border bg-background accent-emerald-500 cursor-pointer"
              />
              <div className="flex flex-col">
                <label htmlFor="qfaq-active" className="text-sm font-medium cursor-pointer select-none text-foreground">
                  Rule Active
                </label>
                <span className="text-[10px] text-muted-foreground">Turn off to save as draft without activating.</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 flex items-center justify-center rounded-xl text-sm font-bold bg-white text-black hover:bg-zinc-100 transition-colors shadow-md disabled:opacity-50 min-w-[130px]"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save & Resolve'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
