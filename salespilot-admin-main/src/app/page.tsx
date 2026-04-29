"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Shield, Loader2, Eye, EyeOff, Zap } from "lucide-react";

export default function LoginPage() {
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    if (sessionStorage.getItem("master_key")) {
      router.push("/dashboard");
    }
  }, [router]);

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!key.trim()) {
      setError("Admin key is required.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      sessionStorage.setItem("master_key", key.trim());
      router.push("/dashboard");
    }, 600);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background glow blobs */}
      <div
        style={{
          position: "absolute",
          top: "-10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "700px",
          height: "700px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-20%",
          right: "-10%",
          width: "500px",
          height: "500px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Login Card */}
      <div
        className={mounted ? "animate-fade-up" : ""}
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "var(--surface)",
          border: "1px solid var(--border-2)",
          borderRadius: "1.5rem",
          padding: "2.5rem",
          boxShadow: "0 0 0 1px rgba(99,102,241,0.08), 0 32px 80px rgba(0,0,0,0.6), 0 0 60px rgba(99,102,241,0.06)",
          backdropFilter: "blur(20px)",
          position: "relative",
        }}
      >
        {/* Accent top line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "20%",
            right: "20%",
            height: "2px",
            background: "linear-gradient(90deg, transparent, var(--accent), transparent)",
            borderRadius: "2px",
          }}
        />

        {/* Logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "2rem" }}>
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, var(--accent-dim), var(--accent))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1rem",
              boxShadow: "0 8px 24px var(--accent-glow2)",
            }}
          >
            <Shield size={24} color="#fff" strokeWidth={2} />
          </div>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em", marginBottom: "0.25rem" }}>
            SalesPilot Admin
          </h1>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", textAlign: "center" }}>
            Super admin access only. Enter your master key to continue.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <label
              htmlFor="admin-key"
              style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}
            >
              Admin Master Key
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="admin-key"
                type={showKey ? "text" : "password"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="sk-admin-••••••••••••••••"
                autoComplete="off"
                style={{
                  width: "100%",
                  padding: "0.6875rem 2.75rem 0.6875rem 0.875rem",
                  background: "var(--bg)",
                  border: `1px solid ${error ? "var(--danger)" : "var(--border-2)"}`,
                  borderRadius: "0.625rem",
                  color: "var(--text)",
                  fontSize: "0.875rem",
                  outline: "none",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  fontFamily: "inherit",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--accent)";
                  e.target.style.boxShadow = "0 0 0 3px var(--accent-glow)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = error ? "var(--danger)" : "var(--border-2)";
                  e.target.style.boxShadow = "none";
                }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "var(--muted)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  padding: "0",
                }}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && (
              <p style={{ fontSize: "0.75rem", color: "var(--danger)", marginTop: "0.125rem" }}>{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.75rem",
              background: loading ? "var(--accent-dim)" : "linear-gradient(135deg, var(--accent), var(--accent-dim))",
              border: "none",
              borderRadius: "0.625rem",
              color: "#fff",
              fontSize: "0.9rem",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              transition: "opacity 0.15s, box-shadow 0.15s",
              boxShadow: loading ? "none" : "0 4px 20px var(--accent-glow2)",
              fontFamily: "inherit",
              letterSpacing: "-0.01em",
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.opacity = "0.9"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            {loading ? (
              <>
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                Authenticating...
              </>
            ) : (
              <>
                <Zap size={16} />
                Authenticate
              </>
            )}
          </button>
        </form>

        {/* Footer note */}
        <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--muted-2)", marginTop: "1.5rem", lineHeight: 1.5 }}>
          This panel is restricted to super administrators only.
          <br />
          Unauthorized access attempts are logged.
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
