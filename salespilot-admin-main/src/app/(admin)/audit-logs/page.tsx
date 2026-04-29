"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchApi } from "@/lib/api";
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
  ShoppingCart,
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
  const styles: Record<string, { bg: string; color: string; border: string; label: string }> = {
    high:   { bg: "rgba(239,68,68,0.12)",   color: "#f87171", border: "rgba(239,68,68,0.35)",   label: "HIGH"   },
    medium: { bg: "rgba(245,158,11,0.12)",  color: "#fbbf24", border: "rgba(245,158,11,0.35)",  label: "MEDIUM" },
    low:    { bg: "rgba(34,197,94,0.1)",    color: "#4ade80", border: "rgba(34,197,94,0.3)",    label: "LOW"    },
  };
  const s = styles[risk?.toLowerCase()] ?? styles.low;
  return (
    <span style={{
      padding: "0.175rem 0.55rem",
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: "999px", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.07em",
    }}>
      {s.label}
    </span>
  );
}

function BusinessBadge({ name, plan, businessId }: { name: string; plan: string; businessId: number }) {
  const planColors: Record<string, string> = {
    pro: "#818cf8", starter: "#4ade80", growth: "#4ade80", free: "#94a3b8",
  };
  const color = planColors[plan?.toLowerCase()] ?? "#94a3b8";
  // Super admin / platform-level actions have no business
  const displayName = name || (businessId === 0 ? "Platform" : "—");
  const displayColor = businessId === 0 ? "#fbbf24" : color;
  return (
    <span style={{
      padding: "0.175rem 0.55rem",
      background: "rgba(255,255,255,0.06)", color: displayColor, border: `1px solid ${displayColor}33`,
      borderRadius: "999px", fontSize: "0.7rem", fontWeight: 600,
      maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      display: "inline-block",
    }}>
      {displayName}
    </span>
  );
}

function CategoryIcon({ category }: { category: string }) {
  const icons: Record<string, React.ReactNode> = {
    billing:  <CreditCard size={13} color="#818cf8" />,
    security: <Shield    size={13} color="#f87171" />,
    bot:      <Bot       size={13} color="#60a5fa" />,
    catalog:  <Package   size={13} color="#4ade80" />,
    system:   <Settings  size={13} color="#fbbf24" />,
  };
  return <span style={{ display: "flex", alignItems: "center" }}>{icons[category] ?? <Info size={13} color="#94a3b8" />}</span>;
}

