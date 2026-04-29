"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchApi } from "@/lib/api";
import {
  Banknote, Clock, CheckCircle, XCircle, Search,
  RefreshCw, ZoomIn, X, AlertTriangle, ChevronDown,
  ImageIcon, Loader2,
} from "lucide-react";

type ProofStatus = "pending" | "approved" | "rejected";

type PaymentProof = {
  id: number;
  business_id: number;
  business_name: string;
  business_phone: string;
  business_email: string;
  billing_cycle: string;
  amount: number;
  screenshot_url: string;
  status: ProofStatus;
  activation_code: string;
  admin_note: string;
  submitted_at: string;
  reviewed_at: string | null;
  created_at: string;
};

const STATUS_STYLES: Record<ProofStatus, { bg: string; color: string; border: string; label: string }> = {
  pending:  { bg: "rgba(245,158,11,0.12)", color: "#fbbf24", border: "rgba(245,158,11,0.3)", label: "⏳ Pending" },
  approved: { bg: "rgba(34,197,94,0.10)",  color: "#4ade80", border: "rgba(34,197,94,0.3)",  label: "✅ Approved" },
  rejected: { bg: "rgba(239,68,68,0.10)",  color: "#f87171", border: "rgba(239,68,68,0.3)",  label: "❌ Rejected" },
};

const CYCLE_LABEL: Record<string, string> = {
  monthly: "Monthly", quarterly: "Quarterly", annual: "Annual",
};

