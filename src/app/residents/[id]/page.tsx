"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc, getDoc, updateDoc, collection, getDocs, serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { accolades } from "@/lib/accolades";
import {
  computeReputationPoints,
  getReputationLevel,
  getReputationProgress,
  getSpecialTitle,
} from "@/lib/reputation";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ResidentProfile {
  apartmentNumber: string;
  xp: number;
  level: number;
  streak: number;
  checkInStreak: number;
  garbageCount: number;
  messageCount: number;
  complaintCount: number;
  unlockedAccolades: string[];
  residentNames: string[];
  primaryContact: string;
  secondaryContact: string;
  tournamentWins: number;
  reputationPoints: number;
  reputationScore: number;
  pollVotes: number;
}

const RARITY_CONFIG: Record<string, { color: string; glow: string; label: string }> = {
  Common:    { color: "#9ca3af", glow: "rgba(156,163,175,0.2)",  label: "Common"    },
  Uncommon:  { color: "#4ade80", glow: "rgba(74,222,128,0.2)",   label: "Uncommon"  },
  Rare:      { color: "#60a5fa", glow: "rgba(96,165,250,0.2)",   label: "Rare"      },
  Epic:      { color: "#a78bfa", glow: "rgba(167,139,250,0.2)",  label: "Epic"      },
  Legendary: { color: "#e8c96a", glow: "rgba(232,201,106,0.25)", label: "Legendary" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getFloor(apt: string) {
  const d = apt.replace(/[^0-9]/g, "");
  return d ? d.charAt(0) : "G";
}

function computeFloorRank(apartmentNumber: string, allResidents: any[]): number {
  const floor = getFloor(apartmentNumber);
  const floorResidents = allResidents
    .filter((r) => getFloor(r.apartmentNumber || "") === floor)
    .sort((a, b) => (b.xp || 0) - (a.xp || 0));
  const rank = floorResidents.findIndex((r) => r.apartmentNumber === apartmentNumber);
  return rank === -1 ? floorResidents.length : rank + 1;
}

function getRarestAccolades(unlockedIds: string[]) {
  const order = ["Legendary", "Epic", "Rare", "Uncommon", "Common"];
  return accolades
    .filter((a) => unlockedIds.includes(a.id))
    .sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity))
    .slice(0, 5);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ResidentProfilePage() {
  const router  = useRouter();
  const params  = useParams();
  const uid     = params?.id as string;

  const [residentData, setResidentData]       = useState<ResidentProfile | null>(null);
  const [allResidents, setAllResidents]       = useState<any[]>([]);
  const [currentUserId, setCurrentUserId]     = useState<string | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [notFound, setNotFound]               = useState(false);

  // Edit state (only used when isOwner)
  const [editing, setEditing]                 = useState(false);
  const [saving, setSaving]                   = useState(false);
  const [saveSuccess, setSaveSuccess]         = useState(false);
  const [editNames, setEditNames]             = useState<string[]>([""]);
  const [editPrimary, setEditPrimary]         = useState("");
  const [editSecondary, setEditSecondary]     = useState("");

  const isOwner = currentUserId === uid;

  // ── Load ─────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const resSnap = await getDoc(doc(db, "residents", uid));
      if (!resSnap.exists()) { setNotFound(true); return; }
      const data = resSnap.data() as ResidentProfile;
      setResidentData(data);
      setEditNames(data.residentNames?.length ? data.residentNames : [""]);
      setEditPrimary(data.primaryContact || "");
      setEditSecondary(data.secondaryContact || "");

      const allSnap = await getDocs(collection(db, "residents"));
      setAllResidents(allSnap.docs.map((d) => d.data()));
    } catch (e) {
      console.error(e);
      setNotFound(true);
    }
  }, [uid]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      setCurrentUserId(user.uid);
      await loadData();
      setLoading(false);
    });
    return () => unsub();
  }, [router, loadData]);

  // ── Save (owner only) ─────────────────────────────────────────────────────

  async function handleSave() {
    if (!isOwner) return;
    const cleanNames = editNames.map((n) => n.trim()).filter(Boolean);
    if (!cleanNames.length) { alert("Please add at least one resident name."); return; }
    setSaving(true);
    try {
      await updateDoc(doc(db, "residents", uid), {
        residentNames:    cleanNames,
        primaryContact:   editPrimary.trim(),
        secondaryContact: editSecondary.trim(),
        profileUpdatedAt: serverTimestamp(),
      });
      setResidentData((prev) =>
        prev ? { ...prev, residentNames: cleanNames, primaryContact: editPrimary.trim(), secondaryContact: editSecondary.trim() } : prev
      );
      setEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error(e);
      alert("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "#050505" }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner" style={{ margin: "0 auto 20px" }} />
          <p style={{ color: "#777", fontSize: "0.85rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Loading Profile
          </p>
        </div>
      </main>
    );
  }

  if (notFound || !residentData) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "#050505" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 48, marginBottom: 16 }}>🏠</p>
          <h2 style={{ color: "#f0ece4", marginBottom: 8 }}>Resident not found</h2>
          <p style={{ color: "#555", marginBottom: 24 }}>This apartment profile doesn't exist.</p>
          <Link href="/directory" style={{
            background: "linear-gradient(135deg, #8a6e2f, #c9a84c)",
            color: "#0a0800", padding: "12px 24px",
            borderRadius: 10, textDecoration: "none", fontWeight: 600,
          }}>
            ← Back to Directory
          </Link>
        </div>
      </main>
    );
  }

  // ── Computed values ───────────────────────────────────────────────────────

  const unlockedIds     = residentData.unlockedAccolades || [];
  const floorRank       = computeFloorRank(residentData.apartmentNumber, allResidents);
  const repPoints       = computeReputationPoints(residentData as unknown as Record<string, unknown>);
  const repLevel        = getReputationLevel(repPoints);
  const repProgress     = getReputationProgress(repPoints);
  const specialTitle    = getSpecialTitle(residentData as unknown as Record<string, unknown>);
  const rarestAccolades = getRarestAccolades(unlockedIds);
  const tournamentWins  = residentData.tournamentWins || 0;
  const streak          = residentData.checkInStreak || residentData.streak || 0;
  const totalXP         = residentData.xp || 0;
  const level           = residentData.level || 1;
  const xpForNext       = level * 200;
  const xpProgress      = Math.min((totalXP % 200) / 200 * 100, 100);
  const names           = (editing ? editNames : residentData.residentNames || []).filter(Boolean);
  const floor           = getFloor(residentData.apartmentNumber);

  return (
    <main
      className="min-h-screen"
      style={{
        backgroundImage: `radial-gradient(ellipse at 50% -10%, ${repLevel.glow} 0%, #050505 55%)`,
        padding: "40px 24px 80px",
      }}
    >
      <div style={{ maxWidth: 780, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div
          className="animate-fade-in-up"
          style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between", marginBottom: 36,
            flexWrap: "wrap", gap: 12,
          }}
        >
          <div>
            <p style={{ color: "var(--gold)", fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>
              {isOwner ? "Your Profile" : "Resident Profile"}
            </p>
            <h1 className="display-font" style={{ fontSize: "2.4rem", color: "#f0ece4", lineHeight: 1.1 }}>
              Apartment {residentData.apartmentNumber}
            </h1>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link
              href="/directory"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10, padding: "10px 16px",
                color: "#888", textDecoration: "none",
                fontFamily: "'DM Sans', sans-serif", fontSize: "0.82rem",
              }}
            >
              ← Directory
            </Link>
            <Link
              href="/dashboard"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10, padding: "10px 16px",
                color: "#888", textDecoration: "none",
                fontFamily: "'DM Sans', sans-serif", fontSize: "0.82rem",
              }}
            >
              Dashboard
            </Link>
          </div>
        </div>

        {/* ── PROFILE CARD ── */}
        <div
          className="animate-fade-in-up stagger-1"
          style={{
            background: "linear-gradient(145deg, rgba(20,18,14,0.98), rgba(10,10,10,0.99))",
            border: `1px solid ${repLevel.color}25`,
            borderRadius: 24, overflow: "hidden",
            boxShadow: `0 0 60px ${repLevel.glow}, 0 20px 60px rgba(0,0,0,0.7)`,
            marginBottom: 24,
          }}
        >
          {/* Gradient bar */}
          <div style={{
            height: 4,
            background: `linear-gradient(90deg, ${repLevel.color}60, ${repLevel.color}, ${repLevel.color}60)`,
          }} />

          {/* Apartment banner */}
          <div style={{
            padding: "28px 32px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: `linear-gradient(135deg, ${repLevel.glow}, transparent)`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{
                width: 60, height: 60, borderRadius: "50%",
                background: `radial-gradient(circle at 30% 30%, ${repLevel.color}30, transparent 70%)`,
                border: `2px solid ${repLevel.color}60`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, flexShrink: 0,
                boxShadow: `0 0 24px ${repLevel.glow}`,
              }}>
                {repLevel.badge}
              </div>
              <div>
                <p style={{ color: "#666", fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  Floor {floor} · Gokul Residency
                </p>
                <h2 className="display-font" style={{ fontSize: "2rem", color: "#f0ece4", lineHeight: 1.1 }}>
                  Apt {residentData.apartmentNumber}
                </h2>
                {isOwner && (
                  <span style={{
                    display: "inline-block",
                    background: "linear-gradient(135deg, #8a6e2f, #c9a84c)",
                    color: "#0a0800", fontSize: "0.6rem", fontWeight: 800,
                    padding: "2px 10px", borderRadius: 999, letterSpacing: "0.1em",
                    marginTop: 4,
                  }}>
                    MY APARTMENT
                  </span>
                )}
              </div>
            </div>
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12, padding: "10px 18px", textAlign: "center",
            }}>
              <p style={{ color: "#555", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Level</p>
              <p className="display-font" style={{ fontSize: "2rem", color: "var(--gold)", lineHeight: 1 }}>{level}</p>
            </div>
          </div>

          {/* ── SECTION 1: Resident Info ── */}
          <div style={{ padding: "28px 32px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 20, flexWrap: "wrap", gap: 10,
            }}>
              <p style={{ color: "var(--gold)", fontSize: "0.7rem", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                ✦ Resident Information
              </p>
              {isOwner && !editing && (
                <button
                  onClick={() => setEditing(true)}
                  style={{
                    background: "rgba(201,168,76,0.08)",
                    border: "1px solid rgba(201,168,76,0.25)",
                    borderRadius: 8, padding: "7px 16px",
                    color: "var(--gold)", fontSize: "0.8rem",
                    fontFamily: "'DM Sans', sans-serif", cursor: "pointer", fontWeight: 600,
                  }}
                >
                  ✏ Edit Profile
                </button>
              )}
              {isOwner && editing && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setEditNames(residentData.residentNames?.length ? residentData.residentNames : [""]);
                      setEditPrimary(residentData.primaryContact || "");
                      setEditSecondary(residentData.secondaryContact || "");
                    }}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8, padding: "7px 14px",
                      color: "#888", fontSize: "0.8rem",
                      fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      background: "linear-gradient(135deg, #8a6e2f, #c9a84c)",
                      border: "none", borderRadius: 8, padding: "7px 18px",
                      color: "#0a0800", fontSize: "0.8rem", fontWeight: 700,
                      fontFamily: "'DM Sans', sans-serif",
                      cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving ? "Saving…" : "💾 Save"}
                  </button>
                </div>
              )}
              {!isOwner && (
                <span style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8, padding: "5px 12px",
                  color: "#555", fontSize: "0.72rem",
                  letterSpacing: "0.06em",
                }}>
                  👁 View Only
                </span>
              )}
            </div>

            {saveSuccess && (
              <div style={{
                background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
                borderRadius: 10, padding: "10px 16px",
                color: "#4ade80", fontSize: "0.85rem", marginBottom: 16, fontWeight: 500,
              }}>
                ✓ Profile updated successfully
              </div>
            )}

            {/* View mode */}
            {!editing ? (
              <div>
                <p style={{ color: "#555", fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                  Residents
                </p>
                {residentData.residentNames?.filter(Boolean).length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                    {residentData.residentNames.filter(Boolean).map((name, i) => (
                      <div key={i} style={{
                        background: "rgba(201,168,76,0.07)", border: "1px solid rgba(201,168,76,0.2)",
                        borderRadius: 999, padding: "6px 16px", color: "#f0ece4",
                        fontSize: "0.9rem", fontWeight: 500,
                        display: "flex", alignItems: "center", gap: 8,
                      }}>
                        <span style={{ fontSize: 14, opacity: 0.7 }}>👤</span>
                        {name}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: "#444", fontSize: "0.85rem", marginBottom: 20, fontStyle: "italic" }}>
                    {isOwner ? "No residents added yet. Click Edit Profile to add names." : "No residents listed."}
                  </p>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <ContactRow icon="📞" label="Primary Contact" value={residentData.primaryContact} />
                  {residentData.secondaryContact && (
                    <ContactRow icon="📱" label="Secondary Contact" value={residentData.secondaryContact} />
                  )}
                </div>
              </div>
            ) : (
              /* Edit Mode — only shown to owner */
              <div>
                <p style={{ color: "#555", fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                  Resident Names
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {editNames.map((name, idx) => (
                    <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => {
                          const updated = [...editNames]; updated[idx] = e.target.value; setEditNames(updated);
                        }}
                        placeholder={`Resident ${idx + 1} name`}
                        className="premium-input"
                        style={{ flex: 1, padding: "12px 16px", fontSize: "0.95rem" }}
                      />
                      {editNames.length > 1 && (
                        <button
                          onClick={() => setEditNames(editNames.filter((_, i) => i !== idx))}
                          style={{
                            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                            borderRadius: 8, width: 36, height: 36, color: "#f87171",
                            cursor: "pointer", fontSize: 16, flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  {editNames.length < 10 && (
                    <button
                      onClick={() => setEditNames([...editNames, ""])}
                      style={{
                        background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.15)",
                        borderRadius: 10, padding: "10px", color: "#777", fontSize: "0.85rem",
                        fontFamily: "'DM Sans', sans-serif", cursor: "pointer", textAlign: "center",
                      }}
                    >
                      + Add Resident
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", color: "#666", fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                      Primary Contact Number
                    </label>
                    <input
                      type="tel" value={editPrimary}
                      onChange={(e) => setEditPrimary(e.target.value)}
                      placeholder="+91 XXXXX XXXXX"
                      className="premium-input" style={{ padding: "12px 16px" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", color: "#666", fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                      Secondary Contact Number <span style={{ color: "#444", fontWeight: 400 }}>(optional)</span>
                    </label>
                    <input
                      type="tel" value={editSecondary}
                      onChange={(e) => setEditSecondary(e.target.value)}
                      placeholder="+91 XXXXX XXXXX"
                      className="premium-input" style={{ padding: "12px 16px" }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── SECTION 2: Reputation ── */}
          <div style={{ padding: "28px 32px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ color: "var(--gold)", fontSize: "0.7rem", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 20 }}>
              ★ Community Reputation
            </p>

            {/* Reputation card */}
            <div style={{
              background: `linear-gradient(135deg, ${repLevel.glow}, rgba(255,255,255,0.02))`,
              border: `1px solid ${repLevel.color}30`,
              borderRadius: 16, padding: "20px 24px", marginBottom: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: `radial-gradient(circle at 30% 30%, ${repLevel.color}25, transparent)`,
                  border: `2px solid ${repLevel.color}50`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 26, flexShrink: 0,
                  boxShadow: `0 0 20px ${repLevel.glow}, 0 0 40px ${repLevel.glow}`,
                }}>
                  {repLevel.badge}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: repLevel.color, fontWeight: 700, fontSize: "1.1rem", marginBottom: 2 }}>
                    {repLevel.title}
                  </p>
                  {specialTitle && (
                    <p style={{ color: "#777", fontSize: "0.75rem" }}>✦ {specialTitle}</p>
                  )}
                  <p style={{ color: "#555", fontSize: "0.75rem", marginTop: 2 }}>
                    {repPoints} reputation points
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ color: repLevel.color, fontSize: "1.8rem", fontWeight: 700, fontFamily: "'Cormorant Garamond', serif", lineHeight: 1 }}>
                    {repPoints}
                  </p>
                  <p style={{ color: "#444", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>points</p>
                </div>
              </div>

              {/* Progress bar */}
              {repLevel.maxScore !== Infinity && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.72rem" }}>
                    <span style={{ color: "#555" }}>{repLevel.title}</span>
                    <span style={{ color: repLevel.color }}>{repProgress}% → next tier</span>
                  </div>
                  <div style={{ background: "#1a1a1a", borderRadius: 999, height: 5, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 999,
                      background: `linear-gradient(90deg, ${repLevel.color}80, ${repLevel.color})`,
                      width: `${repProgress}%`, transition: "width 0.8s ease",
                      boxShadow: `0 0 8px ${repLevel.color}60`,
                    }} />
                  </div>
                </div>
              )}
            </div>

            {/* All reputation tiers preview */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { title: "Disturbed", badge: "😤", min: 0,   color: "#ef4444" },
                { title: "Unstable",  badge: "⚠️",  min: 200, color: "#f97316" },
                { title: "Member",    badge: "🏠",  min: 400, color: "#9ca3af" },
                { title: "Trusted",   badge: "🛡️",  min: 600, color: "#60a5fa" },
                { title: "Elite",     badge: "👑",  min: 800, color: "#e8c96a" },
              ].map((tier) => (
                <div key={tier.title} style={{
                  flex: "1 1 auto",
                  background: repPoints >= tier.min ? `${tier.color}15` : "rgba(255,255,255,0.02)",
                  border: repPoints >= tier.min ? `1px solid ${tier.color}40` : "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 10, padding: "8px 6px",
                  textAlign: "center", transition: "all 0.3s",
                  opacity: repPoints >= tier.min ? 1 : 0.4,
                }}>
                  <div style={{ fontSize: 16, marginBottom: 2 }}>{tier.badge}</div>
                  <div style={{ color: repPoints >= tier.min ? tier.color : "#555", fontSize: "0.62rem", fontWeight: 600 }}>
                    {tier.title}
                  </div>
                  <div style={{ color: "#444", fontSize: "0.55rem" }}>{tier.min}+</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── SECTION 3: Competitive Identity ── */}
          <div style={{ padding: "28px 32px" }}>
            <div style={{ marginBottom: 20 }}>
              <p style={{ color: "var(--gold)", fontSize: "0.7rem", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>
                ⚔ Competitive Identity
              </p>
              <p style={{ color: "#444", fontSize: "0.75rem" }}>Auto-updated by the system</p>
            </div>

            {/* XP Progress */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.78rem" }}>
                <span style={{ color: "#666" }}>Level {level} Progress</span>
                <span style={{ color: "var(--gold)", fontWeight: 600 }}>{totalXP} / {xpForNext} XP</span>
              </div>
              <div style={{ background: "#1a1a1a", borderRadius: 999, height: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{
                  height: "100%", borderRadius: 999,
                  background: "linear-gradient(90deg, var(--gold-dim), var(--gold), var(--gold-light))",
                  width: `${xpProgress}%`, transition: "width 0.8s ease",
                  boxShadow: "0 0 8px rgba(201,168,76,0.5)",
                }} />
              </div>
            </div>

            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 28 }}>
              {[
                { icon: "🏆", label: "Floor Rank",     value: `#${floorRank}`,  accent: "var(--gold)"  },
                { icon: "★",  label: "Reputation",     value: repPoints,         accent: repLevel.color },
                { icon: "⚔", label: "Tournament Wins", value: tournamentWins,   accent: "#a78bfa"       },
                { icon: "🔥", label: "Streak",          value: `${streak}d`,    accent: "#fb923c"       },
                { icon: "⚡", label: "Total XP",        value: totalXP,         accent: "var(--gold)"   },
                { icon: "🏅", label: "Accolades",       value: unlockedIds.length, accent: "#4ade80"    },
              ].map((stat) => (
                <div key={stat.label} style={{
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 14, padding: "16px 14px", textAlign: "center",
                  transition: "all 0.25s ease",
                }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{stat.icon}</div>
                  <div style={{ fontSize: "1.35rem", fontWeight: 700, color: stat.accent, lineHeight: 1, marginBottom: 4, fontFamily: "'Cormorant Garamond', serif" }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Rarest Accolades */}
            <div>
              <p style={{ color: "#555", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
                Rarest Accolades
              </p>
              {rarestAccolades.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {rarestAccolades.map((acc) => {
                    const cfg = RARITY_CONFIG[acc.rarity] || RARITY_CONFIG.Common;
                    return (
                      <div
                        key={acc.id}
                        title={acc.description}
                        style={{
                          background: cfg.glow, border: `1px solid ${cfg.color}40`,
                          borderRadius: 999, padding: "6px 14px",
                          fontSize: "0.82rem", color: cfg.color, fontWeight: 600,
                          boxShadow: `0 0 12px ${cfg.glow}`, cursor: "default",
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px ${cfg.glow}, 0 0 0 1px ${cfg.color}60`;
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.boxShadow = `0 0 12px ${cfg.glow}`;
                        }}
                      >
                        {acc.title}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{
                  background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)",
                  borderRadius: 12, padding: "20px", textAlign: "center",
                }}>
                  <p style={{ color: "#444", fontSize: "0.85rem" }}>🔒 Complete activities to earn accolades</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: "16px 32px",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            background: "rgba(0,0,0,0.3)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 8,
          }}>
            <span style={{ color: "#333", fontSize: "0.72rem", letterSpacing: "0.08em" }}>
              GokulHub · Gokul Residency
            </span>
            <span style={{ color: "#333", fontSize: "0.72rem" }}>Beta v1.0</span>
          </div>
        </div>

        {/* ── All Accolades ── */}
        {unlockedIds.length > 0 && (
          <div className="glass-card animate-fade-in-up stagger-2" style={{ padding: 28, marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
              <p style={{ color: "var(--gold)", fontSize: "0.75rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                🏅 All Earned Accolades ({unlockedIds.length})
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {accolades.filter((a) => unlockedIds.includes(a.id)).map((acc) => {
                const cfg = RARITY_CONFIG[acc.rarity] || RARITY_CONFIG.Common;
                return (
                  <div key={acc.id} title={`${acc.description} · +${acc.xp} XP`} style={{
                    background: cfg.glow, border: `1px solid ${cfg.color}35`,
                    borderRadius: 8, padding: "5px 12px", fontSize: "0.78rem",
                    color: cfg.color, fontWeight: 500, cursor: "default",
                  }}>
                    {acc.title}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Quick Links ── */}
        <div className="animate-fade-in-up stagger-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            { href: "/leaderboard", icon: "🏆", label: "Leaderboard" },
            { href: "/reputation",  icon: "⭐", label: "My Reputation" },
            { href: "/directory",   icon: "🏠", label: "All Residents" },
          ].map((item) => (
            <Link key={item.href} href={item.href} style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12, padding: "14px 16px",
              textDecoration: "none", color: "#ccc",
              fontFamily: "'DM Sans', sans-serif", fontSize: "0.88rem", fontWeight: 500,
              transition: "all 0.25s ease",
            }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "var(--border-hover)";
                el.style.background = "rgba(201,168,76,0.06)";
                el.style.color = "#f0ece4";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "rgba(255,255,255,0.07)";
                el.style.background = "rgba(255,255,255,0.03)";
                el.style.color = "#ccc";
              }}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

// ─── Contact row helper ───────────────────────────────────────────────────────

function ContactRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 16px",
      background: "rgba(255,255,255,0.02)",
      borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)",
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div>
        <p style={{ color: "#555", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
        <p style={{ color: value ? "#f0ece4" : "#444", fontWeight: 600, fontSize: "0.95rem" }}>
          {value || "Not set"}
        </p>
      </div>
    </div>
  );
}
