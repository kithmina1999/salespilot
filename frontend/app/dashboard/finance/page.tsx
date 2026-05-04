'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, DollarSign, ShoppingBag, Package, XCircle,
  BarChart3, Loader2, Award, ArrowUp, ArrowDown,
} from 'lucide-react';
import { DashboardEmptyInsight, DashboardSectionHeader, SegmentedControl } from '@/components/dashboard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  total_revenue: number;
  orders_delivered: number;
  orders_total: number;
  orders_cancelled: number;
  average_order: number;
  pending_revenue: number;
}

interface ChartPoint { day: string; revenue: number; orders: number; }
interface TopProduct  { name: string; revenue: number; qty: number; }

// ─── Config ───────────────────────────────────────────────────────────────────

const API  = 'http://localhost:8080/api/v1';
const auth = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

type Range = '7d' | '30d' | '90d';
const RANGES: { key: Range; label: string }[] = [
  { key: '7d',  label: '7 Days'  },
  { key: '30d', label: '30 Days' },
  { key: '90d', label: '90 Days' },
];

function getParams(r: Range) {
  const pad  = (n: number) => n.toString().padStart(2, '0');
  const fmtD = (d: Date)   => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const to   = new Date();
  const from = new Date(); from.setDate(from.getDate() - (r === '7d' ? 7 : r === '30d' ? 30 : 90));
  return `?from=${fmtD(from)}&to=${fmtD(to)}`;
}

const fmtM = (n: number) => `Rs.${Math.round(n).toLocaleString()}`;
const fmtK = (n: number) => n >= 1000 ? `Rs.${(n/1000).toFixed(1)}k` : fmtM(n);

// ─── Mini Sparkline (SVG path) ────────────────────────────────────────────────

