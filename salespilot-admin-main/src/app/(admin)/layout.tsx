"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import {
  LayoutDashboard,
  Building2,
  KeyRound,
  ScrollText,
  DollarSign,
  Settings2,
  LogOut,
  Shield,
  ChevronRight,
  BookOpen,
} from "lucide-react";

const navItems = [
  { href: "/dashboard",           label: "Dashboard",         icon: LayoutDashboard,  section: "main" },
  { href: "/businesses",          label: "Businesses",        icon: Building2,         section: "main" },
  { href: "/activation-codes",    label: "Activation Codes",  icon: KeyRound,          section: "main" },
  { href: "/audit-logs",          label: "Audit Logs",        icon: ScrollText,        section: "main" },
  { href: "/revenue",             label: "Revenue",           icon: DollarSign,        section: "main" },
  { href: "/global-rules",        label: "Global Rules",      icon: BookOpen,          section: "system" },
  { href: "/platform-settings",   label: "Platform Settings", icon: Settings2,         section: "system" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [showLogout, setShowLogout] = useState(false);
  const { logout, admin } = useAuth();

  async function handleLogout() {
    try {
      await api.post("/system/auth/logout");
    } catch (e) {
      // Ignore if network error
    }
    logout();
    router.push("/");
  }

  const mainNav = navItems.filter((i) => i.section === "main");
  const systemNav = navItems.filter((i) => i.section === "system");

  function NavLink({ href, label, icon: Icon }: (typeof navItems)[0]) {
    const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
    return (
      <Link
        href={href}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.625rem",
          padding: "0.5rem 0.625rem",
          borderRadius: "0.5rem",
          fontSize: "0.8375rem",
          fontWeight: active ? 600 : 400,
          color: active ? "var(--text)" : "var(--muted)",
          background: active ? "var(--accent-glow)" : "transparent",
          border: `1px solid ${active ? "rgba(99,102,241,0.2)" : "transparent"}`,
          transition: "all 0.15s",
          textDecoration: "none",
          position: "relative",
        }}
        onMouseEnter={(e) => {
          if (!active) {
            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
            e.currentTarget.style.color = "var(--text)";
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--muted)";
          }
        }}
      >
        <Icon
          size={15}
          style={{ color: active ? "var(--accent)" : "currentColor", flexShrink: 0 }}
        />
        <span style={{ flex: 1 }}>{label}</span>
        {active && (
          <ChevronRight size={13} style={{ color: "var(--accent)", opacity: 0.7 }} />
        )}
      </Link>
    );
  }

  return (
    <RequireAuth>
      <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
        {/* Sidebar */}
      <aside
        style={{
          width: "220px",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          position: "sticky",
          top: 0,
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          padding: "1.25rem 0.875rem",
          gap: "0",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0 0.375rem", marginBottom: "1.75rem" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, var(--accent), var(--accent-dim))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                SA
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {admin?.name || "Super Admin"}
                </p>
                <p style={{ fontSize: "0.75rem", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {admin?.email || "admin@salespilot.lk"}
                </p>
              </div>
        </div>

        {/* Main Nav */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
          {mainNav.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}

          {/* Divider */}
          <div style={{ height: "1px", background: "var(--border)", margin: "0.75rem 0.25rem" }} />

          {systemNav.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        {/* Bottom: admin badge + logout */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)" }}>
          <div
            style={{
              padding: "0.5rem 0.625rem",
              background: "var(--accent-glow)",
              border: "1px solid rgba(99,102,241,0.15)",
              borderRadius: "0.5rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <div
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "6px",
                background: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Shield size={13} color="#fff" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text)", lineHeight: 1.2 }}>Super Admin</div>
              <div style={{ fontSize: "0.65rem", color: "var(--muted)", lineHeight: 1.2 }}>Full access</div>
            </div>
          </div>

          <button
            onClick={() => setShowLogout(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              padding: "0.5rem 0.625rem",
              borderRadius: "0.5rem",
              fontSize: "0.8375rem",
              fontWeight: 500,
              color: "var(--muted)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              width: "100%",
              textAlign: "left",
              transition: "all 0.15s",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239,68,68,0.08)";
              e.currentTarget.style.color = "#ef4444";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--muted)";
            }}
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, height: "100vh", overflowY: "auto", background: "var(--bg)" }}>
        <div style={{ padding: "2.5rem 2.75rem", maxWidth: "1300px", margin: "0 auto", minHeight: "100%" }}>
          {children}
        </div>
      </main>

      {/* Logout Confirmation Modal */}
      {showLogout && (
        <div
          className="animate-fade-in"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(6px)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            className="animate-fade-up"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border-2)",
              borderRadius: "1.25rem",
              padding: "1.75rem",
              maxWidth: "360px",
              width: "100%",
              boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "12px",
                  background: "rgba(239,68,68,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <LogOut size={20} color="#ef4444" />
              </div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>Sign Out</h3>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
              Are you sure you want to sign out of the super admin panel?
            </p>
            <div style={{ display: "flex", gap: "0.625rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowLogout(false)}
                style={{
                  padding: "0.5rem 1.125rem",
                  borderRadius: "0.625rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--text)",
                  background: "transparent",
                  border: "1px solid var(--border-2)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                style={{
                  padding: "0.5rem 1.125rem",
                  borderRadius: "0.625rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#fff",
                  background: "var(--danger)",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow: "0 4px 12px rgba(239,68,68,0.3)",
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </RequireAuth>
  );
}
