"use client";

import { useState } from "react";
import { Settings2, Save, AlertTriangle, Bot, Zap, Server, Shield, Globe, RefreshCw } from "lucide-react";

type SettingGroup = {
  icon: React.ReactNode;
  title: string;
  description: string;
  fields: { key: string; label: string; value: string | number | boolean; type: "text" | "number" | "toggle" | "select"; options?: string[] }[];
};

const SETTING_GROUPS: SettingGroup[] = [
  {
    icon: <Bot size={17} />,
    title: "AI & Gemini Limits",
    description: "Control global AI usage caps across all tenants",
    fields: [
      { key: "free_ai_limit",    label: "Free Plan AI Messages/Month",    value: 50,   type: "number" },
      { key: "starter_ai_limit", label: "Starter Plan AI Messages/Month", value: 200,  type: "number" },
      { key: "pro_ai_limit",     label: "Pro Plan AI Messages/Month",     value: 1000, type: "number" },
    ],
  },
  {
    icon: <Zap size={17} />,
    title: "Trial & Onboarding",
    description: "Default trial settings for new signups",
    fields: [
      { key: "trial_days",         label: "Default Trial Days",         value: 14,    type: "number" },
      { key: "trial_plan",         label: "Trial Plan",                 value: "starter", type: "select", options: ["free", "starter", "pro"] },
      { key: "auto_downgrade",     label: "Auto-downgrade after trial", value: true,  type: "toggle" },
    ],
  },
  {
    icon: <Server size={17} />,
    title: "Platform Maintenance",
    description: "System-wide toggles and maintenance mode",
    fields: [
      { key: "maintenance_mode",   label: "Maintenance Mode",           value: false, type: "toggle" },
      { key: "new_signups_enabled",label: "Allow New Signups",          value: true,  type: "toggle" },
      { key: "max_plan",           label: "Maximum Available Plan",     value: "pro", type: "select", options: ["free", "starter", "pro"] },
    ],
  },
  {
    icon: <Globe size={17} />,
    title: "Platform Identity",
    description: "Branding and global meta settings",
    fields: [
      { key: "platform_name",  label: "Platform Name",        value: "SalesPilot",         type: "text" },
      { key: "support_email",  label: "Support Email",        value: "admin@salespilot.ai", type: "text" },
      { key: "webhook_secret", label: "Webhook Secret (Hash)",value: "wh_••••••••••••••",   type: "text" },
    ],
  },
];

export default function PlatformSettingsPage() {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.5625rem 0.875rem",
    background: "var(--bg)",
    border: "1px solid var(--border-2)",
    borderRadius: "0.625rem",
    color: "var(--text)",
    fontSize: "0.875rem",
    outline: "none",
    fontFamily: "inherit",
    transition: "border-color 0.15s",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }} className="animate-fade-up">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.25rem" }}>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 900, color: "var(--text)", letterSpacing: "-0.03em" }}>Platform Settings</h1>
            <span style={{ padding: "0.2rem 0.625rem", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "999px", fontSize: "0.7rem", fontWeight: 700, color: "#fbbf24" }}>PLACEHOLDER</span>
          </div>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Global platform configuration — changes affect all tenants</p>
        </div>

        <button
          onClick={handleSave}
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            padding: "0.6rem 1.25rem",
            background: saved ? "rgba(34,197,94,0.15)" : "linear-gradient(135deg, var(--accent), var(--accent-dim))",
            border: saved ? "1px solid rgba(34,197,94,0.3)" : "none",
            borderRadius: "0.625rem",
            color: saved ? "#4ade80" : "#fff",
            fontSize: "0.875rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            boxShadow: saved ? "none" : "0 4px 14px var(--accent-glow2)",
            transition: "all 0.3s",
          }}
        >
          {saved ? <><RefreshCw size={15} /> Saved!</> : <><Save size={15} /> Save Changes</>}
        </button>
      </div>

      {/* Warning */}
      <div style={{ padding: "1rem 1.375rem", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "0.875rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <AlertTriangle size={18} color="#f87171" style={{ flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#f87171" }}>Platform-Wide Impact</p>
          <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.125rem" }}>Changes to these settings apply globally to all tenant accounts. Changes are logged in the audit trail.</p>
        </div>
      </div>

      {/* Setting Groups */}
      {SETTING_GROUPS.map((group) => (
        <div key={group.title} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "1rem", overflow: "hidden" }}>
          {/* Group Header */}
          <div style={{ padding: "1.125rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--accent-glow)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
              {group.icon}
            </div>
            <div>
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text)" }}>{group.title}</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.125rem" }}>{group.description}</p>
            </div>
          </div>

          {/* Fields */}
          <div style={{ padding: "1.375rem 1.5rem", display: "flex", flexDirection: "column", gap: "1.125rem" }}>
            {group.fields.map((field) => (
              <div key={field.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.5rem", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: "180px" }}>
                  <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)" }}>{field.label}</p>
                  <p style={{ fontSize: "0.75rem", color: "var(--muted-2)", fontFamily: "monospace", marginTop: "0.125rem" }}>{field.key}</p>
                </div>

                {field.type === "toggle" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ fontSize: "0.8125rem", color: (field.value as boolean) ? "#4ade80" : "var(--muted)" }}>
                      {(field.value as boolean) ? "Enabled" : "Disabled"}
                    </span>
                    <div
                      style={{
                        width: "44px", height: "24px",
                        borderRadius: "999px",
                        background: (field.value as boolean) ? "var(--accent)" : "var(--border-2)",
                        cursor: "pointer",
                        position: "relative",
                        transition: "background 0.2s",
                      }}
                    >
                      <div style={{
                        position: "absolute",
                        top: "3px",
                        left: (field.value as boolean) ? "23px" : "3px",
                        width: "18px", height: "18px",
                        borderRadius: "50%",
                        background: "#fff",
                        transition: "left 0.2s",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                      }} />
                    </div>
                  </div>
                ) : field.type === "select" ? (
                  <select defaultValue={field.value as string}
                    style={{ ...inputStyle, width: "200px" }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--border-2)")}
                  >
                    {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    defaultValue={field.value as string | number}
                    style={{ ...inputStyle, width: "200px" }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--border-2)")}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Placeholder banner */}
      <div style={{ padding: "1.25rem 1.5rem", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: "0.875rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <Settings2 size={18} color="#fbbf24" style={{ flexShrink: 0 }} />
        <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
          Placeholder configuration. Wire to <code style={{ fontFamily: "monospace", background: "rgba(255,255,255,0.05)", padding: "0.1rem 0.3rem", borderRadius: "4px" }}>/system/settings</code> to persist values to the database.
        </p>
      </div>
    </div>
  );
}
