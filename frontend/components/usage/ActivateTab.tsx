'use client';

import { useState, useEffect } from 'react';
import { KeyRound, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { useAppStore } from '@/lib/store';

interface Props {
  prefilledCode: string;
  onActivated: () => void;
  onGoSubscribe: () => void;
}

export default function ActivateTab({ prefilledCode, onActivated, onGoSubscribe }: Props) {
  const [code, setCode] = useState(prefilledCode);
  const [activating, setActivating] = useState(false);
  const fetchUsage = useAppStore((s) => s.fetchUsage);

  // Sync if prefilled code arrives after mount
  useEffect(() => {
    if (prefilledCode) setCode(prefilledCode);
  }, [prefilledCode]);

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setActivating(true);
    try {
      const data = await apiFetch<any>('/api/v1/billing/activate', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });
      let msg = data.message ?? 'Plan activated!';
      if (data.expires_at) msg += ` · Active until ${data.expires_at}`;
      toast.success(msg);
      setCode('');
      // Refresh usage + plan data in store
      await fetchUsage();
      onActivated();
    } catch (err: any) {
      toast.error(err.message ?? 'Invalid or expired code.');
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Code-ready banner */}
      {prefilledCode && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
          <CheckCircle2 size={20} className="shrink-0" />
          <div>
            <p className="font-bold">Your code is ready! ✅</p>
            <p className="text-sm opacity-80">Your code has been pre-filled below. Click Activate to upgrade instantly.</p>
          </div>
        </div>
      )}

      {/* Input card */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">Enter Activation Code</h2>
            <p className="text-sm text-zinc-500">Received your code? Paste it here to instantly activate.</p>
          </div>
        </div>

        <form onSubmit={handleActivate} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="BSS-STR-XXXX"
            maxLength={16}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-5 py-4 text-white font-mono text-lg tracking-widest placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
          />
          <button
            type="submit"
            disabled={activating || !code.trim()}
            className="w-full py-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20 disabled:shadow-none"
          >
            {activating
              ? <><Loader2 size={16} className="animate-spin" /> Activating...</>
              : <><KeyRound size={16} /> Activate Plan</>
            }
          </button>
        </form>

        <p className="text-xs text-zinc-600 text-center">
          Codes are in format <span className="font-mono">BSS-STR-XXXX</span>. Case-insensitive.
          <br />
          Don&apos;t have a code?{' '}
          <button onClick={onGoSubscribe} className="text-emerald-400 hover:underline">
            Go to Subscribe tab →
          </button>
        </p>
      </div>

      {/* What you unlock */}
      <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-600 mb-4">What you unlock</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '🤖', label: 'Up to 3,000 AI replies/mo' },
            { icon: '✨', label: 'AI rule generations' },
            { icon: '🔓', label: 'Unlimited FAQ rules' },
            { icon: '📦', label: '100 product catalogue entries' },
            { icon: '🖼️', label: 'WhatsApp image replies' },
            { icon: '💾', label: '500 MB media storage' },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-2 text-sm text-zinc-400">
              <span className="text-base">{f.icon}</span> {f.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
