'use client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Banknote, Truck, Building2, Info, ToggleLeft, ToggleRight } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

interface PaymentConfig {
  allow_cod: boolean;
  allow_transfer: boolean;
  bank_details: string;
}

export default function PaymentsTab() {
  const [config, setConfig] = useState<PaymentConfig>({
    allow_cod: true,
    allow_transfer: false,
    bank_details: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load current payment settings from the business settings endpoint
  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/api/v1/settings/business`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setConfig({
            allow_cod: d.allow_cod ?? true,
            allow_transfer: d.allow_transfer ?? false,
            bank_details: d.bank_details ?? '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    // Must have at least one payment method enabled
    if (!config.allow_cod && !config.allow_transfer) {
      toast.error('At least one payment method must be enabled.');
      return;
    }
    // Bank details required if transfer is enabled
    if (config.allow_transfer && !config.bank_details.trim()) {
      toast.error('Please enter your bank account details so customers know where to transfer.');
      return;
    }

    setSaving(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/v1/settings/business`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(config),
      });
      if (res.ok) toast.success('Payment settings saved!');
      else toast.error('Failed to save payment settings.');
    } catch {
      toast.error('An error occurred. Please try again.');
    }
    setSaving(false);
  }

  const labelCls = 'block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2';
  const textareaCls = 'w-full px-4 py-3 bg-background border border-border rounded-xl text-sm outline-none focus:border-zinc-600 transition-colors text-foreground placeholder:text-zinc-600 resize-none leading-relaxed';

  if (loading) {
    return (
      <div className="rounded-2xl bg-card border border-border p-8 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-border border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Info banner ── */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
        <Info size={14} className="text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Choose which payment methods your customers can use at checkout.
          Bank Transfer requires customers to upload a payment receipt for manual verification.
        </p>
      </div>

      {/* ── Payment Methods card ── */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Banknote size={16} className="text-emerald-400" />
          <h2 className="text-sm font-bold text-foreground">Accepted Payment Methods</h2>
        </div>
        <div className="p-6 space-y-4">

          {/* COD Toggle */}
          <MethodToggle
            icon={<Truck size={18} className="text-amber-400" />}
            title="Cash on Delivery (COD)"
            description="Customer pays in cash when the order is delivered."
            enabled={config.allow_cod}
            onToggle={v => setConfig(prev => ({ ...prev, allow_cod: v }))}
            badge="Recommended"
            badgeColor="bg-amber-500/10 text-amber-400 border-amber-500/20"
          />

          {/* Bank Transfer Toggle */}
          <MethodToggle
            icon={<Building2 size={18} className="text-blue-400" />}
            title="Bank Transfer"
            description="Customer makes a direct bank transfer and submits a screenshot via WhatsApp."
            enabled={config.allow_transfer}
            onToggle={v => setConfig(prev => ({ ...prev, allow_transfer: v }))}
          />
        </div>
      </div>

      {/* ── Bank Details card (only shown when transfer is enabled) ── */}
      {config.allow_transfer && (
        <div className="rounded-2xl bg-card border border-border overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <Building2 size={16} className="text-blue-400" />
            <h2 className="text-sm font-bold text-foreground">Bank Account Details</h2>
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20">
              Required
            </span>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className={labelCls}>Bank Details (shown to customers after they choose Bank Transfer)</label>
              <textarea
                value={config.bank_details}
                onChange={e => setConfig(prev => ({ ...prev, bank_details: e.target.value }))}
                rows={5}
                placeholder={`Bank: Sampath Bank\nAccount No: 0123456789\nAccount Name: Your Shop Pvt Ltd\nBranch: Colombo`}
                className={textareaCls}
              />
              <p className="text-[11px] mt-1.5 text-zinc-600">
                This text is sent to the customer immediately after they choose Bank Transfer.
                Include account number, bank name, and branch for easy reference.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Save button ── */}
      <div className="flex justify-end">
        <button
          id="save-payment-settings"
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 bg-white text-black rounded-xl text-sm font-bold hover:bg-zinc-200 transition-all disabled:opacity-50 shadow-sm"
        >
          {saving ? 'Saving…' : 'Save Payment Settings'}
        </button>
      </div>
    </div>
  );
}

// ─── MethodToggle sub-component ───────────────────────────────────────────────

interface MethodToggleProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  badge?: string;
  badgeColor?: string;
}

function MethodToggle({ icon, title, description, enabled, onToggle, badge, badgeColor }: MethodToggleProps) {
  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer select-none ${
        enabled
          ? 'bg-secondary/60 border-border'
          : 'bg-background/40 border-border/60 hover:border-border/60'
      }`}
      onClick={() => onToggle(!enabled)}
    >
      {/* Icon */}
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
        enabled ? 'bg-border' : 'bg-muted'
      }`}>
        {icon}
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-semibold transition-colors ${enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
            {title}
          </span>
          {badge && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badgeColor}`}>
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>

      {/* Toggle */}
      <div className="shrink-0">
        {enabled
          ? <ToggleRight size={26} className="text-emerald-400" />
          : <ToggleLeft size={26} className="text-zinc-600" />
        }
      </div>
    </div>
  );
}
