"use client";
import React, { useState, useEffect } from "react";
import {
  collection, getDocs, doc, updateDoc, getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Permission, ALL_PERMISSIONS, PERMISSION_META,
  ResidentPermissions, isSupremeAdmin, writeAuditLog,
} from "@/lib/permissions";
import { AdminBadge } from "@/components/PermissionGate";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResidentData {
  id: string;
  name: string;
  apartmentNumber: string;
  role: string;
  adminPermissions: Permission[];
  email?: string;
}

interface ConfirmModal {
  type: "revoke" | "promote";
  resident: ResidentData;
}

interface AuditEntry {
  id: string;
  action: string;
  grantedByName: string;
  targetName: string;
  targetApartment?: string;
  previousRole?: string;
  newRole?: string;
  previousPermissions?: Permission[];
  newPermissions?: Permission[];
  timestamp: any;
}

// ─── AdminControlPanel ────────────────────────────────────────────────────────

interface AdminControlPanelProps {
  currentUserId: string;
  currentUserName: string;
  currentResident: ResidentPermissions;
  showToast: (msg: string) => void;
}

export default function AdminControlPanel({
  currentUserId,
  currentUserName,
  currentResident,
  showToast,
}: AdminControlPanelProps) {
  const [residents, setResidents]           = useState<ResidentData[]>([]);
  const [searchQuery, setSearchQuery]       = useState("");
  const [selectedResident, setSelectedResident] = useState<ResidentData | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<Permission[]>([]);
  const [confirmModal, setConfirmModal]     = useState<ConfirmModal | null>(null);
  const [auditLog, setAuditLog]             = useState<AuditEntry[]>([]);
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [activeSection, setActiveSection]   = useState<"residents" | "audit">("residents");

  const isSupreme = isSupremeAdmin(currentResident);

  // ── Load residents ─────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      const snap = await getDocs(collection(db, "residents"));
      const list: ResidentData[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name ?? "Unknown",
          apartmentNumber: data.apartmentNumber ?? "—",
          role: data.role ?? "resident",
          adminPermissions: data.adminPermissions ?? [],
          email: data.email,
        };
      });
      list.sort((a, b) => a.apartmentNumber.localeCompare(b.apartmentNumber, undefined, { numeric: true }));
      setResidents(list);
      setLoading(false);
    })();
  }, []);

  // ── Load audit log ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeSection !== "audit") return;
    (async () => {
      const snap = await getDocs(collection(db, "auditLog"));
      const entries: AuditEntry[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditEntry));
      entries.sort((a, b) => (b.timestamp?.seconds ?? 0) - (a.timestamp?.seconds ?? 0));
      setAuditLog(entries.slice(0, 50));
    })();
  }, [activeSection]);

  // ── Filter residents ───────────────────────────────────────────────────────
  const filtered = residents.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.apartmentNumber.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q)
    );
  });

  // ── Select resident ────────────────────────────────────────────────────────
  function selectResident(r: ResidentData) {
    setSelectedResident(r);
    setEditingPermissions([...r.adminPermissions]);
  }

  // ── Toggle permission ──────────────────────────────────────────────────────
  function togglePermission(p: Permission) {
    if (!isSupreme) return;
    setEditingPermissions((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  // ── Save permissions ───────────────────────────────────────────────────────
  async function savePermissions() {
    if (!selectedResident || !isSupreme) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "residents", selectedResident.id), {
        adminPermissions: editingPermissions,
      });
      await writeAuditLog({
        action: "permission_change",
        grantedBy: currentUserId,
        grantedByName: currentUserName,
        targetUserId: selectedResident.id,
        targetName: selectedResident.name,
        targetApartment: selectedResident.apartmentNumber,
        previousPermissions: selectedResident.adminPermissions,
        newPermissions: editingPermissions,
      });
      // Update local state
      setResidents((prev) =>
        prev.map((r) =>
          r.id === selectedResident.id
            ? { ...r, adminPermissions: editingPermissions }
            : r
        )
      );
      setSelectedResident((p) => p ? { ...p, adminPermissions: editingPermissions } : p);
      showToast("✅ Permissions saved successfully");
    } catch {
      showToast("❌ Failed to save permissions");
    }
    setSaving(false);
  }

  // ── Promote to admin ───────────────────────────────────────────────────────
  async function promoteToAdmin(resident: ResidentData) {
    if (!isSupreme) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "residents", resident.id), {
        role: "admin",
        adminPermissions: [],
      });
      await writeAuditLog({
        action: "grant_admin",
        grantedBy: currentUserId,
        grantedByName: currentUserName,
        targetUserId: resident.id,
        targetName: resident.name,
        targetApartment: resident.apartmentNumber,
        previousRole: resident.role,
        newRole: "admin",
      });
      setResidents((prev) =>
        prev.map((r) =>
          r.id === resident.id ? { ...r, role: "admin", adminPermissions: [] } : r
        )
      );
      if (selectedResident?.id === resident.id) {
        setSelectedResident((p) => p ? { ...p, role: "admin", adminPermissions: [] } : p);
        setEditingPermissions([]);
      }
      setConfirmModal(null);
      showToast(`✅ ${resident.name} promoted to Admin`);
    } catch {
      showToast("❌ Failed to promote resident");
    }
    setSaving(false);
  }

  // ── Revoke admin ───────────────────────────────────────────────────────────
  async function revokeAdmin(resident: ResidentData) {
    if (!isSupreme) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "residents", resident.id), {
        role: "resident",
        adminPermissions: [],
      });
      await writeAuditLog({
        action: "revoke_admin",
        grantedBy: currentUserId,
        grantedByName: currentUserName,
        targetUserId: resident.id,
        targetName: resident.name,
        targetApartment: resident.apartmentNumber,
        previousRole: resident.role,
        newRole: "resident",
        previousPermissions: resident.adminPermissions,
        newPermissions: [],
      });
      setResidents((prev) =>
        prev.map((r) =>
          r.id === resident.id ? { ...r, role: "resident", adminPermissions: [] } : r
        )
      );
      if (selectedResident?.id === resident.id) {
        setSelectedResident((p) => p ? { ...p, role: "resident", adminPermissions: [] } : p);
        setEditingPermissions([]);
      }
      setConfirmModal(null);
      showToast(`✅ Admin access revoked from ${resident.name}`);
    } catch {
      showToast("❌ Failed to revoke admin access");
    }
    setSaving(false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16, padding: 24,
  };

  const sectionTabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 20px", borderRadius: 10, border: "none",
    fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", fontWeight: 600,
    cursor: "pointer", transition: "all 0.2s ease",
    background: active ? "linear-gradient(135deg, #8a6e2f, #c9a84c)" : "rgba(255,255,255,0.04)",
    color: active ? "#0a0800" : "#777",
  });

  if (!isSupreme) {
    return (
      <div style={{ ...cardStyle, textAlign: "center", padding: 48 }}>
        <div style={{ fontSize: "3rem", marginBottom: 16 }}>🔒</div>
        <p style={{ color: "#ef4444", fontWeight: 700, fontSize: "1rem" }}>Supreme Admin Only</p>
        <p style={{ color: "#555", fontSize: "0.85rem", marginTop: 8 }}>
          This panel requires supreme admin clearance.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Section tabs */}
      <div style={{ display: "flex", gap: 8 }}>
        <button style={sectionTabStyle(activeSection === "residents")} onClick={() => setActiveSection("residents")}>
          👥 Resident Permissions
        </button>
        <button style={sectionTabStyle(activeSection === "audit")} onClick={() => setActiveSection("audit")}>
          📋 Audit Log
        </button>
      </div>

      {/* ── RESIDENTS SECTION ─────────────────────────────────────────────── */}
      {activeSection === "residents" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

          {/* Left: Resident list */}
          <div style={cardStyle}>
            <p style={{ color: "#c9a84c", fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16, fontWeight: 700 }}>
              Search Residents
            </p>

            {/* Search */}
            <input
              type="text"
              placeholder="Search by apartment or name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#f0ece4", fontFamily: "'DM Sans', sans-serif", fontSize: "0.88rem",
                outline: "none", marginBottom: 16, boxSizing: "border-box",
              }}
            />

            {/* List */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 460, overflowY: "auto" }}>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{
                    height: 60, background: "rgba(255,255,255,0.02)", borderRadius: 10,
                    animation: "pulse 1.5s ease infinite",
                  }} />
                ))
              ) : filtered.length === 0 ? (
                <p style={{ color: "#555", fontSize: "0.85rem", textAlign: "center", padding: 24 }}>
                  No residents found
                </p>
              ) : filtered.map((r) => (
                <button
                  key={r.id}
                  onClick={() => selectResident(r)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer",
                    background: selectedResident?.id === r.id
                      ? "rgba(201,168,76,0.08)"
                      : "rgba(255,255,255,0.02)",
                    borderLeft: selectedResident?.id === r.id
                      ? "2px solid #c9a84c"
                      : "2px solid transparent",
                    textAlign: "left", transition: "all 0.15s ease",
                  }}
                >
                  <div>
                    <div style={{ color: "#f0ece4", fontWeight: 600, fontSize: "0.88rem", fontFamily: "'DM Sans', sans-serif" }}>
                      {r.name}
                    </div>
                    <div style={{ color: "#555", fontSize: "0.75rem", marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>
                      Apt {r.apartmentNumber}
                    </div>
                  </div>
                  <div>
                    {r.role === "supreme_admin" && (
                      <span style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 999, padding: "2px 8px", fontSize: "0.65rem", color: "#c9a84c", fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>
                        👑 Supreme
                      </span>
                    )}
                    {r.role === "admin" && (
                      <span style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 999, padding: "2px 8px", fontSize: "0.65rem", color: "#818cf8", fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>
                        🛡 Admin
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Permission editor */}
          <div style={cardStyle}>
            {!selectedResident ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 300 }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 16, opacity: 0.4 }}>👈</div>
                <p style={{ color: "#444", fontSize: "0.9rem", textAlign: "center" }}>
                  Select a resident to manage permissions
                </p>
              </div>
            ) : (
              <>
                {/* Resident info */}
                <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <p style={{ color: "#f0ece4", fontWeight: 700, fontSize: "1.05rem" }}>{selectedResident.name}</p>
                      <p style={{ color: "#555", fontSize: "0.8rem", marginTop: 2 }}>Apartment {selectedResident.apartmentNumber}</p>
                    </div>
                    <AdminBadge role={selectedResident.role} />
                  </div>
                </div>

                {/* Promote / Revoke buttons */}
                {selectedResident.role !== "supreme_admin" && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                    {selectedResident.role !== "admin" ? (
                      <button
                        onClick={() => setConfirmModal({ type: "promote", resident: selectedResident })}
                        style={{
                          flex: 1, padding: "9px 14px", borderRadius: 10, cursor: "pointer",
                          background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)",
                          color: "#818cf8", fontFamily: "'DM Sans', sans-serif", fontSize: "0.82rem", fontWeight: 600,
                        }}
                      >
                        🛡 Promote to Admin
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmModal({ type: "revoke", resident: selectedResident })}
                        style={{
                          flex: 1, padding: "9px 14px", borderRadius: 10, cursor: "pointer",
                          background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
                          color: "#f87171", fontFamily: "'DM Sans', sans-serif", fontSize: "0.82rem", fontWeight: 600,
                        }}
                      >
                        ✕ Revoke Admin Access
                      </button>
                    )}
                  </div>
                )}

                {/* Permissions grid — only for admins */}
                {selectedResident.role === "admin" && (
                  <>
                    <p style={{ color: "#c9a84c", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
                      Module Permissions
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                      {ALL_PERMISSIONS.map((p) => {
                        const meta = PERMISSION_META[p];
                        const active = editingPermissions.includes(p);
                        const isAdminControl = p === "adminControl";
                        return (
                          <button
                            key={p}
                            onClick={() => togglePermission(p)}
                            style={{
                              display: "flex", alignItems: "center", gap: 12,
                              padding: "11px 14px", borderRadius: 10, cursor: "pointer",
                              background: active ? "rgba(201,168,76,0.07)" : "rgba(255,255,255,0.02)",
                              border: active ? "1px solid rgba(201,168,76,0.25)" : "1px solid rgba(255,255,255,0.05)",
                              textAlign: "left", transition: "all 0.15s ease",
                            }}
                          >
                            <div style={{
                              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                              background: active ? "rgba(201,168,76,0.12)" : "rgba(255,255,255,0.03)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 18,
                            }}>
                              {meta.icon}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ color: active ? "#f0ece4" : "#666", fontWeight: 600, fontSize: "0.85rem", fontFamily: "'DM Sans', sans-serif" }}>
                                {meta.label}
                                {isAdminControl && <span style={{ color: "#ef4444", fontSize: "0.7rem", marginLeft: 6 }}>⚠ Sensitive</span>}
                              </div>
                              <div style={{ color: "#444", fontSize: "0.73rem", marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>
                                {meta.description}
                              </div>
                            </div>
                            {/* Toggle */}
                            <div style={{
                              width: 38, height: 20, borderRadius: 999, flexShrink: 0,
                              background: active ? "rgba(201,168,76,0.6)" : "rgba(255,255,255,0.08)",
                              position: "relative", transition: "all 0.2s ease",
                            }}>
                              <div style={{
                                position: "absolute", top: 3, width: 14, height: 14, borderRadius: "50%",
                                background: active ? "#c9a84c" : "#444",
                                left: active ? 21 : 3, transition: "all 0.2s ease",
                              }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={savePermissions}
                      disabled={saving}
                      style={{
                        width: "100%", padding: "12px", borderRadius: 10, cursor: saving ? "not-allowed" : "pointer",
                        background: saving ? "rgba(201,168,76,0.3)" : "linear-gradient(135deg, #8a6e2f, #c9a84c)",
                        border: "none", color: "#0a0800", fontFamily: "'DM Sans', sans-serif",
                        fontSize: "0.9rem", fontWeight: 700, transition: "all 0.2s ease",
                      }}
                    >
                      {saving ? "Saving…" : "💾 Save Permissions"}
                    </button>
                  </>
                )}

                {selectedResident.role === "resident" && (
                  <p style={{ color: "#444", fontSize: "0.85rem", textAlign: "center", padding: "24px 0" }}>
                    Promote this resident to admin to configure permissions.
                  </p>
                )}

                {selectedResident.role === "supreme_admin" && (
                  <div style={{ padding: "20px 0", textAlign: "center" }}>
                    <p style={{ color: "#c9a84c", fontSize: "0.9rem", fontWeight: 600 }}>👑 Supreme Admin</p>
                    <p style={{ color: "#444", fontSize: "0.82rem", marginTop: 8 }}>
                      Supreme admins have full access to all modules by default.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── AUDIT LOG SECTION ─────────────────────────────────────────────── */}
      {activeSection === "audit" && (
        <div style={cardStyle}>
          <p style={{ color: "#c9a84c", fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 20, fontWeight: 700 }}>
            Audit Log — Last 50 actions
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {auditLog.length === 0 ? (
              <p style={{ color: "#444", fontSize: "0.85rem", textAlign: "center", padding: 24 }}>No audit entries yet.</p>
            ) : auditLog.map((entry) => {
              const actionColor = entry.action === "grant_admin"
                ? "#818cf8"
                : entry.action === "revoke_admin"
                ? "#ef4444"
                : "#c9a84c";
              const actionLabel = entry.action === "grant_admin"
                ? "🛡 Admin Granted"
                : entry.action === "revoke_admin"
                ? "✕ Admin Revoked"
                : "🔧 Permissions Changed";
              return (
                <div key={entry.id} style={{
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                  borderLeft: `3px solid ${actionColor}`, borderRadius: 10, padding: "12px 16px",
                  display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
                }}>
                  <div>
                    <p style={{ color: actionColor, fontSize: "0.78rem", fontWeight: 700, marginBottom: 4 }}>{actionLabel}</p>
                    <p style={{ color: "#f0ece4", fontSize: "0.85rem" }}>
                      <span style={{ color: "#888" }}>by</span> {entry.grantedByName} →{" "}
                      <span style={{ fontWeight: 700 }}>{entry.targetName}</span>
                      {entry.targetApartment && <span style={{ color: "#555" }}> (Apt {entry.targetApartment})</span>}
                    </p>
                    {entry.action === "permission_change" && entry.newPermissions && (
                      <p style={{ color: "#555", fontSize: "0.75rem", marginTop: 4 }}>
                        Permissions: {entry.newPermissions.length === 0 ? "none" : entry.newPermissions.join(", ")}
                      </p>
                    )}
                  </div>
                  <p style={{ color: "#444", fontSize: "0.73rem", whiteSpace: "nowrap" }}>
                    {entry.timestamp?.seconds
                      ? new Date(entry.timestamp.seconds * 1000).toLocaleString("en-IN")
                      : "—"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── CONFIRM MODAL ─────────────────────────────────────────────────── */}
      {confirmModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }}>
          <div style={{
            background: "rgba(10,8,0,0.95)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 20, padding: "40px 36px", maxWidth: 440, width: "100%",
            boxShadow: "0 40px 120px rgba(0,0,0,0.8)",
          }}>
            {confirmModal.type === "revoke" ? (
              <>
                <div style={{ fontSize: "3rem", textAlign: "center", marginBottom: 16 }}>⚠️</div>
                <h2 style={{ color: "#f0ece4", fontSize: "1.4rem", fontWeight: 800, textAlign: "center", marginBottom: 8 }}>
                  Revoke Admin Access?
                </h2>
                <p style={{ color: "#666", fontSize: "0.9rem", textAlign: "center", marginBottom: 28, lineHeight: 1.6 }}>
                  This will remove all admin permissions from{" "}
                  <span style={{ color: "#f0ece4", fontWeight: 700 }}>{confirmModal.resident.name}</span>{" "}
                  (Apt {confirmModal.resident.apartmentNumber}). They will be downgraded to a regular resident.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => setConfirmModal(null)}
                    style={{
                      flex: 1, padding: "12px", borderRadius: 10, cursor: "pointer",
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                      color: "#888", fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem", fontWeight: 600,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => revokeAdmin(confirmModal.resident)}
                    disabled={saving}
                    style={{
                      flex: 1, padding: "12px", borderRadius: 10, cursor: "pointer",
                      background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                      color: "#f87171", fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem", fontWeight: 700,
                    }}
                  >
                    {saving ? "Revoking…" : "✕ Revoke Access"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: "3rem", textAlign: "center", marginBottom: 16 }}>🛡</div>
                <h2 style={{ color: "#f0ece4", fontSize: "1.4rem", fontWeight: 800, textAlign: "center", marginBottom: 8 }}>
                  Promote to Admin?
                </h2>
                <p style={{ color: "#666", fontSize: "0.9rem", textAlign: "center", marginBottom: 28, lineHeight: 1.6 }}>
                  <span style={{ color: "#f0ece4", fontWeight: 700 }}>{confirmModal.resident.name}</span>{" "}
                  will be granted admin access. You can configure their permissions after promoting.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => setConfirmModal(null)}
                    style={{
                      flex: 1, padding: "12px", borderRadius: 10, cursor: "pointer",
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                      color: "#888", fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem", fontWeight: 600,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => promoteToAdmin(confirmModal.resident)}
                    disabled={saving}
                    style={{
                      flex: 1, padding: "12px", borderRadius: 10, cursor: "pointer",
                      background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)",
                      color: "#818cf8", fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem", fontWeight: 700,
                    }}
                  >
                    {saving ? "Promoting…" : "🛡 Confirm Promote"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
