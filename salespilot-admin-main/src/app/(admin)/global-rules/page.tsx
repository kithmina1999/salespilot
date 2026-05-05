"use client";
import { useState, useEffect } from "react";
import { Plus, Trash2, RefreshCw, VolumeX, GitBranch, BookOpen, Loader2 } from "lucide-react";
import useSWR from "swr";
import { api } from "@/lib/api";

interface GlobalRule {
  ID: number;
  keywords: string;
  response: string;
  sinhala_response: string;
  is_active: boolean;
  is_drop_rule: boolean;
  is_context_bridge: boolean;
  usage_count: number;
}

type RuleType = "faq" | "drop" | "bridge";

function getRuleType(rule: GlobalRule): RuleType {
  if (rule.is_drop_rule) return "drop";
  if (rule.is_context_bridge) return "bridge";
  return "faq";
}

function RuleBadge({ type }: { type: RuleType }) {
  if (type === "drop") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.55rem", borderRadius: "9999px", background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
      <VolumeX size={10} /> Silent Drop
    </span>
  );
  if (type === "bridge") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.55rem", borderRadius: "9999px", background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
      <GitBranch size={10} /> Context Bridge
    </span>
  );
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.55rem", borderRadius: "9999px", background: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
      <BookOpen size={10} /> FAQ
    </span>
  );
}

