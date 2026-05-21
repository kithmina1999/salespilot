"use client"

import type { ReactNode } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  ArrowUpRight,
  BarChart2,
  CreditCard,
  DollarSign,
  TrendingUp,
  Users,
} from "lucide-react"

import {
  AdminBadge,
  AdminCard,
  AdminPage,
  AdminPageHeader,
  AdminSectionCard,
  AdminStatCard,
} from "@/components/admin/page"

const MOCK_MONTHLY = [
  { month: "Oct", revenue: 1200 },
  { month: "Nov", revenue: 1850 },
  { month: "Dec", revenue: 2400 },
  { month: "Jan", revenue: 2100 },
  { month: "Feb", revenue: 3200 },
  { month: "Mar", revenue: 4100 },
]

const MOCK_BY_PLAN = [
  { plan: "Starter", revenue: 960, color: "#22c55e" },
  { plan: "Growth", revenue: 1440, color: "#3b82f6" },
  { plan: "Pro", revenue: 1700, color: "#6366f1" },
]

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "0.5rem",
  color: "var(--foreground)",
  fontSize: "13px",
}

export default function RevenuePage() {
  const totalMRR = 4100
  const growth = 28.1

  return (
    <AdminPage>
      <AdminPageHeader
        title="Revenue"
        description="Platform-wide revenue metrics and subscription overview"
        badge={<AdminBadge tone="warning">Placeholder</AdminBadge>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard icon={DollarSign} label="MRR" value={`$${totalMRR.toLocaleString()}`} description="Monthly Recurring" />
        <AdminStatCard icon={TrendingUp} label="Growth (MoM)" value={`+${growth}%`} description="vs last month" tone="success" />
        <AdminStatCard icon={CreditCard} label="ARR (proj.)" value={`$${(totalMRR * 12).toLocaleString()}`} description="Annualized" tone="info" />
        <AdminStatCard icon={Users} label="ARPU" value="$68" description="Avg. revenue/tenant" tone="warning" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <AdminSectionCard
          title="Revenue Trend"
          action={<ChartTrend value={`+${growth}% MoM`} />}
        >
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={MOCK_MONTHLY} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revenue-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`$${value}`, "Revenue"]} />
              <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2.5} fill="url(#revenue-gradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </AdminSectionCard>

        <AdminSectionCard title="Revenue by Plan">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={MOCK_BY_PLAN} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <XAxis dataKey="plan" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`$${value}`, "Revenue"]} />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                {MOCK_BY_PLAN.map((entry) => (
                  <Cell key={entry.plan} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </AdminSectionCard>
      </div>

      <AdminCard className="border-amber-500/20 bg-amber-500/10 p-4">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <BarChart2 className="size-5 shrink-0 text-amber-500" />
          <p>
            Showing projected mock data. Wire to your payment processor webhook endpoints to populate real revenue data.
          </p>
        </div>
      </AdminCard>
    </AdminPage>
  )
}

function ChartTrend({ value }: { value: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-500">
      <ArrowUpRight className="size-4" />
      {value}
    </div>
  )
}