function ActorBadge({ actorType }: { actorType: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    super_admin: { bg: "rgba(99,102,241,0.12)", color: "#818cf8" },
    user:        { bg: "rgba(255,255,255,0.06)", color: "#e2e8f0" },
    system:      { bg: "rgba(245,158,11,0.1)",  color: "#fbbf24" },
  };
  const s = styles[actorType] ?? styles.user;
  return (
    <span style={{
      padding: "0.125rem 0.45rem",
      background: s.bg, color: s.color, borderRadius: "999px",
      fontSize: "0.68rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em",
    }}>
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
      style={{
        padding: "0.375rem 0.875rem",
        borderRadius: "999px",
        fontSize: "0.8rem", fontWeight: 600,
        background: active ? "var(--accent)" : "rgba(255,255,255,0.05)",
        color: active ? "#fff" : "var(--muted)",
        border: `1px solid ${active ? "var(--accent)" : "var(--border-2)"}`,
        cursor: "pointer", fontFamily: "inherit",
        transition: "all 0.15s",
        boxShadow: active ? "0 0 10px rgba(99,102,241,0.3)" : "none",
      }}
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
    fetchApi("/system/businesses")
      .then((d) => setBusinesses(d.businesses || []))
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
      const data = await fetchApi(buildUrl());
      setLogs(data.logs || []);
      setStats(data.stats || { high: 0, medium: 0, low: 0 });
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [buildUrl]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  function handleExport() {
    const key = sessionStorage.getItem("master_key") || "";
    const params = new URLSearchParams();
    if (selectedDate) { params.set("from", selectedDate); params.set("to", selectedDate); }
    if (risk)         params.set("risk", risk);
    if (category)     params.set("category", category);
    if (actorType)    params.set("actor_type", actorType);
    if (businessId)   params.set("business_id", businessId);
    if (search)       params.set("search", search);
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
    const url  = `${base}/system/audit-logs/download?${params.toString()}`;
    const a    = document.createElement("a");
    a.href = url;
    a.setAttribute("data-x-master-key", key);
    // Open in new tab — server returns with Content-Disposition: attachment
    window.open(`${url}&master_key=${encodeURIComponent(key)}`);
  }

  const quickDates = [
    { label: "Today",     value: todayStr() },
    { label: "Yesterday", value: (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })() },
    { label: "Last 7 Days", value: (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); })() },
  ];

  const totalEvents = stats.high + stats.medium + stats.low;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }} className="animate-fade-up">

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.375rem" }}>
            <div style={{
              width: "34px", height: "34px", borderRadius: "10px",
              background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(99,102,241,0.1))",
              border: "1px solid rgba(99,102,241,0.25)", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <ScrollText size={17} color="var(--accent)" />
            </div>
            <h1 style={{ fontSize: "1.625rem", fontWeight: 900, color: "var(--text)", letterSpacing: "-0.03em" }}>
              Audit Logs
            </h1>
          </div>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginLeft: "0.25rem" }}>
            {formatDisplayDate(selectedDate)} · {loading ? "Loading…" : `${logs.length} events`}
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "0.625rem", alignItems: "center" }}>
          <button
            id="audit-refresh-btn"
            onClick={() => loadLogs(true)}
            disabled={refreshing}
            style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              padding: "0.5rem 0.875rem",
              background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-2)",
              borderRadius: "0.625rem", color: "var(--muted)", fontSize: "0.8375rem", fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "var(--muted)"; }}
          >
            <RefreshCw size={14} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
          <button
            id="audit-export-btn"
            onClick={handleExport}
            style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              padding: "0.5rem 0.875rem",
              background: "var(--accent)", border: "none",
              borderRadius: "0.625rem", color: "#fff", fontSize: "0.8375rem", fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 4px 12px rgba(99,102,241,0.35)", transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.875rem" }}>
        {[
          { label: "Total Events",    value: totalEvents, icon: <ScrollText size={16} color="#818cf8" />, color: "#818cf8", glow: "rgba(99,102,241,0.15)" },
          { label: "High Risk",       value: stats.high,  icon: <AlertTriangle size={16} color="#f87171" />, color: "#f87171", glow: "rgba(239,68,68,0.12)" },
          { label: "Medium Risk",     value: stats.medium, icon: <AlertCircle size={16} color="#fbbf24" />, color: "#fbbf24", glow: "rgba(245,158,11,0.12)" },
          { label: "Low Risk",        value: stats.low,   icon: <Info size={16} color="#4ade80" />, color: "#4ade80", glow: "rgba(34,197,94,0.1)" },
        ].map((s) => (
          <div key={s.label} style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "0.875rem", padding: "1rem 1.25rem",
            display: "flex", alignItems: "center", gap: "0.875rem",
          }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: s.glow, border: `1px solid ${s.color}33`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: "1.625rem", fontWeight: 900, color: s.color, lineHeight: 1 }}>
                {loading ? "—" : s.value}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.2rem" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter Bar ── */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "1rem", padding: "1.125rem 1.25rem",
        display: "flex", flexDirection: "column", gap: "1rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--muted)", fontSize: "0.8rem", fontWeight: 600 }}>
          <Filter size={13} />
          FILTERS
        </div>

        {/* Row 1: Date nav + search */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          {/* Quick shortcuts */}
          <div style={{ display: "flex", gap: "0.375rem" }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Calendar size={14} color="var(--muted)" />
            <input
              id="audit-date-picker"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                background: "var(--surface-2)", border: "1px solid var(--border-2)",
                borderRadius: "0.5rem", color: "var(--text)", fontSize: "0.8375rem",
                padding: "0.375rem 0.625rem", cursor: "pointer", fontFamily: "inherit",
                outline: "none",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border-2)")}
            />
          </div>

          {/* Text search */}
          <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
            <Search size={14} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
            <input
              id="audit-search-input"
              type="text"
              placeholder="Search business, action, entity…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%", paddingLeft: "2.25rem", paddingRight: "0.875rem",
                paddingTop: "0.5rem", paddingBottom: "0.5rem",
                background: "var(--surface-2)", border: "1px solid var(--border-2)",
                borderRadius: "0.625rem", color: "var(--text)", fontSize: "0.875rem",
                outline: "none", fontFamily: "inherit", transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border-2)")}
            />
          </div>
        </div>

        {/* Row 2: Risk / Category / Actor / Business */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          {/* Risk */}
          <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600, marginRight: "0.125rem" }}>Risk</span>
            {(["", "high", "medium", "low"] as const).map((r) => (
              <FilterPill key={r || "all"} label={r || "All"} active={risk === r} onClick={() => setRisk(r)} />
            ))}
          </div>

          {/* Category dropdown */}
          <select
            id="audit-category-filter"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              background: "var(--surface-2)", border: "1px solid var(--border-2)",
              borderRadius: "0.5rem", color: category ? "var(--text)" : "var(--muted)",
              fontSize: "0.8375rem", padding: "0.375rem 0.75rem", cursor: "pointer",
              fontFamily: "inherit", outline: "none",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border-2)")}
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
            style={{
              background: "var(--surface-2)", border: "1px solid var(--border-2)",
              borderRadius: "0.5rem", color: actorType ? "var(--text)" : "var(--muted)",
              fontSize: "0.8375rem", padding: "0.375rem 0.75rem", cursor: "pointer",
              fontFamily: "inherit", outline: "none",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border-2)")}
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
            style={{
              background: "var(--surface-2)", border: "1px solid var(--border-2)",
              borderRadius: "0.5rem", color: businessId ? "var(--text)" : "var(--muted)",
              fontSize: "0.8375rem", padding: "0.375rem 0.75rem", cursor: "pointer",
              fontFamily: "inherit", outline: "none", maxWidth: "200px",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border-2)")}
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
              style={{
                padding: "0.375rem 0.75rem", borderRadius: "0.5rem",
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                color: "#f87171", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                fontFamily: "inherit", transition: "all 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.15)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── Log Table ── */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "1rem", overflow: "hidden",
      }}>
        {/* Table Header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "75px 1fr 130px 110px 95px 90px 90px",
          padding: "0.625rem 1.25rem",
          background: "rgba(255,255,255,0.02)",
          borderBottom: "1px solid var(--border)",
          gap: "0.75rem",
          alignItems: "center",
        }}>
          {["Time", "Action / Entity", "Business", "Actor", "Category", "Risk", "Details"].map((h) => (
            <span key={h} style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              {h}
            </span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: "2rem 1.25rem" }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{
                height: "48px", background: "var(--surface-2)", borderRadius: "0.5rem",
                marginBottom: "0.5rem", opacity: 1 - i * 0.12,
                animation: "pulse 1.8s ease-in-out infinite",
                animationDelay: `${i * 80}ms`,
              }} />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: "5rem", textAlign: "center" }}>
            <ScrollText size={36} style={{ color: "var(--muted)", margin: "0 auto 1rem" }} />
            <p style={{ color: "var(--muted)", fontSize: "0.95rem", fontWeight: 600 }}>No events for {formatDisplayDate(selectedDate)}</p>
            <p style={{ color: "var(--muted-2)", fontSize: "0.8375rem", marginTop: "0.375rem" }}>Try a different date or adjust your filters.</p>
          </div>
        ) : (
          logs.map((log, idx) => {
            const isExpanded = expandedIds.has(log.id);
            const parsedMeta = parseMetadata(log.metadata);
            const hasMeta = parsedMeta && Object.keys(parsedMeta).length > 0;

            return (
              <div
                key={log.id}
                style={{
                  borderBottom: idx < logs.length - 1 ? "1px solid var(--border)" : "none",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "75px 1fr 130px 110px 95px 90px 90px",
                  padding: "0.875rem 1.25rem",
                  gap: "0.75rem",
                  alignItems: "center",
                }}>
                  {/* Time */}
                  <span style={{ fontSize: "0.72rem", color: "var(--muted-2)", fontFamily: "monospace", paddingTop: "0.125rem" }}>
                    {formatDate(log.created_at)}
                  </span>

                  {/* Action / Entity */}
                  <div>
                    <p style={{ fontSize: "0.8375rem", fontWeight: 600, color: "var(--text)", fontFamily: "monospace" }}>
                      {log.action}
                    </p>
                    {log.entity_type && (
                      <p style={{ fontSize: "0.72rem", color: "var(--muted-2)", marginTop: "1px" }}>
                        {log.entity_type}{log.entity_id ? ` #${log.entity_id}` : ""}
                      </p>
                    )}
                  </div>

                  {/* Business badge */}
                  <div style={{ paddingTop: "0.125rem" }}>
                    <BusinessBadge name={log.business_name} plan={log.business_plan} businessId={log.business_id} />
                  </div>

                  {/* Actor */}
                  <div style={{ paddingTop: "0.125rem" }}>
                    <ActorBadge actorType={log.actor_type} />
                    {log.ip_address && (
                      <p style={{ fontSize: "0.68rem", color: "var(--muted-2)", marginTop: "3px", fontFamily: "monospace" }}>
                        {log.ip_address}
                      </p>
                    )}
                  </div>

                  {/* Category */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", paddingTop: "0.125rem" }}>
                    <CategoryIcon category={log.category} />
                    <span style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "capitalize" }}>
                      {log.category || "—"}
                    </span>
                  </div>

                  {/* Risk */}
                  <div style={{ paddingTop: "0.125rem" }}>
                    <RiskBadge risk={log.risk} />
                  </div>

                  {/* Details Toggle */}
                  <div style={{ paddingTop: "0.125rem" }}>
                    {hasMeta ? (
                      <button
                        onClick={() => {
                          const newSet = new Set(expandedIds);
                          if (newSet.has(log.id)) newSet.delete(log.id);
                          else newSet.add(log.id);
                          setExpandedIds(newSet);
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: "0.3rem",
                          background: isExpanded ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.05)", 
                          border: "1px solid var(--border-2)",
                          borderRadius: "0.375rem", padding: "0.2rem 0.5rem",
                          color: isExpanded ? "#818cf8" : "var(--muted)", 
                          fontSize: "0.7rem", cursor: "pointer", fontFamily: "inherit",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(99,102,241,0.1)"; e.currentTarget.style.color = "#818cf8"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = isExpanded ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.05)"; e.currentTarget.style.color = isExpanded ? "#818cf8" : "var(--muted)"; }}
                      >
                        {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                        Details
                      </button>
                    ) : (
                      <span style={{ color: "var(--muted-2)", fontSize: "0.75rem", paddingLeft: "0.5rem" }}>—</span>
                    )}
                  </div>
                </div>

                {/* Expanded Details Content */}
                {isExpanded && hasMeta && (
                  <div style={{ padding: "0 1.25rem 1.25rem 1.25rem" }}>
                    <pre style={{
                      margin: 0,
                      padding: "0.75rem 1rem",
                      background: "rgba(0,0,0,0.35)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.5rem",
                      fontSize: "0.75rem",
                      color: "#a5f3fc",
                      overflow: "auto",
                      maxHeight: "300px",
                      lineHeight: 1.6,
                      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    }}>
                      {JSON.stringify(parsedMeta, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