export default function GlobalRulesPage() {
  const { data: rules, error, mutate, isLoading } = useSWR<GlobalRule[]>(
    "/system/global-rules",
    (url:string) => api.get(url).then((res) => res.data)
  );
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ keywords: "", response: "", sinhala_response: "", is_active: true, ruleType: "faq" as RuleType });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const body = {
        keywords: form.keywords,
        response: form.response,
        sinhala_response: form.sinhala_response,
        is_active: form.is_active,
        is_drop_rule: form.ruleType === "drop",
        is_context_bridge: form.ruleType === "bridge",
      };
      await api.post("/system/global-rules", body);
      setShowCreate(false);
      setForm({ keywords: "", response: "", sinhala_response: "", is_active: true, ruleType: "faq" });
      mutate();
    } finally { setCreating(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this global rule? It affects all tenants immediately.")) return;
    await api.delete(`/system/global-rules/${id}`);
    mutate();
  }

  const safeRules = rules || [];
  const dropRules   = safeRules.filter(r => r.is_drop_rule);
  const bridgeRules = safeRules.filter(r => r.is_context_bridge);
  const faqRules    = safeRules.filter(r => !r.is_drop_rule && !r.is_context_bridge);

  return (
    <div style={{ padding: "2rem", maxWidth: "1100px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.75rem" }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0 }}>Global Rules</h1>
          <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: "0.25rem" }}>
            Platform-wide rules that apply to <strong>all tenants</strong>. Changes take effect immediately.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={() => mutate()} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.45rem 0.9rem", fontSize: "0.8rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer" }}>
            <RefreshCw size={13} className={!rules && !error ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={() => setShowCreate(true)} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.45rem 0.9rem", fontSize: "0.8rem", fontWeight: 600, borderRadius: "0.5rem", border: "none", background: "var(--accent)", color: "#000", cursor: "pointer" }}>
            <Plus size={13} /> New Global Rule
          </button>
        </div>
      </div>

      {/* Stats Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
        {[
          { label: "FAQ Rules", count: faqRules.length, color: "#fbbf24", bg: "rgba(245,158,11,0.08)" },
          { label: "Silent DROP Rules", count: dropRules.length, color: "#f87171", bg: "rgba(239,68,68,0.08)" },
          { label: "Context Bridge Rules", count: bridgeRules.length, color: "#818cf8", bg: "rgba(99,102,241,0.08)" },
        ].map(s => (
          <div key={s.label} style={{ padding: "1rem 1.25rem", borderRadius: "0.75rem", background: s.bg, border: `1px solid ${s.color}22` }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.15rem" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "1rem", padding: "1.75rem", width: "100%", maxWidth: "520px" }}>
            <h2 style={{ margin: "0 0 1.25rem", fontSize: "1.05rem", fontWeight: 700 }}>New Global Rule</h2>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Rule Type Toggle */}
              <div>
                <label style={{ fontSize: "0.78rem", color: "var(--muted)", display: "block", marginBottom: "0.4rem" }}>Rule Type</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {(["faq", "drop", "bridge"] as RuleType[]).map(t => (
                    <button key={t} type="button" onClick={() => setForm(f => ({ ...f, ruleType: t }))}
                      style={{ flex: 1, padding: "0.45rem", fontSize: "0.78rem", fontWeight: 600, borderRadius: "0.5rem", cursor: "pointer", border: "1px solid", borderColor: form.ruleType === t ? (t === "drop" ? "#f87171" : t === "bridge" ? "#818cf8" : "#fbbf24") : "var(--border)", background: form.ruleType === t ? (t === "drop" ? "rgba(239,68,68,0.15)" : t === "bridge" ? "rgba(99,102,241,0.15)" : "rgba(245,158,11,0.15)") : "transparent", color: form.ruleType === t ? (t === "drop" ? "#f87171" : t === "bridge" ? "#818cf8" : "#fbbf24") : "var(--muted)" }}>
                      {t === "faq" ? "📖 FAQ" : t === "drop" ? "🔇 Silent Drop" : "🔄 Context Bridge"}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.4rem" }}>
                  {form.ruleType === "drop" ? "No reply sent. No token consumed. No inbox log. Pure silence." : form.ruleType === "bridge" ? "Checks conversation history. Re-prompts if bot asked a question; else drops silently." : "Standard FAQ reply rule."}
                </p>
              </div>
              <div>
                <label style={{ fontSize: "0.78rem", color: "var(--muted)", display: "block", marginBottom: "0.4rem" }}>Keywords (comma-separated)*</label>
                <textarea value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} required rows={2} placeholder='e.g. "ok,okay,k,fine"' style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "0.83rem", resize: "vertical", boxSizing: "border-box" }} />
              </div>
              {form.ruleType === "faq" && (
                <>
                  <div>
                    <label style={{ fontSize: "0.78rem", color: "var(--muted)", display: "block", marginBottom: "0.4rem" }}>English Response*</label>
                    <textarea value={form.response} onChange={e => setForm(f => ({ ...f, response: e.target.value }))} rows={3} style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "0.83rem", resize: "vertical", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.78rem", color: "var(--muted)", display: "block", marginBottom: "0.4rem" }}>Sinhala Response (optional)</label>
                    <textarea value={form.sinhala_response} onChange={e => setForm(f => ({ ...f, sinhala_response: e.target.value }))} rows={2} style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "0.83rem", resize: "vertical", boxSizing: "border-box" }} />
                  </div>
                </>
              )}
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{ padding: "0.5rem 1rem", fontSize: "0.82rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={creating} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 600, borderRadius: "0.5rem", border: "none", background: "var(--accent)", color: "#000", cursor: "pointer", opacity: creating ? 0.6 : 1 }}>
                  {creating ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : "Create Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rule Table */}
      {isLoading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)" }}><Loader2 size={24} className="animate-spin" style={{ margin: "0 auto" }} /></div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--danger)" }}>Failed to load rules</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {safeRules.map(rule => (
            <div key={rule.ID} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.9rem 1.1rem", borderRadius: "0.75rem", background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                  <RuleBadge type={getRuleType(rule)} />
                  <code style={{ fontSize: "0.77rem", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rule.keywords}</code>
                </div>
                {!rule.is_drop_rule && !rule.is_context_bridge && rule.response && (
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text)", opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rule.response}</p>
                )}
              </div>
              <span style={{ fontSize: "0.72rem", color: "var(--muted)", whiteSpace: "nowrap" }}>{rule.usage_count} hits</span>
              <button onClick={() => handleDelete(rule.ID)} style={{ padding: "0.35rem", borderRadius: "0.4rem", border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)", color: "#f87171", cursor: "pointer", display: "flex", alignItems: "center" }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {safeRules.length === 0 && (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)", fontSize: "0.85rem" }}>No global rules yet. Create your first one above.</div>
          )}
        </div>
      )}
    </div>
  );
}
