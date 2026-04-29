"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import {
  ArrowLeft, Save, ShieldAlert, Activity, MessageSquare, Bot,
  Calendar, Phone, Hash,
} from "lucide-react";

function PlanBadge({ plan }: { plan: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    pro:     { bg: "rgba(99,102,241,0.1)",  color: "#818cf8", border: "rgba(99,102,241,0.3)" },
    starter: { bg: "rgba(34,197,94,0.1)",   color: "#4ade80", border: "rgba(34,197,94,0.3)" },
    growth:  { bg: "rgba(34,197,94,0.1)",   color: "#4ade80", border: "rgba(34,197,94,0.3)" },
    free:    { bg: "rgba(100,116,139,0.1)", color: "#94a3b8", border: "rgba(100,116,139,0.25)" },
  };
  const s = styles[plan?.toLowerCase()] ?? styles.free;
  return (
    <span style={{ padding: "0.2rem 0.6rem", background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: "999px", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
      {plan}
    </span>
  );
}

type TabKey = "usage" | "override";

export default function BusinessDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [b, setB] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("usage");

  const [plan, setPlan]     = useState("");
  const [cycle, setCycle]   = useState("");
  const [expiry, setExpiry] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchApi(`/system/businesses/${id}`)
      .then((data) => {
        setB(data.business);
        setPlan(data.business.plan || "free");
        setCycle(data.business.billing_cycle || "");
        setExpiry(
          data.business.plan_expires_at
            ? new Date(data.business.plan_expires_at).toISOString().split("T")[0]
            : ""
        );
        setLoading(false);
      })
      .catch(console.error);
  }, [id]);

  const handleOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await fetchApi(`/system/businesses/${id}/plan`, {
        method: "PATCH",
        body: JSON.stringify({
          plan,
          billing_cycle: cycle,
          plan_expires_at: expiry ? new Date(expiry).toISOString() : null,
          reason,
        }),
      });
      setMessage("Plan overridden successfully!");
      setB(res.business);
      setReason("");
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.625rem 0.875rem",
    background: "var(--bg)",
    border: "1px solid var(--border-2)",
    borderRadius: "0.625rem",
    color: "var(--text)",
    fontSize: "0.875rem",
    outline: "none",
    fontFamily: "inherit",
    transition: "border-color 0.15s",
  };

  const inputStyle: React.CSSProperties = {
    ...selectStyle,
  };

  if (loading || !b) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div style={{ height: "40px", width: "300px", background: "var(--surface)", borderRadius: "0.5rem", animation: "pulse 1.5s ease-in-out infinite" }} />
        <div style={{ height: "120px", background: "var(--surface)", borderRadius: "1rem", animation: "pulse 1.5s ease-in-out infinite" }} />
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }} className="animate-fade-up">
      {/* Back + Title */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <button
          onClick={() => router.push("/businesses")}
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: "var(--surface)",
            border: "1px solid var(--border-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--muted)",
            cursor: "pointer",
            transition: "all 0.15s",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; e.currentTarget.style.borderColor = "var(--accent)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; e.currentTarget.style.borderColor = "var(--border-2)"; }}
        >
          <ArrowLeft size={16} />
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" }}>
            <h1 style={{ fontSize: "1.625rem", fontWeight: 900, color: "var(--text)", letterSpacing: "-0.03em" }}>
              {b.name}
            </h1>
            <PlanBadge plan={b.plan} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.375rem", flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
              <Phone size={12} /> {b.phone}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
              <Hash size={12} /> ID: {b.id}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
              <Calendar size={12} /> Joined {new Date(b.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.25rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "0.875rem", padding: "0.375rem" }}>
        {(["usage", "override"] as TabKey[]).map((tab) => {
          const active = activeTab === tab;
          const labels: Record<TabKey, string> = { usage: "Usage Stats", override: "⚡ Power Actions" };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: "0.5625rem 1rem",
                borderRadius: "0.625rem",
                fontSize: "0.875rem",
                fontWeight: active ? 700 : 500,
                color: active ? (tab === "override" ? "#f87171" : "var(--accent)") : "var(--muted)",
                background: active
                  ? tab === "override" ? "rgba(239,68,68,0.08)" : "var(--accent-glow)"
                  : "transparent",
                border: active
                  ? `1px solid ${tab === "override" ? "rgba(239,68,68,0.2)" : "rgba(99,102,241,0.2)"}`
                  : "1px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s",
                fontFamily: "inherit",
              }}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* Usage Tab */}
      {activeTab === "usage" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
          {[
            { icon: <MessageSquare size={16} />, label: "Inbound Messages", value: b.system_message_count, accent: "#3b82f6" },
            { icon: <Activity size={16} />,      label: "FAQ Replies",       value: b.faq_reply_count,     accent: "#22c55e" },
            { icon: <Bot size={16} />,            label: "AI Messages",       value: b.ai_message_count,    accent: "#8b5cf6", sub: `/ ${b.ai_message_limit} limit` },
          ].map((card) => (
            <div
              key={card.label}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "1rem",
                padding: "1.375rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}>{card.label}</span>
                <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: `${card.accent}18`, display: "flex", alignItems: "center", justifyContent: "center", color: card.accent }}>
                  {card.icon}
                </div>
              </div>
              <div>
                <p style={{ fontSize: "2rem", fontWeight: 900, color: "var(--text)", letterSpacing: "-0.03em", lineHeight: 1 }}>{card.value ?? "—"}</p>
                {card.sub && <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>{card.sub}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Override Tab */}
      {activeTab === "override" && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid rgba(239,68,68,0.15)",
            borderRadius: "1rem",
            padding: "1.75rem",
            maxWidth: "520px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.375rem" }}>
            <ShieldAlert size={18} color="#f87171" />
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#f87171" }}>Super Admin Override</h3>
          </div>
          <p style={{ fontSize: "0.8375rem", color: "var(--muted)", marginBottom: "1.5rem" }}>
            Force a plan change without payment. This action is logged to the audit trail.
          </p>

          <form onSubmit={handleOverride} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Plan */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}>Force Plan</label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                style={selectStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-2)")}
              >
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
              </select>
            </div>

            {/* Billing Cycle */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}>Billing Cycle</label>
              <select
                value={cycle}
                onChange={(e) => setCycle(e.target.value)}
                style={selectStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-2)")}
              >
                <option value="">None (Free)</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>

            {/* Expiry */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}>
                Expiry Date <span style={{ color: "var(--muted-2)", fontWeight: 400 }}>(leave empty = infinite)</span>
              </label>
              <input
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-2)")}
              />
            </div>

            {/* Reason */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}>
                Reason <span style={{ color: "#f87171", fontWeight: 700 }}>*</span>
              </label>
              <input
                required
                type="text"
                placeholder="e.g. Complimentary early adopter — 3 months"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-2)")}
              />
              <p style={{ fontSize: "0.75rem", color: "var(--muted-2)" }}>Required for audit log. Be descriptive.</p>
            </div>

            <button
              type="submit"
              disabled={saving || !reason}
              style={{
                width: "100%",
                padding: "0.75rem",
                background: saving || !reason ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: "0.625rem",
                color: saving || !reason ? "#9ca3af" : "#f87171",
                fontSize: "0.9rem",
                fontWeight: 700,
                cursor: saving || !reason ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                fontFamily: "inherit",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!saving && reason) {
                  e.currentTarget.style.background = "rgba(239,68,68,0.25)";
                  e.currentTarget.style.color = "#fff";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(239,68,68,0.15)";
                e.currentTarget.style.color = "#f87171";
              }}
            >
              <Save size={15} />
              {saving ? "Applying..." : "Apply Forced Override"}
            </button>

            {message && (
              <p
                style={{
                  textAlign: "center",
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  color: message.includes("Error") ? "var(--danger)" : "#4ade80",
                }}
              >
                {message}
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
