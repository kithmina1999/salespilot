"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import {
  Zap, Bot, Users, Activity, MessageSquare,
  TrendingUp, Server, ArrowUpRight,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from "recharts";

type MetricsData = {
  businesses: {
    total: number;
    free: number;
    starter: number;
    pro: number;
    active_trials: number;
    expired_plans: number;
  };
  whatsapp: {
    connected: number;
    disconnected: number;
    not_connected: number;
  };
  usage: {
    ai_messages: number;
    faq_replies: number;
    system_messages: number;
    rule_generations: number;
    simulation_messages: number;
  };
  revenue: {
    estimated_mrr: number;
    estimated_arr: number;
    currency: string;
    is_estimate: boolean;
  };
  risk: {
    near_ai_limit_count: number;
    near_simulation_limit_count: number;
    expired_paid_count: number;
  };
};

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
  delay = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  accent: string;
  delay?: number;
}) {
  return (
    <div
      className="animate-fade-up"
      style={{
        animationDelay: `${delay}ms`,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "1rem",
        padding: "1.25rem 1.375rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.875rem",
        transition: "border-color 0.2s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-2)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}>{label}</span>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: `${accent}18`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: accent,
          }}
        >
          {icon}
        </div>
      </div>
      <div>
        <p style={{ fontSize: "2rem", fontWeight: 900, color: "var(--text)", letterSpacing: "-0.03em", lineHeight: 1 }}>
          {value}
        </p>
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.375rem", fontWeight: 500 }}>{sub}</p>
      </div>
    </div>
  );
}

const PLAN_COLORS = {
  Free:   "#64748b",
  Growth: "#22c55e",
  Pro:    "#6366f1",
};

export default function DashboardPage() {
  const { data: metrics, error } = useSWR<MetricsData>(
    "/system/metrics",
    (url: string) => api.get(url).then((res) => res.data)
  );

  if (error) {
    return (
      <div
        style={{
          padding: "1.25rem",
          background: "rgba(239,68,68,0.06)",
          border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: "0.875rem",
          color: "var(--danger)",
        }}
      >
        <p style={{ fontWeight: 700 }}>Error loading metrics</p>
        <p style={{ fontSize: "0.875rem", marginTop: "0.25rem", opacity: 0.8 }}>{error.message || "Failed to load metrics"}</p>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div>
          <div style={{ height: "2.25rem", width: "240px", background: "var(--surface)", borderRadius: "0.5rem", marginBottom: "0.5rem", animation: "pulse 1.5s ease-in-out infinite" }} />
          <div style={{ height: "1rem", width: "180px", background: "var(--surface)", borderRadius: "0.5rem", animation: "pulse 1.5s ease-in-out infinite" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ height: "120px", background: "var(--surface)", borderRadius: "1rem", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </div>
    );
  }

  const planData = [
    { name: "Free",    value: metrics.businesses.free,    color: PLAN_COLORS.Free },
    { name: "Starter", value: metrics.businesses.starter, color: PLAN_COLORS.Growth },
    { name: "Pro",     value: metrics.businesses.pro,     color: PLAN_COLORS.Pro },
  ];

  const usageData = [
    { name: "Inbound",   messages: metrics.usage.system_messages },
    { name: "FAQ",       messages: metrics.usage.faq_replies },
    { name: "AI",        messages: metrics.usage.ai_messages },
  ];

  const activePaid = metrics.businesses.starter + metrics.businesses.pro;
  const conversionRate = ((activePaid / (metrics.businesses.total || 1)) * 100).toFixed(1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }} className="animate-fade-up">
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.375rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 900, color: "var(--text)", letterSpacing: "-0.03em" }}>
            Platform Overview
          </h1>
          <span
            style={{
              padding: "0.2rem 0.625rem",
              background: "var(--accent-glow)",
              border: "1px solid rgba(99,102,241,0.2)",
              borderRadius: "999px",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "var(--accent)",
            }}
          >
            Live
          </span>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
          Real-time SaaS metrics across all tenants
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
        <StatCard
          icon={<Users size={16} />}
          label="Total Tenants"
          value={metrics.businesses.total}
          sub={`${metrics.businesses.active_trials} active trials`}
          accent="#6366f1"
          delay={0}
        />
        <StatCard
          icon={<Activity size={16} />}
          label="Estimated MRR"
          value={`${metrics.revenue.currency} ${metrics.revenue.estimated_mrr.toLocaleString()}`}
          sub={`${conversionRate}% conversion rate`}
          accent="#22c55e"
          delay={60}
        />
        <StatCard
          icon={<Bot size={16} />}
          label="AI Messages"
          value={metrics.usage.ai_messages.toLocaleString()}
          sub="Gemini API calls this month"
          accent="#8b5cf6"
          delay={120}
        />
        <StatCard
          icon={<MessageSquare size={16} />}
          label="Connected WA"
          value={metrics.whatsapp.connected}
          sub={`Out of ${metrics.businesses.total} tenants`}
          accent="#3b82f6"
          delay={180}
        />
      </div>

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.25rem" }}>
        {/* Plan Donut */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "1rem",
            padding: "1.5rem",
          }}
        >
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text)", marginBottom: "1.25rem" }}>
            Plan Distribution
          </h3>
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
                {planData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} strokeWidth={0} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border-2)",
                  borderRadius: "8px",
                  color: "var(--text)",
                  fontSize: "13px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.75rem" }}>
            {planData.map((p) => (
              <div key={p.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: p.color }} />
                  <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>{p.name}</span>
                </div>
                <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text)" }}>{p.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Usage Area Chart */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "1rem",
            padding: "1.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
            <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text)" }}>
              Platform Usage — Month to Date
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", color: "var(--accent)", fontWeight: 600 }}>
              <TrendingUp size={13} />
              This month
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={usageData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border-2)",
                  borderRadius: "8px",
                  color: "var(--text)",
                  fontSize: "13px",
                }}
                cursor={{ stroke: "var(--border-2)", strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="messages"
                stroke="#6366f1"
                strokeWidth={2.5}
                fill="url(#grad1)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Summary Row */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "1rem",
          padding: "1.25rem 1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "2rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Server size={14} style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 500 }}>Active Trials:</span>
          <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text)" }}>{metrics.businesses.active_trials}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Zap size={14} style={{ color: "#f59e0b" }} />
          <span style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 500 }}>FAQ Replies:</span>
          <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text)" }}>{metrics.usage.faq_replies.toLocaleString()}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <ArrowUpRight size={14} style={{ color: "#ef4444" }} />
          <span style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 500 }}>Near AI Limit:</span>
          <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text)" }}>{metrics.risk.near_ai_limit_count}</span>
        </div>
      </div>
    </div>
  );
}
