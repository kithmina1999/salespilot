"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { api } from "@/lib/api";
import {
  ArrowLeft,
  RefreshCw,
  Box,
  Activity,
  Network,
  MessageSquare,
  ChevronRight,
  Cpu,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/* ── helpers ─────────────────────────────────────────────── */

function formatTime(dateString: string) {
  const d = new Date(dateString);
  return (
    d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  );
}

function RouteTag({ route }: { route: string }) {
  const map: Record<string, { bg: string; color: string; border: string; label: string }> = {
    deterministic: { bg: "rgba(34,197,94,0.1)",   color: "#4ade80", border: "rgba(34,197,94,0.3)",   label: "Deterministic" },
    semantic_hint: { bg: "rgba(168,85,247,0.1)",  color: "#c084fc", border: "rgba(168,85,247,0.3)",  label: "Semantic Hint" },
    llm_generative:{ bg: "rgba(99,102,241,0.1)",  color: "#818cf8", border: "rgba(99,102,241,0.3)",  label: "Generative AI"  },
    drop:          { bg: "rgba(239,68,68,0.1)",   color: "#f87171", border: "rgba(239,68,68,0.3)",   label: "Dropped"        },
  };
  if (!route) return <span style={{ color: "var(--muted)" }}>—</span>;
  const s = route.startsWith("bot_state_")
    ? { bg: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "rgba(59,130,246,0.3)", label: "State Machine" }
    : (map[route] ?? { bg: "rgba(100,116,139,0.1)", color: "#94a3b8", border: "rgba(100,116,139,0.25)", label: route });
  return (
    <span style={{
      padding: "0.2rem 0.6rem",
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
      borderRadius: "999px",
      fontSize: "0.7rem",
      fontWeight: 700,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
    }}>
      {s.label}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? "#4ade80" : value >= 60 ? "#fbbf24" : "#f87171";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "flex-end" }}>
      <div style={{ width: "60px", height: "4px", background: "var(--border-2)", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ width: `${Math.min(value, 100)}%`, height: "100%", background: color, borderRadius: "2px", transition: "width 0.4s" }} />
      </div>
      <span style={{ fontFamily: "monospace", fontSize: "0.8125rem", fontWeight: 700, color, minWidth: "42px", textAlign: "right" }}>
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

/* ── main page ───────────────────────────────────────────── */

export default function PipelineLogsPage() {
  const { id } = useParams();
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);

  const { data, isLoading, mutate, isValidating } = useSWR(
    id ? `/system/businesses/${id}/pipeline-logs?page=${page}&limit=50` : null,
    (url: string) => api.get(url).then((r) => r.data),
    { refreshInterval: 10000 }
  );

  const { data: detailData, isLoading: detailLoading } = useSWR(
    selectedLogId ? `/system/pipeline-logs/${selectedLogId}` : null,
    (url: string) => api.get(url).then((r) => r.data)
  );

  const logs    = data?.data  || [];
  const meta    = data?.meta  || { total: 0 };
  const detail  = detailData?.log;

  /* ── skeleton ──────────────────────────────────────────── */
  const skeleton = (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{ height: "52px", background: "var(--surface-2)", borderRadius: "0.5rem",
          animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i * 80}ms` }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }} className="animate-fade-up">

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            onClick={() => router.push(`/businesses/${id}`)}
            style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "var(--surface)", border: "1px solid var(--border-2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--muted)", cursor: "pointer", transition: "all 0.15s", flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; e.currentTarget.style.borderColor = "var(--accent)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; e.currentTarget.style.borderColor = "var(--border-2)"; }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 900, color: "var(--text)", letterSpacing: "-0.03em", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Network size={22} style={{ color: "var(--accent)" }} />
              Pipeline Telemetry
            </h1>
            <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginTop: "0.2rem" }}>
              Real-time bot routing decisions, AI invocations &amp; signal density.
            </p>
          </div>
        </div>

        <button
          onClick={() => mutate()}
          disabled={isValidating}
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            padding: "0.5rem 1rem", background: "var(--surface)",
            border: "1px solid var(--border-2)", borderRadius: "0.625rem",
            color: "var(--muted)", fontSize: "0.875rem", fontWeight: 600,
            cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; e.currentTarget.style.borderColor = "var(--accent)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; e.currentTarget.style.borderColor = "var(--border-2)"; }}
        >
          <RefreshCw size={14} style={{ animation: isValidating ? "spin 1s linear infinite" : "none" }} />
          Refresh
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </button>
      </div>

      {/* ── Table card ─────────────────────────────────────── */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "1rem", overflow: "hidden" }}>

        {/* thead */}
        <div style={{
          display: "grid", gridTemplateColumns: "1.6fr 1.2fr 0.8fr 1.2fr 1.4fr 40px",
          padding: "0.75rem 1.25rem",
          background: "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--border)",
        }}>
          {["Timestamp", "Customer", "Length", "Route", "Action", ""].map((h) => (
            <span key={h} style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              {h}
            </span>
          ))}
        </div>

        {/* body */}
        {isLoading && !logs.length ? (
          <div style={{ padding: "1.5rem" }}>{skeleton}</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: "4rem", textAlign: "center" }}>
            <Activity size={32} style={{ color: "var(--muted)", margin: "0 auto 0.75rem" }} />
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>No pipeline logs found.</p>
            <p style={{ color: "var(--muted-2)", fontSize: "0.8rem", marginTop: "0.35rem" }}>Enable Debug Mode on this business to start capturing.</p>
          </div>
        ) : (
          logs.map((log: any, idx: number) => (
            <div
              key={log.id}
              onClick={() => setSelectedLogId(log.id)}
              style={{
                display: "grid", gridTemplateColumns: "1.6fr 1.2fr 0.8fr 1.2fr 1.4fr 40px",
                padding: "0.875rem 1.25rem", alignItems: "center",
                borderBottom: idx < logs.length - 1 ? "1px solid var(--border)" : "none",
                cursor: "pointer", transition: "background 0.12s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: "0.78rem", color: "var(--muted)", fontFamily: "monospace" }}>
                {formatTime(log.created_at)}
              </span>
              <span style={{ fontSize: "0.8375rem", fontWeight: 600, color: "var(--text)", fontFamily: "monospace" }}>
                {log.customer_phone}
              </span>
              <span style={{
                display: "inline-block", padding: "0.2rem 0.5rem",
                background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-2)",
                borderRadius: "999px", fontSize: "0.7rem", color: "var(--muted-2)", fontFamily: "monospace",
              }}>
                {log.char_count}c
              </span>
              <RouteTag route={log.route_taken} />
              <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>{log.action_taken || "—"}</span>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <ChevronRight size={15} style={{ color: "var(--muted-2)" }} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Pagination ─────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.875rem", color: "var(--muted)" }}>
        <span>Showing <strong style={{ color: "var(--text)" }}>{logs.length}</strong> of <strong style={{ color: "var(--text)" }}>{meta.total}</strong> logs</span>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {[
            { label: "← Prev", disabled: page === 1,         action: () => setPage((p) => Math.max(1, p - 1)) },
            { label: "Next →", disabled: logs.length < 50,   action: () => setPage((p) => p + 1) },
          ].map(({ label, disabled, action }) => (
            <button
              key={label}
              disabled={disabled}
              onClick={action}
              style={{
                padding: "0.4rem 0.85rem", background: "var(--surface)",
                border: "1px solid var(--border-2)", borderRadius: "0.5rem",
                color: disabled ? "var(--muted-2)" : "var(--text)",
                fontSize: "0.8125rem", fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.4 : 1, fontFamily: "inherit", transition: "all 0.12s",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Detail Sheet ───────────────────────────────────── */}
      <Sheet open={selectedLogId !== null} onOpenChange={(open) => !open && setSelectedLogId(null)}>
        <SheetContent
          className="overflow-y-auto"
          style={{
            width: "min(860px, 92vw)", maxWidth: "none",
            background: "var(--bg)", borderLeft: "1px solid var(--border)",
            padding: "2rem",
          }}
        >
          <SheetHeader style={{ marginBottom: "1.5rem", paddingBottom: "1.25rem", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
              <div style={{
                width: "42px", height: "42px", borderRadius: "12px",
                background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Activity size={20} style={{ color: "var(--accent)" }} />
              </div>
              <div>
                <SheetTitle style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--text)", letterSpacing: "-0.02em" }}>
                  Execution Trace
                </SheetTitle>
                <SheetDescription style={{ fontFamily: "monospace", color: "var(--muted)", fontSize: "0.78rem", marginTop: "0.15rem" }}>
                  TRACE #{selectedLogId}{detail ? ` · ${formatTime(detail.created_at)}` : ""}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* loading skeleton */}
          {detailLoading || !detail ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} style={{ height: i === 2 ? "180px" : "80px", background: "var(--surface)", borderRadius: "0.75rem", animation: "pulse 1.5s ease-in-out infinite" }} />
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

              {/* ── Raw Message ─────────────────────────────── */}
              <div style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "0.875rem", padding: "1.25rem",
                borderLeft: "3px solid var(--accent)",
              }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.625rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <MessageSquare size={11} /> Ingested Message
                </div>
                <p style={{ fontSize: "0.9375rem", color: "var(--text)", lineHeight: 1.6, fontWeight: 500 }}>
                  {detail.raw_message || <em style={{ color: "var(--muted)", fontStyle: "italic" }}>Media payload — no text content</em>}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "1rem" }}>
                  {[
                    { label: "Pipeline Cleaned", value: detail.clean_message },
                    { label: "Stemmed & Reduced", value: detail.reduced_message },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--muted-2)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.35rem" }}>{label}</div>
                      <div style={{
                        fontSize: "0.78rem", fontFamily: "monospace", color: "var(--muted)",
                        background: "var(--bg)", border: "1px dashed var(--border-2)",
                        borderRadius: "0.5rem", padding: "0.5rem 0.75rem",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {value || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Routing + Flags ─────────────────────────── */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
                {/* Routing card */}
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "0.875rem", padding: "1.25rem" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.875rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <Zap size={11} /> Routing Decision
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                    {[
                      { label: "Route", value: <RouteTag route={detail.route_taken} /> },
                      { label: "Action", value: <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text)" }}>{detail.action_taken || "—"}</span> },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>{label}</span>
                        {value}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Flags card */}
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "0.875rem", padding: "1.25rem" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.875rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <Cpu size={11} /> Classifier Flags
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                    {[
                      {
                        label: "Gemini Invoked",
                        value: detail.used_gemini
                          ? <span style={{ padding: "0.15rem 0.5rem", background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)", borderRadius: "999px", fontSize: "0.7rem", fontWeight: 700 }}>YES</span>
                          : <span style={{ fontSize: "0.8rem", color: "var(--muted-2)" }}>No</span>,
                      },
                      {
                        label: "Toxic / Gibberish",
                        value: (detail.is_gibberish || detail.is_toxic)
                          ? <span style={{ padding: "0.15rem 0.5rem", background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "999px", fontSize: "0.7rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.25rem" }}><AlertTriangle size={10} /> Flagged</span>
                          : <span style={{ fontSize: "0.8rem", color: "var(--muted-2)" }}>Clean</span>,
                      },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>{label}</span>
                        {value}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Signal Map ──────────────────────────────── */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <Box size={16} style={{ color: "var(--accent)" }} />
                  <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.01em" }}>Signal Density Map</h3>
                </div>
                <p style={{ fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "1rem", lineHeight: 1.5 }}>
                  Each row shows a rule the scorer evaluated, with its raw confidence, any modifier effects, and the final confidence used for routing.
                </p>

                {(!detail.SignalLogs || detail.SignalLogs.length === 0) ? (
                  <div style={{
                    padding: "2.5rem", textAlign: "center",
                    border: "1px dashed var(--border-2)", borderRadius: "0.875rem",
                    background: "rgba(255,255,255,0.01)", color: "var(--muted)", fontSize: "0.875rem",
                  }}>
                    No explicit signals were logged for this payload.
                  </div>
                ) : (
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "0.875rem", overflow: "hidden" }}>
                    {/* signal thead */}
                    <div style={{
                      display: "grid", gridTemplateColumns: "36px 1.8fr 1fr 1fr 1fr 1.4fr",
                      padding: "0.65rem 1rem",
                      background: "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--border)",
                    }}>
                      {["#", "Matched Keyword", "Strength", "Raw", "Modified", "Final Conf"].map((h) => (
                        <span key={h} style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: h === "Final Conf" || h === "Modified" || h === "Raw" ? "right" : "left" }}>
                          {h}
                        </span>
                      ))}
                    </div>

                    {/* signal rows */}
                    {detail.SignalLogs.map((s: any, idx: number) => (
                      <div
                        key={s.id}
                        style={{
                          display: "grid", gridTemplateColumns: "36px 1.8fr 1fr 1fr 1fr 1.4fr",
                          padding: "0.75rem 1rem", alignItems: "center",
                          borderBottom: idx < detail.SignalLogs.length - 1 ? "1px solid var(--border)" : "none",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <span style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: "22px", height: "22px", borderRadius: "50%",
                          background: "var(--border-2)", fontSize: "0.68rem", fontWeight: 800, color: "var(--muted)",
                        }}>
                          {s.rank}
                        </span>

                        <div>
                          <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text)" }}>{s.matched_entry}</div>
                          <div style={{ fontSize: "0.68rem", fontFamily: "monospace", color: "var(--muted-2)", marginTop: "1px" }}>Rule #{s.rule_id}</div>
                        </div>

                        <span style={{
                          display: "inline-block", padding: "0.15rem 0.45rem",
                          background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-2)",
                          borderRadius: "4px", fontSize: "0.68rem", fontFamily: "monospace",
                          color: "var(--muted)", textTransform: "uppercase",
                        }}>
                          {s.keyword_strength}
                        </span>

                        <span style={{ fontFamily: "monospace", fontSize: "0.8125rem", color: "var(--muted-2)", textAlign: "right" }}>
                          {s.raw_confidence.toFixed(1)}%
                        </span>

                        <span style={{ fontFamily: "monospace", fontSize: "0.8125rem", textAlign: "right",
                          color: s.after_modifiers !== s.after_weight ? "#fbbf24" : "var(--muted-2)",
                          fontWeight: s.after_modifiers !== s.after_weight ? 700 : 400,
                        }}>
                          {s.after_modifiers !== s.after_weight ? `${s.after_modifiers.toFixed(1)}%` : "—"}
                        </span>

                        <ConfidenceBar value={s.final_confidence} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
