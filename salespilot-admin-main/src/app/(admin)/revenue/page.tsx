"use client";

import { useState } from "react";
import { DollarSign, TrendingUp, CreditCard, BarChart2, Users, ArrowUpRight, Calendar } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";

const MOCK_MONTHLY = [
  { month: "Oct", revenue: 1200 },
  { month: "Nov", revenue: 1850 },
  { month: "Dec", revenue: 2400 },
  { month: "Jan", revenue: 2100 },
  { month: "Feb", revenue: 3200 },
  { month: "Mar", revenue: 4100 },
];

const MOCK_BY_PLAN = [
  { plan: "Starter", revenue: 960,  color: "#22c55e" },
  { plan: "Growth",  revenue: 1440, color: "#3b82f6" },
  { plan: "Pro",     revenue: 1700, color: "#6366f1" },
];

export default function RevenuePage() {
  const totalMRR = 4100;
  const growth = 28.1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }} className="animate-fade-up">
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.25rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 900, color: "var(--text)", letterSpacing: "-0.03em" }}>Revenue</h1>
          <span style={{ padding: "0.2rem 0.625rem", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "999px", fontSize: "0.7rem", fontWeight: 700, color: "#fbbf24" }}>PLACEHOLDER</span>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Platform-wide revenue metrics and subscription overview</p>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
        {[
          { icon: <DollarSign size={16} />, label: "MRR",          value: `$${totalMRR.toLocaleString()}`, sub: "Monthly Recurring", accent: "#6366f1" },
          { icon: <TrendingUp size={16} />, label: "Growth (MoM)", value: `+${growth}%`,                  sub: "vs last month",       accent: "#22c55e" },
          { icon: <CreditCard size={16} />, label: "ARR (proj.)",  value: `$${(totalMRR * 12).toLocaleString()}`, sub: "Annualized", accent: "#3b82f6" },
          { icon: <Users size={16} />,      label: "ARPU",          value: "$68",                          sub: "Avg. revenue/tenant", accent: "#f59e0b" },
        ].map((s, i) => (
          <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "1rem", padding: "1.25rem 1.375rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}>{s.label}</span>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: `${s.accent}18`, display: "flex", alignItems: "center", justifyContent: "center", color: s.accent }}>{s.icon}</div>
            </div>
            <div>
              <p style={{ fontSize: "1.875rem", fontWeight: 900, color: "var(--text)", letterSpacing: "-0.03em", lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.375rem" }}>{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.25rem" }}>
        {/* Revenue trend */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "1rem", padding: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
            <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text)" }}>Revenue Trend</h3>
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", color: "#22c55e", fontWeight: 600 }}>
              <ArrowUpRight size={14} /> +{growth}% MoM
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={MOCK_MONTHLY} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: "8px", color: "var(--text)", fontSize: "13px" }} formatter={(v: any) => [`$${v}`, "Revenue"]} />
              <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2.5} fill="url(#revGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* By Plan */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "1rem", padding: "1.5rem" }}>
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text)", marginBottom: "1.25rem" }}>Revenue by Plan</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={MOCK_BY_PLAN} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <XAxis dataKey="plan" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: "8px", color: "var(--text)", fontSize: "13px" }} formatter={(v: any) => [`$${v}`, "Revenue"]} />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                {MOCK_BY_PLAN.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Placeholder banner */}
      <div style={{ padding: "1.25rem 1.5rem", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: "0.875rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <BarChart2 size={18} color="#fbbf24" style={{ flexShrink: 0 }} />
        <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
          Showing projected mock data. Wire to your payment processor (Stripe / PayHere) webhook endpoints to populate real revenue data.
        </p>
      </div>
    </div>
  );
}
