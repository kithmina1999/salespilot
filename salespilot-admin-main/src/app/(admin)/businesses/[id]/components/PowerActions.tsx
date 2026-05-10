"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { ShieldAlert, Save } from "lucide-react";

function getApiErrorMessage(err: any) {
  if (typeof err === "object" && err !== null && "response" in err) {
    const response = (err as any).response;
    if (response?.data?.error) return response.data.error;
  }
  return err instanceof Error ? err.message : "Request failed";
}

export function PowerActions({ business, id, mutate }: { business: any, id: string, mutate: () => void }) {
  const [plan, setPlan] = useState(business.plan || "free");
  const [cycle, setCycle] = useState(business.billing_cycle || "");
  const [expiry, setExpiry] = useState(business.plan_expires_at ? new Date(business.plan_expires_at).toISOString().split("T")[0] : "");
  const [reason, setReason] = useState("");
  const [confirmAction, setConfirmAction] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [suspendType, setSuspendType] = useState("manual");
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendConfirm, setSuspendConfirm] = useState("");
  const [suspending, setSuspending] = useState(false);
  const [suspendMessage, setSuspendMessage] = useState("");

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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
      setSuspendMessage(`Error: ${getApiErrorMessage(err)}`);
    } finally {
      setSuspending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Plan Override */}
      <div className="bg-card border border-destructive/20 rounded-2xl p-5 shadow-[0_0_15px_rgba(239,68,68,0.05)]">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="w-4 h-4 text-destructive" />
          <h3 className="text-sm font-bold text-destructive">Super Admin Override</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Force a plan change without payment. This action is logged to the audit trail.
        </p>

        <form onSubmit={handleOverride} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.8rem] font-bold text-muted-foreground">Force Plan</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors"
            >
              <option value="free">Free</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[0.8rem] font-bold text-muted-foreground">Billing Cycle</label>
            <select
              value={cycle}
              onChange={(e) => setCycle(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors"
            >
              <option value="">None (Free)</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[0.8rem] font-bold text-muted-foreground">
              Expiry Date <span className="text-muted-foreground/60 font-normal">(leave empty = infinite)</span>
            </label>
            <input
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[0.8rem] font-bold text-muted-foreground">
              Reason <span className="text-destructive">*</span>
            </label>
            <input
              required
              type="text"
              placeholder="e.g. Complimentary early adopter"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors"
            />
            <p className="text-[0.7rem] text-muted-foreground/80">Required for audit log. Be descriptive.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[0.8rem] font-bold text-muted-foreground">
              Confirm Override <span className="text-destructive">*</span>
            </label>
            <input
              required
              type="text"
              placeholder="Type FORCE PLAN to confirm"
              value={confirmAction}
              onChange={(e) => setConfirmAction(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-destructive transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !reason}
            className="w-full mt-2 py-2.5 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50 disabled:hover:bg-destructive/10 disabled:hover:text-destructive cursor-pointer outline-none"
          >
            <Save size={15} />
            {saving ? "Applying..." : "Apply Forced Override"}
          </button>

          {message && (
            <p className={`text-center text-xs font-bold mt-1 ${message.includes("Error") ? "text-destructive" : "text-emerald-500"}`}>
              {message}
            </p>
          )}
        </form>
      </div>

      {/* Suspend Account Block */}
      <div className="bg-card border border-destructive/20 rounded-2xl p-5 shadow-[0_0_15px_rgba(239,68,68,0.05)]">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="w-4 h-4 text-destructive" />
          <h3 className="text-sm font-bold text-destructive">
            {business.suspended_at ? "Unsuspend Business" : "Suspend Business"}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {business.suspended_at
            ? "Reactivate this account. Their bot and dashboard will be unlocked."
            : "Suspend this account. Their bot will stop answering, and their dashboard will go into read-only mode."}
        </p>

        <form onSubmit={business.suspended_at ? handleUnsuspend : handleSuspend} className="flex flex-col gap-3">
          {!business.suspended_at && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.8rem] font-bold text-muted-foreground">Suspension Type</label>
              <select
                value={suspendType}
                onChange={(e) => setSuspendType(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors"
              >
                <option value="billing">Billing/Payment Expired</option>
                <option value="abuse">Policy/Abuse Violation</option>
                <option value="manual">Manual Admin Decision</option>
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[0.8rem] font-bold text-muted-foreground">
              Reason <span className="text-destructive">*</span>
            </label>
            <input
              required
              type="text"
              placeholder={business.suspended_at ? "e.g. Paid via bank transfer" : "e.g. Overdue invoice"}
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[0.8rem] font-bold text-muted-foreground">
              Confirm Action <span className="text-destructive">*</span>
            </label>
            <input
              required
              type="text"
              placeholder={`Type ${business.suspended_at ? "UNSUSPEND" : "SUSPEND"} to confirm`}
              value={suspendConfirm}
              onChange={(e) => setSuspendConfirm(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-destructive transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={suspending || !suspendReason || !suspendConfirm}
            className="w-full mt-2 py-2.5 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50 disabled:hover:bg-destructive/10 disabled:hover:text-destructive cursor-pointer outline-none"
          >
            <ShieldAlert size={15} />
            {suspending ? "Applying..." : (business.suspended_at ? "Unsuspend Business" : "Suspend Business")}
          </button>

          {suspendMessage && (
            <p className={`text-center text-xs font-bold mt-1 ${suspendMessage.includes("Error") ? "text-destructive" : "text-emerald-500"}`}>
              {suspendMessage}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
