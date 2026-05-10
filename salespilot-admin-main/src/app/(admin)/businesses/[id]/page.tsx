"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { api } from "@/lib/api";
import {
  ArrowLeft, Save, ShieldAlert, Activity, MessageSquare, Bot,
  Calendar, Phone, Hash,
} from "lucide-react";

function PlanBadge({ plan }: { plan: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    pro:     { bg: "rgba(99,102,241,0.1)",  color: "var(--info)", border: "rgba(99,102,241,0.3)" },
    starter: { bg: "rgba(34,197,94,0.1)",   color: "var(--success)", border: "rgba(34,197,94,0.3)" },
    growth:  { bg: "rgba(34,197,94,0.1)",   color: "var(--success)", border: "rgba(34,197,94,0.3)" },
    free:    { bg: "var(--surface-2)", color: "var(--muted-foreground)", border: "var(--border)" },
  };
  const s = styles[plan?.toLowerCase()] ?? styles.free;
  return (
    <span style={{ padding: "0.2rem 0.6rem", background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: "999px", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
      {plan}
    </span>
  );
}

function getApiErrorMessage(err: unknown) {
  if (typeof err === "object" && err !== null && "response" in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response;
    if (response?.data?.error) return response.data.error;
  }
  return err instanceof Error ? err.message : "Request failed";
}

type TabKey = "usage" | "override";

export default function BusinessDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const { data, isLoading: loading, mutate } = useSWR(
    id ? `/system/businesses/${id}` : null,
    (url: string) => api.get(url).then((res) => res.data)
  );
  const b = data?.business;

  const [activeTab, setActiveTab] = useState<TabKey>("usage");

  const [plan, setPlan]     = useState("");
  const [cycle, setCycle]   = useState("");
  const [expiry, setExpiry] = useState("");
  const [reason, setReason] = useState("");
  const [confirmAction, setConfirmAction] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [suspendType, setSuspendType] = useState("manual");
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendConfirm, setSuspendConfirm] = useState("");
  const [suspending, setSuspending] = useState(false);
  const [suspendMessage, setSuspendMessage] = useState("");

  useEffect(() => {
    if (b) {
      setPlan(b.plan || "free");
      setCycle(b.billing_cycle || "");
      setExpiry(
        b.plan_expires_at
          ? new Date(b.plan_expires_at).toISOString().split("T")[0]
          : ""
      );
    }
  }, [b]);

  const handleOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await api.patch(`/system/businesses/${id}/plan`, {
        plan,
        billing_cycle: cycle,
        plan_expires_at: expiry ? new Date(expiry).toISOString() : null,
        reason,
        confirm: confirmAction,
      });
      setMessage("Plan overridden successfully!");
      mutate();
      setReason("");
      setConfirmAction("");
    } catch (err: unknown) {
      setMessage(`Error: ${getApiErrorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSuspend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuspending(true);
    setSuspendMessage("");
    try {
      await api.post(`/system/businesses/${id}/suspend`, {
        type: suspendType,
        reason: suspendReason,
        confirm: suspendConfirm,
      });
      setSuspendMessage("Business suspended successfully!");
      mutate();
      setSuspendReason("");
      setSuspendConfirm("");
    } catch (err: unknown) {
      setSuspendMessage(`Error: ${getApiErrorMessage(err)}`);
    } finally {
      setSuspending(false);
    }
  };

  const handleUnsuspend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuspending(true);
    setSuspendMessage("");
    try {
      await api.post(`/system/businesses/${id}/unsuspend`, {
        reason: suspendReason,
        confirm: suspendConfirm,
      });
      setSuspendMessage("Business unsuspended successfully!");
      mutate();
      setSuspendReason("");
      setSuspendConfirm("");
    } catch (err: unknown) {
      setSuspendMessage(`Error: ${getApiErrorMessage(err)}`);
    } finally {
      setSuspending(false);
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
            color: "var(--muted-foreground)",
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
            <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8125rem", color: "var(--muted-foreground)" }}>
              <Phone size={12} /> {b.phone}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8125rem", color: "var(--muted-foreground)" }}>
              <Hash size={12} /> ID: {b.id}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8125rem", color: "var(--muted-foreground)" }}>
              <Calendar size={12} /> Joined {new Date(b.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
        <button
          onClick={() => router.push(`/businesses/${b.id}/pipeline`)}
          style={{
            padding: "0.5rem 1rem",
            background: "var(--accent)",
            color: "var(--primary-foreground)",
            borderRadius: "0.625rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: "pointer",
            border: "none",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Activity size={16} />
          Pipeline Debugger
        </button>
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
                color: active ? (tab === "override" ? "var(--danger)" : "var(--accent)") : "var(--muted)",
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
            { icon: <MessageSquare size={16} />, label: "Inbound Messages", value: b.system_message_count, accent: "var(--info)" },
            { icon: <Activity size={16} />,      label: "FAQ Replies",       value: b.faq_reply_count,     accent: "var(--success)" },
            { icon: <Bot size={16} />,            label: "AI Messages",       value: b.ai_message_count,    accent: "var(--accent)", sub: `/ ${b.ai_message_limit} limit` },
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
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted-foreground)" }}>{card.label}</span>
                <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: `${card.accent}18`, display: "flex", alignItems: "center", justifyContent: "center", color: card.accent }}>
                  {card.icon}
                </div>
              </div>
              <div>
                <p style={{ fontSize: "2rem", fontWeight: 900, color: "var(--text)", letterSpacing: "-0.03em", lineHeight: 1 }}>{card.value ?? "—"}</p>
                {card.sub && <p style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", marginTop: "0.25rem" }}>{card.sub}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Override Tab */}
      {activeTab === "override" && (
        <>
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
            <ShieldAlert size={18} color="var(--danger)" />
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--danger)" }}>Super Admin Override</h3>
          </div>
          <p style={{ fontSize: "0.8375rem", color: "var(--muted-foreground)", marginBottom: "1.5rem" }}>
            Force a plan change without payment. This action is logged to the audit trail.
          </p>

          <form onSubmit={handleOverride} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Plan */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted-foreground)" }}>Force Plan</label>
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
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted-foreground)" }}>Billing Cycle</label>
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
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted-foreground)" }}>
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
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted-foreground)" }}>
                Reason <span style={{ color: "var(--danger)", fontWeight: 700 }}>*</span>
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
            {/* Confirm */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted-foreground)" }}>
                Confirm Override <span style={{ color: "var(--danger)", fontWeight: 700 }}>*</span>
              </label>
              <input
                required
                type="text"
                placeholder="Type FORCE PLAN to confirm"
                value={confirmAction}
                onChange={(e) => setConfirmAction(e.target.value)}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-2)")}
              />
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
                color: saving || !reason ? "var(--muted)" : "var(--danger)",
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
                  e.currentTarget.style.background = "var(--danger)";
                  e.currentTarget.style.color = "var(--primary-foreground)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(239,68,68,0.15)";
                e.currentTarget.style.color = "var(--danger)";
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

        {/* Suspend Account Block */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid rgba(239,68,68,0.15)",
            borderRadius: "1rem",
            padding: "1.75rem",
            maxWidth: "520px",
            marginTop: "1.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.375rem" }}>
            <ShieldAlert size={18} color="var(--danger)" />
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--danger)" }}>
              {b.suspended_at ? "Unsuspend Business" : "Suspend Business"}
            </h3>
          </div>
          <p style={{ fontSize: "0.8375rem", color: "var(--muted-foreground)", marginBottom: "1.5rem" }}>
            {b.suspended_at
              ? "Reactivate this account. Their bot and dashboard will be unlocked."
              : "Suspend this account. Their bot will stop answering, and their dashboard will go into read-only mode."}
          </p>

          <form onSubmit={b.suspended_at ? handleUnsuspend : handleSuspend} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Type */}
            {!b.suspended_at && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted-foreground)" }}>Suspension Type</label>
                <select
                  value={suspendType}
                  onChange={(e) => setSuspendType(e.target.value)}
                  style={selectStyle}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border-2)")}
                >
                  <option value="billing">Billing/Payment Expired</option>
                  <option value="abuse">Policy/Abuse Violation</option>
                  <option value="manual">Manual Admin Decision</option>
                </select>
              </div>
            )}

            {/* Reason */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted-foreground)" }}>
                Reason <span style={{ color: "var(--danger)", fontWeight: 700 }}>*</span>
              </label>
              <input
                required
                type="text"
                placeholder={b.suspended_at ? "e.g. Paid via bank transfer" : "e.g. Overdue invoice"}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-2)")}
              />
            </div>

            {/* Confirm */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted-foreground)" }}>
                Confirm Action <span style={{ color: "var(--danger)", fontWeight: 700 }}>*</span>
              </label>
              <input
                required
                type="text"
                placeholder={`Type ${b.suspended_at ? "UNSUSPEND" : "SUSPEND"} to confirm`}
                value={suspendConfirm}
                onChange={(e) => setSuspendConfirm(e.target.value)}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-2)")}
              />
            </div>

            <button
              type="submit"
              disabled={suspending || !suspendReason || !suspendConfirm}
              style={{
                width: "100%",
                padding: "0.75rem",
                background: suspending || !suspendReason || !suspendConfirm ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: "0.625rem",
                color: suspending || !suspendReason || !suspendConfirm ? "var(--muted)" : "var(--danger)",
                fontSize: "0.9rem",
                fontWeight: 700,
                cursor: suspending || !suspendReason || !suspendConfirm ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                fontFamily: "inherit",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!suspending && suspendReason && suspendConfirm) {
                  e.currentTarget.style.background = "var(--danger)";
                  e.currentTarget.style.color = "var(--primary-foreground)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(239,68,68,0.15)";
                e.currentTarget.style.color = "var(--danger)";
              }}
            >
              <ShieldAlert size={15} />
              {suspending ? "Applying..." : (b.suspended_at ? "Unsuspend Business" : "Suspend Business")}
            </button>

            {suspendMessage && (
              <p
                style={{
                  textAlign: "center",
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  color: suspendMessage.includes("Error") ? "var(--danger)" : "#4ade80",
                }}
              >
                {suspendMessage}
              </p>
            )}
          </form>
        </div>
      </>
      )}
    </div>
  );
}
