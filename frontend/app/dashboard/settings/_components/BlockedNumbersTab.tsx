'use client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

interface BlacklistedNumber {
  id: number;
  phone: string;
  reason: string;
  blocked_at: string;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function BlockedNumbersTab() {
  const [blacklist, setBlacklist] = useState<BlacklistedNumber[]>([]);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => { fetchList(); }, []);

  async function fetchList() {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/v1/settings/blacklist`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const d = await res.json(); setBlacklist(d.blacklist || []); }
  }

  async function handleBlock(e: React.FormEvent) {
    e.preventDefault();
    if (!phone) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/v1/settings/blacklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ phone, reason }),
    });
    if (res.ok) {
      setPhone(''); setReason('');
      toast.success(`${phone} has been blocked.`);
      fetchList();
    } else toast.error('Failed to block number');
  }

  async function handleUnblock(id: number) {
    if (!confirm('Unblock this number?')) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/v1/settings/blacklist/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) { toast.success('Number unblocked.'); fetchList(); }
    else toast.error('Failed to unblock.');
  }

  const inputCls = 'px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm outline-none focus:border-zinc-600 transition-colors text-zinc-200 placeholder:text-zinc-600';

  return (
    <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-2">
        <ShieldCheck size={16} className="text-red-400" />
        <h2 className="text-sm font-bold text-zinc-200">Blocked Numbers</h2>
      </div>
      <div className="p-6 space-y-6">
        <form onSubmit={handleBlock} className="flex flex-col sm:flex-row gap-3">
          <input required type="text" placeholder="e.g. 94712345678"
            value={phone} onChange={e => setPhone(e.target.value)}
            className={`${inputCls} flex-1`} />
          <input type="text" placeholder="Reason (optional)"
            value={reason} onChange={e => setReason(e.target.value)}
            className={`${inputCls} flex-1`} />
          <button type="submit"
            className="px-5 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-sm font-bold hover:bg-red-500/20 transition-colors whitespace-nowrap">
            Block Number
          </button>
        </form>

        {blacklist.length === 0 ? (
          <p className="text-sm text-center py-10 text-zinc-600 border border-dashed border-zinc-800 rounded-xl">
            No numbers currently blocked.
          </p>
        ) : (
          <div className="space-y-2">
            {blacklist.map(b => (
              <div key={b.id} className="flex items-center justify-between p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                <div>
                  <span className="font-mono text-sm font-bold text-zinc-200 block">{b.phone}</span>
                  <span className="text-xs text-zinc-600 mt-0.5 block">
                    {b.reason || 'No reason provided'} · Blocked {fmt(b.blocked_at)}
                  </span>
                </div>
                <button onClick={() => handleUnblock(b.id)}
                  className="text-xs font-bold px-4 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors">
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
