'use client';

import { useEffect, useState } from 'react';
import {
  Wifi, WifiOff, AlertTriangle, CheckCircle2, Loader2, Eye, EyeOff,
  Copy, Check, ChevronDown, ChevronUp, ExternalLink, Unplug, Play,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { PUBLIC_API_URL } from '@/hooks/_shared';
import { useAppStore } from '@/lib/store';

// ── Types ─────────────────────────────────────────────────────────────────────

type WAStatus = 'not_connected' | 'connected' | 'disconnected';
type ViewState = 'not_connected' | 'setup' | 'connected';

interface WAState {
  status: WAStatus;
  is_connected: boolean;
  has_credentials?: boolean;
  phone_number_id: string;
  waba_id: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskToken(token: string): string {
  if (!token || token.length < 8) return '••••••••';
  return '••••••••••••' + token.slice(-6);
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-3 py-2.5">
        <code className="flex-1 text-xs font-mono text-muted-foreground truncate">{value || '—'}</code>
        <button
          onClick={copy}
          className="shrink-0 p-1 rounded-lg text-zinc-600 hover:text-muted-foreground hover:bg-secondary transition-all"
          title="Copy"
        >
          {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
        </button>
      </div>
    </div>
  );
}

function GuidePanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-all"
      >
        <span>📘 How to get these credentials?</span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 text-xs text-muted-foreground border-t border-border bg-muted/40">
          {[
            {
              step: '1',
              title: 'Create a Meta Business Manager account',
              desc: 'Go to business.facebook.com → Create Account. This is your business hub — NOT the developer portal. Use your normal Facebook login.',
            },
            {
              step: '2',
              title: 'Set up WhatsApp in Business Manager',
              desc: 'In Business Manager, go to Settings → WhatsApp Accounts → Add. Meta will guide you through connecting your business phone number.',
            },
            {
              step: '3',
              title: 'Get your Phone Number ID',
              desc: 'After adding your number, go to WhatsApp Manager → Phone Numbers. Click on your number — the Phone Number ID is shown in the details panel (it\'s a long number, NOT your actual phone number).',
            },
            {
              step: '4',
              title: 'Get your WABA ID',
              desc: 'In WhatsApp Manager, the WhatsApp Business Account ID (WABA ID) is shown at the top of the page or in Account Settings.',
            },
            {
              step: '5',
              title: 'Generate a System User Access Token',
              desc: 'In Business Manager, go to Settings → System Users → Create a System Admin user. Click "Generate New Token" → select your app → grant whatsapp_business_messaging and whatsapp_business_management permissions.',
            },
            {
              step: '6',
              title: 'Webhook — handled automatically ✅',
              desc: 'SalesPilot automatically subscribes your WhatsApp account to our webhook when you click Verify & Connect. You do not need to do this manually.',
            },
          ].map(g => (
            <div key={g.step} className="flex gap-3">
              <span className="shrink-0 w-5 h-5 rounded-full bg-secondary text-muted-foreground flex items-center justify-center text-[10px] font-black mt-0.5">
                {g.step}
              </span>
              <div>
                <p className="font-bold text-muted-foreground">{g.title}</p>
                <p className="text-muted-foreground mt-0.5 leading-relaxed">{g.desc}</p>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-3 mt-1">
            <a
              href="https://business.facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-emerald-400 font-bold hover:underline"
            >
              <ExternalLink size={11} /> Meta Business Manager
            </a>
            <a
              href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-muted-foreground font-bold hover:underline"
            >
              <ExternalLink size={11} /> Official API Docs
            </a>
          </div>
          <div className="mt-2 p-3 rounded-lg bg-amber-500/8 border border-amber-500/20 text-amber-400/80 text-[11px] leading-relaxed">
            💡 <strong>Tip:</strong> Use a <strong>System User token</strong>, not the temporary token from the API Setup page. System tokens don't expire unless revoked.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ConnectPage() {
  const [view, setView] = useState<ViewState>('not_connected');
  const [waState, setWaState] = useState<WAState | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const fetchBusiness = useAppStore(s => s.fetchBusiness);

  // Form state
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);

  // Test state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Webhook URL (read from env or derive)
  const webhookUrl = `${PUBLIC_API_URL}/api/whatsapp/webhook`;

  // ── Load status on mount ──
  useEffect(() => {
    apiFetch<WAState>('/api/v1/whatsapp/status')
      .then(data => {
        setWaState(data);
        setView(data.status === 'connected' ? 'connected' : 'not_connected');
      })
      .catch(() => { })
      .finally(() => setLoadingStatus(false));
  }, []);

  // ── Save credentials ──
  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/v1/whatsapp/connect', {
        method: 'POST',
        body: JSON.stringify({
          phone_number_id: phoneNumberId.trim(),
          waba_id: wabaId.trim(),
          access_token: accessToken.trim(),
        }),
      });
      toast.success('WhatsApp connected successfully!');
      // Reload status
      const data = await apiFetch<WAState>('/api/v1/whatsapp/status');
      setWaState(data);
      setView(data.status === 'connected' ? 'connected' : 'not_connected');
      await fetchBusiness(); // Sync global store
      // Clear form
      setPhoneNumberId(''); setWabaId(''); setAccessToken('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not verify credentials with Meta. Check your details and try again.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  // ── Test connection ──
  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const data = await apiFetch<WAState>('/api/v1/whatsapp/test', { method: 'POST' });
      setWaState(data);
      setView(data.status === 'connected' ? 'connected' : 'not_connected');
      setTestResult('ok');
      toast.success('Credentials verified — connection is healthy!');
      await fetchBusiness(); // Sync global store
    } catch {
      setTestResult('fail');
      toast.error('Credentials are invalid or token has expired. Please reconnect.');
      await fetchBusiness(); // Sync global store
    } finally {
      setTesting(false);
    }
  }

  // ── Disconnect ──
  async function handleDisconnect() {
    if (!confirm('Disconnect WhatsApp? Your bot will stop responding to customers immediately.')) return;
    setDisconnecting(true);
    try {
      await apiFetch('/api/v1/whatsapp/disconnect', { method: 'POST' });
      toast.info('WhatsApp disconnected.');
      setWaState(null);
      setTestResult(null);
      setView('not_connected');
      await fetchBusiness(); // Sync global store
    } catch {
      toast.error('Failed to disconnect. Try again.');
    } finally {
      setDisconnecting(false);
    }
  }

  if (loadingStatus) {
    return (
      <div className="max-w-2xl mx-auto mt-12 flex justify-center">
        <Loader2 className="animate-spin text-zinc-600 w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full pb-12">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="pb-6 mb-2 border-b border-border">
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <Wifi className="w-7 h-7 text-emerald-400" />
            WhatsApp Connection
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect your official Meta WhatsApp Business number to power the AI bot.
          </p>
        </div>

        {/* ── Not Connected ── */}
        {view === 'not_connected' && (
          <div className="rounded-2xl border border-border bg-card p-8 flex flex-col items-center gap-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-20 h-20 rounded-2xl bg-background border border-border flex items-center justify-center shadow-inner">
              <WifiOff size={34} className="text-zinc-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-foreground">Not Connected</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Link your Meta WhatsApp number to start responding to customers automatically.
              </p>
            </div>
            <button
              onClick={() => setView('setup')}
              className="px-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-black transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              Connect via Meta API
            </button>
          </div>
        )}

        {/* ── Setup Form ── */}
        {view === 'setup' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-lg font-black text-foreground mb-1">Enter Meta Credentials</h2>
              <p className="text-xs text-muted-foreground mb-5">
                These are verified live with Meta before saving. We never store temporary tokens.
              </p>

              <form onSubmit={handleConnect} className="space-y-4">
                {/* Phone Number ID */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Phone Number ID
                  </label>
                  <input
                    type="text"
                    value={phoneNumberId}
                    onChange={e => setPhoneNumberId(e.target.value)}
                    placeholder="e.g. 123456789012345"
                    required
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono"
                  />
                  <p className="text-[10px] text-zinc-600">WhatsApp Manager → Phone Numbers → click your number → copy the ID. This is NOT your actual phone number.</p>
                </div>

                {/* WABA ID */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    WhatsApp Business Account ID (WABA ID)
                  </label>
                  <input
                    type="text"
                    value={wabaId}
                    onChange={e => setWabaId(e.target.value)}
                    placeholder="e.g. 987654321012345"
                    required
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono"
                  />
                  <p className="text-[10px] text-zinc-600">Meta Business Manager → WhatsApp Accounts → the WABA ID is shown at the top of the page.</p>
                </div>

                {/* Access Token */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    System User Access Token
                  </label>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={accessToken}
                      onChange={e => setAccessToken(e.target.value)}
                      placeholder="EAAxxxxx..."
                      required
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 pr-12 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-muted-foreground transition-colors"
                    >
                      {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-600">Business Manager → Settings → System Users → Generate Token. Use a <strong className="text-muted-foreground">System User token</strong>, NOT the temporary test token.</p>
                </div>



                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setView('not_connected')}
                    className="flex-1 py-3 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:text-muted-foreground hover:border-border transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-black transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saving
                      ? <><Loader2 size={15} className="animate-spin" /> Verifying with Meta...</>
                      : <><ShieldCheck size={15} /> Verify &amp; Connect</>
                    }
                  </button>
                </div>
              </form>
            </div>

            {/* Expandable Guide */}
            <GuidePanel />
          </div>
        )}

        {/* ── Connected ── */}
        {view === 'connected' && waState && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">

            {/* Status card */}
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                      <Wifi size={26} className="text-emerald-400" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-muted rounded-full flex items-center justify-center">
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Status</p>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-foreground">Connected</h2>
                      <CheckCircle2 size={17} className="text-emerald-400 mt-0.5" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Meta WhatsApp Cloud API · Live</p>
                  </div>
                </div>

                {/* Test result badge */}
                {testResult === 'ok' && (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    ✓ Verified
                  </span>
                )}
                {testResult === 'fail' && (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30">
                    ✗ Token Expired
                  </span>
                )}
              </div>
            </div>

            {/* Credential details */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Connection Details</p>
              <CopyField label="Phone Number ID" value={waState.phone_number_id} />
              <CopyField label="WABA ID" value={waState.waba_id} />
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Access Token</p>
                <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-3 py-2.5">
                  <code className="flex-1 text-xs font-mono text-muted-foreground truncate">
                    {maskToken('stored')}
                  </code>
                  <span className="text-[10px] text-zinc-700 font-bold">Secured</span>
                </div>
              </div>
            </div>

            {/* Webhook URL
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <ShieldCheck size={12} className="text-emerald-500" /> Webhook URL (registered in Meta)
            </p>
            <CopyField label="Callback URL" value={webhookUrl} />
            <p className="text-[10px] text-zinc-600">
              If you change your domain, update this URL in Meta → App → WhatsApp → Configuration → Webhook.
            </p>
          </div> */}

            {/* Important notice */}
            <div className="flex gap-3 items-start p-4 rounded-xl bg-amber-500/8 border border-amber-500/20">
              <AlertTriangle size={15} className="text-amber-500 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-amber-400">Keep Your System User Token Active</h4>
                <p className="text-[11px] text-amber-500/60 mt-1 leading-relaxed">
                  System User tokens do not expire unless revoked. If messages stop sending, click "Test Connection" to check if your token is still valid.
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleTest}
                disabled={testing}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-border bg-muted hover:bg-secondary hover:border-border text-sm font-bold text-muted-foreground transition-all"
              >
                {testing
                  ? <><Loader2 size={14} className="animate-spin" /> Testing...</>
                  : <><Play size={14} /> Test Connection</>
                }
              </button>
              <button
                onClick={() => setView('setup')}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-border bg-muted hover:bg-secondary hover:border-border text-sm font-bold text-muted-foreground transition-all"
              >
                Update Credentials
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-red-500/20 bg-red-500/8 hover:bg-red-500/15 text-sm font-bold text-red-400 transition-all"
              >
                {disconnecting
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Unplug size={14} />
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
