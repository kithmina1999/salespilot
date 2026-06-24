'use client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Bell, Phone, ChevronDown, Eye, X, Download, Send } from 'lucide-react';

import { API_URL } from '@/hooks/_shared';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function ReportsTab() {
  const [settings, setSettings] = useState({ monthly_report_enabled: true, report_phone: '', plan: 'free' });
  const [history, setHistory] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [viewing, setViewing] = useState<any | null>(null);

  useEffect(() => { fetchSettings(); fetchHistory(); }, []);

  async function fetchSettings() {
    const res = await fetch(`${API_URL}/api/v1/settings/report`, { credentials: 'include' });
    if (res.ok) setSettings(await res.json());
  }

  async function fetchHistory() {
    const res = await fetch(`${API_URL}/api/v1/settings/report/history`, { credentials: 'include' });
    if (res.ok) { const d = await res.json(); setHistory(d.reports || []); }
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`${API_URL}/api/v1/settings/report`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(settings),
    });
    if (res.ok) toast.success('Report settings saved ✅');
    else toast.error('Failed to save');
    setSaving(false);
  }

  async function sendTest() {
    setSending(true);
    const res = await fetch(`${API_URL}/api/v1/settings/report/test`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      toast.success('Test report generating! Check your WhatsApp in ~30s 📊');
      setTimeout(fetchHistory, 35000);
    } else toast.error('Failed to trigger test report');
    setSending(false);
  }

  function download(r: any) {
    const blob = new Blob([r.report_text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `salespilot_report_${r.month}.txt`;
    document.body.appendChild(a); a.click();
    URL.revokeObjectURL(url); document.body.removeChild(a);
  }

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-2">
        <Bell size={16} className="text-amber-400" />
        <h2 className="text-sm font-bold text-foreground">Monthly Intelligence Report</h2>
      </div>

      {/* Toggle */}
      <div className="p-6 flex items-center justify-between gap-4 border-b border-border">
        <div>
          <p className="text-sm font-bold text-foreground">Auto-deliver Monthly Report</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {settings.plan === 'pro'
              ? '🧠 Advanced AI Analysis — delivered on 1st of every month'
              : '📊 Business Summary — delivered on 1st of every month'}
          </p>
        </div>
        <button
          onClick={() => setSettings(s => ({ ...s, monthly_report_enabled: !s.monthly_report_enabled }))}
          className={`relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 ${settings.monthly_report_enabled ? 'bg-emerald-500' : 'bg-border'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${settings.monthly_report_enabled ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
      </div>

      {/* Delivery phone */}
      <div className="p-6 border-b border-border">
        <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
          <Phone size={11} className="inline mr-1" /> Delivery WhatsApp Number
        </label>
        <div className="flex gap-3 flex-wrap">
          <input
            type="text" value={settings.report_phone}
            onChange={e => setSettings(s => ({ ...s, report_phone: e.target.value }))}
            placeholder="e.g. +94771234567"
            className="flex-1 min-w-[200px] px-4 py-2.5 bg-background border border-border rounded-xl text-sm outline-none focus:border-zinc-600 transition-colors text-foreground"
          />
          <button onClick={save} disabled={saving}
            className="px-5 py-2.5 bg-white text-black rounded-xl text-sm font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        <p className="text-xs text-zinc-600 mt-2">Defaults to your registered business number if left empty.</p>
      </div>

      {/* Preview accordion */}
      <div className="border-b border-border">
        <button
          onClick={() => setPreviewOpen(o => !o)}
          className="w-full flex items-center justify-between px-6 py-4 text-sm font-bold text-muted-foreground hover:bg-secondary/30 transition-colors"
        >
          <span>📋 What will the report contain?</span>
          <ChevronDown size={14} className={`transition-transform ${previewOpen ? 'rotate-180' : ''}`} />
        </button>
        {previewOpen && (
          <div className="px-6 pb-5 text-xs text-muted-foreground space-y-2 leading-relaxed">
            <p>✅ <strong className="text-muted-foreground">Revenue Snapshot</strong> — Total LKR revenue, order count, avg order value with MoM % change</p>
            <p>✅ <strong className="text-muted-foreground">Customer Growth</strong> — New vs returning customers</p>
            <p>✅ <strong className="text-muted-foreground">Bot Performance</strong> — AI resolution rate, automation %, quota usage</p>
            <p>✅ <strong className="text-muted-foreground">Top Knowledge Gaps</strong> — Unanswered customer questions</p>
            {settings.plan === 'pro' ? (
              <p>🧠 <strong className="text-emerald-400">Advanced AI Analysis (Pro)</strong> — Deep market analysis, Sri Lanka economic context, 3 strategic recommendations</p>
            ) : (
              <p>📊 <strong className="text-blue-400">Business Summary (Starter)</strong> — Concise AI review with one key action recommendation</p>
            )}
          </div>
        )}
      </div>

      {/* Test + history */}
      <div className="p-6 space-y-5">
        <button onClick={sendTest} disabled={sending}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
          {sending
            ? <><div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" /> Generating…</>
            : <><Send size={13} /> Send Test Report Now</>}
        </button>

        {history.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-600 mb-3">Last {history.length} Reports</p>
            <div className="space-y-2">
              {history.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-background border border-border gap-4 flex-wrap">
                  <div>
                    <p className="text-sm font-bold text-foreground">{r.month}</p>
                    <p className="text-xs text-zinc-600 mt-0.5">{r.report_type === 'advanced' ? '🧠 Advanced' : '📊 Basic'} · Sent to {r.sent_to} · {fmt(r.sent_at)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setViewing(r)}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground hover:bg-border hover:text-foreground transition-colors">
                      <Eye size={11} /> View
                    </button>
                    <button onClick={() => download(r)}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground hover:bg-border hover:text-foreground transition-colors">
                      <Download size={11} /> TXT
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* View modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-muted border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <p className="font-bold text-foreground">Report — {viewing.month}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{viewing.report_type === 'advanced' ? '🧠 Advanced Analysis' : '📊 Business Summary'}</p>
              </div>
              <button onClick={() => setViewing(null)} className="text-muted-foreground hover:text-foreground p-1"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">{viewing.report_text}</pre>
            </div>
            <div className="flex gap-2 p-4 border-t border-border">
              <button onClick={() => download(viewing)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-secondary text-foreground hover:bg-border rounded-xl transition-colors">
                <Download size={13} /> Download TXT
              </button>
              <button onClick={() => setViewing(null)} className="px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground rounded-xl transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
