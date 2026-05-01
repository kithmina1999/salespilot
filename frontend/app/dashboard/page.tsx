'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
  RadialBarChart, RadialBar, Legend,
} from 'recharts';
import {
  Users, Bot, Layers, AlertCircle, PlusCircle, Sparkles, CheckCircle2,
  TrendingUp, TrendingDown, ShoppingCart, Clock, Zap, Target,
  BarChart3, Activity,
} from 'lucide-react';
import QuickFAQModal from '@/components/QuickFAQModal';
import { useLocale } from '@/lib/locale';

// ── Types ──────────────────────────────────────────────────────────────────────

interface OrderStatusCount { status: string; count: number; }
interface DailyRevenue    { date: string; revenue: number; orders: number; }
interface DailyStat       { date: string; ai_messages: number; user_messages: number; }
interface TopUnmatched    { message: string; count: number; }

interface DashboardStats {
  // Legacy
  total_customers: number;
  total_products: number;
  total_rules: number;
  system_quota_used: number;
  ai_quota_used: number;
  top_unmatched: TopUnmatched[];
  daily_stats: DailyStat[];
  no_sinhala_coverage: number;
  // Revenue
  revenue_this_month: number;
  revenue_last_month: number;
  avg_order_value: number;
  // Orders
  orders_today: number;
  orders_yesterday: number;
  orders_this_month: number;
  orders_last_month: number;
  pending_orders: number;
  orders_by_status: OrderStatusCount[];
  revenue_daily_30d: DailyRevenue[];
  // Customers
  new_customers_this_week: number;
  new_customers_last_week: number;
  new_customers_this_month: number;
  new_customers_last_month: number;
  total_customers_prev: number;
  // Bot
  ai_resolution_rate: number;
  ai_resolution_rate_prev: number;
  bot_automation_pct: number;
  bot_automation_pct_prev: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function pctChange(current: number | undefined | null, prev: number | undefined | null): number {
  const c = current ?? 0;
  const p = prev ?? 0;
  if (p === 0) return c > 0 ? 100 : 0;
  return ((c - p) / p) * 100;
}

function fmtLKR(v: number | undefined | null): string {
  const n = v ?? 0;
  if (n >= 1_000_000) return `Rs. ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `Rs. ${(n / 1_000).toFixed(1)}K`;
  return `Rs. ${n.toFixed(0)}`;
}

function fmtPct(v: number | undefined | null): string {
  const n = v ?? 0;
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function GrowthBadge({ current, prev, invert = false }: { current: number; prev: number; invert?: boolean }) {
  const pct = pctChange(current, prev);
  const positive = invert ? pct < 0 : pct >= 0;
  if (Math.abs(pct) < 0.1) return <span className="text-xs text-zinc-500">—</span>;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${
      positive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
    }`}>
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {fmtPct(pct)}
    </span>
  );
}

