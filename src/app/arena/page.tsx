"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, doc, getDoc, query, orderBy, limit,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { computeReputationPoints, getReputationLevel } from "@/lib/reputation";
import {
  FLOOR_CONFIG,
  SEED_FLOOR_WAR,
  SEED_MISSIONS,
  MISSION_DIFFICULTY_META,
  ARENA_BADGES,
  FloorWarEntry,
  ArenaStats,
  getCurrentWeekLabel,
  getFloorFromApartment,
  getArenaRankLabel,
} from "@/lib/arena";

// ── Style helpers ─────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: "100vh",
    background: "#050505",
    padding: "40px 24px 80px",
  } as React.CSSProperties,
  wrap: { maxWidth: 900, margin: "0 auto" } as React.CSSProperties,
  sectionLabel: {
    color: "var(--gold)",
    fontSize: "0.72rem",
    letterSpacing: "0.18em",
    textTransform: "uppercase" as const,
    marginBottom: 6,
  },
  h1: {
    fontSize: "2.8rem",
    color: "#f0ece4",
    fontFamily: "'Cormorant Garamond', serif",
    fontWeight: 700,
    lineHeight: 1.1,
  },
  card: {
    background: "linear-gradient(145deg, rgba(20,18,14,0.97), rgba(14,14,14,0.99))",
    border: "1px solid rgba(201,168,76,0.18)",
    borderRadius: 20,
    padding: "24px 28px",
    marginBottom: 20,
  } as React.CSSProperties,
  tabRow: {
    display: "flex",
    gap: 6,
    marginBottom: 32,
    flexWrap: "wrap" as const,
    borderBottom: "1px solid rgba(201,168,76,0.12)",
    paddingBottom: 2,
  },
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: "10px 20px",
    borderRadius: "10px 10px 0 0",
    fontSize: "0.85rem",
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    fontFamily: "'DM Sans', sans-serif",
    background: active ? "rgba(201,168,76,0.12)" : "transparent",
    color: active ? "var(--gold)" : "#555",
    borderBottom: active ? "2px solid var(--gold)" : "2px solid transparent",
    transition: "all 0.2s",
    letterSpacing: "0.03em",
  };
}

// ── Neon progress bar ─────────────────────────────────────────────────────────

function NeonBar({
  value, max, color, height = 8,
}: { value: number; max: number; color: string; height?: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{
      background: "rgba(255,255,255,0.05)", borderRadius: 999,
      height, overflow: "hidden",
    }}>
      <div style={{
        width: `${pct}%`, height: "100%", borderRadius: 999,
        background: `linear-gradient(90deg, ${color}99, ${color})`,
        boxShadow: `0 0 8px ${color}88`,
        transition: "width 1.2s cubic-bezier(0.23,1,0.32,1)",
      }} />
    </div>
  );
}

// ── Animated border card ──────────────────────────────────────────────────────

function GlowCard({
  color, children, style,
}: { color: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "linear-gradient(145deg, rgba(20,18,14,0.97), rgba(10,10,10,0.99))",
      border: `1px solid ${color}44`,
      borderRadius: 18,
      padding: "20px 24px",
      boxShadow: `0 0 24px ${color}22, inset 0 0 40px ${color}08`,
      transition: "all 0.3s ease",
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ icon, label, sub }: { icon: string; label: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={S.sectionLabel}>{icon} {label}</p>
      {sub && <p style={{ color: "#555", fontSize: "0.82rem", marginTop: 2 }}>{sub}</p>}
    </div>
  );
}

// ── Coming Soon card ──────────────────────────────────────────────────────────

function ComingSoonCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{
      background: "linear-gradient(145deg, rgba(20,18,14,0.95), rgba(14,14,14,0.98))",
      border: "1px dashed rgba(201,168,76,0.2)",
      borderRadius: 18,
      padding: "28px 24px",
      textAlign: "center",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at 50% 0%, rgba(201,168,76,0.04) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{ fontSize: "2.2rem", marginBottom: 12 }}>{icon}</div>
      <p style={{ color: "#f0ece4", fontWeight: 600, fontSize: "1rem", marginBottom: 6 }}>{title}</p>
      <p style={{ color: "#555", fontSize: "0.8rem", marginBottom: 16 }}>{desc}</p>
      <span style={{
        display: "inline-block",
        padding: "4px 14px",
        borderRadius: 999,
        background: "rgba(201,168,76,0.08)",
        border: "1px solid rgba(201,168,76,0.2)",
        color: "var(--gold)",
        fontSize: "0.7rem",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        fontWeight: 700,
      }}>
        Coming Soon
      </span>
    </div>
  );
}

// ── Floor War Section ─────────────────────────────────────────────────────────

