"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import Link from "next/link";
import {
  computeReputationPoints,
  getReputationLevel,
} from "@/lib/reputation";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const [residents, setResidents]   = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState<"xp" | "reputation">("xp");

  useEffect(() => {
    const fetchData = async () => {
      const snapshot = await getDocs(collection(db, "residents"));
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setResidents(data);
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "#050505" }}>
      <div style={{ textAlign: "center" }}>
        <div className="spinner" style={{ margin: "0 auto 20px" }} />
        <p style={{ color: "#777", fontSize: "0.85rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading Leaderboard</p>
      </div>
    </main>
  );

  const xpSorted  = [...residents].sort((a, b) => (b.xp || 0) - (a.xp || 0));
  const repSorted = [...residents].map((r) => ({
    ...r,
    _repPts: computeReputationPoints(r as Record<string, unknown>),
  })).sort((a, b) => b._repPts - a._repPts);

  const tabStyle = (active: boolean) => ({
    padding: "10px 22px", borderRadius: 10, fontSize: "0.88rem", fontWeight: 600 as const,
    cursor: "pointer" as const, fontFamily: "'DM Sans', sans-serif", border: "none",
    background: active ? "rgba(201,168,76,0.15)" : "transparent",
    color: active ? "var(--gold)" : "#555",
    borderBottom: active ? "2px solid var(--gold)" : "2px solid transparent",
    transition: "all 0.2s",
  });

  return (
    <main className="min-h-screen" style={{ background: "#050505", padding: "40px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Header */}
        <div className="animate-fade-in-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 40, flexWrap: "wrap", gap: 12 }}>
          <div>
            <p style={{ color: "var(--gold)", fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>Rankings</p>
            <h1 className="display-font" style={{ fontSize: "2.6rem", color: "#f0ece4" }}>🏆 Leaderboard</h1>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/reputation" style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 10, padding: "10px 18px", color: "var(--gold)", textDecoration: "none", fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", fontWeight: 600 }}>
              ★ My Reputation
            </Link>
            <Link href="/dashboard" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 18px", color: "#888", textDecoration: "none", fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem" }}>
              ← Dashboard
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="animate-fade-in-up stagger-1" style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => setActiveTab("xp")}         style={tabStyle(activeTab === "xp")}>⚡ XP Rankings</button>
          <button onClick={() => setActiveTab("reputation")} style={tabStyle(activeTab === "reputation")}>⭐ Reputation Rankings</button>
        </div>

        {/* XP Tab */}
        {activeTab === "xp" && (
          <div className="animate-fade-in">
            {xpSorted.length >= 3 && (
              <div className="animate-fade-in-up stagger-1" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 32 }}>
                {[xpSorted[1], xpSorted[0], xpSorted[2]].map((resident, i) => {
                  const rank = i === 1 ? 1 : i === 0 ? 2 : 3;
                  return (
                    <div key={resident.apartmentNumber} style={{
                      background: rank === 1 ? "linear-gradient(145deg, rgba(201,168,76,0.15), rgba(201,168,76,0.05))" : "rgba(255,255,255,0.03)",
                      border: rank === 1 ? "1px solid var(--border-hover)" : "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 16, padding: "20px 12px", textAlign: "center",
                      marginBottom: rank === 1 ? 0 : 12,
                    }}>
                      <div style={{ fontSize: rank === 1 ? 32 : 24, marginBottom: 8 }}>{MEDALS[rank - 1]}</div>
                      <p style={{ fontWeight: 700, color: rank === 1 ? "var(--gold-light)" : "#f0ece4", fontSize: "1rem" }}>
                        Apt {resident.apartmentNumber}
                      </p>
                      <p style={{ color: rank === 1 ? "var(--gold)" : "#555", fontSize: "0.85rem", fontWeight: 700, marginTop: 4 }}>
                        {resident.xp || 0} XP
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {xpSorted.map((resident, index) => (
                <div key={index} className={`premium-card animate-fade-in-up stagger-${Math.min(index + 2, 8)}`}
                  style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ minWidth: 32, textAlign: "center" }}>
                    {index < 3 ? <span style={{ fontSize: 20 }}>{MEDALS[index]}</span> : <span style={{ color: "#555", fontWeight: 700, fontSize: "0.9rem" }}>#{index + 1}</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, color: "#f0ece4", marginBottom: 2 }}>Apartment {resident.apartmentNumber}</p>
                    {resident.residentNames?.length > 0 && (
                      <p style={{ color: "#555", fontSize: "0.78rem", marginBottom: 2 }}>
                        {resident.residentNames.slice(0, 2).join(", ")}{resident.residentNames.length > 2 ? ` +${resident.residentNames.length - 2}` : ""}
                      </p>
                    )}
                    <p style={{ color: "#666", fontSize: "0.82rem" }}>Streak: {resident.streak || 0} days · Level {resident.level || 1}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontWeight: 700, color: index === 0 ? "var(--gold)" : "#ccc", fontSize: "1.2rem" }}>{resident.xp || 0}</p>
                    <p style={{ color: "#555", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>XP</p>
                  </div>
                  <div style={{ width: 60 }}>
                    <div style={{ background: "#1e1e1e", borderRadius: 999, height: 4, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 999,
                        background: "linear-gradient(90deg, var(--gold-dim), var(--gold))",
                        width: `${Math.min(((resident.xp || 0) / Math.max(xpSorted[0]?.xp || 1, 1)) * 100, 100)}%`,
                      }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reputation Tab */}
        {activeTab === "reputation" && (
          <div className="animate-fade-in">
            {/* Top 3 podium */}
            {repSorted.length >= 3 && (
              <div className="animate-fade-in-up stagger-1" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 32 }}>
                {[repSorted[1], repSorted[0], repSorted[2]].map((resident, i) => {
                  const rank = i === 1 ? 1 : i === 0 ? 2 : 3;
                  const lvl  = getReputationLevel(resident._repPts);
                  return (
                    <div key={resident.apartmentNumber} style={{
                      background: rank === 1
                        ? `linear-gradient(145deg, ${lvl.glow}, rgba(255,255,255,0.02))`
                        : "rgba(255,255,255,0.02)",
                      border: rank === 1 ? `1px solid ${lvl.color}50` : "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 16, padding: "20px 12px", textAlign: "center",
                      marginBottom: rank === 1 ? 0 : 12,
                      boxShadow: rank === 1 ? `0 0 24px ${lvl.glow}` : "none",
                    }}>
                      <div style={{ fontSize: rank === 1 ? 28 : 20, marginBottom: 6 }}>{lvl.badge}</div>
                      <div style={{ fontSize: rank === 1 ? 28 : 20, marginBottom: 8 }}>{MEDALS[rank - 1]}</div>
                      <p style={{ fontWeight: 700, color: rank === 1 ? lvl.color : "#f0ece4", fontSize: "0.95rem" }}>
                        Apt {resident.apartmentNumber}
                      </p>
                      <p style={{ color: "#555", fontSize: "0.72rem", marginTop: 2 }}>{lvl.title}</p>
                      <p style={{ color: lvl.color, fontSize: "0.9rem", fontWeight: 800, marginTop: 4 }}>
                        {resident._repPts} pts
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {repSorted.map((resident, index) => {
                const lvl = getReputationLevel(resident._repPts);
                return (
                  <div key={index} className={`premium-card animate-fade-in-up stagger-${Math.min(index + 2, 8)}`}
                    style={{
                      padding: "16px 20px", display: "flex", alignItems: "center", gap: 16,
                      background: index === 0 ? `linear-gradient(145deg, ${lvl.glow}, rgba(14,14,14,0.98))` : undefined,
                      border: index === 0 ? `1px solid ${lvl.color}40` : undefined,
                      boxShadow: index === 0 ? `0 0 24px ${lvl.glow}` : undefined,
                    }}>
                    <div style={{ minWidth: 32, textAlign: "center" }}>
                      {index < 3 ? <span style={{ fontSize: 20 }}>{MEDALS[index]}</span> : <span style={{ color: "#555", fontWeight: 700, fontSize: "0.9rem" }}>#{index + 1}</span>}
                    </div>
                    <div style={{ fontSize: 22, flexShrink: 0 }}>{lvl.badge}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, color: "#f0ece4", marginBottom: 2 }}>Apartment {resident.apartmentNumber}</p>
                      {resident.residentNames?.length > 0 && (
                        <p style={{ color: "#555", fontSize: "0.78rem", marginBottom: 2 }}>
                          {resident.residentNames.slice(0, 2).join(", ")}
                        </p>
                      )}
                      <p style={{ color: lvl.color, fontSize: "0.75rem", fontWeight: 600 }}>{lvl.title}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontWeight: 800, color: index === 0 ? lvl.color : "#ccc", fontSize: "1.3rem", fontFamily: "'Cormorant Garamond', serif", lineHeight: 1 }}>
                        {resident._repPts}
                      </p>
                      <p style={{ color: "#555", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>pts</p>
                    </div>
                    <div style={{ width: 60 }}>
                      <div style={{ background: "#1e1e1e", borderRadius: 999, height: 4, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 999,
                          background: `linear-gradient(90deg, ${lvl.color}60, ${lvl.color})`,
                          width: `${Math.min((resident._repPts / 1000) * 100, 100)}%`,
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
