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
  CreditCard,
  AlertTriangle,
  WifiOff,
  Ban,
  CheckCircle2,
} from "lucide-react"
import Link from "next/link"
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
import { NoticeManager } from "./components/NoticeManager"

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
  action_queue: {
    pending_payments: number
    expired_paid_plans: number
    near_quota_tenants: number
    disconnected_whatsapp: number
    suspended_tenants: number
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

      {/* Operator Action Queue */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-500" />
          Operator Action Queue
        </h3>
        
        {metrics.action_queue.pending_payments === 0 && 
         metrics.action_queue.expired_paid_plans === 0 && 
         metrics.action_queue.near_quota_tenants === 0 && 
         metrics.action_queue.disconnected_whatsapp === 0 && 
         metrics.action_queue.suspended_tenants === 0 ? (
          <AdminCard className="p-4 border-emerald-500/20 bg-emerald-500/5">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-5" />
              <div>
                <p className="text-sm font-bold">All clear!</p>
                <p className="text-xs opacity-90">No pending operator actions required at this time.</p>
              </div>
            </div>
          </AdminCard>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {metrics.action_queue.pending_payments > 0 && (
              <ActionCard 
                href="/activation-codes" // Using activation-codes as proxy since payments page is missing
                icon={CreditCard} 
                count={metrics.action_queue.pending_payments} 
                label="Pending Payments" 
                tone="warning" 
              />
            )}
            {metrics.action_queue.expired_paid_plans > 0 && (
              <ActionCard 
                href="/businesses" 
                icon={AlertTriangle} 
                count={metrics.action_queue.expired_paid_plans} 
                label="Expired Paid Plans" 
                tone="destructive" 
              />
            )}
            {metrics.action_queue.near_quota_tenants > 0 && (
              <ActionCard 
                href="/usage" 
                icon={Zap} 
                count={metrics.action_queue.near_quota_tenants} 
                label="Near Quota" 
                tone="warning" 
              />
            )}
            {metrics.action_queue.disconnected_whatsapp > 0 && (
              <ActionCard 
                href="/businesses" 
                icon={WifiOff} 
                count={metrics.action_queue.disconnected_whatsapp} 
                label="Disconnected WA" 
                tone="destructive" 
              />
            )}
            {metrics.action_queue.suspended_tenants > 0 && (
              <ActionCard 
                href="/businesses" 
                icon={Ban} 
                count={metrics.action_queue.suspended_tenants} 
                label="Suspended Tenants" 
                tone="primary" 
              />
            )}
          </div>
        )}
      </div>

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
        <div className="flex flex-col gap-4">
          <NoticeManager />
          <AdminSectionCard title="Plan Distribution" contentClassName="pt-4 flex-1">
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
        </div>

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

    </AdminPage>
  )
}

function ActionCard({
  href,
  icon: Icon,
  count,
  label,
  tone = "warning",
}: {
  href: string
  icon: any
  count: number
  label: string
  tone?: "primary" | "warning" | "destructive"
}) {
  const styles = {
    primary: "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10",
    warning: "border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-500 hover:bg-amber-500/10",
    destructive: "border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10",
  }[tone]

  return (
    <Link href={href} className="outline-none block">
      <AdminCard className={`p-4 transition-colors ${styles}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background/50 backdrop-blur-sm shadow-sm">
              <Icon className="size-4" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black leading-none">{count}</span>
              <span className="text-[0.65rem] font-bold uppercase tracking-wider opacity-80 mt-1">{label}</span>
            </div>
          </div>
          <ArrowUpRight className="size-4 opacity-50" />
        </div>
      </AdminCard>
    </Link>
  )
}
