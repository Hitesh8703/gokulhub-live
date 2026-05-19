"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc, getDoc, collection, getDocs, query, orderBy, limit,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  computeReputationPoints,
  getReputationLevel,
  getReputationProgress,
  getSpecialTitle,
  REPUTATION_LEVELS,
  ReputationHistoryEntry,
} from "@/lib/reputation";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatTS(ts: unknown): string {
  if (!ts) return "";
  if (typeof ts === "object" && ts !== null && "toDate" in ts) {
    return (ts as { toDate: () => Date }).toDate().toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }
  if (typeof ts === "string") return new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  return "";
}

function relativeTime(ts: unknown): string {
  let date: Date | null = null;
  if (typeof ts === "object" && ts !== null && "toDate" in ts) {
    date = (ts as { toDate: () => Date }).toDate();
  } else if (typeof ts === "string") {
    date = new Date(ts);
  }
  if (!date) return "";
  const diff = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 30) return `${days}d ago`;
  return formatTS(ts);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReputationPage() {
  const router = useRouter();
  const [loading, setLoading]         = useState(true);
  const [residentData, setResidentData] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory]         = useState<ReputationHistoryEntry[]>([]);
  const [leaderboard, setLeaderboard] = useState<{ id: string; aptNum: string; names: string[]; repPts: number }[]>([]);
  const [uid, setUid]                 = useState<string | null>(null);
  const [activeTab, setActiveTab]     = useState<"overview" | "history" | "leaderboard">("overview");

  const loadData = useCallback(async (userId: string) => {
    try {
      const snap = await getDoc(doc(db, "residents", userId));
      if (!snap.exists()) { router.push("/dashboard"); return; }
      const data = snap.data() as Record<string, unknown>;
      setResidentData(data);

      // Load history subcollection
      const hSnap = await getDocs(
        query(collection(db, "residents", userId, "reputationHistory"), orderBy("timestamp", "desc"), limit(50))
      );
      setHistory(hSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ReputationHistoryEntry)));

      // Load leaderboard
      const allSnap = await getDocs(collection(db, "residents"));
      const lb = allSnap.docs.map((d) => {
        const rd = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          aptNum: String(rd.apartmentNumber || ""),
          names: (rd.residentNames as string[]) || [],
          repPts: computeReputationPoints(rd),
        };
      }).sort((a, b) => b.repPts - a.repPts);
      setLeaderboard(lb);
    } catch (e) {
      console.error(e);
    }
  }, [router]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      setUid(user.uid);
      await loadData(user.uid);
      setLoading(false);
    });
    return () => unsub();
  }, [router, loadData]);

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "#050505" }}>
      <div style={{ textAlign: "center" }}>
        <div className="spinner" style={{ margin: "0 auto 20px" }} />
        <p style={{ color: "#777", fontSize: "0.85rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading Reputation</p>
      </div>
    </main>
  );

  if (!residentData) return null;

  const repPts     = computeReputationPoints(residentData);
  const repLevel   = getReputationLevel(repPts);
  const repProg    = getReputationProgress(repPts);
  const specialTitle = getSpecialTitle(residentData);
  const myRank     = leaderboard.findIndex((r) => r.id === uid) + 1;

  const tabStyle = (active: boolean) => ({
    padding: "10px 20px", borderRadius: 10, fontSize: "0.85rem", fontWeight: 600 as const,
    cursor: "pointer" as const, fontFamily: "'DM Sans', sans-serif", border: "none",
    background: active ? `${repLevel.color}20` : "transparent",
    color: active ? repLevel.color : "#555",
    borderBottom: active ? `2px solid ${repLevel.color}` : "2px solid transparent",
    transition: "all 0.2s",
  });

  return (
    <main className="min-h-screen" style={{ background: "#050505", padding: "40px 24px", minHeight: "100vh" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* Header */}
        <div className="animate-fade-in-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 36, flexWrap: "wrap", gap: 12 }}>
          <div>
            <p style={{ color: "var(--gold)", fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>Community</p>
            <h1 className="display-font" style={{ fontSize: "2.4rem", color: "#f0ece4" }}>★ Reputation</h1>
          </div>
          <Link href="/dashboard" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 18px", color: "#888", textDecoration: "none", fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem" }}>
            ← Dashboard
          </Link>
        </div>

        {/* Hero Reputation Card */}
        <div className="animate-fade-in-up stagger-1" style={{
          background: `linear-gradient(135deg, ${repLevel.glow}, rgba(14,14,14,0.98))`,
          border: `1px solid ${repLevel.color}40`,
          borderRadius: 24, padding: "32px", marginBottom: 24,
          boxShadow: `0 0 40px ${repLevel.glow}, 0 8px 40px rgba(0,0,0,0.6)`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", marginBottom: 24 }}>
            {/* Badge */}
            <div style={{
              width: 80, height: 80, borderRadius: "50%", flexShrink: 0,
              background: `radial-gradient(circle at 30% 30%, ${repLevel.color}30, transparent)`,
              border: `3px solid ${repLevel.color}60`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 36,
              boxShadow: `0 0 30px ${repLevel.glow}, 0 0 60px ${repLevel.glow}`,
              animation: "pulse 3s ease-in-out infinite",
            }}>
              {repLevel.badge}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ color: repLevel.color, fontWeight: 700, fontSize: "1.4rem", marginBottom: 4, fontFamily: "'Cormorant Garamond', serif" }}>
                {repLevel.title}
              </p>
              {specialTitle && (
                <p style={{ color: "#888", fontSize: "0.82rem", marginBottom: 4 }}>✦ {specialTitle}</p>
              )}
              <p style={{ color: "#555", fontSize: "0.78rem" }}>Apartment {String(residentData.apartmentNumber || "")}</p>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p style={{ color: repLevel.color, fontSize: "3rem", fontWeight: 700, fontFamily: "'Cormorant Garamond', serif", lineHeight: 1 }}>
                {repPts}
              </p>
              <p style={{ color: "#444", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>points</p>
            </div>
          </div>

          {/* Rank badge */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 16px", fontSize: "0.82rem", color: "#888" }}>
              🏆 Community Rank #{myRank} of {leaderboard.length}
            </div>
            <div style={{ background: `${repLevel.color}15`, border: `1px solid ${repLevel.color}30`, borderRadius: 10, padding: "8px 16px", fontSize: "0.82rem", color: repLevel.color, fontWeight: 600 }}>
              {repLevel.badge} {repLevel.title}
            </div>
          </div>

          {/* Progress to next tier */}
          {repPts < 1000 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.75rem" }}>
                <span style={{ color: "#555" }}>{repLevel.title} ({repLevel.minScore})</span>
                <span style={{ color: repLevel.color }}>{repProg}% → next tier</span>
              </div>
              <div style={{ background: "#1a1a1a", borderRadius: 999, height: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{
                  height: "100%", borderRadius: 999,
                  background: `linear-gradient(90deg, ${repLevel.color}60, ${repLevel.color})`,
                  width: `${repProg}%`, transition: "width 1s ease",
                  boxShadow: `0 0 10px ${repLevel.color}80`,
                }} />
              </div>
              {(() => {
                const nextTier = REPUTATION_LEVELS.find((l) => l.minScore > repPts);
                return nextTier ? (
                  <p style={{ color: "#444", fontSize: "0.72rem", marginTop: 6 }}>
                    {nextTier.minScore - repPts} points to {nextTier.badge} {nextTier.title}
                  </p>
                ) : null;
              })()}
            </div>
          )}
          {repPts >= 1000 && (
            <div style={{ background: `${repLevel.color}15`, border: `1px solid ${repLevel.color}30`, borderRadius: 12, padding: "12px 16px", textAlign: "center" }}>
              <p style={{ color: repLevel.color, fontWeight: 700, fontSize: "0.9rem" }}>👑 Maximum Reputation Achieved!</p>
            </div>
          )}
        </div>

        {/* All Tiers Preview */}
        <div className="animate-fade-in-up stagger-2" style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {REPUTATION_LEVELS.map((tier) => (
            <div key={tier.title} style={{
              flex: "1 1 auto", minWidth: 90,
              background: repPts >= tier.minScore ? `${tier.color}12` : "rgba(255,255,255,0.02)",
              border: repPts >= tier.minScore ? `1px solid ${tier.color}40` : "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12, padding: "12px 8px", textAlign: "center",
              opacity: repPts >= tier.minScore ? 1 : 0.35,
              transition: "all 0.3s",
              boxShadow: repPts >= tier.minScore ? `0 0 16px ${tier.glow}` : "none",
            }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{tier.badge}</div>
              <div style={{ color: repPts >= tier.minScore ? tier.color : "#555", fontSize: "0.68rem", fontWeight: 700, marginBottom: 2 }}>
                {tier.title.split(" ")[0]}
              </div>
              <div style={{ color: "#333", fontSize: "0.6rem" }}>{tier.minScore}+</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="animate-fade-in-up stagger-2" style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 0 }}>
          <button onClick={() => setActiveTab("overview")}    style={tabStyle(activeTab === "overview")}>Overview</button>
          <button onClick={() => setActiveTab("history")}     style={tabStyle(activeTab === "history")}>History ({history.length})</button>
          <button onClick={() => setActiveTab("leaderboard")} style={tabStyle(activeTab === "leaderboard")}>Leaderboard</button>
        </div>

        {/* Tab: Overview */}
        {activeTab === "overview" && (
          <div className="animate-fade-in">
            {/* How to earn */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              {/* Earn points */}
              <div style={{ background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.12)", borderRadius: 16, padding: "20px" }}>
                <p style={{ color: "#4ade80", fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>
                  ↑ Earn Points
                </p>
                {[
                  { label: "Maintenance on time", pts: "+15" },
                  { label: "Featured resident",   pts: "+15" },
                  { label: "Admin appreciation",  pts: "+20" },
                  { label: "Challenge completed", pts: "+10" },
                  { label: "Tournament win",      pts: "+20" },
                  { label: "Poll participation",  pts: "+5"  },
                  { label: "Event participation", pts: "+6"  },
                  { label: "Floor war contrib.",  pts: "+8"  },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.82rem" }}>
                    <span style={{ color: "#666" }}>{item.label}</span>
                    <span style={{ color: "#4ade80", fontWeight: 700 }}>{item.pts}</span>
                  </div>
                ))}
              </div>
              {/* Lose points */}
              <div style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.12)", borderRadius: 16, padding: "20px" }}>
                <p style={{ color: "#f87171", fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>
                  ↓ Lose Points
                </p>
                {[
                  { label: "Misconduct warning",  pts: "-25" },
                  { label: "Unpaid maintenance",  pts: "-20" },
                  { label: "Late maintenance",     pts: "-15" },
                  { label: "Repeated reports",     pts: "-15" },
                  { label: "Fake complaint",       pts: "-10" },
                  { label: "Late sinking fund",    pts: "-10" },
                  { label: "Late gas bill",        pts: "-8"  },
                  { label: "Inactivity penalty",   pts: "-5"  },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.82rem" }}>
                    <span style={{ color: "#666" }}>{item.label}</span>
                    <span style={{ color: "#f87171", fontWeight: 700 }}>{item.pts}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent activity */}
            {history.length > 0 && (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "20px" }}>
                <p style={{ color: "#555", fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>Recent Activity</p>
                {history.slice(0, 5).map((entry, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, paddingBottom: 10, borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                      background: entry.delta > 0 ? "rgba(74,222,128,0.12)" : "rgba(239,68,68,0.12)",
                      border: entry.delta > 0 ? "1px solid rgba(74,222,128,0.2)" : "1px solid rgba(239,68,68,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, color: entry.delta > 0 ? "#4ade80" : "#f87171", fontWeight: 700,
                    }}>
                      {entry.delta > 0 ? "↑" : "↓"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: "#ccc", fontSize: "0.85rem", marginBottom: 2 }}>{entry.reason}</p>
                      <p style={{ color: "#444", fontSize: "0.72rem" }}>{entry.source === "admin" ? "👤 Admin" : "🤖 System"} · {relativeTime(entry.timestamp)}</p>
                    </div>
                    <div style={{ fontWeight: 700, color: entry.delta > 0 ? "#4ade80" : "#f87171", fontSize: "0.95rem", flexShrink: 0 }}>
                      {entry.delta > 0 ? "+" : ""}{entry.delta}
                    </div>
                  </div>
                ))}
                <button onClick={() => setActiveTab("history")} style={{ marginTop: 4, background: "transparent", border: "none", color: "#555", fontSize: "0.78rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                  View full history →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab: History */}
        {activeTab === "history" && (
          <div className="animate-fade-in">
            {history.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📜</div>
                <p style={{ color: "#444" }}>No reputation history yet.</p>
                <p style={{ color: "#333", fontSize: "0.82rem", marginTop: 8 }}>Participate in community activities to earn reputation.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {history.map((entry, i) => (
                  <div key={i} style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderLeft: `3px solid ${entry.delta > 0 ? "#4ade80" : "#f87171"}`,
                    borderRadius: "0 12px 12px 0",
                    padding: "14px 18px",
                    display: "flex", alignItems: "center", gap: 14,
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                      background: entry.delta > 0 ? "rgba(74,222,128,0.1)" : "rgba(239,68,68,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18,
                    }}>
                      {entry.source === "admin" ? "👤" : "🤖"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: "#ddd", fontSize: "0.88rem", fontWeight: 500, marginBottom: 3 }}>{entry.reason}</p>
                      <p style={{ color: "#444", fontSize: "0.72rem" }}>
                        {entry.source === "admin" ? `Admin${entry.adminName ? `: ${entry.adminName}` : ""}` : "System"}
                        {entry.timestamp ? ` · ${formatTS(entry.timestamp)}` : ""}
                      </p>
                    </div>
                    <div style={{
                      fontWeight: 800, fontSize: "1.1rem",
                      color: entry.delta > 0 ? "#4ade80" : "#f87171",
                      flexShrink: 0, fontFamily: "'Cormorant Garamond', serif",
                    }}>
                      {entry.delta > 0 ? "+" : ""}{entry.delta}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Leaderboard */}
        {activeTab === "leaderboard" && (
          <div className="animate-fade-in">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {leaderboard.map((resident, index) => {
                const isMe    = resident.id === uid;
                const lvl     = getReputationLevel(resident.repPts);
                const medals  = ["🥇","🥈","🥉"];
                return (
                  <div key={resident.id} style={{
                    background: isMe ? `${lvl.color}10` : "rgba(255,255,255,0.02)",
                    border: isMe ? `1px solid ${lvl.color}40` : "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 14, padding: "14px 20px",
                    display: "flex", alignItems: "center", gap: 14,
                    boxShadow: isMe ? `0 0 20px ${lvl.glow}` : "none",
                    transition: "all 0.2s",
                  }}>
                    <div style={{ minWidth: 32, textAlign: "center" }}>
                      {index < 3 ? (
                        <span style={{ fontSize: 20 }}>{medals[index]}</span>
                      ) : (
                        <span style={{ color: "#555", fontWeight: 700, fontSize: "0.88rem" }}>#{index + 1}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 22, flexShrink: 0 }}>{lvl.badge}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <p style={{ fontWeight: 600, color: "#f0ece4", fontSize: "0.95rem" }}>Apt {resident.aptNum}</p>
                        {isMe && <span style={{ background: `${lvl.color}20`, border: `1px solid ${lvl.color}40`, borderRadius: 999, padding: "2px 8px", fontSize: "0.65rem", color: lvl.color, fontWeight: 700 }}>YOU</span>}
                      </div>
                      {resident.names.length > 0 && (
                        <p style={{ color: "#555", fontSize: "0.75rem" }}>{resident.names.slice(0, 2).join(", ")}</p>
                      )}
                      <p style={{ color: lvl.color, fontSize: "0.72rem", fontWeight: 600 }}>{lvl.title}</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ fontWeight: 800, color: index === 0 ? "var(--gold)" : lvl.color, fontSize: "1.3rem", fontFamily: "'Cormorant Garamond', serif", lineHeight: 1 }}>
                        {resident.repPts}
                      </p>
                      <p style={{ color: "#444", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>pts</p>
                    </div>
                    {/* Mini bar */}
                    <div style={{ width: 50 }}>
                      <div style={{ background: "#1a1a1a", borderRadius: 999, height: 4, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 999,
                          background: `linear-gradient(90deg, ${lvl.color}60, ${lvl.color})`,
                          width: `${Math.min(((resident.repPts) / 1000) * 100, 100)}%`,
                          boxShadow: `0 0 6px ${lvl.color}80`,
                        }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