function KpiCard({
  icon, label, value, valueStr, sub, color, bg, border, growth, invertGrowth = false, onClick,
}: {
  icon: React.ReactNode; label: string; value?: number; valueStr?: string;
  sub: string; color: string; bg: string; border: string;
  growth?: { current: number; prev: number }; invertGrowth?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border p-5 flex flex-col gap-3 bg-zinc-900/50 ${border} transition-all duration-200 hover:bg-zinc-800/70 hover:scale-[1.01] ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bg} ${color}`}>
          {icon}
        </div>
      </div>
      <div>
        <p className="text-3xl font-black text-white">{valueStr ?? value}</p>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-zinc-500 font-medium">{sub}</p>
          {growth && <GrowthBadge current={growth.current} prev={growth.prev} invert={invertGrowth} />}
        </div>
      </div>
    </div>
  );
}

const ORDER_STATUS_COLORS: Record<string, string> = {
  new:       '#71717a',
  confirmed: '#3b82f6',
  shipped:   '#f59e0b',
  delivered: '#10b981',
  cancelled: '#ef4444',
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  new: 'New', confirmed: 'Confirmed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled',
};

// Custom tooltip for donut chart
function DonutTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm">
        <p className="font-bold text-white">{ORDER_STATUS_LABELS[d.status] ?? d.status}</p>
        <p className="text-zinc-400">{d.count} orders</p>
      </div>
    );
  }
  return null;
}

// Revenue chart tab type
type ChartTab = 'revenue' | 'orders' | 'both';

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [stats, setStats]       = useState<DashboardStats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [chartTab, setChartTab] = useState<ChartTab>('both');
  const [quickFaqMsg, setQuickFaqMsg] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiFetch<DashboardStats>('/api/v1/dashboard/stats');
      setStats(res);
    } catch (err) {
      console.error('Failed to load dashboard stats', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-zinc-400 text-sm">{t('common.loading')}…</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return <div className="p-8 text-red-500 text-center">Failed to load statistics.</div>;
  }

  // Chart data transforms
  const trend30d = stats.revenue_daily_30d?.map(d => ({
    name: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    revenue: d.revenue ?? 0,
    orders: d.orders ?? 0,
  })) ?? [];

  const donutData = stats.orders_by_status?.filter(s => s.count > 0) ?? [];
  const totalDonutOrders = donutData.reduce((a, b) => a + (b.count ?? 0), 0);

  const trafficData = stats.daily_stats?.map(d => ({
    name: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
    AI: d.ai_messages ?? 0,
    Customers: d.user_messages ?? 0,
  })) ?? [];

  // Bot gauges data for RadialBarChart
  const gaugeData = [
    { name: 'Resolution', value: Math.round(stats.ai_resolution_rate ?? 0), fill: '#10b981' },
    { name: 'Automation', value: Math.round(stats.bot_automation_pct ?? 0), fill: '#6366f1' },
  ];

  // KB coverage score
  const kbScore = (stats.total_rules ?? 0) > 0
    ? Math.round(((stats.total_rules - (stats.no_sinhala_coverage ?? 0)) / stats.total_rules) * 100)
    : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 p-2 md:p-6 pb-24">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-emerald-400" />
            {t('dashboard.title')}
          </h1>
          <p className="text-zinc-400 mt-1 text-sm max-w-lg">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <div className="text-xs text-zinc-200 font-mono bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800">
          {new Date().toLocaleDateString('en-US', {day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>

      {/* ── Section 1: 6 KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard
          icon={<TrendingUp className="w-4 h-4" />}
          label={t('dashboard.revenue')}
          valueStr={fmtLKR(stats.revenue_this_month)}
          sub={t('dashboard.this_month')}
          color="text-emerald-400" bg="bg-emerald-500/10" border="border-emerald-500/20"
          growth={{ current: stats.revenue_this_month ?? 0, prev: stats.revenue_last_month ?? 0 }}
        />
        <KpiCard
          icon={<ShoppingCart className="w-4 h-4" />}
          label={t('dashboard.orders_today')}
          value={stats.orders_today ?? 0}
          sub={t('dashboard.vs_yesterday')}
          color="text-blue-400" bg="bg-blue-500/10" border="border-blue-500/20"
          growth={{ current: stats.orders_today ?? 0, prev: stats.orders_yesterday ?? 0 }}
        />
        <KpiCard
          icon={<Users className="w-4 h-4" />}
          label={t('dashboard.customers')}
          value={stats.total_customers ?? 0}
          sub={t('dashboard.total_engaged')}
          color="text-purple-400" bg="bg-purple-500/10" border="border-purple-500/20"
          growth={{ current: stats.total_customers ?? 0, prev: stats.total_customers_prev ?? 0 }}
        />
        <KpiCard
          icon={<Clock className="w-4 h-4" />}
          label={t('dashboard.pending')}
          value={stats.pending_orders ?? 0}
          sub={t('dashboard.needs_action')}
          color="text-amber-400" bg="bg-amber-500/10"
          border={(stats.pending_orders ?? 0) > 0 ? 'border-amber-500/40 shadow-amber-500/10 shadow-lg' : 'border-amber-500/20'}
          invertGrowth
          onClick={() => router.push('/dashboard/orders?status=new')}
        />
        <KpiCard
          icon={<Target className="w-4 h-4" />}
          label={t('dashboard.ai_resolution')}
          valueStr={`${(stats.ai_resolution_rate ?? 0).toFixed(1)}%`}
          sub={t('dashboard.queries_resolved')}
          color="text-cyan-400" bg="bg-cyan-500/10" border="border-cyan-500/20"
          growth={{ current: stats.ai_resolution_rate ?? 0, prev: stats.ai_resolution_rate_prev ?? 0 }}
        />
        <KpiCard
          icon={<Zap className="w-4 h-4" />}
          label={t('dashboard.automation')}
          valueStr={`${(stats.bot_automation_pct ?? 0).toFixed(1)}%`}
          sub={t('dashboard.auto_handled')}
          color="text-indigo-400" bg="bg-indigo-500/10" border="border-indigo-500/20"
          growth={{ current: stats.bot_automation_pct ?? 0, prev: stats.bot_automation_pct_prev ?? 0 }}
        />
      </div>

      {/* ── Section 2: Revenue Trend + Order Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* 30-Day Trend Chart (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h3 className="text-base font-bold text-white">30-Day Performance</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Revenue (bars) & order volume (line)</p>
            </div>
            <div className="flex bg-zinc-800 rounded-xl p-1 gap-1">
              {(['revenue', 'orders', 'both'] as ChartTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setChartTab(tab)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all capitalize ${
                    chartTab === tab
                      ? 'bg-emerald-500 text-white shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-[280px]">
            {trend30d.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trend30d} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                  <XAxis dataKey="name" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} interval={4} />
                  <YAxis yAxisId="rev" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false}
                    tickFormatter={v => v >= 1000 ? `${v/1000}K` : v} />
                  <YAxis yAxisId="ord" orientation="right" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#fff', fontSize: 12 }}
                    formatter={((value: any, name: any) => [
                      name === 'revenue' ? `Rs. ${Number(value).toLocaleString()}` : value,
                      name === 'revenue' ? 'Revenue' : 'Orders'
                    ]) as any}
                  />
                  {(chartTab === 'revenue' || chartTab === 'both') && (
                    <Bar yAxisId="rev" dataKey="revenue" fill="url(#revGrad)" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  )}
                  {(chartTab === 'orders' || chartTab === 'both') && (
                    <Line yAxisId="ord" type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-500 italic text-sm">
                No order data yet. Your first order will appear here!
              </div>
            )}
          </div>
        </div>

        {/* Order Status Donut (1 col) */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 flex flex-col">
          <h3 className="text-base font-bold text-white mb-1">Order Status</h3>
          <p className="text-xs text-zinc-500 mb-4">This month breakdown</p>

          {donutData.length > 0 ? (
            <>
              <div className="relative flex-1 min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="count"
                      nameKey="status"
                      cx="50%" cy="50%"
                      innerRadius="55%"
                      outerRadius="80%"
                      strokeWidth={2}
                      stroke="#09090b"
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={index} fill={ORDER_STATUS_COLORS[entry.status] ?? '#52525b'} />
                      ))}
                    </Pie>
                    <Tooltip content={<DonutTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-2xl font-black text-white">{totalDonutOrders}</p>
                  <p className="text-xs text-zinc-500">orders</p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {donutData.map((s) => (
                  <div key={s.status} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ORDER_STATUS_COLORS[s.status] }} />
                      <span className="text-zinc-400 capitalize">{ORDER_STATUS_LABELS[s.status] ?? s.status}</span>
                    </div>
                    <span className="font-bold text-zinc-200">{s.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm italic">
              No orders this month yet.
            </div>
          )}
        </div>
      </div>

      {/* ── Section 3: Intelligence Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Customer Growth */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Customer Growth</h3>
              <p className="text-xs text-zinc-500 mt-0.5">New contacts this month</p>
            </div>
            <div className="w-9 h-9 bg-purple-500/10 text-purple-400 rounded-xl flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-4xl font-black text-white">{stats.new_customers_this_month ?? 0}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-zinc-500">vs last month</span>
              <GrowthBadge current={stats.new_customers_this_month ?? 0} prev={stats.new_customers_last_month ?? 0} />
            </div>
          </div>
          {/* Weekly mini comparison */}
          <div className="flex gap-3 mt-auto pt-3 border-t border-zinc-800">
            <div className="flex-1 text-center">
              <p className="text-xl font-black text-white">{stats.new_customers_this_week ?? 0}</p>
              <p className="text-xs text-zinc-500 mt-0.5">This week</p>
            </div>
            <div className="w-px bg-zinc-800" />
            <div className="flex-1 text-center">
              <p className="text-xl font-black text-zinc-400">{stats.new_customers_last_week ?? 0}</p>
              <p className="text-xs text-zinc-500 mt-0.5">Last week</p>
            </div>
          </div>
        </div>

        {/* Bot Efficiency Gauges */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Bot Efficiency</h3>
              <p className="text-xs text-zinc-500 mt-0.5">AI performance gauges</p>
            </div>
            <div className="w-9 h-9 bg-cyan-500/10 text-cyan-400 rounded-xl flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="flex-1 min-h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%" cy="50%"
                innerRadius="30%"
                outerRadius="90%"
                data={gaugeData}
                startAngle={180}
                endAngle={0}
              >
                <RadialBar dataKey="value" cornerRadius={8} background={{ fill: '#27272a' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', fontSize: 12 }}
                  formatter={((v: any, name: any) => [`${v}%`, name ?? '']) as any}
                />
                <Legend
                  iconSize={10}
                  formatter={(value) => <span className="text-xs text-zinc-400">{value}</span>}
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-3 border-t border-zinc-800 pt-3">
            <div className="flex-1 text-center">
              <p className="text-lg font-black text-emerald-400">{(stats.ai_resolution_rate ?? 0).toFixed(0)}%</p>
              <p className="text-xs text-zinc-500 mt-0.5">Resolution</p>
            </div>
            <div className="w-px bg-zinc-800" />
            <div className="flex-1 text-center">
              <p className="text-lg font-black text-indigo-400">{(stats.bot_automation_pct ?? 0).toFixed(0)}%</p>
              <p className="text-xs text-zinc-500 mt-0.5">Automation</p>
            </div>
          </div>
        </div>

        {/* Knowledge Base Score */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Knowledge Score</h3>
              <p className="text-xs text-zinc-500 mt-0.5">FAQ & Sinhala coverage</p>
            </div>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${kbScore >= 70 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          {/* Score ring */}
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#27272a" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke={kbScore >= 70 ? '#10b981' : '#f59e0b'}
                  strokeWidth="3"
                  strokeDasharray={`${kbScore} ${100 - kbScore}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-lg font-black ${kbScore >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>{kbScore}%</span>
              </div>
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Total FAQs</span>
                <span className="font-bold text-zinc-200">{stats.total_rules}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Sinhala gaps</span>
                <span className={`font-bold ${stats.no_sinhala_coverage > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {stats.no_sinhala_coverage}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Unresolved Q's</span>
                <span className={`font-bold ${stats.top_unmatched?.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {stats.top_unmatched?.length ?? 0}
                </span>
              </div>
            </div>
          </div>
          {kbScore < 70 && (
            <div className="mt-auto">
              <button
                onClick={() => setQuickFaqMsg(stats.top_unmatched?.[0]?.message ?? '')}
                className="w-full text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 rounded-xl py-2 font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Add missing FAQs to improve score
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 4: 7-Day Traffic + Missing Knowledge ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Traffic Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 flex flex-col h-[340px]">
          <h3 className="text-base font-bold text-white mb-1">7-Day Message Traffic</h3>
          <p className="text-xs text-zinc-500 mb-4">Customer messages (blue) vs AI replies (green)</p>
          <div className="flex-1 w-full min-h-0">
            {trafficData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trafficData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAI"   x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCust" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                  <XAxis dataKey="name" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#fff' }} />
                  <Area type="monotone" dataKey="Customers" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCust)" />
                  <Area type="monotone" dataKey="AI"        stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorAI)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-500 italic text-sm">
                No messaging data yet. Connect WhatsApp to start tracking!
              </div>
            )}
          </div>
        </div>

        {/* Missing Knowledge Feed */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 flex flex-col h-[340px]">
          <h3 className="text-sm font-bold text-white mb-1 flex items-center justify-between">
            Missing Knowledge
            {(stats.top_unmatched?.length ?? 0) > 0 && (
              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">Needs Action</span>
            )}
          </h3>
          <p className="text-xs text-zinc-400 mb-4">Unanswered questions — Create FAQs to fix!</p>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {stats.top_unmatched?.length > 0 ? (
              stats.top_unmatched.map((um, idx) => (
                <div key={idx} className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-3 flex items-start gap-3">
                  <div className="bg-zinc-900 px-2 py-1 rounded-lg text-xs font-black text-zinc-400 border border-zinc-800 shrink-0">
                    {um.count}x
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">{um.message}</p>
                    <button
                      onClick={() => setQuickFaqMsg(um.message)}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-bold mt-1 inline-flex items-center gap-1 transition-colors"
                    >
                      <PlusCircle className="w-3 h-3" /> Convert to FAQ
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-2">
                <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="text-zinc-300 text-sm font-bold">Fully covered!</p>
                <p className="text-xs text-zinc-500">All recent queries were answered successfully.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick FAQ Modal */}
      {quickFaqMsg && (
        <QuickFAQModal
          unmatchedMessage={quickFaqMsg}
          onClose={() => setQuickFaqMsg(null)}
          onSuccess={() => { setQuickFaqMsg(null); fetchStats(); }}
        />
      )}
    </div>
  );
}
