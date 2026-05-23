import { Activity, ShieldCheck, ArrowRight, AlertTriangle, Info, AlertCircle, Bot } from "lucide-react";
import Link from "next/link";
import type { AuditLog, PipelineLog } from "../types";

export function RecentPipelineLogs({ logs, businessId }: { logs: PipelineLog[], businessId: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-bold text-foreground">Recent Pipeline Logs</h2>
        </div>
      </div>

      <div className="flex flex-col">
        {!logs || logs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm font-semibold">
            No pipeline logs found.
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={log.id} className={`p-4 flex flex-col gap-2 ${i < logs.length - 1 ? 'border-b border-border/50' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="text-[0.65rem] text-muted-foreground font-mono">
                  {new Date(log.created_at).toLocaleTimeString()}
                </span>
                <span className="px-1.5 py-0.5 bg-secondary border border-border rounded text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground">
                  {log.route_taken}
                </span>
              </div>
              <p className="text-sm font-bold text-foreground truncate" title={log.clean_message}>
                {log.clean_message || "—"}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {log.ai_used && (
                  <span className="flex items-center gap-1 text-[0.65rem] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    <Bot className="w-3 h-3" /> AI Used
                  </span>
                )}
                <span className="text-xs text-muted-foreground capitalize">{log.action_taken}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-border bg-secondary/30">
        <Link 
          href={`/businesses/${businessId}/pipeline`}
          className="flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-500 hover:opacity-80 transition-opacity"
        >
          Open Pipeline Debugger <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

export function RecentAuditLogs({ logs, businessId }: { logs: AuditLog[], businessId: string }) {
  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case "high": return <AlertTriangle className="w-3.5 h-3.5 text-destructive" />;
      case "medium": return <AlertCircle className="w-3.5 h-3.5 text-amber-500" />;
      default: return <Info className="w-3.5 h-3.5 text-emerald-500" />;
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-border">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-bold text-foreground">Recent Audit Logs</h2>
        </div>
      </div>

      <div className="flex flex-col">
        {!logs || logs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm font-semibold">
            No audit logs found.
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={log.id} className={`p-4 flex items-center gap-3 ${i < logs.length - 1 ? 'border-b border-border/50' : ''}`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                log.risk === 'high' ? 'bg-destructive/10' : log.risk === 'medium' ? 'bg-amber-500/10' : 'bg-emerald-500/10'
              }`}>
                {getRiskIcon(log.risk)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground font-mono truncate">{log.action}</span>
                  <span className="text-[0.65rem] text-muted-foreground font-mono shrink-0 pl-2">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-[0.7rem] text-muted-foreground capitalize mt-0.5 flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 bg-secondary rounded">{log.actor_type.replace('_', ' ')}</span>
                  <span>{log.category}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-border bg-secondary/30">
        <Link 
          href={`/audit-logs?business_id=${businessId}`}
          className="flex items-center justify-center gap-1.5 text-xs font-bold text-foreground hover:text-primary transition-colors"
        >
          View full audit log <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
