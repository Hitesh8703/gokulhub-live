"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { accolades } from "@/lib/accolades";

const RARITY_COLORS: Record<string, string> = {
  Common: "#888",
  Uncommon: "#4ade80",
  Rare: "#60a5fa",
  Epic: "#a78bfa",
  Legendary: "#e8c96a",
};

export default function AccoladesPage() {
  const [residentData, setResidentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubSnap: any;
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) { setLoading(false); return; }
      try {
        unsubSnap = onSnapshot(doc(db, "residents", user.uid), (snap) => {
          if (snap.exists()) setResidentData(snap.data());
          setLoading(false);
        });
      } catch { setLoading(false); }
    });
    return () => { unsubAuth(); if (unsubSnap) unsubSnap(); };
  }, []);

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "#050505" }}>
      <div style={{ textAlign: "center" }}>
        <div className="spinner" style={{ margin: "0 auto 20px" }} />
        <p style={{ color: "#777", fontSize: "0.85rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading Accolades</p>
      </div>
    </main>
  );

  if (!residentData) return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "#050505" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ color: "#f0ece4", fontSize: "1.5rem", marginBottom: 20 }}>Failed to Load</h1>
        <Link href="/dashboard" style={{ background: "linear-gradient(135deg, #8a6e2f, #c9a84c)", color: "#0a0800", padding: "12px 24px", borderRadius: 10, textDecoration: "none", fontWeight: 600 }}>Return to Dashboard</Link>
      </div>
    </main>
  );

  const unlocked = residentData.unlockedAccolades || [];
  const unlockedCount = accolades.filter((a) => unlocked.includes(a.id)).length;

  return (
    <main className="min-h-screen" style={{ background: "#050505", padding: "40px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div className="animate-fade-in-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 40 }}>
          <div>
            <p style={{ color: "var(--gold)", fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>Achievements</p>
            <h1 className="display-font" style={{ fontSize: "2.6rem", color: "#f0ece4" }}>🏅 Accolades</h1>
            <p style={{ color: "#666", marginTop: 6, fontSize: "0.9rem" }}>
              <span style={{ color: "var(--gold)", fontWeight: 600 }}>{unlockedCount}</span> / {accolades.length} unlocked
            </p>
          </div>
          <Link href="/dashboard" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 18px", color: "#888", textDecoration: "none", fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem" }}>
            ← Dashboard
          </Link>
        </div>

        {/* Progress bar */}
        <div className="animate-fade-in-up stagger-1 glass-card" style={{ padding: "20px 24px", marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: "0.82rem", color: "#666" }}>
            <span>Collection Progress</span>
            <span className="gold-text">{Math.round((unlockedCount / accolades.length) * 100)}%</span>
          </div>
          <div className="xp-bar-track">
            <div className="xp-bar-fill" style={{ width: `${(unlockedCount / accolades.length) * 100}%` }} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
          {accolades.map((accolade, i) => {
            const isUnlocked = unlocked.includes(accolade.id);
            return (
              <div key={accolade.id}
                className={`premium-card animate-fade-in-up stagger-${Math.min(i + 2, 8)}`}
                style={{
                  padding: 22,
                  opacity: isUnlocked ? 1 : 0.45,
                  border: isUnlocked ? "1px solid var(--border-hover)" : "1px solid rgba(255,255,255,0.06)",
                  boxShadow: isUnlocked ? "0 0 20px rgba(201,168,76,0.1)" : "none",
                  transition: "all 0.3s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{
                    padding: "3px 10px", borderRadius: 999, fontSize: "0.7rem", fontWeight: 600,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    color: RARITY_COLORS[accolade.rarity] || "#888",
                    background: `${RARITY_COLORS[accolade.rarity] || "#888"}18`,
                    border: `1px solid ${RARITY_COLORS[accolade.rarity] || "#888"}40`,
                  }}>
                    {accolade.rarity}
                  </div>
                  {isUnlocked ? (
                    <span style={{ fontSize: 18 }}>✅</span>
                  ) : (
                    <span style={{ fontSize: 18 }}>🔒</span>
                  )}
                </div>
                <h2 style={{ fontSize: "1rem", fontWeight: 700, color: isUnlocked ? "#f0ece4" : "#666", marginBottom: 8 }}>
                  {accolade.title}
                </h2>
                <p style={{ color: "#666", fontSize: "0.82rem", lineHeight: 1.5, marginBottom: 12 }}>
                  {accolade.description}
                </p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.78rem", color: "#555" }}>Reward</span>
                  <span style={{ fontWeight: 700, color: isUnlocked ? "var(--gold)" : "#555", fontSize: "0.9rem" }}>+{accolade.xp} XP</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
