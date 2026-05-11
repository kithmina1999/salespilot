"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, RefreshCw, BarChart2 } from "lucide-react";
import { AdminDataTable, AdminDataTableColumn } from "@/components/admin/data-table";
import { TableRow, TableCell } from "@/components/ui/table";
import { PlanBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export function UsageTable({ 
  businesses, 
  loading, 
  filterPlan, 
  nearLimitOnly, 
  onReset 
}: { 
  businesses: any[], 
  loading: boolean,
  filterPlan: string,
  nearLimitOnly: boolean,
  onReset: (business: any) => void
}) {
  const [sortCol, setSortCol] = useState<string>("ai_pct");
  const [sortDesc, setSortDesc] = useState<boolean>(true);

  const { admin } = useAuth();
  const isOwner = admin?.role === "owner";

  // Helper to get %
  const getPct = (count: number, limit: number) => {
    if (limit === -1) return 0;
    if (limit === 0) return 0;
    return (count / limit) * 100;
  };

  const isNearLimit = (b: any) => {
    return getPct(b.ai_message_count, b.ai_message_limit) >= 80 ||
           getPct(b.system_message_count, b.system_message_limit) >= 80 ||
           getPct(b.simulation_count, b.simulation_limit) >= 80 ||
           getPct(b.rule_generation_count, b.rule_generation_limit) >= 80;
  };

  const filtered = businesses.filter((b) => {
    if (filterPlan !== "all" && b.plan !== filterPlan) return false;
    if (nearLimitOnly && !isNearLimit(b)) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let valA = 0;
    let valB = 0;
    
    switch (sortCol) {
      case "ai_pct":
        valA = getPct(a.ai_message_count, a.ai_message_limit);
        valB = getPct(b.ai_message_count, b.ai_message_limit);
        break;
      case "inbound_pct":
        valA = getPct(a.system_message_count, a.system_message_limit);
        valB = getPct(b.system_message_count, b.system_message_limit);
        break;
      case "sim_pct":
        valA = getPct(a.simulation_count, a.simulation_limit);
        valB = getPct(b.simulation_count, b.simulation_limit);
        break;
      case "rule_pct":
        valA = getPct(a.rule_generation_count, a.rule_generation_limit);
        valB = getPct(b.rule_generation_count, b.rule_generation_limit);
        break;
      case "storage":
        valA = a.total_storage_used || 0;
        valB = b.total_storage_used || 0;
        break;
    }

    if (valA < valB) return sortDesc ? 1 : -1;
    if (valA > valB) return sortDesc ? -1 : 1;
    return 0;
  });

  const columns: Array<AdminDataTableColumn & { sortable?: boolean }> = [
    { key: "business", header: "Business" },
    { key: "plan", header: "Plan" },
    { key: "ai_pct", header: "AI Usage", sortable: true },
    { key: "inbound_pct", header: "Inbound", sortable: true },
    { key: "sim_pct", header: "Simulations", sortable: true },
    { key: "rule_pct", header: "Rule Gen", sortable: true },
    { key: "storage", header: "Storage", sortable: true },
    { key: "actions", header: "", className: "text-right" },
  ];

  const handleSort = (key: string) => {
    if (sortCol === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortCol(key);
      setSortDesc(true);
    }
  };

  const formatStorage = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const ProgressBar = ({ count, limit }: { count: number, limit: number }) => {
    const isUnlimited = limit === -1;
    const pct = isUnlimited ? 0 : Math.min(100, Math.round((count / limit) * 100)) || 0;
    const isDanger = pct >= 90;
    const isWarning = pct >= 80 && pct < 90;
    
    return (
      <div className="flex flex-col gap-1 w-full min-w-[100px] max-w-[140px]">
        <div className="flex justify-between items-baseline">
          <span className="text-xs font-bold text-foreground">{count}</span>
          <span className="text-[0.65rem] font-semibold text-muted-foreground">{isUnlimited ? "∞" : limit}</span>
        </div>
        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
          {!isUnlimited && (
            <div 
              className={`h-full rounded-full transition-all duration-500 ${isDanger ? 'bg-destructive' : isWarning ? 'bg-amber-500' : 'bg-primary'}`} 
              style={{ width: `${pct}%` }} 
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <AdminDataTable
      columns={columns.map(c => ({
        ...c,
        header: c.sortable ? (
          <button 
            className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer outline-none"
            onClick={() => handleSort(c.key)}
          >
            {c.header}
            {sortCol === c.key && (
              <span className="text-primary text-[10px]">{sortDesc ? "▼" : "▲"}</span>
            )}
          </button>
        ) : c.header
      }))}
      isLoading={loading}
      isEmpty={sorted.length === 0}
      emptyIcon={BarChart2}
      emptyTitle="No usage data found."
      minWidth="1200px"
    >
      {sorted.map((business) => (
        <TableRow key={business.id} className="border-border/50 hover:bg-muted/30">
          <TableCell className="px-4 py-3">
            <Link href={`/businesses/${business.id}`} className="font-semibold text-foreground hover:underline">
              {business.name}
            </Link>
            <div className="mt-0.5 text-xs text-muted-foreground">ID: {business.id}</div>
          </TableCell>
          <TableCell className="px-4 py-3">
            <PlanBadge plan={business.plan} />
          </TableCell>
          <TableCell className="px-4 py-3">
            <ProgressBar count={business.ai_message_count} limit={business.ai_message_limit} />
          </TableCell>
          <TableCell className="px-4 py-3">
            <ProgressBar count={business.system_message_count} limit={business.system_message_limit} />
          </TableCell>
          <TableCell className="px-4 py-3">
            <ProgressBar count={business.simulation_count} limit={business.simulation_limit} />
          </TableCell>
          <TableCell className="px-4 py-3">
            <ProgressBar count={business.rule_generation_count} limit={business.rule_generation_limit} />
          </TableCell>
          <TableCell className="px-4 py-3 text-sm font-semibold text-muted-foreground">
            {formatStorage(business.total_storage_used)}
          </TableCell>
          <TableCell className="px-4 py-3">
            <div className="flex justify-end gap-1.5">
              <Button
                disabled={!isOwner}
                onClick={() => onReset(business)}
                title={!isOwner ? "Owner permissions required" : "Reset Usage"}
                variant="outline"
                size="sm"
                className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
              >
                <RefreshCw className="size-3.5 mr-1" /> Reset
              </Button>
              <Button
                render={<Link href={`/businesses/${business.id}`} />}
                variant="outline"
                size="sm"
                className="text-primary"
              >
                Detail <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      ))}
    </AdminDataTable>
  );
}