function FloorWarsSection({ floors, residents }: { floors: FloorWarEntry[]; residents: ResidentRow[] }) {
  const sorted = [...floors].sort((a, b) => b.totalPoints - a.totalPoints);
  const maxPts = sorted[0]?.totalPoints || 1;

  // Build VS matchups: pair top vs bottom, 2nd vs 2nd-last, etc.
  const pairs: [FloorWarEntry, FloorWarEntry][] = [];
  for (let i = 0; i < Math.floor(sorted.length / 2); i++) {
    pairs.push([sorted[i], sorted[sorted.length - 1 - i]]);
  }

  return (
    <div>
      <SectionHeader icon="⚔️" label="Floor Wars" sub={`Week of ${getCurrentWeekLabel()} — floors compete for dominance`} />

      {/* Rankings */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: "#777", fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
          🏆 Floor Rankings
        </p>
        {sorted.map((f, i) => {
          const cfg = FLOOR_CONFIG[f.floor] ?? FLOOR_CONFIG[0];
          const medal = ["🥇", "🥈", "🥉"][i] ?? `#${i + 1}`;
          return (
            <div key={f.floor} className="animate-fade-in-up" style={{
              animationDelay: `${i * 0.07}s`,
              background: "rgba(255,255,255,0.02)",
              border: `1px solid ${cfg.color}22`,
              borderRadius: 14,
              padding: "16px 20px",
              marginBottom: 10,
              boxShadow: i === 0 ? `0 0 20px ${cfg.color}22` : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                <span style={{ fontSize: "1.3rem", minWidth: 28 }}>{medal}</span>
                <span style={{ fontSize: "1.4rem" }}>{cfg.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ color: cfg.color, fontWeight: 700, fontSize: "0.95rem" }}>{cfg.label}</p>
                  <p style={{ color: "#555", fontSize: "0.75rem" }}>
                    {f.residentCount} residents · MVP: {f.mvpName} (Apt {f.mvpApt})
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ color: cfg.color, fontWeight: 700, fontSize: "1.1rem" }}>{f.totalPoints.toLocaleString()}</p>
                  <p style={{
                    fontSize: "0.72rem",
                    color: f.weeklyDelta >= 0 ? "#4ade80" : "#f87171",
                  }}>
                    {f.weeklyDelta >= 0 ? "▲" : "▼"} {Math.abs(f.weeklyDelta)} this week
                  </p>
                </div>
              </div>
              <NeonBar value={f.totalPoints} max={maxPts} color={cfg.color} height={6} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: "0.72rem", color: "#444" }}>
                <span>⭐ {f.reputationPoints.toLocaleString()} reputation pts</span>
                <span>👑 MVP XP: {f.mvpXP.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Battle Cards */}
      <p style={{ color: "#777", fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
        ⚔️ Battle Matchups
      </p>
      <div style={{ display: "grid", gap: 14 }}>
        {pairs.map(([a, b]) => {
          const cfgA = FLOOR_CONFIG[a.floor] ?? FLOOR_CONFIG[0];
          const cfgB = FLOOR_CONFIG[b.floor] ?? FLOOR_CONFIG[0];
          const total = a.totalPoints + b.totalPoints;
          const pctA = total > 0 ? (a.totalPoints / total) * 100 : 50;
          return (
            <div key={`${a.floor}-${b.floor}`} style={{
              background: "rgba(255,255,255,0.015)",
              border: "1px solid rgba(201,168,76,0.12)",
              borderRadius: 16,
              padding: "20px 24px",
              position: "relative",
              overflow: "hidden",
            }}>
              {/* VS glow */}
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%,-50%)",
                width: 60, height: 60,
                background: "radial-gradient(circle, rgba(201,168,76,0.15), transparent 70%)",
                borderRadius: "50%", pointerEvents: "none",
              }} />

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                {/* Floor A */}
                <div style={{ textAlign: "left", flex: 1 }}>
                  <div style={{ fontSize: "1.8rem", marginBottom: 4 }}>{cfgA.icon}</div>
                  <p style={{ color: cfgA.color, fontWeight: 700, fontSize: "0.9rem" }}>{cfgA.label}</p>
                  <p style={{ color: "#555", fontSize: "0.72rem" }}>Fl {a.floor}</p>
                  <p style={{ color: cfgA.color, fontSize: "1.2rem", fontWeight: 800, marginTop: 4 }}>{a.totalPoints.toLocaleString()}</p>
                </div>

                {/* VS */}
                <div style={{ textAlign: "center", padding: "0 16px" }}>
                  <p style={{
                    fontSize: "1rem", fontWeight: 900, letterSpacing: "0.1em",
                    color: "var(--gold)", fontFamily: "'Cormorant Garamond', serif",
                  }}>VS</p>
                </div>

                {/* Floor B */}
                <div style={{ textAlign: "right", flex: 1 }}>
                  <div style={{ fontSize: "1.8rem", marginBottom: 4 }}>{cfgB.icon}</div>
                  <p style={{ color: cfgB.color, fontWeight: 700, fontSize: "0.9rem" }}>{cfgB.label}</p>
                  <p style={{ color: "#555", fontSize: "0.72rem" }}>Fl {b.floor}</p>
                  <p style={{ color: cfgB.color, fontSize: "1.2rem", fontWeight: 800, marginTop: 4 }}>{b.totalPoints.toLocaleString()}</p>
                </div>
              </div>

              {/* Dual progress bar */}
              <div style={{ display: "flex", gap: 0, height: 8, borderRadius: 999, overflow: "hidden" }}>
                <div style={{
                  width: `${pctA}%`, height: "100%",
                  background: `linear-gradient(90deg, ${cfgA.color}88, ${cfgA.color})`,
                  transition: "width 1.2s ease",
                }} />
                <div style={{
                  flex: 1, height: "100%",
                  background: `linear-gradient(90deg, ${cfgB.color}, ${cfgB.color}88)`,
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: "0.7rem", color: "#444" }}>
                <span>{pctA.toFixed(0)}%</span>
                <span>{(100 - pctA).toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Passive points info */}
      <div style={{
        marginTop: 24,
        background: "rgba(201,168,76,0.04)",
        border: "1px solid rgba(201,168,76,0.12)",
        borderRadius: 14,
        padding: "18px 22px",
      }}>
        <p style={{ color: "var(--gold)", fontWeight: 600, fontSize: "0.85rem", marginBottom: 10 }}>
          ⚡ How Floors Earn Points
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            ["💰 Maintenance Paid", "+15 pts"],
            ["🏦 Sinking Fund Paid", "+10 pts"],
            ["🔥 Gas Bill Paid", "+8 pts"],
            ["📊 Poll Vote", "+5 pts"],
            ["🏆 Challenge Progress", "+10 pts"],
            ["⭐ Reputation Gain", "+1 pt per rep"],
            ["📅 Daily Check-In", "+2 pts"],
            ["🏅 Accolade Earned", "+5 pts"],
          ].map(([label, pts]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#666", fontSize: "0.78rem" }}>{label}</span>
              <span style={{ color: "#4ade80", fontSize: "0.75rem", fontWeight: 700 }}>{pts}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── War Missions Section ──────────────────────────────────────────────────────

function WarMissionsSection() {
  const [activeType, setActiveType] = useState<"all" | "community" | "hidden" | "competitive">("all");

  const filtered = activeType === "all"
    ? SEED_MISSIONS
    : SEED_MISSIONS.filter((m) => m.type === activeType);

  const typeBtn = (t: typeof activeType, label: string) => (
    <button
      onClick={() => setActiveType(t)}
      style={{
        padding: "6px 16px", borderRadius: 999,
        fontSize: "0.78rem", fontWeight: 600,
        cursor: "pointer",
        fontFamily: "'DM Sans', sans-serif",
        background: activeType === t ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.03)",
        color: activeType === t ? "var(--gold)" : "#555",
        border: activeType === t ? "1px solid rgba(201,168,76,0.3)" : "1px solid rgba(255,255,255,0.06)",
        transition: "all 0.2s",
      } as React.CSSProperties}
    >
      {label}
    </button>
  );

  return (
    <div>
      <SectionHeader
        icon="🎯"
        label="War Missions"
        sub="Complete missions to earn War XP, Tournament XP, and Floor Points"
      />

      {/* Info box */}
      <div style={{
        background: "rgba(167,139,250,0.06)",
        border: "1px solid rgba(167,139,250,0.2)",
        borderRadius: 12,
        padding: "14px 18px",
        marginBottom: 20,
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}>
        <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>ℹ️</span>
        <div>
          <p style={{ color: "#c4b5fd", fontWeight: 600, fontSize: "0.85rem", marginBottom: 4 }}>
            Tournament XP is separate from your normal XP
          </p>
          <p style={{ color: "#666", fontSize: "0.78rem", lineHeight: 1.5 }}>
            Tournament XP determines tournament brackets and resets every tournament week. Normal XP never resets.
          </p>
        </div>
      </div>

      {/* Type filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {typeBtn("all", "⚔️ All Missions")}
        {typeBtn("community", "🤝 Community")}
        {typeBtn("hidden", "🔍 Hidden")}
        {typeBtn("competitive", "🏆 Competitive")}
      </div>

      {/* Mission cards */}
      <div style={{ display: "grid", gap: 12 }}>
        {filtered.map((m, i) => {
          const diff = MISSION_DIFFICULTY_META[m.difficulty];
          const typeColors: Record<string, string> = {
            community: "#60a5fa",
            hidden: "#a78bfa",
            competitive: "#f97316",
          };
          const typeColor = typeColors[m.type] ?? "#888";

          return (
            <div key={m.title} className="animate-fade-in-up" style={{
              animationDelay: `${i * 0.06}s`,
              background: "rgba(255,255,255,0.018)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16,
              padding: "18px 22px",
              display: "flex",
              gap: 16,
              alignItems: "flex-start",
              transition: "border-color 0.3s",
            }}>
              {/* Icon */}
              <div style={{
                width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                background: `${typeColor}18`,
                border: `1px solid ${typeColor}33`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.4rem",
              }}>
                {m.icon}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <p style={{ color: "#f0ece4", fontWeight: 700, fontSize: "0.92rem" }}>{m.title}</p>
                  <span style={{
                    padding: "2px 10px", borderRadius: 999,
                    fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                    background: diff.bg, color: diff.color,
                  }}>
                    {diff.label}
                  </span>
                  <span style={{
                    padding: "2px 10px", borderRadius: 999,
                    fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                    background: `${typeColor}15`, color: typeColor,
                  }}>
                    {m.type}
                  </span>
                </div>
                <p style={{ color: "#666", fontSize: "0.8rem", marginBottom: 10 }}>{m.description}</p>

                {/* Rewards row */}
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.75rem", color: "#f97316", fontWeight: 600 }}>
                    ⚔️ +{m.warXP} War XP
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#a78bfa", fontWeight: 600 }}>
                    🏆 +{m.tournamentXP} Tournament XP
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#4ade80", fontWeight: 600 }}>
                    🏠 +{m.floorPoints} Floor Pts
                  </span>
                </div>
              </div>

              {/* Status */}
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1rem",
                }}>
                  🔒
                </div>
                <p style={{ color: "#444", fontSize: "0.65rem", marginTop: 4 }}>Locked</p>
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ textAlign: "center", color: "#333", fontSize: "0.78rem", marginTop: 20, fontStyle: "italic" }}>
        Mission completion will be tracked in Phase 2 · Rewards are live
      </p>
    </div>
  );
}

// ── Tournament Section ────────────────────────────────────────────────────────

function TournamentSection({ residents }: { residents: ResidentRow[] }) {
  // Group by floor and pick top 2 per floor (by XP)
  const byFloor: Record<number, ResidentRow[]> = {};
  for (const r of residents) {
    const fl = getFloorFromApartment(r.apartmentNumber || "1");
    if (!byFloor[fl]) byFloor[fl] = [];
    byFloor[fl].push(r);
  }

  const qualifiers = Object.entries(byFloor).flatMap(([floor, rs]) => {
    const sorted = [...rs].sort((a, b) => (b.xp || 0) - (a.xp || 0)).slice(0, 2);
    return sorted.map((r) => ({ ...r, floor: parseInt(floor) }));
  }).sort((a, b) => (b.tournamentXP || b.xp || 0) - (a.tournamentXP || a.xp || 0));

  const top8 = qualifiers.slice(0, 8);

  // Build bracket pairs
  const qfMatches = [
    [top8[0], top8[7]],
    [top8[1], top8[6]],
    [top8[2], top8[5]],
    [top8[3], top8[4]],
  ] as [ResidentRow | undefined, ResidentRow | undefined][];

  function MatchCard({ p1, p2, round }: { p1?: ResidentRow; p2?: ResidentRow; round: string }) {
    const name1 = p1 ? ((p1.residentNames as string[])?.[0] || `Apt ${p1.apartmentNumber}`) : "TBD";
    const name2 = p2 ? ((p2.residentNames as string[])?.[0] || `Apt ${p2.apartmentNumber}`) : "TBD";
    const xp1 = p1?.tournamentXP || p1?.xp || 0;
    const xp2 = p2?.tournamentXP || p2?.xp || 0;
    const fl1 = p1 ? FLOOR_CONFIG[getFloorFromApartment(p1.apartmentNumber || "1")] ?? FLOOR_CONFIG[0] : null;
    const fl2 = p2 ? FLOOR_CONFIG[getFloorFromApartment(p2.apartmentNumber || "1")] ?? FLOOR_CONFIG[0] : null;
    return (
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(201,168,76,0.12)",
        borderRadius: 14,
        padding: "14px 18px",
        flex: 1,
        minWidth: 0,
      }}>
        <p style={{ color: "#444", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>{round}</p>

        {/* P1 */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          {fl1 && <span style={{ fontSize: "1rem" }}>{fl1.icon}</span>}
          <div style={{ flex: 1 }}>
            <p style={{ color: "#f0ece4", fontSize: "0.82rem", fontWeight: 600 }}>{name1}</p>
            {p1 && <p style={{ color: "#555", fontSize: "0.7rem" }}>Apt {p1.apartmentNumber}</p>}
          </div>
          <span style={{ color: "#a78bfa", fontSize: "0.78rem", fontWeight: 700 }}>{xp1.toLocaleString()} TXP</span>
        </div>

        <div style={{ textAlign: "center", color: "var(--gold)", fontSize: "0.7rem", fontWeight: 900, marginBottom: 8 }}>VS</div>

        {/* P2 */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {fl2 && <span style={{ fontSize: "1rem" }}>{fl2.icon}</span>}
          <div style={{ flex: 1 }}>
            <p style={{ color: "#f0ece4", fontSize: "0.82rem", fontWeight: 600 }}>{name2}</p>
            {p2 && <p style={{ color: "#555", fontSize: "0.7rem" }}>Apt {p2.apartmentNumber}</p>}
          </div>
          <span style={{ color: "#a78bfa", fontSize: "0.78rem", fontWeight: 700 }}>{xp2.toLocaleString()} TXP</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        icon="🏆"
        label="Resident Tournaments"
        sub={`Week of ${getCurrentWeekLabel()} · Top 2 per floor qualify · Tournament XP decides winners`}
      />

      {/* Legend */}
      <div style={{
        background: "rgba(167,139,250,0.06)",
        border: "1px solid rgba(167,139,250,0.18)",
        borderRadius: 12, padding: "14px 18px", marginBottom: 24,
        display: "flex", gap: 24, flexWrap: "wrap",
      }}>
        <div>
          <p style={{ color: "#c4b5fd", fontWeight: 700, fontSize: "0.82rem" }}>Tournament XP (TXP)</p>
          <p style={{ color: "#555", fontSize: "0.75rem", marginTop: 2 }}>Resets every tournament · Earned from War Missions</p>
        </div>
        <div>
          <p style={{ color: "#60a5fa", fontWeight: 700, fontSize: "0.82rem" }}>Normal XP</p>
          <p style={{ color: "#555", fontSize: "0.75rem", marginTop: 2 }}>Never resets · Used for leaderboard ranking</p>
        </div>
      </div>

      {/* Bracket */}
      <p style={{ color: "#666", fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
        🥊 Quarterfinals — {top8.length > 0 ? "Seeded from current Tournament XP" : "No participants yet"}
      </p>

      {top8.length >= 2 ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {qfMatches.map(([p1, p2], i) => (
              <MatchCard key={i} p1={p1} p2={p2} round={`QF ${i + 1}`} />
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <MatchCard p1={undefined} p2={undefined} round="SF 1 — Winner QF1 vs Winner QF2" />
            <MatchCard p1={undefined} p2={undefined} round="SF 2 — Winner QF3 vs Winner QF4" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            <MatchCard p1={undefined} p2={undefined} round="🏆 FINAL — Champion Match" />
          </div>
        </>
      ) : (
        <div style={{ textAlign: "center", padding: "40px 24px", color: "#444" }}>
          <p style={{ fontSize: "2rem", marginBottom: 12 }}>⚔️</p>
          <p style={{ fontSize: "0.9rem" }}>Tournament brackets form when residents earn Tournament XP from missions.</p>
        </div>
      )}

      {/* Qualifiers list */}
      {qualifiers.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <p style={{ color: "#666", fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
            📋 Qualified Participants (Top 2 per floor)
          </p>
          {qualifiers.slice(0, 12).map((r, i) => {
            const fl = FLOOR_CONFIG[r.floor ?? 0] ?? FLOOR_CONFIG[0];
            const name = (r.residentNames as string[])?.[0] || `Apt ${r.apartmentNumber}`;
            return (
              <div key={r.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}>
                <span style={{ color: "#555", fontSize: "0.8rem", minWidth: 24 }}>#{i + 1}</span>
                <span style={{ fontSize: "1rem" }}>{fl.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ color: "#f0ece4", fontSize: "0.85rem", fontWeight: 600 }}>{name}</p>
                  <p style={{ color: "#555", fontSize: "0.72rem" }}>{fl.label} · Apt {r.apartmentNumber}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ color: "#a78bfa", fontSize: "0.82rem", fontWeight: 700 }}>
                    {(r.tournamentXP || r.xp || 0).toLocaleString()} TXP
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Arena Leaderboards Section ─────────────────────────────────────────────────

function LeaderboardSection({ residents }: { residents: ResidentRow[] }) {
  const [tab, setTab] = useState<"xp" | "reputation" | "floor" | "tournament">("xp");

  const byXP = [...residents].sort((a, b) => (b.xp || 0) - (a.xp || 0));
  const byRep = [...residents]
    .map((r) => ({ ...r, _rep: computeReputationPoints(r as Record<string, unknown>) }))
    .sort((a, b) => b._rep - a._rep);
  const byTXP = [...residents].sort((a, b) => (b.tournamentXP || 0) - (a.tournamentXP || 0));

  // Floor totals
  const floorTotals: Record<number, number> = {};
  for (const r of residents) {
    const fl = getFloorFromApartment(r.apartmentNumber || "1");
    floorTotals[fl] = (floorTotals[fl] || 0) + (r.xp || 0);
  }
  const byFloor = Object.entries(floorTotals)
    .map(([fl, total]) => ({ floor: parseInt(fl), total }))
    .sort((a, b) => b.total - a.total);

  const MEDALS = ["🥇", "🥈", "🥉"];

  function ResidentRow({ r, rank, value, unit, color }: {
    r: ResidentRow; rank: number; value: number; unit: string; color: string;
  }) {
    const name = (r.residentNames as string[])?.[0] || `Apt ${r.apartmentNumber}`;
    const fl = FLOOR_CONFIG[getFloorFromApartment(r.apartmentNumber || "1")] ?? FLOOR_CONFIG[0];
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "12px 18px",
        background: rank === 1 ? "rgba(201,168,76,0.06)" : "transparent",
        borderRadius: 12,
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        <span style={{ minWidth: 28, fontSize: "1rem" }}>{MEDALS[rank - 1] ?? `#${rank}`}</span>
        <span style={{ fontSize: "1rem" }}>{fl.icon}</span>
        <div style={{ flex: 1 }}>
          <p style={{ color: "#f0ece4", fontSize: "0.88rem", fontWeight: 600 }}>{name}</p>
          <p style={{ color: "#555", fontSize: "0.72rem" }}>Apt {r.apartmentNumber} · {fl.label}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ color, fontSize: "0.92rem", fontWeight: 700 }}>{value.toLocaleString()}</p>
          <p style={{ color: "#444", fontSize: "0.68rem" }}>{unit}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader icon="📊" label="Arena Leaderboards" sub="Multi-dimensional rankings" />

      <div style={S.tabRow}>
        {[
          { key: "xp",         label: "⚡ XP" },
          { key: "reputation", label: "⭐ Reputation" },
          { key: "floor",      label: "🏠 Floors" },
          { key: "tournament", label: "🏆 Tournament" },
        ].map(({ key, label }) => (
          <button key={key} style={tabStyle(tab === key)} onClick={() => setTab(key as typeof tab)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "xp" && (
        <div>
          {byXP.slice(0, 10).map((r, i) => (
            <ResidentRow key={r.id} r={r} rank={i + 1} value={r.xp || 0} unit="XP" color="#fbbf24" />
          ))}
        </div>
      )}

      {tab === "reputation" && (
        <div>
          {byRep.slice(0, 10).map((r, i) => {
            const lvl = getReputationLevel(r._rep);
            return (
              <div key={r.id} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "12px 18px",
                background: i === 0 ? "rgba(201,168,76,0.06)" : "transparent",
                borderRadius: 12,
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}>
                <span style={{ minWidth: 28, fontSize: "1rem" }}>{MEDALS[i] ?? `#${i + 1}`}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ color: "#f0ece4", fontSize: "0.88rem", fontWeight: 600 }}>
                    {(r.residentNames as string[])?.[0] || `Apt ${r.apartmentNumber}`}
                  </p>
                  <p style={{ color: lvl.color, fontSize: "0.72rem" }}>{lvl.badge} {lvl.title}</p>
                </div>
                <p style={{ color: lvl.color, fontSize: "0.92rem", fontWeight: 700 }}>{r._rep} pts</p>
              </div>
            );
          })}
        </div>
      )}

      {tab === "floor" && (
        <div>
          {byFloor.map((f, i) => {
            const cfg = FLOOR_CONFIG[f.floor] ?? FLOOR_CONFIG[0];
            return (
              <div key={f.floor} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "12px 18px",
                background: i === 0 ? `${cfg.color}08` : "transparent",
                borderRadius: 12,
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}>
                <span style={{ minWidth: 28, fontSize: "1rem" }}>{MEDALS[i] ?? `#${i + 1}`}</span>
                <span style={{ fontSize: "1.2rem" }}>{cfg.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ color: cfg.color, fontWeight: 700, fontSize: "0.9rem" }}>{cfg.label}</p>
                  <p style={{ color: "#555", fontSize: "0.72rem" }}>Combined XP</p>
                </div>
                <p style={{ color: cfg.color, fontWeight: 700 }}>{f.total.toLocaleString()}</p>
              </div>
            );
          })}
        </div>
      )}

      {tab === "tournament" && (
        <div>
          {byTXP.length === 0 || byTXP.every((r) => !r.tournamentXP) ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#444" }}>
              <p style={{ fontSize: "1.5rem", marginBottom: 12 }}>🏆</p>
              <p>No Tournament XP earned yet. Complete War Missions to earn TXP.</p>
            </div>
          ) : (
            byTXP.slice(0, 10).map((r, i) => (
              <ResidentRow key={r.id} r={r} rank={i + 1} value={r.tournamentXP || 0} unit="TXP" color="#a78bfa" />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Arena Profile Stats ───────────────────────────────────────────────────────

function ArenaProfileSection({ resident }: { resident: ResidentRow | null }) {
  if (!resident) return null;

  const arenaStats: ArenaStats = {
    residentId: resident.id,
    arenaRank: 0,
    tournamentWins: resident.tournamentWins || 0,
    floorWarWins: resident.floorWarWins || 0,
    currentTournamentXP: resident.tournamentXP || 0,
    totalWarXP: resident.warXP || 0,
    arenaBadges: resident.arenaBadges || [],
    arenaStreak: resident.arenaStreak || 0,
    missionsCompleted: resident.missionsCompleted || 0,
  };

  const floor = getFloorFromApartment(resident.apartmentNumber || "1");
  const flCfg = FLOOR_CONFIG[floor] ?? FLOOR_CONFIG[0];
  const repPts = computeReputationPoints(resident as Record<string, unknown>);
  const repLvl = getReputationLevel(repPts);

  const statCards = [
    { label: "Tournament Wins",  value: arenaStats.tournamentWins,       icon: "🏆", color: "#fbbf24" },
    { label: "Floor War Wins",   value: arenaStats.floorWarWins,          icon: "⚔️",  color: flCfg.color },
    { label: "Tournament XP",    value: arenaStats.currentTournamentXP,   icon: "🎯", color: "#a78bfa" },
    { label: "Total War XP",     value: arenaStats.totalWarXP,            icon: "⚡", color: "#f97316" },
    { label: "Missions Done",    value: arenaStats.missionsCompleted,     icon: "✅", color: "#4ade80" },
    { label: "Arena Streak",     value: arenaStats.arenaStreak,           icon: "🔥", color: "#f97316" },
  ];

  return (
    <div>
      <SectionHeader icon="👤" label="My Arena Profile" sub="Your personal arena statistics" />

      {/* Identity card */}
      <GlowCard color={flCfg.color} style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: `${flCfg.color}20`,
            border: `2px solid ${flCfg.color}55`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.6rem",
          }}>
            {flCfg.icon}
          </div>
          <div>
            <p style={{ color: "#f0ece4", fontWeight: 700, fontSize: "1rem" }}>
              {(resident.residentNames as string[])?.[0] || `Apt ${resident.apartmentNumber}`}
            </p>
            <p style={{ color: flCfg.color, fontSize: "0.8rem", marginTop: 2 }}>
              {flCfg.label} · Apt {resident.apartmentNumber}
            </p>
            <p style={{ color: repLvl.color, fontSize: "0.78rem", marginTop: 2 }}>
              {repLvl.badge} {repLvl.title} · {repPts} rep pts
            </p>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <p style={{ color: "#444", fontSize: "0.7rem" }}>Arena Rank</p>
            <p style={{ color: "var(--gold)", fontWeight: 800, fontSize: "1.4rem" }}>
              {getArenaRankLabel(arenaStats.arenaRank)}
            </p>
          </div>
        </div>
      </GlowCard>

      {/* Stat grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        {statCards.map((s) => (
          <div key={s.label} style={{
            background: `${s.color}08`,
            border: `1px solid ${s.color}22`,
            borderRadius: 14, padding: "16px 14px", textAlign: "center",
          }}>
            <div style={{ fontSize: "1.3rem", marginBottom: 6 }}>{s.icon}</div>
            <p style={{ color: s.color, fontWeight: 800, fontSize: "1.3rem" }}>{s.value}</p>
            <p style={{ color: "#444", fontSize: "0.68rem", marginTop: 2 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Badges */}
      <div>
        <p style={{ color: "#555", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
          Arena Badges
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Object.entries(ARENA_BADGES).map(([key, badge]) => {
            const earned = arenaStats.arenaBadges.includes(key);
            return (
              <div key={key} style={{
                padding: "6px 14px", borderRadius: 999,
                background: earned ? `${badge.color}18` : "rgba(255,255,255,0.03)",
                border: `1px solid ${earned ? badge.color + "44" : "rgba(255,255,255,0.06)"}`,
                display: "flex", alignItems: "center", gap: 6,
                opacity: earned ? 1 : 0.35,
                filter: earned ? "none" : "grayscale(1)",
              }}>
                <span style={{ fontSize: "0.9rem" }}>{badge.icon}</span>
                <span style={{ color: earned ? badge.color : "#555", fontSize: "0.72rem", fontWeight: 600 }}>
                  {badge.label}
                </span>
              </div>
            );
          })}
        </div>
        <p style={{ color: "#333", fontSize: "0.72rem", marginTop: 12, fontStyle: "italic" }}>
          Earn badges by completing arena activities. All badges unlock in Phase 2.
        </p>
      </div>
    </div>
  );
}

// ── Coming Soon Section ───────────────────────────────────────────────────────

function ComingSoonSection() {
  return (
    <div>
      <SectionHeader icon="🚀" label="Coming Soon" sub="Future arena systems in development" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        <ComingSoonCard
          icon="👹"
          title="Apartment Boss Battles"
          desc="Each floor faces a weekly Boss. Defeat it together for massive rewards."
        />
        <ComingSoonCard
          icon="🗺️"
          title="Secret Daily Hunt"
          desc="Find hidden symbols across the app every day for exclusive XP."
        />
        <ComingSoonCard
          icon="🛒"
          title="Arena Shop"
          desc="Spend War XP on exclusive titles, badges, and profile cosmetics."
        />
        <ComingSoonCard
          icon="🌊"
          title="Seasonal Arena"
          desc="Seasonal resets, exclusive season rewards, and legendary title tracks."
        />
      </div>
    </div>
  );
}

// ── Resident type ─────────────────────────────────────────────────────────────

interface ResidentRow {
  id: string;
  residentNames?: unknown;
  apartmentNumber?: string;
  xp?: number;
  level?: number;
  reputationPoints?: number;
  tournamentXP?: number;
  tournamentWins?: number;
  floorWarWins?: number;
  warXP?: number;
  arenaBadges?: string[];
  arenaStreak?: number;
  missionsCompleted?: number;
  [key: string]: unknown;
}

// ── Main Arena Page ───────────────────────────────────────────────────────────

export default function ArenaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [resident, setResident] = useState<ResidentRow | null>(null);
  const [residents, setResidents] = useState<ResidentRow[]>([]);
  const [activeTab, setActiveTab] = useState<
    "floor-wars" | "missions" | "tournament" | "leaderboard" | "profile" | "coming-soon"
  >("floor-wars");

  const loadData = useCallback(async (uid: string) => {
    try {
      const [meSnap, allSnap] = await Promise.all([
        getDoc(doc(db, "residents", uid)),
        getDocs(collection(db, "residents")),
      ]);
      if (meSnap.exists()) {
        setResident({ id: meSnap.id, ...meSnap.data() } as ResidentRow);
      }
      setResidents(allSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ResidentRow)));
    } catch (e) {
      console.error("Arena load error:", e);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      await loadData(user.uid);
      setLoading(false);
    });
    return () => unsub();
  }, [router, loadData]);

  // Build floor war entries from live resident data
  const floorWars: FloorWarEntry[] = (() => {
    if (residents.length === 0) return SEED_FLOOR_WAR;
    const byFloor: Record<number, ResidentRow[]> = {};
    for (const r of residents) {
      const fl = getFloorFromApartment(r.apartmentNumber || "1");
      if (!byFloor[fl]) byFloor[fl] = [];
      byFloor[fl].push(r);
    }
    return Object.entries(byFloor).map(([flStr, rs]) => {
      const fl = parseInt(flStr);
      const cfg = FLOOR_CONFIG[fl] ?? FLOOR_CONFIG[0];
      const totalXP = rs.reduce((s, r) => s + (r.xp || 0), 0);
      const totalRep = rs.reduce((s, r) => s + computeReputationPoints(r as Record<string, unknown>), 0);
      const mvp = [...rs].sort((a, b) => (b.xp || 0) - (a.xp || 0))[0];
      return {
        floor: fl,
        label: cfg.label,
        totalPoints: totalXP,
        reputationPoints: totalRep,
        residentCount: rs.length,
        mvpName: (mvp?.residentNames as string[])?.[0] || `Apt ${mvp?.apartmentNumber}`,
        mvpApt: String(mvp?.apartmentNumber || ""),
        mvpXP: mvp?.xp || 0,
        weeklyDelta: Math.round((Math.random() - 0.4) * 150), // Phase 2: real delta tracking
      } as FloorWarEntry;
    });
  })();

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#050505" }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner" style={{ margin: "0 auto 20px" }} />
          <p style={{ color: "#777", fontSize: "0.85rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Entering the Arena
          </p>
        </div>
      </main>
    );
  }

  const TABS = [
    { key: "floor-wars",   icon: "⚔️",  label: "Floor Wars"   },
    { key: "missions",     icon: "🎯",  label: "Missions"      },
    { key: "tournament",   icon: "🏆",  label: "Tournament"    },
    { key: "leaderboard",  icon: "📊",  label: "Leaderboard"   },
    { key: "profile",      icon: "👤",  label: "My Arena"      },
    { key: "coming-soon",  icon: "🚀",  label: "Coming Soon"   },
  ] as const;

  return (
    <main style={S.page}>
      <div style={S.wrap}>

        {/* ── Header ── */}
        <div className="animate-fade-in-up" style={{ marginBottom: 40 }}>
          <Link href="/dashboard" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            color: "#555", fontSize: "0.8rem", textDecoration: "none",
            marginBottom: 20, letterSpacing: "0.04em",
          }}>
            ← Dashboard
          </Link>

          {/* Arena title banner */}
          <div style={{
            background: "linear-gradient(135deg, rgba(20,10,0,0.98), rgba(10,0,20,0.98))",
            border: "1px solid rgba(201,168,76,0.25)",
            borderRadius: 24,
            padding: "36px 32px",
            position: "relative",
            overflow: "hidden",
            marginBottom: 32,
          }}>
            {/* Glow orbs */}
            <div style={{
              position: "absolute", top: -40, right: -40, width: 200, height: 200,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(201,168,76,0.15) 0%, transparent 70%)",
              pointerEvents: "none",
            }} />
            <div style={{
              position: "absolute", bottom: -60, left: -40, width: 240, height: 240,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(167,139,250,0.1) 0%, transparent 70%)",
              pointerEvents: "none",
            }} />

            {/* Animated border accent */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 2,
              background: "linear-gradient(90deg, transparent, var(--gold), rgba(167,139,250,0.8), var(--gold), transparent)",
              opacity: 0.6,
            }} />

            <div style={{ position: "relative" }}>
              <p style={{ color: "var(--gold)", fontSize: "0.72rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 8 }}>
                ⚔️ GOKUL RESIDENCY
              </p>
              <h1 className="display-font" style={{ fontSize: "3.2rem", color: "#f0ece4", marginBottom: 12, lineHeight: 1 }}>
                Gokul Arena
              </h1>
              <p style={{ color: "#666", fontSize: "0.9rem", maxWidth: 480, lineHeight: 1.6 }}>
                The competitive heart of Gokul Residency. Floor Wars, Missions, Tournaments, and glory await.
                Phase 1 — Foundation is live.
              </p>

              {/* Live stats strip */}
              <div style={{ display: "flex", gap: 24, marginTop: 20, flexWrap: "wrap" }}>
                {[
                  { label: "Active Residents", value: residents.length, color: "#4ade80" },
                  { label: "Active Floors",    value: Object.keys(floorWars).length, color: "#60a5fa" },
                  { label: "War Missions",     value: SEED_MISSIONS.length, color: "#f97316" },
                  { label: "Week",             value: getCurrentWeekLabel(), color: "var(--gold)" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p style={{ color: stat.color, fontWeight: 800, fontSize: "1.1rem" }}>{stat.value}</p>
                    <p style={{ color: "#444", fontSize: "0.7rem", marginTop: 1 }}>{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Phase badge */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <span style={{
              padding: "4px 14px", borderRadius: 999,
              background: "rgba(74,222,128,0.1)",
              border: "1px solid rgba(74,222,128,0.25)",
              color: "#4ade80", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}>
              ✓ Phase 1 Live
            </span>
            <span style={{
              padding: "4px 14px", borderRadius: 999,
              background: "rgba(201,168,76,0.08)",
              border: "1px solid rgba(201,168,76,0.2)",
              color: "var(--gold)", fontSize: "0.72rem", letterSpacing: "0.08em",
            }}>
              Phase 2 — Live Battles · Coming Soon
            </span>
          </div>
        </div>

        {/* ── Tab Nav ── */}
        <div style={S.tabRow}>
          {TABS.map(({ key, icon, label }) => (
            <button
              key={key}
              style={tabStyle(activeTab === key)}
              onClick={() => setActiveTab(key)}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        <div className="animate-fade-in" key={activeTab}>
          {activeTab === "floor-wars" && (
            <FloorWarsSection floors={floorWars} residents={residents} />
          )}
          {activeTab === "missions" && (
            <WarMissionsSection />
          )}
          {activeTab === "tournament" && (
            <TournamentSection residents={residents} />
          )}
          {activeTab === "leaderboard" && (
            <LeaderboardSection residents={residents} />
          )}
          {activeTab === "profile" && (
            <ArenaProfileSection resident={resident} />
          )}
          {activeTab === "coming-soon" && (
            <ComingSoonSection />
          )}
        </div>

        {/* ── Back nav ── */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid rgba(201,168,76,0.1)" }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              { href: "/dashboard",   label: "Dashboard"   },
              { href: "/leaderboard", label: "Leaderboard" },
              { href: "/reputation",  label: "Reputation"  },
              { href: "/challenges",  label: "Challenges"  },
              { href: "/polls",       label: "Polls"       },
            ].map(({ href, label }) => (
              <Link key={href} href={href} style={{
                padding: "8px 18px", borderRadius: 10,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                color: "#666", fontSize: "0.8rem", textDecoration: "none",
                transition: "all 0.2s",
              }}>
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
