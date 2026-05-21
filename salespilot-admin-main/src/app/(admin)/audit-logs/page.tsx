"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import {
  ScrollText,
  Search,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Calendar,
  AlertTriangle,
  AlertCircle,
  Info,
  Shield,
  CreditCard,
  Package,
  Settings,
  Bot,
  Filter,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type AuditLog = {
  id: number;
  business_id: number;
  business_name: string;
  business_plan: string;
  actor_type: string;
  actor_id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: string;
  ip_address: string;
  risk: string;
  category: string;
  created_at: string;
};

type Stats = { high: number; medium: number; low: number };
type Business = { id: number; name: string };

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function parseMetadata(raw: string): object | null {
  try { return JSON.parse(raw); } catch { return null; }
}

// ── Sub-components ────────────────────────────────────────────────────────────
function RiskBadge({ risk }: { risk: string }) {
  const styles: Record<string, string> = {
    high:   "bg-destructive/10 text-destructive border-destructive/30",
    medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    low:    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  };
  const s = styles[risk?.toLowerCase()] ?? styles.low;
  return (
    <span className={`px-2.5 py-0.5 border rounded-full text-[0.65rem] font-bold tracking-widest uppercase ${s}`}>
      {risk?.toLowerCase() || "low"}
    </span>
  );
}

function BusinessBadge({ name, plan, businessId }: { name: string; plan: string; businessId: number }) {
  const planColors: Record<string, string> = {
    pro: "text-blue-500 dark:text-blue-400", 
    starter: "text-emerald-500 dark:text-emerald-400", 
    growth: "text-emerald-500 dark:text-emerald-400", 
    free: "text-muted-foreground",
  };
  const color = planColors[plan?.toLowerCase()] ?? "text-muted-foreground";
  // Super admin / platform-level actions have no business
  const displayName = name || (businessId === 0 ? "Platform" : "—");
  const displayColor = businessId === 0 ? "text-amber-500 dark:text-amber-400" : color;
  return (
    <span className={`px-2 py-0.5 bg-secondary border border-border rounded-full text-[0.7rem] font-semibold max-w-[140px] truncate inline-block ${displayColor}`}>
      {displayName}
    </span>
  );
}

function CategoryIcon({ category }: { category: string }) {
  const icons: Record<string, React.ReactNode> = {
    billing:  <CreditCard className="w-3.5 h-3.5 text-blue-500" />,
    security: <Shield    className="w-3.5 h-3.5 text-destructive" />,
    bot:      <Bot       className="w-3.5 h-3.5 text-primary" />,
    catalog:  <Package   className="w-3.5 h-3.5 text-emerald-500" />,
    system:   <Settings  className="w-3.5 h-3.5 text-amber-500" />,
  };
  return <span className="flex items-center">{icons[category] ?? <Info className="w-3.5 h-3.5 text-foreground" />}</span>;
}

