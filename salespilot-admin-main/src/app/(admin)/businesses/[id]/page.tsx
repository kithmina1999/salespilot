"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { api } from "@/lib/api";

import { ProfileHeader } from "./components/ProfileHeader";
import { UsageQuotas } from "./components/UsageQuotas";
import { CountsOverview } from "./components/CountsOverview";
import { WAConnectionCard } from "./components/WAConnectionCard";
import { BotConfigCard } from "./components/BotConfigCard";
import { PaymentHistoryList } from "./components/PaymentHistoryList";
import { RecentPipelineLogs, RecentAuditLogs } from "./components/RecentLogsList";
import { PowerActions } from "./components/PowerActions";

export default function BusinessDetailPage() {
  const { id } = useParams();

  const { data, isLoading: loading, mutate } = useSWR(
    id ? `/system/businesses/${id}` : null,
    (url: string) => api.get(url).then((res) => res.data)
  );

  if (loading || !data?.business) {
    return (
      <div className="flex flex-col gap-6 animate-pulse p-4">
        <div className="h-20 bg-secondary rounded-2xl w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
            <div className="h-64 bg-secondary rounded-2xl" />
            <div className="h-40 bg-secondary rounded-2xl" />
          </div>
          <div className="col-span-1 flex flex-col gap-6">
            <div className="h-48 bg-secondary rounded-2xl" />
            <div className="h-48 bg-secondary rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  const { business, counts, recent_audit_logs, recent_pipeline_logs, payment_history, redeemed_activation_codes } = data;

  return (
    <div className="flex flex-col gap-6 animate-fade-up max-w-[1400px]">
      <ProfileHeader business={business} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(350px,400px)] gap-6 items-start">
        {/* Left Column - ~60% wide */}
        <div className="flex flex-col gap-6">
          <UsageQuotas business={business} mutate={mutate} />
          <CountsOverview counts={counts} />
          <RecentPipelineLogs logs={recent_pipeline_logs} businessId={id as string} />
          <RecentAuditLogs logs={recent_audit_logs} businessId={id as string} />
        </div>

        {/* Right Column - ~40% wide */}
        <div className="flex flex-col gap-6">
          <WAConnectionCard business={business} />
          <BotConfigCard business={business} />
          <PaymentHistoryList 
            payments={payment_history} 
            activationCodes={redeemed_activation_codes} 
            businessId={id as string} 
          />
          <PowerActions business={business} id={id as string} mutate={mutate} />
        </div>
      </div>
    </div>
  );
}
