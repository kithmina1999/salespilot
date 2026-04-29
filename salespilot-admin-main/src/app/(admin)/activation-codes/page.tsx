"use client";

import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/api";
import {
  KeyRound, Copy, CheckCircle, Plus, Search, Trash2,
  Clock, Shield, MessageCircle, RefreshCw, AlertTriangle,
  ChevronDown,
} from "lucide-react";

type ActivationCode = {
  id: number;
  code: string;
  plan: string;
  billing_cycle: string;
  duration_days: number;
  note: string;
  target_phone: string;
  is_used: boolean;
  used_by_name: string | null;
  used_at: string | null;
  expires_at: string | null;
  created_at: string;
};

function PlanBadge({ plan }: { plan: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    pro:     { bg: "rgba(99,102,241,0.12)",  color: "#818cf8", border: "rgba(99,102,241,0.3)" },
    growth:  { bg: "rgba(34,197,94,0.1)",    color: "#4ade80", border: "rgba(34,197,94,0.3)" },
    starter: { bg: "rgba(34,197,94,0.08)",   color: "#86efac", border: "rgba(34,197,94,0.2)" },
    free:    { bg: "rgba(100,116,139,0.1)",  color: "#94a3b8", border: "rgba(100,116,139,0.25)" },
  };
  const s = styles[plan?.toLowerCase()] ?? styles.free;
  return (
    <span style={{ padding: "0.2rem 0.6rem", background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: "999px", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
      {plan}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "#4ade80" : "var(--muted)", transition: "color 0.15s", padding: "0.2rem", display: "flex", alignItems: "center" }}>
      {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
    </button>
  );
}

// WhatsApp send button — opens wa.me with code pre-filled
function SendWhatsApp({ phone, code, plan, days }: { phone: string; code: string; plan: string; days: number }) {
  if (!phone) return null;
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const msg = encodeURIComponent(
    `🎉 Your SalesPilot activation code is ready!\n\n` +
    `*Code:* ${code}\n` +
    `*Plan:* ${plan.toUpperCase()}\n` +
    `*Duration:* ${days} days\n\n` +
    `To activate:\n1. Login to your SalesPilot dashboard\n2. Go to Usage & Plan\n3. Enter the code above\n\n` +
    `Need help? Just reply here 😊`
  );
  return (
    <a
      href={`https://wa.me/${cleanPhone}?text=${msg}`}
      target="_blank"
      rel="noreferrer"
      title={`Send to ${phone}`}
      style={{
        display: "flex", alignItems: "center", gap: "0.3rem",
        padding: "0.35rem 0.625rem",
        background: "rgba(34,197,94,0.1)",
        border: "1px solid rgba(34,197,94,0.25)",
        borderRadius: "0.5rem",
        color: "#4ade80",
        fontSize: "0.75rem", fontWeight: 600,
        textDecoration: "none",
        transition: "background 0.15s",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(34,197,94,0.2)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(34,197,94,0.1)")}
    >
      <MessageCircle size={12} />
      Send
    </a>
  );
}

export default function ActivationCodesPage() {
  const [codes, setCodes] = useState<ActivationCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, used: 0, available: 0 });
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Create form state
  const [newPlan, setNewPlan]           = useState("starter");
  const [newCycle, setNewCycle]         = useState("quarterly");
  const [newDays, setNewDays]           = useState(90);
  const [newNote, setNewNote]           = useState("");
  const [newPhone, setNewPhone]         = useState("");

  async function loadCodes() {
    try {
      const data = await fetchApi("/system/activation-codes");
      setCodes(data.codes || []);
      setStats({ total: data.total, used: data.used, available: data.available });
    } catch (err) {
      console.error("Failed to load codes:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCodes(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    try {
      await fetchApi("/system/activation-codes", {
        method: "POST",
        body: JSON.stringify({
          plan: newPlan,
          billing_cycle: newCycle,
          duration_days: Number(newDays),
          note: newNote,
          target_phone: newPhone,
        }),
      });
      setShowCreate(false);
      setNewNote(""); setNewPhone("");
      await loadCodes();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(code: string) {
    if (!confirm(`Revoke code ${code}? This cannot be undone.`)) return;
    try {
      await fetchApi(`/system/activation-codes/${code}`, { method: "DELETE" });
      await loadCodes();
    } catch (err: any) {
      alert("Failed to revoke: " + err.message);
    }
  }

  const filtered = codes.filter((c) =>
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.plan.toLowerCase().includes(search.toLowerCase()) ||
    (c.target_phone || "").includes(search) ||
    (c.note || "").toLowerCase().includes(search.toLowerCase())
  );

  const selectStyle: React.CSSProperties = {
    width: "100%", padding: "0.5625rem 0.875rem",
    background: "var(--bg)", border: "1px solid var(--border-2)",
    borderRadius: "0.625rem", color: "var(--text)", fontSize: "0.875rem",
    outline: "none", fontFamily: "inherit",
  };
  const inputStyle: React.CSSProperties = { ...selectStyle };

  return (
    <>
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }} className="animate-fade-up">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 900, color: "var(--text)", letterSpacing: "-0.03em" }}>
            Activation Codes
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginTop: "0.25rem" }}>
            Generate BSS codes for tenants who pay via bank transfer
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.625rem", alignItems: "center" }}>
          {/* Search */}
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
            <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: "2rem", width: "200px" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border-2)")}
            />
          </div>
          {/* Reload */}
          <button onClick={loadCodes} style={{ padding: "0.5rem", background: "var(--surface)", border: "1px solid var(--border-2)", borderRadius: "0.625rem", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <RefreshCw size={15} />
          </button>
          {/* Create */}
          <button onClick={() => setShowCreate(true)}
            style={{ display: "flex", alignItems: "center", gap: "0.425rem", padding: "0.5rem 1rem", background: "linear-gradient(135deg, var(--accent), var(--accent-dim))", border: "none", borderRadius: "0.625rem", color: "#fff", fontSize: "0.875rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 14px var(--accent-glow2)" }}
          >
            <Plus size={15} /> Generate Code
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
        {[
          { icon: <KeyRound size={16} />, label: "Total Codes",  value: stats.total,     accent: "#6366f1" },
          { icon: <CheckCircle size={16} />, label: "Used",      value: stats.used,      accent: "#22c55e" },
          { icon: <Clock size={16} />,       label: "Available", value: stats.available, accent: "#f59e0b" },
        ].map((s) => (
          <div key={s.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "1rem", padding: "1.125rem 1.375rem", display: "flex", alignItems: "center", gap: "0.875rem" }}>
            <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: `${s.accent}18`, display: "flex", alignItems: "center", justifyContent: "center", color: s.accent, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <p style={{ fontSize: "1.75rem", fontWeight: 900, color: "var(--text)", letterSpacing: "-0.03em", lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.25rem" }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "1rem", overflow: "hidden" }}>
        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: "3fr 1.5fr 1.5fr 2fr 160px", padding: "0.75rem 1.25rem", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--border)" }}>
          {["Code / Note", "Plan", "Duration", "Status / Used By", "Actions"].map((h) => (
            <span key={h} style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", textAlign: h === "Actions" ? "right" : "left" }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: "2rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ height: "52px", background: "var(--surface-2)", borderRadius: "0.5rem", animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i * 100}ms` }} />
            ))}
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "3.5rem", textAlign: "center" }}>
            <KeyRound size={28} style={{ color: "var(--muted)", margin: "0 auto 0.75rem" }} />
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>No activation codes yet. Generate the first one!</p>
          </div>
        ) : (
          filtered.map((c, idx) => (
            <div key={c.id}
              style={{ display: "grid", gridTemplateColumns: "3fr 1.5fr 1.5fr 2fr 160px", padding: "0.875rem 1.25rem", borderBottom: idx < filtered.length - 1 ? "1px solid var(--border)" : "none", alignItems: "center", transition: "background 0.12s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {/* Code */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontFamily: "monospace", fontSize: "0.875rem", fontWeight: 700, color: "var(--text)", letterSpacing: "0.04em" }}>{c.code}</span>
                  <CopyButton text={c.code} />
                  {c.target_phone && (
                    <span style={{ fontSize: "0.7rem", color: "var(--accent)", background: "var(--accent-glow)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "999px", padding: "0.1rem 0.45rem", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                      🔒 {c.target_phone}
                    </span>
                  )}
                </div>
                {c.note && <p style={{ fontSize: "0.75rem", color: "var(--muted-2)", marginTop: "0.2rem" }}>{c.note}</p>}
              </div>

              {/* Plan */}
              <div><PlanBadge plan={c.plan} /></div>

              {/* Duration */}
              <span style={{ fontSize: "0.8375rem", color: "var(--muted)" }}>{c.duration_days}d · {c.billing_cycle}</span>

              {/* Status */}
              <div>
                {c.is_used ? (
                  <div>
                    <span style={{ padding: "0.2rem 0.6rem", background: "rgba(34,197,94,0.1)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.25)", borderRadius: "999px", fontSize: "0.7rem", fontWeight: 700 }}>USED</span>
                    {c.used_by_name && <p style={{ fontSize: "0.7rem", color: "var(--muted-2)", marginTop: "0.2rem" }}>{c.used_by_name}</p>}
                  </div>
                ) : (
                  <span style={{ padding: "0.2rem 0.6rem", background: "rgba(245,158,11,0.1)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "999px", fontSize: "0.7rem", fontWeight: 700 }}>AVAILABLE</span>
                )}
              </div>

              {/* Actions (WhatsApp & Revoke) */}
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", alignItems: "center" }}>
                {!c.is_used && c.target_phone && (
                  <SendWhatsApp phone={c.target_phone} code={c.code} plan={c.plan} days={c.duration_days} />
                )}
                {!c.is_used && (
                  <button onClick={() => handleRevoke(c.code)}
                    style={{ padding: "0.35rem 0.5rem", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "0.5rem", color: "#f87171", cursor: "pointer", display: "flex", alignItems: "center", transition: "background 0.15s", height: "100%" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
                    title="Revoke Code"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>



      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>

      {/* Create Modal — rendered outside animated div to avoid transform stacking context */}
      {showCreate && (
        <div className="animate-fade-in" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "10vh", overflowY: "auto" }}>
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: "1.25rem", padding: "2rem", maxWidth: "480px", width: "100%", boxShadow: "0 24px 60px rgba(0,0,0,0.5)", marginBottom: "4rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "1.5rem" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--accent-glow)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
                <KeyRound size={17} />
              </div>
              <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--text)" }}>Generate Activation Code</h3>
            </div>

            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Plan + Cycle row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}>Plan</label>
                  <select value={newPlan} onChange={(e) => { setNewPlan(e.target.value); }} style={selectStyle}
                    onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--border-2)")}>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="free">Free</option>
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}>Billing Cycle</label>
                  <select value={newCycle} onChange={(e) => {
                    setNewCycle(e.target.value);
                    setNewDays(e.target.value === "monthly" ? 30 : e.target.value === "quarterly" ? 90 : 365);
                  }} style={selectStyle}
                    onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--border-2)")}>
                    <option value="monthly">Monthly (30d)</option>
                    <option value="quarterly">Quarterly (90d)</option>
                    <option value="annual">Annual (365d)</option>
                  </select>
                </div>
              </div>

              {/* Duration override */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}>Duration (days)</label>
                <input type="number" value={newDays} onChange={(e) => setNewDays(Number(e.target.value))} min={1} style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border-2)")} />
              </div>

              {/* Target phone */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}>
                  Lock to Phone <span style={{ color: "var(--accent)", fontSize: "0.75rem", fontWeight: 500 }}>🔒 Recommended</span>
                </label>
                <input type="text" placeholder="+94771234567 — leave empty for any tenant" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border-2)")} />
                <p style={{ fontSize: "0.75rem", color: "var(--muted-2)" }}>When set, only the business registered with this number can redeem the code.</p>
              </div>

              {/* Note */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}>Admin Note</label>
                <input type="text" placeholder="e.g., Ahmed paid LKR 4500 via ComBank on 30 Mar" value={newNote} onChange={(e) => setNewNote(e.target.value)} style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border-2)")} />
              </div>

              {createError && (
                <div style={{ padding: "0.75rem 1rem", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "0.625rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <AlertTriangle size={14} color="#f87171" />
                  <span style={{ fontSize: "0.875rem", color: "#f87171" }}>{createError}</span>
                </div>
              )}

              <div style={{ display: "flex", gap: "0.625rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                <button type="button" onClick={() => { setShowCreate(false); setCreateError(""); }}
                  style={{ padding: "0.5rem 1.125rem", borderRadius: "0.625rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--text)", background: "transparent", border: "1px solid var(--border-2)", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                <button type="submit" disabled={creating}
                  style={{ padding: "0.5rem 1.25rem", borderRadius: "0.625rem", fontSize: "0.875rem", fontWeight: 700, color: "#fff", background: creating ? "var(--accent-dim)" : "linear-gradient(135deg, var(--accent), var(--accent-dim))", border: "none", cursor: creating ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: "0 4px 14px var(--accent-glow2)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  {creating ? <><RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Generating...</> : <><KeyRound size={13} /> Generate</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