function ActorBadge({ actorType }: { actorType: string }) {
  const styles: Record<string, string> = {
    super_admin: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    user:        "bg-secondary text-foreground border border-border/50",
    system:      "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  };
  const s = styles[actorType] ?? styles.user;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[0.68rem] font-semibold uppercase tracking-wider ${s}`}>
      {actorType?.replace("_", " ")}
    </span>
  );
}

// ── Filter Pill ───────────────────────────────────────────────────────────────
function FilterPill({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 border outline-none cursor-pointer ${
        active 
          ? "bg-primary text-primary-foreground border-primary shadow-[0_0_10px_rgba(99,102,241,0.3)]" 
          : "bg-secondary text-muted-foreground border-transparent hover:border-border hover:bg-secondary/80"
      }`}
    >
      {label}
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AuditLogsPage() {
  const [logs, setLogs]             = useState<AuditLog[]>([]);
  const [stats, setStats]           = useState<Stats>({ high: 0, medium: 0, low: 0 });
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Filters
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [risk, setRisk]                 = useState("");
  const [category, setCategory]         = useState("");
  const [actorType, setActorType]       = useState("");
  const [businessId, setBusinessId]     = useState("");
  const [search, setSearch]             = useState("");

  // Fetch businesses list for dropdown
  useEffect(() => {
    api.get("/system/businesses")
      .then((d) => setBusinesses(d.data.businesses || []))
      .catch(() => {});
  }, []);

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedDate) { params.set("from", selectedDate); params.set("to", selectedDate); }
    if (risk)         params.set("risk", risk);
    if (category)     params.set("category", category);
    if (actorType)    params.set("actor_type", actorType);
    if (businessId)   params.set("business_id", businessId);
    if (search)       params.set("search", search);
    return `/system/audit-logs?${params.toString()}`;
  }, [selectedDate, risk, category, actorType, businessId, search]);

  const loadLogs = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true); else setLoading(true);
    try {
      setExpandedIds(new Set());
      const res = await api.get(buildUrl());
      setLogs(res.data.logs || []);
      setStats(res.data.stats || { high: 0, medium: 0, low: 0 });
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [buildUrl]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  async function handleExport() {
    try {
      const params = new URLSearchParams();
      if (selectedDate) { params.set("from", selectedDate); params.set("to", selectedDate); }
      if (risk)         params.set("risk", risk);
      if (category)     params.set("category", category);
      if (actorType)    params.set("actor_type", actorType);
      if (businessId)   params.set("business_id", businessId);
      if (search)       params.set("search", search);
      
      const res = await api.get(`/system/audit-logs/download?${params.toString()}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit_logs_${selectedDate || "all"}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to export logs", e);
    }
  }

  const quickDates = [
    { label: "Today",     value: todayStr() },
    { label: "Yesterday", value: (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })() },
    { label: "Last 7 Days", value: (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); })() },
  ];

  const totalEvents = stats.high + stats.medium + stats.low;

  return (
    <div className="flex flex-col gap-7 animate-fade-up">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-[34px] h-[34px] rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <ScrollText className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">
              Audit Logs
            </h1>
          </div>
          <p className="text-sm text-muted-foreground ml-1">
            {formatDisplayDate(selectedDate)} · {loading ? "Loading…" : `${logs.length} events`}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2.5 items-center">
          <button
            id="audit-refresh-btn"
            onClick={() => loadLogs(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-card border border-border rounded-lg text-muted-foreground text-sm font-semibold transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50 outline-none cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            id="audit-export-btn"
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-primary border-none rounded-lg text-primary-foreground text-sm font-semibold transition-opacity hover:opacity-85 shadow-[0_4px_12px_rgba(99,102,241,0.35)] outline-none cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {[
          { label: "Total Events",    value: totalEvents, icon: <ScrollText className="w-4 h-4 text-blue-500" />, bg: "bg-blue-500/10", border: "border-blue-500/20", color: "text-blue-500 dark:text-blue-400" },
          { label: "High Risk",       value: stats.high,  icon: <AlertTriangle className="w-4 h-4 text-destructive" />, bg: "bg-destructive/10", border: "border-destructive/20", color: "text-destructive" },
          { label: "Medium Risk",     value: stats.medium, icon: <AlertCircle className="w-4 h-4 text-amber-500" />, bg: "bg-amber-500/10", border: "border-amber-500/20", color: "text-amber-500 dark:text-amber-400" },
          { label: "Low Risk",        value: stats.low,   icon: <Info className="w-4 h-4 text-emerald-500" />, bg: "bg-emerald-500/10", border: "border-emerald-500/20", color: "text-emerald-500 dark:text-emerald-400" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3.5">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${s.bg} ${s.border}`}>
              {s.icon}
            </div>
            <div>
              <div className={`text-2xl font-black leading-none ${s.color}`}>
                {loading ? "—" : s.value}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-card border border-border rounded-2xl p-[1.125rem_1.25rem] flex flex-col gap-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
          <Filter className="w-3.5 h-3.5" />
          FILTERS
        </div>

        {/* Row 1: Date nav + search */}
        <div className="flex gap-3 flex-wrap items-center">
          {/* Quick shortcuts */}
          <div className="flex gap-1.5">
            {quickDates.map((qd) => (
              <FilterPill
                key={qd.label}
                label={qd.label}
                active={selectedDate === qd.value && qd.label !== "Last 7 Days"}
                onClick={() => setSelectedDate(qd.value)}
              />
            ))}
          </div>

          {/* Calendar picker */}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              id="audit-date-picker"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-secondary border border-transparent focus:border-primary rounded-lg text-foreground text-sm px-2.5 py-1.5 cursor-pointer outline-none transition-colors"
            />
          </div>

          {/* Text search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              id="audit-search-input"
              type="text"
              placeholder="Search business, action, entity…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-secondary border border-transparent focus:border-primary rounded-lg text-foreground text-sm outline-none transition-colors"
            />
          </div>
        </div>

        {/* Row 2: Risk / Category / Actor / Business */}
        <div className="flex gap-3 flex-wrap items-center">
          {/* Risk */}
          <div className="flex gap-1.5 items-center">
            <span className="text-xs text-muted-foreground font-semibold mr-0.5">Risk</span>
            {(["", "high", "medium", "low"] as const).map((r) => (
              <FilterPill key={r || "all"} label={r || "All"} active={risk === r} onClick={() => setRisk(r)} />
            ))}
          </div>

          {/* Category dropdown */}
          <select
            id="audit-category-filter"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={`bg-secondary border border-transparent focus:border-primary rounded-lg text-sm px-3 py-1.5 cursor-pointer outline-none transition-colors ${category ? "text-foreground" : "text-muted-foreground"}`}
          >
            <option value="">All Categories</option>
            <option value="billing">💳 Billing</option>
            <option value="security">🔐 Security</option>
            <option value="bot">🤖 Bot</option>
            <option value="catalog">📦 Catalog</option>
            <option value="system">⚙️ System</option>
          </select>

          {/* Actor type */}
          <select
            id="audit-actor-filter"
            value={actorType}
            onChange={(e) => setActorType(e.target.value)}
            className={`bg-secondary border border-transparent focus:border-primary rounded-lg text-sm px-3 py-1.5 cursor-pointer outline-none transition-colors ${actorType ? "text-foreground" : "text-muted-foreground"}`}
          >
            <option value="">All Actors</option>
            <option value="super_admin">🛡️ Super Admin</option>
            <option value="user">👤 User</option>
            <option value="system">⚙️ System</option>
          </select>

          {/* Business selector */}
          <select
            id="audit-business-filter"
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            className={`bg-secondary border border-transparent focus:border-primary rounded-lg text-sm px-3 py-1.5 cursor-pointer outline-none transition-colors max-w-[200px] ${businessId ? "text-foreground" : "text-muted-foreground"}`}
          >
            <option value="">All Businesses</option>
            {businesses.map((b) => (
              <option key={b.id} value={String(b.id)}>{b.name}</option>
            ))}
          </select>

          {/* Clear filters */}
          {(risk || category || actorType || businessId || search) && (
            <button
              onClick={() => { setRisk(""); setCategory(""); setActorType(""); setBusinessId(""); setSearch(""); }}
              className="px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold transition-colors hover:bg-destructive/20 outline-none cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── Log Table ── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[75px_1fr_130px_110px_95px_90px_90px] px-5 py-2.5 bg-secondary border-b border-border gap-3 items-center">
          {["Time", "Action / Entity", "Business", "Actor", "Category", "Risk", "Details"].map((h) => (
            <span key={h} className="text-[0.7rem] font-semibold text-muted-foreground tracking-wider uppercase">
              {h}
            </span>
          ))}
        </div>

        {loading ? (
          <div className="p-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-secondary rounded-lg mb-2 animate-pulse" style={{ animationDelay: `${i * 80}ms`, opacity: 1 - i * 0.12 }} />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-20 text-center flex flex-col items-center">
            <ScrollText className="w-9 h-9 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-[0.95rem] font-semibold">No events for {formatDisplayDate(selectedDate)}</p>
            <p className="text-muted-foreground opacity-60 text-sm mt-1.5">Try a different date or adjust your filters.</p>
          </div>
        ) : (
          logs.map((log, idx) => {
            const isExpanded = expandedIds.has(log.id);
            const parsedMeta = parseMetadata(log.metadata);
            const hasMeta = parsedMeta && Object.keys(parsedMeta).length > 0;

            return (
              <div
                key={log.id}
                className={`transition-colors hover:bg-secondary/50 ${idx < logs.length - 1 ? "border-b border-border" : ""}`}
              >
                <div className="grid grid-cols-[75px_1fr_130px_110px_95px_90px_90px] px-5 py-3.5 gap-3 items-center">
                  {/* Time */}
                  <span className="text-[0.72rem] text-muted-foreground font-mono pt-0.5">
                    {formatDate(log.created_at)}
                  </span>

                  {/* Action / Entity */}
                  <div>
                    <p className="text-sm font-semibold text-foreground font-mono">
                      {log.action}
                    </p>
                    {log.entity_type && (
                      <p className="text-[0.72rem] text-muted-foreground mt-[1px]">
                        {log.entity_type}{log.entity_id ? ` #${log.entity_id}` : ""}
                      </p>
                    )}
                  </div>

                  {/* Business badge */}
                  <div className="pt-0.5">
                    <BusinessBadge name={log.business_name} plan={log.business_plan} businessId={log.business_id} />
                  </div>

                  {/* Actor */}
                  <div className="pt-0.5">
                    <ActorBadge actorType={log.actor_type} />
                    {log.ip_address && (
                      <p className="text-[0.68rem] text-muted-foreground mt-1 font-mono">
                        {log.ip_address}
                      </p>
                    )}
                  </div>

                  {/* Category */}
                  <div className="flex items-center gap-1 pt-0.5">
                    <CategoryIcon category={log.category} />
                    <span className="text-[0.72rem] text-muted-foreground capitalize">
                      {log.category || "—"}
                    </span>
                  </div>

                  {/* Risk */}
                  <div className="pt-0.5">
                    <RiskBadge risk={log.risk} />
                  </div>

                  {/* Details Toggle */}
                  <div className="pt-0.5">
                    {hasMeta ? (
                      <button
                        onClick={() => {
                          const newSet = new Set(expandedIds);
                          if (newSet.has(log.id)) newSet.delete(log.id);
                          else newSet.add(log.id);
                          setExpandedIds(newSet);
                        }}
                        className={`flex items-center gap-1 border rounded-md px-2 py-1 text-[0.7rem] cursor-pointer outline-none transition-colors ${
                          isExpanded 
                            ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-500 dark:text-indigo-400" 
                            : "bg-secondary border-transparent text-muted-foreground hover:border-border"
                        }`}
                      >
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        Details
                      </button>
                    ) : (
                      <span className="text-muted-foreground text-xs pl-2 opacity-60">—</span>
                    )}
                  </div>
                </div>

                {/* Expanded Details Content */}
                {isExpanded && hasMeta && (
                  <div className="px-5 pb-5">
                    <pre className="m-0 p-4 bg-card border border-border rounded-lg text-xs text-foreground overflow-auto max-h-[300px] leading-relaxed font-mono">
                      {JSON.stringify(parsedMeta, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
