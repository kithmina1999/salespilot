"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchApi } from "@/lib/api";
import { Search, ChevronRight, Building2, ExternalLink } from "lucide-react";

type Business = {
  id: number;
  name: string;
  phone: string;
  plan: string;
  plan_expires_at: string | null;
  created_at: string;
};

function PlanBadge({ plan }: { plan: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    pro:     { bg: "rgba(99,102,241,0.1)",  color: "#818cf8", border: "rgba(99,102,241,0.3)" },
    starter: { bg: "rgba(34,197,94,0.1)",   color: "#4ade80", border: "rgba(34,197,94,0.3)" },
    growth:  { bg: "rgba(34,197,94,0.1)",   color: "#4ade80", border: "rgba(34,197,94,0.3)" },
    free:    { bg: "rgba(100,116,139,0.1)", color: "#94a3b8", border: "rgba(100,116,139,0.25)" },
  };
  const s = styles[plan?.toLowerCase()] ?? styles.free;
  return (
    <span
      style={{
        padding: "0.2rem 0.6rem",
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        borderRadius: "999px",
        fontSize: "0.7rem",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {plan}
    </span>
  );
}

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi("/system/businesses")
      .then((data) => {
        setBusinesses(data.businesses || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = businesses.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.phone.includes(search)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }} className="animate-fade-up">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 900, color: "var(--text)", letterSpacing: "-0.03em" }}>
            Businesses
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginTop: "0.25rem" }}>
            {loading ? "Loading tenants..." : `${filtered.length} of ${businesses.length} tenants`}
          </p>
        </div>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <Search
            size={15}
            style={{
              position: "absolute",
              left: "0.75rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder="Search name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              paddingLeft: "2.25rem",
              paddingRight: "0.875rem",
              paddingTop: "0.5625rem",
              paddingBottom: "0.5625rem",
              background: "var(--surface)",
              border: "1px solid var(--border-2)",
              borderRadius: "0.625rem",
              color: "var(--text)",
              fontSize: "0.875rem",
              outline: "none",
              width: "260px",
              fontFamily: "inherit",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border-2)")}
          />
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "1rem",
          overflow: "hidden",
        }}
      >
        {/* Table Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1.5fr 1fr 1fr 80px",
            padding: "0.75rem 1.25rem",
            background: "rgba(255,255,255,0.02)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {["ID / Name", "Phone", "Plan", "Joined", ""].map((h) => (
            <span key={h} style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center" }}>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                style={{
                  height: "52px",
                  background: "var(--surface-2)",
                  borderRadius: "0.5rem",
                  marginBottom: "0.5rem",
                  animation: "pulse 1.5s ease-in-out infinite",
                  animationDelay: `${i * 100}ms`,
                }}
              />
            ))}
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "4rem", textAlign: "center" }}>
            <Building2 size={32} style={{ color: "var(--muted)", margin: "0 auto 0.75rem" }} />
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>No businesses found.</p>
          </div>
        ) : (
          filtered.map((b, idx) => (
            <div
              key={b.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1.5fr 1fr 1fr 80px",
                padding: "0.875rem 1.25rem",
                borderBottom: idx < filtered.length - 1 ? "1px solid var(--border)" : "none",
                alignItems: "center",
                transition: "background 0.12s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {/* Name */}
              <div>
                <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)" }}>{b.name}</p>
                <p style={{ fontSize: "0.7rem", color: "var(--muted-2)", marginTop: "1px" }}>ID: {b.id}</p>
              </div>

              {/* Phone */}
              <span style={{ fontSize: "0.8375rem", color: "var(--muted)", fontFamily: "monospace" }}>{b.phone}</span>

              {/* Plan */}
              <div><PlanBadge plan={b.plan} /></div>

              {/* Date */}
              <span style={{ fontSize: "0.8125rem", color: "var(--muted-2)" }}>
                {new Date(b.created_at).toLocaleDateString()}
              </span>

              {/* Action */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Link
                  href={`/businesses/${b.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    padding: "0.375rem 0.75rem",
                    background: "var(--accent-glow)",
                    border: "1px solid rgba(99,102,241,0.2)",
                    borderRadius: "0.5rem",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--accent)",
                    textDecoration: "none",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(99,102,241,0.2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--accent-glow)";
                  }}
                >
                  View
                  <ChevronRight size={13} />
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
