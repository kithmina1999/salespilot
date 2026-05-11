'use client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { History, Download, RefreshCw, Activity, Box, ShoppingCart, FileText, Zap } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

interface AuditLog {
  id: number; actor_type: string; actor_id: number; action: string;
  entity_type: string; entity_id: string; metadata: string;
  ip_address: string; created_at: string;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

function entityIcon(type: string) {
  switch (type) {
    case 'product': return <Box size={13} className="text-blue-400" />;
    case 'order':   return <ShoppingCart size={13} className="text-purple-400" />;
    case 'rule':    return <FileText size={13} className="text-orange-400" />;
    default:        return <Activity size={13} className="text-muted-foreground" />;
  }
}

function fmtAction(a: string) {
  return a.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function parseMeta(json: string) {
  try { return JSON.parse(json); } catch { return {}; }
}

export default function AuditLogTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchLogs(); }, []);

  async function fetchLogs() {
    setLoading(true);
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/v1/settings/logs`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setLogs(await res.json() || []);
    setLoading(false);
  }

  async function downloadLogs() {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/v1/settings/logs/download`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);
      toast.success('Logs downloaded');
    } else toast.error('Download failed');
  }

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History size={16} className="text-purple-400" />
          <h2 className="text-sm font-bold text-foreground">Security Audit Log</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadLogs}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-muted border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <Download size={12} /> CSV
          </button>
          <button onClick={fetchLogs}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-muted border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-sm text-zinc-600">Loading audit records…</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-sm text-zinc-600">No audit logs recorded yet.</div>
      ) : (
        <div className="divide-y divide-zinc-800 max-h-[520px] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full">
          {logs.map(log => {
            const meta = parseMeta(log.metadata);
            return (
              <div key={log.id} className="p-4 flex flex-col sm:flex-row gap-3 hover:bg-secondary/30 transition-colors">
                <div className="flex sm:flex-col sm:w-28 shrink-0 sm:border-r sm:border-border sm:pr-4 items-center sm:items-end justify-between sm:justify-center gap-2 pb-2 sm:pb-0 border-b sm:border-b-0 border-border">
                  <span className="text-[11px] text-muted-foreground font-medium">{fmt(log.created_at)}</span>
                  <span className="text-[10px] font-mono text-zinc-600">{log.ip_address || 'System'}</span>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    {entityIcon(log.entity_type)}
                    <span className="text-sm font-bold text-foreground">{fmtAction(log.action)}</span>
                    {log.actor_type === 'system' ? (
                      <span className="ml-auto text-[9px] font-bold uppercase flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                        <Zap size={9} /> Auto
                      </span>
                    ) : (
                      <span className="ml-auto text-[9px] font-mono px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border shrink-0">
                        Admin #{log.actor_id}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-2 items-center">
                    <span className="uppercase text-[9px] font-black tracking-widest border border-border bg-background px-1.5 py-0.5 rounded">
                      {log.entity_type} #{log.entity_id}
                    </span>
                    {log.action === 'order_status_updated' && (
                      <span>
                        <span className="text-muted-foreground font-mono bg-secondary px-1.5 py-0.5 rounded mx-1 border border-border">{meta.old_status}</span>
                        →
                        <span className="text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded mx-1">{meta.new_status}</span>
                      </span>
                    )}
                    {log.action === 'product_created' && (
                      <span>Created <span className="text-foreground font-bold">{meta.name}</span> at <span className="font-mono text-foreground">Rs.{meta.price}</span></span>
                    )}
                    {log.action === 'product_updated' && (
                      <span className="font-mono text-[11px] bg-background px-2 py-1 rounded border border-border text-muted-foreground">
                        Fields: {Object.keys(meta.updates_applied || {}).join(', ')}
                      </span>
                    )}
                    {log.action.includes('rule_') && meta.keywords && (
                      <span>Keywords: <span className="font-mono text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded border border-blue-400/20 ml-1">{meta.keywords}</span></span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