function Sparkline({ data }: { data: ChartPoint[] }) {
  if (data.length < 2) return <div className="h-32 flex items-center justify-center text-zinc-400 text-xs">Not enough data</div>;

  const W = 600; const H = 120; const PAD = 8;
  const revenues = data.map(d => d.revenue);
  const max = Math.max(...revenues, 1);
  const min = Math.min(...revenues);
  const range = max - min || 1;

  const xs = data.map((_, i) => PAD + (i / (data.length - 1)) * (W - PAD * 2));
  const ys = revenues.map(v => H - PAD - ((v - min) / range) * (H - PAD * 2));

  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ');
  const area = `${path} L${xs[xs.length-1]},${H} L${xs[0]},${H} Z`;

  // X-axis labels (first, mid, last)
  const labelIdx = [0, Math.floor(data.length / 2), data.length - 1];

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32" preserveAspectRatio="none">
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#10b981" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0"   />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#grad)" />
        <path d={path}  fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots on data points (only on hover-friendly amount — every few points) */}
        {xs.map((x, i) => (
          <circle key={i} cx={x} cy={ys[i]} r="3" fill="#10b981" opacity="0.7" />
        ))}
      </svg>

      {/* X labels */}
      <div className="flex justify-between text-[10px] text-zinc-600 mt-1 px-1">
        {labelIdx.map(i => (
          <span key={i}>{new Date(data[i].day).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
        ))}
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, color, bg, trend,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string; bg: string;
  trend?: 'up' | 'down' | null;
}) {
  return (
    <div className={`rounded-2xl border border-zinc-800 p-5 ${bg} flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-center`}>
          <Icon size={18} className={color} />
        </div>
        {trend && (
          <span className={`text-xs font-bold flex items-center gap-0.5 ${trend === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend === 'up' ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
          </span>
        )}
      </div>
      <div>
        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mb-1">{label}</p>
        <p className={`text-2xl font-black ${color}`}>{value}</p>
        {sub && <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const [range,    setRange]    = useState<Range>('30d');
  const [stats,    setStats]    = useState<Stats | null>(null);
  const [chart,    setChart]    = useState<ChartPoint[]>([]);
  const [products, setProducts] = useState<TopProduct[]>([]);
  const [loading,  setLoading]  = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const p = getParams(range);
    try {
      const [sRes, cRes, pRes] = await Promise.all([
        fetch(`${API}/finance/stats${p}`,        { headers: auth() }),
        fetch(`${API}/finance/chart${p}`,        { headers: auth() }),
        fetch(`${API}/finance/top-products${p}`, { headers: auth() }),
      ]);
      if (sRes.ok) setStats(await sRes.json());
      if (cRes.ok) { const d = await cRes.json(); setChart(d.chart || []); }
      if (pRes.ok) { const d = await pRes.json(); setProducts(d.top_products || []); }
    } catch { /* silent */ }
    setLoading(false);
  }, [range]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Max revenue for bar scaling
  const maxRev = Math.max(...products.map(p => p.revenue), 1);

  return (
    <div className="max-w-7xl mx-auto w-full space-y-6 pb-12">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
            <TrendingUp size={24} className="text-emerald-400" />
            Finance
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Revenue analytics and order performance for your business.</p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-60 shrink-0"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <BarChart3 size={13} />}
          Refresh
        </button>
      </div>

      {/* Range picker */}
      <SegmentedControl
        label="Revenue range"
        options={RANGES.map(({ key, label }) => ({ value: key, label }))}
        value={range}
        onChange={setRange}
      />

      {loading ? (
        <div className="flex items-center justify-center py-28 text-zinc-600">
          <Loader2 size={26} className="animate-spin mr-3" />
          <span className="text-sm font-medium">Loading analytics…</span>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <KpiCard
              label="Delivered Revenue"
              value={fmtK(stats?.total_revenue ?? 0)}
              sub={`${stats?.orders_delivered ?? 0} deliveries`}
              icon={DollarSign}
              color="text-emerald-400"
              bg="bg-emerald-500/5"
            />
            <KpiCard
              label="Avg. Order Value"
              value={fmtM(stats?.average_order ?? 0)}
              sub="per delivered order"
              icon={TrendingUp}
              color="text-blue-400"
              bg="bg-blue-500/5"
            />
            <KpiCard
              label="Pipeline Revenue"
              value={fmtK(stats?.pending_revenue ?? 0)}
              sub="new + confirmed + shipped"
              icon={Package}
              color="text-violet-400"
              bg="bg-violet-500/5"
            />
            <KpiCard
              label="Total Orders"
              value={String(stats?.orders_total ?? 0)}
              sub="all statuses"
              icon={ShoppingBag}
              color="text-zinc-300"
              bg="bg-zinc-800/50"
            />
            <KpiCard
              label="Cancelled"
              value={String(stats?.orders_cancelled ?? 0)}
              sub={stats && stats.orders_total > 0
                ? `${((stats.orders_cancelled / stats.orders_total) * 100).toFixed(1)}% cancellation rate`
                : '—'}
              icon={XCircle}
              color="text-red-400"
              bg="bg-red-500/5"
            />
            <KpiCard
              label="Conversion Rate"
              value={stats && stats.orders_total > 0
                ? `${((stats.orders_delivered / stats.orders_total) * 100).toFixed(1)}%`
                : '—'}
              sub="orders → delivered"
              icon={Award}
              color="text-amber-400"
              bg="bg-amber-500/5"
            />
          </div>

          {/* Revenue chart */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <DashboardSectionHeader
              className="mb-4"
              title="Daily Revenue"
              description={`Delivered-order revenue by day. Amounts shown in LKR · ${range === '7d' ? 'Last 7 days' : range === '30d' ? 'Last 30 days' : 'Last 90 days'}`}
              actions={(
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                {fmtK(stats?.total_revenue ?? 0)} total
              </span>
              )}
            />
            {chart.length > 0 ? (
              <>
                <Sparkline data={chart} />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                  <span>Y-axis: delivered revenue in LKR</span>
                  <span>X-axis: calendar day</span>
                </div>
              </>
            ) : (
              <DashboardEmptyInsight
                className="min-h-32"
                icon={<BarChart3 size={24} className="text-emerald-400" />}
                title="No delivered orders in this range"
                description="Revenue is calculated from delivered orders. Review orders or add products so customers can place their first order."
                primaryHref="/dashboard/orders"
                primaryLabel="Review Orders"
                secondaryHref="/dashboard/products"
                secondaryLabel="Add Products"
              />
            )}
          </div>

          {/* Top products */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h2 className="text-sm font-black text-white mb-4 flex items-center gap-2">
              <Award size={14} className="text-amber-400" />
              Top Products by Revenue
            </h2>
            {products.length === 0 ? (
              <DashboardEmptyInsight
                className="py-8"
                icon={<Package size={26} className="text-amber-400" />}
                title="No product revenue yet"
                description="Top products appear after orders are delivered in the selected range."
                secondaryHref="/dashboard/products"
                secondaryLabel="Manage Products"
              />
            ) : (
              <div className="space-y-3">
                {products.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3">
                    {/* Rank */}
                    <span className={`text-xs font-black w-5 shrink-0 text-center ${
                      i === 0 ? 'text-amber-400' : i === 1 ? 'text-zinc-400' : i === 2 ? 'text-amber-700' : 'text-zinc-700'
                    }`}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
                    </span>
                    {/* Bar + label */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-zinc-200 truncate">{p.name}</span>
                        <span className="text-xs text-zinc-500 shrink-0 ml-2">{p.qty} sold</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-linear-to-r from-emerald-500 to-emerald-400 transition-all"
                          style={{ width: `${(p.revenue / maxRev) * 100}%` }}
                        />
                      </div>
                    </div>
                    {/* Revenue */}
                    <span className="text-sm font-black text-emerald-400 shrink-0 w-20 text-right">
                      {fmtK(p.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