function formatLKR(n: number) { return `LKR ${n.toLocaleString("en-LK")}`; }
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function PaymentsPage() {
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [filtered, setFiltered] = useState<PaymentProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProofStatus | "all">("all");
  const [pendingCount, setPendingCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);

  // Lightbox state
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Approve modal state
  const [approving, setApproving] = useState<PaymentProof | null>(null);
  const [approveLoading, setApproveLoading] = useState(false);

  // Reject modal state
  const [rejecting, setRejecting] = useState<PaymentProof | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);

  const loadProofs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchApi<any>("/system/payments");
      setProofs(data.proofs || []);
      setPendingCount(data.pending_count ?? 0);
      setApprovedCount(data.approved_count ?? 0);
    } catch (err) {
      console.error("Failed to load payments:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProofs(); }, [loadProofs]);

  // Filter logic
  useEffect(() => {
    let result = proofs;
    if (statusFilter !== "all") result = result.filter(p => p.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.business_name.toLowerCase().includes(q) ||
        p.business_phone.includes(q) ||
        p.business_email.toLowerCase().includes(q) ||
        p.billing_cycle.includes(q)
      );
    }
    setFiltered(result);
  }, [proofs, statusFilter, search]);

  async function handleApprove(proof: PaymentProof) {
    setApproveLoading(true);
    try {
      await fetchApi(`/system/payments/${proof.id}/approve`, { method: "POST" });
      setApproving(null);
      await loadProofs();
    } catch (err: any) {
      alert("Failed to approve: " + err.message);
    } finally {
      setApproveLoading(false);
    }
  }

  async function handleReject() {
    if (!rejecting || !rejectReason.trim()) return;
    setRejectLoading(true);
    try {
      await fetchApi(`/system/payments/${rejecting.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      setRejecting(null);
      setRejectReason("");
      await loadProofs();
    } catch (err: any) {
      alert("Failed to reject: " + err.message);
    } finally {
      setRejectLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: "0.5625rem 0.875rem",
    background: "var(--bg)",
    border: "1px solid var(--border-2)",
    borderRadius: "0.625rem",
    color: "var(--text)",
    fontSize: "0.875rem",
    outline: "none",
    fontFamily: "inherit",
    width: "100%",
  };

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }} className="animate-fade-up">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 900, color: "var(--text)", letterSpacing: "-0.03em" }}>
              Payment Verification
            </h1>
            <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginTop: "0.25rem" }}>
              Review bank transfer screenshots and issue activation codes
            </p>
          </div>
          <button onClick={loadProofs} style={{ padding: "0.5rem", background: "var(--surface)", border: "1px solid var(--border-2)", borderRadius: "0.625rem", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <RefreshCw size={15} />
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
          {[
            { icon: <Clock size={16} />,       label: "Pending Review", value: pendingCount,  accent: "#f59e0b" },
            { icon: <CheckCircle size={16} />, label: "Approved Total", value: approvedCount, accent: "#22c55e" },
            { icon: <Banknote size={16} />,    label: "All Submissions",value: proofs.length, accent: "#6366f1" },
          ].map(s => (
            <div key={s.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "1rem", padding: "1.125rem 1.375rem", display: "flex", alignItems: "center", gap: "0.875rem" }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${s.accent}18`, display: "flex", alignItems: "center", justifyContent: "center", color: s.accent, flexShrink: 0 }}>{s.icon}</div>
              <div>
                <p style={{ fontSize: "1.75rem", fontWeight: 900, color: "var(--text)", letterSpacing: "-0.03em", lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.2rem" }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          {/* Status tabs */}
          <div style={{ display: "flex", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "0.25rem", gap: "0.25rem" }}>
            {(["all", "pending", "approved", "rejected"] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: "0.375rem 0.875rem",
                  borderRadius: "0.5rem",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  background: statusFilter === s ? "var(--accent)" : "transparent",
                  color: statusFilter === s ? "#fff" : "var(--muted)",
                  transition: "all 0.15s",
                  textTransform: "capitalize",
                }}
              >
                {s === "all" ? "All" : s}{s === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
            <input
              type="text" placeholder="Search by name, phone, email..." value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: "2.25rem" }}
            />
          </div>
        </div>

        {/* Table */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "1rem", overflow: "hidden" }}>
          {/* Headers */}
          <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1.5fr 1.2fr 100px 1fr 180px", padding: "0.75rem 1.25rem", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--border)" }}>
            {["Business", "Cycle / Amount", "Submitted", "Screenshot", "Status", "Actions"].map(h => (
              <span key={h} style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", textAlign: h === "Actions" ? "right" : "left" }}>{h}</span>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center" }}>
              <Loader2 size={24} style={{ color: "var(--muted)", animation: "spin 1s linear infinite", margin: "0 auto" }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "3.5rem", textAlign: "center" }}>
              <Banknote size={28} style={{ color: "var(--muted)", margin: "0 auto 0.75rem" }} />
              <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>No payment submissions {statusFilter !== "all" ? `with status "${statusFilter}"` : "yet"}.</p>
            </div>
          ) : (
            filtered.map((proof, idx) => {
              const s = STATUS_STYLES[proof.status];
              return (
                <div
                  key={proof.id}
                  style={{ display: "grid", gridTemplateColumns: "2.5fr 1.5fr 1.2fr 100px 1fr 180px", padding: "1rem 1.25rem", borderBottom: idx < filtered.length - 1 ? "1px solid var(--border)" : "none", alignItems: "center", transition: "background 0.12s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  {/* Business */}
                  <div>
                    <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text)" }}>{proof.business_name}</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.15rem", fontFamily: "monospace" }}>{proof.business_phone}</p>
                    <p style={{ fontSize: "0.7rem", color: "var(--muted-2)", marginTop: "0.1rem" }}>{proof.business_email}</p>
                  </div>

                  {/* Cycle */}
                  <div>
                    <p style={{ fontSize: "0.8375rem", fontWeight: 700, color: "var(--text)" }}>{formatLKR(proof.amount)}</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.1rem" }}>{CYCLE_LABEL[proof.billing_cycle] ?? proof.billing_cycle}</p>
                  </div>

                  {/* Submitted */}
                  <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{fmtDate(proof.created_at)}</p>

                  {/* Screenshot thumbnail */}
                  <div>
                    {proof.screenshot_url ? (
                      <button
                        onClick={() => setLightboxUrl(proof.screenshot_url)}
                        style={{ background: "none", border: "1px solid var(--border-2)", borderRadius: "0.5rem", padding: "2px", cursor: "pointer", display: "flex", overflow: "hidden", position: "relative", width: 60, height: 44 }}
                        title="Click to view full screenshot"
                      >
                        <img src={proof.screenshot_url} alt="Receipt" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "0.375rem" }} />
                        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.15s" }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                          onMouseLeave={e => (e.currentTarget.style.opacity = "0")}
                        >
                          <ZoomIn size={14} color="#fff" />
                        </div>
                      </button>
                    ) : (
                      <div style={{ width: 60, height: 44, background: "var(--surface-2)", borderRadius: "0.5rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <ImageIcon size={14} style={{ color: "var(--muted)" }} />
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <span style={{ padding: "0.2rem 0.6rem", background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: "999px", fontSize: "0.7rem", fontWeight: 700 }}>{s.label}</span>
                    {proof.status === "approved" && proof.activation_code && (
                      <p style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.2rem", fontFamily: "monospace" }}>{proof.activation_code}</p>
                    )}
                    {proof.status === "rejected" && proof.admin_note && (
                      <p style={{ fontSize: "0.7rem", color: "#f87171", marginTop: "0.2rem", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={proof.admin_note}>{proof.admin_note}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                    {proof.status === "pending" && (
                      <>
                        <button
                          onClick={() => setApproving(proof)}
                          style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.35rem 0.75rem", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: "0.5rem", color: "#4ade80", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                        >
                          <CheckCircle size={12} /> Approve
                        </button>
                        <button
                          onClick={() => setRejecting(proof)}
                          style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.35rem 0.625rem", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "0.5rem", color: "#f87171", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                        >
                          <XCircle size={12} /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Lightbox ──────────────────────────────────────────────── */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}
          className="animate-fade-in"
        >
          <button
            onClick={() => setLightboxUrl(null)}
            style={{ position: "absolute", top: "1.5rem", right: "1.5rem", background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "0.75rem", padding: "0.5rem", cursor: "pointer", color: "#fff", display: "flex", alignItems: "center" }}
          >
            <X size={20} />
          </button>
          <img
            src={lightboxUrl} alt="Payment screenshot"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: "1rem", boxShadow: "0 40px 80px rgba(0,0,0,0.8)" }}
          />
        </div>
      )}

      {/* ── Approve Confirmation Modal ─────────────────────────────── */}
      {approving && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} className="animate-fade-in">
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: "1.25rem", padding: "2rem", maxWidth: 420, width: "100%", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(34,197,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle size={20} color="#4ade80" />
              </div>
              <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--text)" }}>Approve Payment</h3>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: "0.5rem", lineHeight: 1.6 }}>
              Approve payment from <strong style={{ color: "var(--text)" }}>{approving.business_name}</strong>?
            </p>
            <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
              The system will generate a <strong style={{ color: "#4ade80" }}>BSS-STR-XXXX</strong> code and email it to{" "}
              <strong style={{ color: "var(--text)" }}>{approving.business_email}</strong>.
            </p>
            <div style={{ display: "flex", gap: "0.625rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => setApproving(null)}
                style={{ padding: "0.5rem 1.125rem", borderRadius: "0.625rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--text)", background: "transparent", border: "1px solid var(--border-2)", cursor: "pointer", fontFamily: "inherit" }}
              >Cancel</button>
              <button
                onClick={() => handleApprove(approving)}
                disabled={approveLoading}
                style={{ padding: "0.5rem 1.25rem", borderRadius: "0.625rem", fontSize: "0.875rem", fontWeight: 700, color: "#000", background: "#22c55e", border: "none", cursor: approveLoading ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "0.4rem", opacity: approveLoading ? 0.7 : 1 }}
              >
                {approveLoading ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Approving...</> : <><CheckCircle size={13} /> Approve & Send Code</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ──────────────────────────────────────────── */}
      {rejecting && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} className="animate-fade-in">
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: "1.25rem", padding: "2rem", maxWidth: 420, width: "100%", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <XCircle size={20} color="#ef4444" />
              </div>
              <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--text)" }}>Reject Payment</h3>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: "1rem", lineHeight: 1.6 }}>
              Reject payment from <strong style={{ color: "var(--text)" }}>{rejecting.business_name}</strong>. This reason will be shown to the tenant so they can resubmit.
            </p>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.375rem" }}>
                Rejection Reason <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder='e.g., "Screenshot is blurry, please upload a clearer photo" or "Amount transferred does not match"'
                rows={3}
                style={{ ...{ padding: "0.5625rem 0.875rem", background: "var(--bg)", border: "1px solid var(--border-2)", borderRadius: "0.625rem", color: "var(--text)", fontSize: "0.875rem", outline: "none", fontFamily: "inherit", width: "100%", resize: "vertical", lineHeight: 1.5 } }}
                onFocus={e => (e.target.style.borderColor = "var(--accent)")}
                onBlur={e => (e.target.style.borderColor = "var(--border-2)")}
              />
            </div>
            <div style={{ display: "flex", gap: "0.625rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => { setRejecting(null); setRejectReason(""); }}
                style={{ padding: "0.5rem 1.125rem", borderRadius: "0.625rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--text)", background: "transparent", border: "1px solid var(--border-2)", cursor: "pointer", fontFamily: "inherit" }}
              >Cancel</button>
              <button
                onClick={handleReject}
                disabled={rejectLoading || !rejectReason.trim()}
                style={{ padding: "0.5rem 1.25rem", borderRadius: "0.625rem", fontSize: "0.875rem", fontWeight: 700, color: "#fff", background: "#ef4444", border: "none", cursor: (rejectLoading || !rejectReason.trim()) ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "0.4rem", opacity: (rejectLoading || !rejectReason.trim()) ? 0.6 : 1 }}
              >
                {rejectLoading ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Rejecting...</> : <><XCircle size={13} /> Reject Payment</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
