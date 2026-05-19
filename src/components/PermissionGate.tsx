"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  Permission, ResidentPermissions,
  fetchResidentPermissions, hasPermission, isSupremeAdmin,
} from "@/lib/permissions";

// ─── AccessDenied UI ─────────────────────────────────────────────────────────

export function AccessDenied({ permission }: { permission?: Permission }) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (countdown <= 0) router.push("/dashboard");
  }, [countdown, router]);

  return (
    <main style={{
      minHeight: "100vh", background: "#050505",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* Animated grid background */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        backgroundImage: `
          linear-gradient(rgba(239,68,68,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(239,68,68,0.03) 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
        animation: "gridPulse 4s ease infinite",
      }} />

      {/* Red glow orbs */}
      <div style={{
        position: "fixed", top: "20%", left: "15%", width: 400, height: 400,
        background: "radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 70%)",
        borderRadius: "50%", pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{
        position: "fixed", bottom: "20%", right: "15%", width: 300, height: 300,
        background: "radial-gradient(circle, rgba(239,68,68,0.05) 0%, transparent 70%)",
        borderRadius: "50%", pointerEvents: "none", zIndex: 0,
      }} />

      <div style={{
        position: "relative", zIndex: 1, textAlign: "center", maxWidth: 520,
        background: "rgba(255,255,255,0.02)", backdropFilter: "blur(24px)",
        border: "1px solid rgba(239,68,68,0.2)", borderRadius: 24,
        padding: "56px 48px",
        boxShadow: "0 0 80px rgba(239,68,68,0.08), inset 0 0 80px rgba(239,68,68,0.02)",
      }}>
        {/* Animated lock icon */}
        <div style={{
          fontSize: "4.5rem", marginBottom: 24,
          animation: "lockPulse 2s ease infinite",
          display: "inline-block",
        }}>
          🔒
        </div>

        <p style={{
          color: "#ef4444", fontSize: "0.7rem", letterSpacing: "0.22em",
          textTransform: "uppercase", fontWeight: 700, marginBottom: 14,
          textShadow: "0 0 20px rgba(239,68,68,0.5)",
        }}>
          ⚠ CLEARANCE DENIED
        </p>

        <h1 style={{
          fontSize: "2.4rem", fontWeight: 800, color: "#f0ece4", marginBottom: 16,
          letterSpacing: "-0.02em",
        }}>
          Access Restricted
        </h1>

        <p style={{ color: "#666", fontSize: "0.95rem", lineHeight: 1.7, marginBottom: 28 }}>
          You do not have the required clearance level to access this section.
          {permission && (
            <> The <span style={{ color: "#ef4444", fontWeight: 600 }}>{permission}</span> permission is required.</>
          )}
        </p>

        {/* Scanline effect */}
        <div style={{
          background: "linear-gradient(135deg, rgba(239,68,68,0.06), rgba(239,68,68,0.02))",
          border: "1px solid rgba(239,68,68,0.12)", borderRadius: 12,
          padding: "16px 20px", marginBottom: 28,
        }}>
          <p style={{ color: "#555", fontSize: "0.8rem", marginBottom: 4 }}>
            SYSTEM MESSAGE
          </p>
          <p style={{ color: "#ef4444", fontSize: "0.85rem", fontFamily: "monospace" }}>
            &gt; Unauthorized access attempt logged
          </p>
          <p style={{ color: "#555", fontSize: "0.85rem", fontFamily: "monospace" }}>
            &gt; Redirecting to dashboard in <span style={{ color: "#f0ece4", fontWeight: 700 }}>{countdown}s</span>
          </p>
        </div>

        <button
          onClick={() => router.push("/dashboard")}
          style={{
            padding: "12px 28px", borderRadius: 12, cursor: "pointer",
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            color: "#ef4444", fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.9rem", fontWeight: 600, transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.15)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)";
          }}
        >
          ← Return to Dashboard
        </button>
      </div>

      <style>{`
        @keyframes lockPulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 8px rgba(239,68,68,0.4)); }
          50% { transform: scale(1.05); filter: drop-shadow(0 0 20px rgba(239,68,68,0.7)); }
        }
        @keyframes gridPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </main>
  );
}

// ─── Admin Badge Component ───────────────────────────────────────────────────

export function AdminBadge({ role }: { role: string }) {
  if (role === "supreme_admin") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        background: "linear-gradient(135deg, rgba(201,168,76,0.18), rgba(201,168,76,0.06))",
        border: "1px solid rgba(201,168,76,0.35)", borderRadius: 999,
        padding: "3px 10px", fontSize: "0.72rem", fontWeight: 700,
        color: "#c9a84c", letterSpacing: "0.06em", textTransform: "uppercase",
        boxShadow: "0 0 12px rgba(201,168,76,0.1)",
      }}>
        👑 Supreme Admin
      </span>
    );
  }
  if (role === "admin") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)",
        borderRadius: 999, padding: "3px 10px", fontSize: "0.72rem", fontWeight: 700,
        color: "#818cf8", letterSpacing: "0.06em", textTransform: "uppercase",
      }}>
        🛡 Admin
      </span>
    );
  }
  return null;
}

// ─── PermissionGate ───────────────────────────────────────────────────────────

interface PermissionGateProps {
  permission: Permission;
  resident: ResidentPermissions | null;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirect?: boolean; // if true, shows full AccessDenied page instead of fallback
}

export function PermissionGate({
  permission,
  resident,
  children,
  fallback = null,
  redirect = false,
}: PermissionGateProps) {
  const allowed = hasPermission(resident, permission);
  if (allowed) return <>{children}</>;
  if (redirect) return <AccessDenied permission={permission} />;
  return <>{fallback}</>;
}

// ─── withPermission HOC (for page-level protection) ──────────────────────────

export function withPermission(
  Component: React.ComponentType<any>,
  requiredPermission: Permission
) {
  return function ProtectedComponent(props: any) {
    const router = useRouter();
    const [resident, setResident] = useState<ResidentPermissions | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const unsub = onAuthStateChanged(auth, async (user) => {
        if (!user) { router.push("/login"); return; }
        const perms = await fetchResidentPermissions(user.uid);
        setResident(perms);
        setLoading(false);
        if (!hasPermission(perms, requiredPermission)) {
          // Don't redirect here — show AccessDenied below
        }
      });
      return () => unsub();
    }, [router]);

    if (loading) return (
      <main style={{
        minHeight: "100vh", background: "#050505",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          border: "2px solid rgba(201,168,76,0.2)",
          borderTopColor: "#c9a84c", animation: "spin 1s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    );

    if (!hasPermission(resident, requiredPermission)) {
      return <AccessDenied permission={requiredPermission} />;
    }

    return <Component {...props} resident={resident} />;
  };
}
