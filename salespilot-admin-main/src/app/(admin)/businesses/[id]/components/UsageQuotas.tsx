"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Edit2, Save, X, Settings2 } from "lucide-react";

export function UsageQuotas({ business, mutate }: { business: any, mutate: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Edit state
  const [aiLimit, setAiLimit] = useState(business.ai_message_limit);
  const [sysLimit, setSysLimit] = useState(business.system_message_limit);
  const [ruleLimit, setRuleLimit] = useState(business.rule_generation_limit);
  const [simLimit, setSimLimit] = useState(business.simulation_limit);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!reason) {
      setError("Reason is required for audit log.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.patch(`/system/businesses/${business.id}/quotas`, {
        ai_message_limit: Number(aiLimit),
        system_message_limit: Number(sysLimit),
        rule_generation_limit: Number(ruleLimit),
        simulation_limit: Number(simLimit),
        reason
      });
      mutate();
      setEditing(false);
      setReason("");
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Failed to update quotas");
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditing(false);
    setAiLimit(business.ai_message_limit);
    setSysLimit(business.system_message_limit);
    setRuleLimit(business.rule_generation_limit);
    setSimLimit(business.simulation_limit);
    setReason("");
    setError("");
  };

  const formatStorage = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const quotas = [
    { label: "AI Messages", used: business.ai_message_count, limit: business.ai_message_limit, stateVal: aiLimit, setState: setAiLimit, color: "bg-primary" },
    { label: "Inbound Messages", used: business.system_message_count, limit: business.system_message_limit, stateVal: sysLimit, setState: setSysLimit, color: "bg-blue-500" },
    { label: "Rule Generations", used: business.rule_generation_count, limit: business.rule_generation_limit, stateVal: ruleLimit, setState: setRuleLimit, color: "bg-emerald-500" },
    { label: "Simulations", used: business.simulation_count, limit: business.simulation_limit, stateVal: simLimit, setState: setSimLimit, color: "bg-amber-500" },
  ];

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-bold text-foreground">Usage & Quotas</h2>
          <span className="text-xs text-muted-foreground ml-2">({business.current_usage_month || "Current Month"})</span>
        </div>
        
        {!editing ? (
          <button 
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-secondary text-muted-foreground text-xs font-semibold hover:bg-secondary/80 hover:text-foreground transition-colors outline-none cursor-pointer"
          >
            <Edit2 className="w-3 h-3" /> Edit Limits
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button 
              onClick={cancelEdit}
              disabled={saving}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-secondary text-muted-foreground text-xs font-semibold hover:bg-secondary/80 hover:text-foreground transition-colors outline-none cursor-pointer disabled:opacity-50"
            >
              <X className="w-3 h-3" /> Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={saving || !reason}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity outline-none cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3 h-3" /> {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </div>

      {editing && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-2 animate-fade-up">
          <label className="text-xs font-bold text-amber-600 dark:text-amber-400 block mb-1">Audit Reason <span className="text-destructive">*</span></label>
          <input 
            type="text" 
            placeholder="Why are you overriding these limits?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground outline-none focus:border-amber-500 transition-colors"
          />
          {error && <p className="text-xs text-destructive mt-1 font-semibold">{error}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
        {quotas.map((q) => {
          const isUnlimited = q.limit === -1;
          const percentage = isUnlimited ? 0 : Math.min(100, Math.round((q.used / q.limit) * 100)) || 0;
          
          return (
            <div key={q.label} className="flex flex-col gap-1.5">
              <div className="flex justify-between items-end">
                <span className="text-xs font-semibold text-muted-foreground">{q.label}</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-bold text-foreground">{q.used}</span>
                  <span className="text-xs text-muted-foreground">/</span>
                  {editing ? (
                    <input 
                      type="number" 
                      value={q.stateVal}
                      onChange={(e) => q.setState(e.target.value)}
                      className="w-20 bg-secondary border border-border rounded-md px-2 py-0.5 text-xs font-bold text-foreground outline-none focus:border-primary text-right"
                    />
                  ) : (
                    <span className="text-xs font-bold text-muted-foreground">{isUnlimited ? "∞" : q.limit}</span>
                  )}
                </div>
              </div>
              {!editing && (
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${q.color} ${percentage > 90 ? '!bg-destructive' : ''} transition-all duration-500`} 
                    style={{ width: `${isUnlimited ? 0 : percentage}%` }} 
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Storage - Always read-only */}
        <div className="flex flex-col gap-1.5 col-span-1 md:col-span-2">
          <div className="flex justify-between items-end">
            <span className="text-xs font-semibold text-muted-foreground">Storage Used</span>
            <span className="text-sm font-bold text-foreground">{formatStorage(business.total_storage_used)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
