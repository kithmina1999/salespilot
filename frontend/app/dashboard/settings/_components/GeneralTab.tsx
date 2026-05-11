'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { UserCog, CreditCard, Clock, Zap } from 'lucide-react';
import Link from 'next/link';
import type { BusinessSettings, BillingStatus } from '../page';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

interface Props {
  settings: BusinessSettings;
  setSettings: (s: BusinessSettings) => void;
  billing: BillingStatus | null;
}

export default function GeneralTab({ settings, setSettings, billing }: Props) {
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/v1/settings/business`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      if (res.ok) toast.success('Settings saved successfully!');
      else toast.error('Failed to save settings');
    } catch { toast.error('An error occurred'); }
    setSaving(false);
  }

  function update(k: keyof BusinessSettings, v: string) {
    setSettings({ ...settings, [k]: v });
  }

  const inputCls = 'w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm outline-none focus:border-zinc-600 transition-colors text-foreground placeholder:text-zinc-600';
  const labelCls = 'block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2';

  return (
    <div className="space-y-6">
      {/* ── Current Plan card — compact, links to /usage ── */}
      {billing && (
        <div className="p-5 rounded-2xl bg-card border border-border flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <CreditCard size={16} className="text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground capitalize">
                {billing.plan === 'free' && billing.trial_days_remaining && billing.trial_days_remaining > 0
                  ? 'Starter Trial'
                  : billing.plan === 'starter' || billing.plan === 'pro'
                  ? `${billing.plan.charAt(0).toUpperCase() + billing.plan.slice(1)} Plan`
                  : 'Free Plan'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                {billing.plan === 'starter' || billing.plan === 'pro' ? (
                  <><Clock size={10} className="text-emerald-500" /> Renews in {billing.days_remaining} days</>
                ) : billing.trial_days_remaining && billing.trial_days_remaining > 0 ? (
                  <><Clock size={10} className="text-amber-500" /> {billing.trial_days_remaining} trial days remaining</>
                ) : (
                  <><Zap size={10} className="text-amber-500" /> Trial ended</>
                )}
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/usage"
            className="shrink-0 text-xs font-bold px-4 py-2 rounded-lg bg-secondary border border-border text-muted-foreground hover:bg-border hover:text-foreground transition-colors"
          >
            Manage Plan
          </Link>
        </div>
      )}

      {/* ── Business & Bot Settings ── */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <UserCog size={16} className="text-emerald-400" />
          <h2 className="text-sm font-bold text-foreground">Business Profile & AI Settings</h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelCls}>Business Name</label>
              <input
                type="text" value={settings.name}
                onChange={e => update('name', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Bot Name</label>
              <input
                type="text" value={settings.bot_name}
                onChange={e => update('bot_name', e.target.value)}
                placeholder="e.g. SalesPilot Assistant"
                className={inputCls}
              />
              <p className="text-[11px] mt-1.5 text-zinc-600">How the AI introduces itself to customers.</p>
            </div>
            <div>
              <label className={labelCls}>Operating Hours</label>
              <input
                type="text" value={settings.operating_hours}
                onChange={e => update('operating_hours', e.target.value)}
                placeholder="e.g. Mon–Sat 9AM–6PM"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Delivery Policy</label>
              <input
                type="text" value={settings.delivery_policy}
                onChange={e => update('delivery_policy', e.target.value)}
                placeholder="e.g. Island-wide delivery in 3 days"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Bot Personality & Instructions</label>
            <textarea
              value={settings.bot_personality || ''}
              onChange={e => update('bot_personality', e.target.value)}
              placeholder="e.g. You are a friendly and helpful assistant. Keep your answers very short (1-2 sentences). Always be polite."
              rows={4}
              className={`${inputCls} resize-none leading-relaxed`}
            />
            <div className="mt-2 space-y-1.5">
              <p className="text-[11px] text-muted-foreground">
                Define how the AI behaves and speaks across all languages. The AI will automatically translate this persona.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => update('bot_personality', "You are a friendly and casual sales assistant. Keep your answers extremely short, natural, and use emojis. Encourage the customer to ask questions.")}
                  className="text-[10px] px-2 py-1 rounded bg-secondary text-muted-foreground hover:text-foreground hover:bg-border transition-colors"
                >
                  Use Friendly Default
                </button>
                <button
                  type="button"
                  onClick={() => update('bot_personality', "You are a highly professional and polite customer support agent. Provide clear, direct, and formal answers without emojis.")}
                  className="text-[10px] px-2 py-1 rounded bg-secondary text-muted-foreground hover:text-foreground hover:bg-border transition-colors"
                >
                  Use Professional Default
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={save}
              disabled={saving}
              className="px-6 py-2.5 bg-white text-black rounded-xl text-sm font-bold hover:bg-zinc-200 transition-all disabled:opacity-50 shadow-sm"
            >
              {saving ? 'Saving…' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
