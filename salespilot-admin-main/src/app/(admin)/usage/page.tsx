"use client";

import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { AdminPage, AdminPageHeader } from "@/components/admin/page";
import { AdminBadge } from "@/components/admin/page";

import { UsageStats } from "./components/UsageStats";
import { UsageTable } from "./components/UsageTable";
import { ResetUsageDialog } from "./components/ResetUsageDialog";
import type { UsageBusiness } from "./types";

export default function UsageMonitorPage() {
  const [filterPlan, setFilterPlan] = useState("all");
  const [nearLimitOnly, setNearLimitOnly] = useState(false);
  
  const [resetTarget, setResetTarget] = useState<UsageBusiness | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  const { data: metricsData, isLoading: loadingMetrics, mutate: mutateMetrics } = useSWR(
    "/system/metrics",
    (url: string) => api.get(url).then(res => res.data)
  );

  const { data: businessData, isLoading: loadingBusinesses, mutate: mutateBusinesses } = useSWR(
    "/system/businesses",
    (url: string) => api.get(url).then(res => res.data)
  );

  const handleResetClick = (business: UsageBusiness) => {
    setResetTarget(business);
    setIsResetDialogOpen(true);
  };

  const handleResetSuccess = () => {
    mutateBusinesses();
    mutateMetrics();
  };

  return (
    <AdminPage>
      <AdminPageHeader
        title="Usage & Quota Monitor"
        description="Live fleet-wide view of tenant usage and resource consumption"
        badge={<AdminBadge>Live Data</AdminBadge>}
        actions={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <input 
                type="checkbox" 
                checked={nearLimitOnly} 
                onChange={(e) => setNearLimitOnly(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className={nearLimitOnly ? "text-amber-500" : "text-muted-foreground"}>≥80% Usage Only</span>
            </label>
            
            <select
              value={filterPlan}
              onChange={(e) => setFilterPlan(e.target.value)}
              className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors min-w-[140px]"
            >
              <option value="all">All Plans</option>
              <option value="free">Free</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
            </select>
          </div>
        }
      />

      <div className="flex flex-col gap-6">
        <UsageStats metrics={metricsData} loading={loadingMetrics} />
        
        <UsageTable 
          businesses={businessData?.businesses || []} 
          loading={loadingBusinesses}
          filterPlan={filterPlan}
          nearLimitOnly={nearLimitOnly}
          onReset={handleResetClick}
        />
      </div>

      <ResetUsageDialog 
        business={resetTarget}
        isOpen={isResetDialogOpen}
        onClose={() => setIsResetDialogOpen(false)}
        onSuccess={handleResetSuccess}
      />
    </AdminPage>
  );
}
