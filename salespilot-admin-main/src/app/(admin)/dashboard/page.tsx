"use client"

import type { ReactNode } from "react"
import useSWR from "swr"
import {
  Activity,
  ArrowUpRight,
  Bot,
  MessageSquare,
  Server,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import {
  AdminBadge,
  AdminCard,
  AdminPage,
  AdminPageHeader,
  AdminSectionCard,
  AdminSkeleton,
  AdminStatCard,
} from "@/components/admin/page"
import { api } from "@/lib/api"

type MetricsData = {
  businesses: {
    total: number
    free: number
    starter: number
    pro: number
    active_trials: number
    expired_plans: number
  }
  whatsapp: {
    connected: number
    disconnected: number
    not_connected: number
  }
  usage: {
    ai_messages: number
    faq_replies: number
    system_messages: number
    rule_generations: number
    simulation_messages: number
  }
  revenue: {
    estimated_mrr: number
    estimated_arr: number
    currency: string
    is_estimate: boolean
  }
  risk: {
    near_ai_limit_count: number
    near_simulation_limit_count: number
    expired_paid_count: number
  }
}

const PLAN_COLORS = {
  Free: "#64748b",
  Growth: "#22c55e",
  Pro: "#6366f1",
}

const chartTooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "0.5rem",
  color: "var(--foreground)",
  fontSize: "13px",
}

export default function DashboardPage() {
  const { data: metrics, error } = useSWR<MetricsData>(
    "/system/metrics",
    (url: string) => api.get(url).then((res) => res.data)
  )

  if (error) {
    return (
      <AdminCard className="border-destructive/25 bg-destructive/10 p-5 text-destructive">
        <p className="font-bold">Error loading metrics</p>
        <p className="mt-1 text-sm opacity-80">
          {error.message || "Failed to load metrics"}
        </p>
      </AdminCard>
    )
  }

  if (!metrics) {
    return (
      <AdminPage>
        <div>
          <AdminSkeleton className="mb-2 h-9 w-60" />
          <AdminSkeleton className="h-4 w-44" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <AdminSkeleton key={index} className="h-[120px]" />
          ))}
        </div>
      </AdminPage>
    )
  }

  const planData = [
    { name: "Free", value: metrics.businesses.free, color: PLAN_COLORS.Free },
    { name: "Starter", value: metrics.businesses.starter, color: PLAN_COLORS.Growth },
    { name: "Pro", value: metrics.businesses.pro, color: PLAN_COLORS.Pro },
  ]

  const usageData = [
    { name: "Inbound", messages: metrics.usage.system_messages },
    { name: "FAQ", messages: metrics.usage.faq_replies },
    { name: "AI", messages: metrics.usage.ai_messages },
  ]

  const activePaid = metrics.businesses.starter + metrics.businesses.pro
  const conversionRate = ((activePaid / (metrics.businesses.total || 1)) * 100).toFixed(1)

  return (
    <AdminPage>
      <AdminPageHeader
        title="Platform Overview"
        description="Real-time SaaS metrics across all tenants"
        badge={<AdminBadge>Live</AdminBadge>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          icon={Users}
          label="Total Tenants"
          value={metrics.businesses.total}
          description={`${metrics.businesses.active_trials} active trials`}
          tone="primary"
        />
        <AdminStatCard
          icon={Activity}
          label="Estimated MRR"
          value={`${metrics.revenue.currency} ${metrics.revenue.estimated_mrr.toLocaleString()}`}
          description={`${conversionRate}% conversion rate`}
          tone="success"
        />
        <AdminStatCard
          icon={Bot}
          label="AI Messages"
          value={metrics.usage.ai_messages.toLocaleString()}
          description="Gemini API calls this month"
          tone="info"
        />
        <AdminStatCard
          icon={MessageSquare}
          label="Connected WA"
          value={metrics.whatsapp.connected}
          description={`Out of ${metrics.businesses.total} tenants`}
          tone="info"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_2fr]">
        <AdminSectionCard title="Plan Distribution" contentClassName="pt-4">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={planData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={85}
                paddingAngle={4}
                dataKey="value"
              >
                {planData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} strokeWidth={0} />
                ))}
              </Pie>
              <Tooltip contentStyle={chartTooltipStyle} />
            </PieChart>
          </ResponsiveContainer>

          <div className="mt-4 flex flex-col gap-2">
            {planData.map((plan) => (
              <div key={plan.name} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: plan.color }}
                  />
                  <span className="text-sm text-muted-foreground">{plan.name}</span>
                </div>
                <span className="text-sm font-bold text-foreground">{plan.value}</span>
              </div>
            ))}
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          title="Platform Usage - Month to Date"
          action={
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <TrendingUp className="size-3.5" />
              This month
            </div>
          }
          contentClassName="pt-4"
        >
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={usageData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="usage-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={chartTooltipStyle}
                cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="messages"
                stroke="#6366f1"
                strokeWidth={2.5}
                fill="url(#usage-gradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </AdminSectionCard>
      </div>

      <AdminCard className="p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <SummaryItem icon={Server} label="Active Trials" value={metrics.businesses.active_trials} />
          <SummaryItem icon={Zap} label="FAQ Replies" value={metrics.usage.faq_replies.toLocaleString()} tone="warning" />
          <SummaryItem icon={ArrowUpRight} label="Near AI Limit" value={metrics.risk.near_ai_limit_count} tone="destructive" />
        </div>
      </AdminCard>
    </AdminPage>
  )
}

function SummaryItem({
  icon: Icon,
  label,
  value,
  tone = "primary",
}: {
  icon: typeof Server
  label: string
  value: ReactNode
  tone?: "primary" | "warning" | "destructive"
}) {
  const color = {
    primary: "text-primary",
    warning: "text-amber-500",
    destructive: "text-destructive",
  }[tone]

  return (
    <div className="flex items-center gap-2">
      <Icon className={`size-4 ${color}`} />
      <span className="text-sm font-medium text-muted-foreground">{label}:</span>
      <span className="text-sm font-bold text-foreground">{value}</span>
    </div>
  )
}
