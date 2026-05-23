import { Bot, MessageSquare, AlertTriangle, AlertCircle } from "lucide-react";
import { AdminStatCard } from "@/components/admin/page";
import type { UsageMetrics } from "../types";

export function UsageStats({ metrics, loading }: { metrics?: UsageMetrics, loading: boolean }) {
  if (loading || !metrics) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-[120px] bg-secondary rounded-xl border border-border" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <AdminStatCard
        icon={Bot}
        label="Total AI Messages"
        value={metrics.usage.ai_messages.toLocaleString()}
        description="Across all tenants this month"
        tone="info"
      />
      <AdminStatCard
        icon={MessageSquare}
        label="Total Inbound"
        value={metrics.usage.system_messages.toLocaleString()}
        description="Across all tenants this month"
        tone="info"
      />
      <AdminStatCard
        icon={AlertTriangle}
        label="Near AI Limit"
        value={metrics.risk.near_ai_limit_count}
        description="Tenants at ≥80% AI usage"
        tone="destructive"
      />
      <AdminStatCard
        icon={AlertCircle}
        label="Near Simulation Limit"
        value={metrics.risk.near_simulation_limit_count}
        description="Tenants at ≥80% Simulation usage"
        tone="warning"
      />
    </div>
  );
}
