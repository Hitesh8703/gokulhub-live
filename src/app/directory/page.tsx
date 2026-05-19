"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { accolades } from "@/lib/accolades";
import {
  computeReputationPoints,
  getReputationLevel,
  REPUTATION_LEVELS,
} from "@/lib/reputation";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ResidentCard {
  id: string;
  apartmentNumber: string;
  floor: string;
  residentNames: string[];
  primaryContact: string;
  secondaryContact: string;
  xp: number;
  level: number;
  streak: number;
  checkInStreak: number;
  tournamentWins: number;
  reputationPoints: number;
  reputationScore: number;
  unlockedAccolades: string[];
  complaintCount: number;
  pollVotes: number;
}

const RARITY_CONFIG: Record<string, { color: string; glow: string }> = {
  Common:    { color: "#9ca3af", glow: "rgba(156,163,175,0.15)" },
  Uncommon:  { color: "#4ade80", glow: "rgba(74,222,128,0.15)"  },
  Rare:      { color: "#60a5fa", glow: "rgba(96,165,250,0.15)"  },
  Epic:      { color: "#a78bfa", glow: "rgba(167,139,250,0.15)" },
  Legendary: { color: "#e8c96a", glow: "rgba(232,201,106,0.2)"  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getFloor(apt: string): string {
  const digits = apt.replace(/[^0-9]/g, "");
  if (!digits) return "G";
  if (digits.length === 1) return digits;
  return digits.charAt(0);
}

function computeFloorRank(apt: string, all: ResidentCard[]): number {
  const floor = getFloor(apt);
  const same = all
    .filter((r) => getFloor(r.apartmentNumber) === floor)
    .sort((a, b) => (b.xp || 0) - (a.xp || 0));
  const idx = same.findIndex((r) => r.apartmentNumber === apt);
  return idx === -1 ? same.length : idx + 1;
}

function getRarestAccolades(unlockedIds: string[], limit = 3) {
  const order = ["Legendary", "Epic", "Rare", "Uncommon", "Common"];
  return accolades
    .filter((a) => unlockedIds.includes(a.id))
    .sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity))
    .slice(0, limit);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DirectoryPage() {
  const router = useRouter();
  const [residents, setResidents]       = useState<ResidentCard[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [sortBy, setSortBy]             = useState<"xp" | "apt" | "rep">("xp");
  const [filterFloor, setFilterFloor]   = useState("all");
  const [viewMode, setViewMode]         = useState<"grid" | "list">("grid");

  // ── Load all residents ──────────────────────────────────────────────────

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      setCurrentUserId(user.uid);
      try {
        const snap = await getDocs(collection(db, "residents"));
        const data: ResidentCard[] = snap.docs.map((d) => {
          const raw = d.data();
          return {
            id:               d.id,
            apartmentNumber:  raw.apartmentNumber || "",
            floor:            getFloor(raw.apartmentNumber || ""),
            residentNames:    raw.residentNames || [],
            primaryContact:   raw.primaryContact || "",
            secondaryContact: raw.secondaryContact || "",
            xp:               raw.xp || 0,
            level:            raw.level || 1,
            streak:           raw.streak || 0,
            checkInStreak:    raw.checkInStreak || 0,
            tournamentWins:   raw.tournamentWins || 0,
            reputationPoints: computeReputationPoints(raw),
            reputationScore:  raw.reputationScore || 0,
            unlockedAccolades: raw.unlockedAccolades || [],
            complaintCount:   raw.complaintCount || 0,
            pollVotes:        raw.pollVotes || 0,
          };
        });
        setResidents(data);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  // ── Derived / filtered list ─────────────────────────────────────────────

  const floors = useMemo(() => {
    const set = new Set(residents.map((r) => r.floor));
    return ["all", ...Array.from(set).sort()];
  }, [residents]);

  const filtered = useMemo(() => {
    let list = [...residents];

    // Search
    const q = search.toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.apartmentNumber.toLowerCase().includes(q) ||
          r.residentNames.some((n) => n.toLowerCase().includes(q))
      );
    }

    // Floor filter
    if (filterFloor !== "all") {
      list = list.filter((r) => r.floor === filterFloor);
    }

    // Sort
    if (sortBy === "xp")  list.sort((a, b) => b.xp - a.xp);
    if (sortBy === "apt") list.sort((a, b) => a.apartmentNumber.localeCompare(b.apartmentNumber));
    if (sortBy === "rep") list.sort((a, b) => b.reputationPoints - a.reputationPoints);

    return list;
  }, [residents, search, filterFloor, sortBy]);

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "#050505" }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner" style={{ margin: "0 auto 20px" }} />
          <p style={{ color: "#777", fontSize: "0.85rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Loading Directory
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen"
      style={{
        backgroundImage: "radial-gradient(ellipse at 50% -10%, rgba(201,168,76,0.07) 0%, #050505 55%)",
        padding: "40px 24px 80px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

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
              Gokul Residency
            </p>
            <h1 className="display-font" style={{ fontSize: "2.6rem", color: "#f0ece4", lineHeight: 1.1 }}>
              Resident Directory
            </h1>
            <p style={{ color: "#555", fontSize: "0.85rem", marginTop: 6 }}>
              {residents.length} apartments · Browse who lives where
            </p>
          </div>
          <Link
            href="/dashboard"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10, padding: "10px 18px",
              color: "#888", textDecoration: "none",
              fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem",
            }}
          >
            ← Dashboard
          </Link>
        </div>

        {/* ── Controls bar ── */}
        <div
          className="animate-fade-in-up stagger-1"
          style={{
            display: "flex", gap: 10, marginBottom: 28,
            flexWrap: "wrap", alignItems: "center",
          }}
        >
          {/* Search */}
          <div style={{ flex: "1 1 220px", position: "relative" }}>
            <span style={{
              position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
              color: "#555", fontSize: 16, pointerEvents: "none",
            }}>🔍</span>
            <input
              type="text"
              placeholder="Search apartment or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="premium-input"
              style={{ paddingLeft: 40, padding: "11px 16px 11px 40px", width: "100%" }}
            />
          </div>

          {/* Floor filter */}
          <select
            value={filterFloor}
            onChange={(e) => setFilterFloor(e.target.value)}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10, padding: "11px 14px",
              color: "#ccc", fontFamily: "'DM Sans', sans-serif",
              fontSize: "0.85rem", cursor: "pointer",
              outline: "none",
            }}
          >
            {floors.map((f) => (
              <option key={f} value={f} style={{ background: "#111" }}>
                {f === "all" ? "All Floors" : `Floor ${f}`}
              </option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10, padding: "11px 14px",
              color: "#ccc", fontFamily: "'DM Sans', sans-serif",
              fontSize: "0.85rem", cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="xp"  style={{ background: "#111" }}>Sort: XP</option>
            <option value="apt" style={{ background: "#111" }}>Sort: Apartment</option>
            <option value="rep" style={{ background: "#111" }}>Sort: Reputation</option>
          </select>

          {/* View toggle */}
          <div style={{ display: "flex", gap: 4 }}>
            {(["grid", "list"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  background: viewMode === mode ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.04)",
                  border: viewMode === mode ? "1px solid rgba(201,168,76,0.4)" : "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8, padding: "10px 14px",
                  color: viewMode === mode ? "var(--gold)" : "#666",
                  fontSize: 16, cursor: "pointer",
                }}
              >
                {mode === "grid" ? "⊞" : "☰"}
              </button>
            ))}
          </div>
        </div>

        {/* ── Results count ── */}
        {search && (
          <p style={{ color: "#555", fontSize: "0.82rem", marginBottom: 16 }}>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""} for "{search}"
          </p>
        )}

        {/* ── Grid / List ── */}
        {filtered.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "60px 20px",
            background: "rgba(255,255,255,0.02)",
            border: "1px dashed rgba(255,255,255,0.08)",
            borderRadius: 20,
          }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>🏠</p>
            <p style={{ color: "#555" }}>No residents found matching your search.</p>
          </div>
        ) : (
          <div
            style={
              viewMode === "grid"
                ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }
                : { display: "flex", flexDirection: "column", gap: 12 }
            }
          >
            {filtered.map((resident, idx) => (
              <ResidentDirectoryCard
                key={resident.id}
                resident={resident}
                allResidents={residents}
                isOwn={resident.id === currentUserId}
                idx={idx}
                viewMode={viewMode}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Directory Card Component ─────────────────────────────────────────────────

function ResidentDirectoryCard({
  resident,
  allResidents,
  isOwn,
  idx,
  viewMode,
}: {
  resident: ResidentCard;
  allResidents: ResidentCard[];
  isOwn: boolean;
  idx: number;
  viewMode: "grid" | "list";
}) {
  const repLevel      = getReputationLevel(resident.reputationPoints);
  const floorRank     = computeFloorRank(resident.apartmentNumber, allResidents);
  const rarestAcc     = getRarestAccolades(resident.unlockedAccolades, 3);
  const streak        = resident.checkInStreak || resident.streak || 0;
  const names         = resident.residentNames.filter(Boolean);

  if (viewMode === "list") {
    return (
      <Link
        href={`/residents/${resident.id}`}
        style={{ textDecoration: "none" }}
      >
        <div
          className="premium-card"
          style={{
            padding: "16px 20px",
            display: "flex", alignItems: "center", gap: 16,
            flexWrap: "wrap",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {isOwn && (
            <div style={{
              position: "absolute", top: 0, right: 0,
              background: "linear-gradient(135deg, #8a6e2f, #c9a84c)",
              color: "#0a0800", fontSize: "0.6rem", fontWeight: 700,
              padding: "3px 10px", letterSpacing: "0.08em",
              borderBottomLeftRadius: 8,
            }}>
              YOU
            </div>
          )}

          {/* Avatar */}
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            background: `linear-gradient(135deg, ${repLevel.color}40, ${repLevel.color}20)`,
            border: `2px solid ${repLevel.color}50`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, flexShrink: 0,
            boxShadow: `0 0 16px ${repLevel.glow}`,
          }}>
            {repLevel.badge}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <span style={{ color: "#f0ece4", fontWeight: 700, fontSize: "1rem" }}>
                Apt {resident.apartmentNumber}
              </span>
              <span style={{
                background: `${repLevel.glow}`,
                border: `1px solid ${repLevel.color}40`,
                borderRadius: 999, padding: "1px 8px",
                color: repLevel.color, fontSize: "0.65rem", fontWeight: 600,
              }}>
                {repLevel.title}
              </span>
            </div>
            {names.length > 0 && (
              <p style={{ color: "#888", fontSize: "0.8rem" }}>
                {names.slice(0, 2).join(", ")}{names.length > 2 ? ` +${names.length - 2}` : ""}
              </p>
            )}
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <StatMini icon="⚡" label="XP" value={resident.xp} color="var(--gold)" />
            <StatMini icon="🏆" label={`#${floorRank} Floor`} value={`Lvl ${resident.level}`} color="#a78bfa" />
            <StatMini icon="🔥" label="Streak" value={`${streak}d`} color="#fb923c" />
          </div>

          <div style={{ color: "#555", fontSize: 18, flexShrink: 0 }}>›</div>
        </div>
      </Link>
    );
  }

  // Grid card
  return (
    <Link href={`/residents/${resident.id}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          background: "linear-gradient(145deg, rgba(20,18,14,0.98), rgba(10,10,10,0.99))",
          border: `1px solid rgba(255,255,255,0.07)`,
          borderRadius: 20,
          overflow: "hidden",
          transition: "all 0.3s cubic-bezier(0.23,1,0.32,1)",
          position: "relative",
          cursor: "pointer",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.transform = "translateY(-4px)";
          el.style.borderColor = `${repLevel.color}40`;
          el.style.boxShadow = `0 8px 40px ${repLevel.glow}, 0 0 0 1px ${repLevel.color}25`;
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.transform = "";
          el.style.borderColor = "rgba(255,255,255,0.07)";
          el.style.boxShadow = "0 4px 20px rgba(0,0,0,0.5)";
        }}
      >
        {/* Top gradient bar */}
        <div style={{
          height: 3,
          background: `linear-gradient(90deg, ${repLevel.color}80, ${repLevel.color}, ${repLevel.color}80)`,
        }} />

        {isOwn && (
          <div style={{
            position: "absolute", top: 3, right: 0,
            background: "linear-gradient(135deg, #8a6e2f, #c9a84c)",
            color: "#0a0800", fontSize: "0.6rem", fontWeight: 800,
            padding: "3px 12px", letterSpacing: "0.1em",
            borderBottomLeftRadius: 8,
          }}>
            MY APARTMENT
          </div>
        )}

        {/* Card header */}
        <div style={{ padding: "20px 20px 14px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
            {/* Avatar */}
            <div style={{
              width: 52, height: 52, borderRadius: "50%",
              background: `radial-gradient(circle at 30% 30%, ${repLevel.color}30, transparent 70%)`,
              border: `2px solid ${repLevel.color}50`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, flexShrink: 0,
              boxShadow: `0 0 20px ${repLevel.glow}`,
              animation: resident.reputationPoints >= 300 ? "pulse-glow 2s ease-in-out infinite" : undefined,
            }}>
              {repLevel.badge}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: "#666", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Floor {resident.floor}
              </p>
              <h3 className="display-font" style={{ fontSize: "1.5rem", color: "#f0ece4", lineHeight: 1.1, marginBottom: 4 }}>
                Apt {resident.apartmentNumber}
              </h3>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: `${repLevel.glow}`,
                border: `1px solid ${repLevel.color}40`,
                borderRadius: 999, padding: "2px 10px",
              }}>
                <span style={{ color: repLevel.color, fontSize: "0.68rem", fontWeight: 700 }}>
                  {repLevel.title}
                </span>
              </div>
            </div>

            {/* Floor rank badge */}
            <div style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10, padding: "6px 10px",
              textAlign: "center", flexShrink: 0,
            }}>
              <p style={{ color: "#555", fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Floor</p>
              <p style={{ color: "var(--gold)", fontWeight: 700, fontSize: "0.9rem", fontFamily: "'Cormorant Garamond', serif" }}>
                #{floorRank}
              </p>
            </div>
          </div>

          {/* Resident names */}
          {names.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
              {names.slice(0, 3).map((name, i) => (
                <span key={i} style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 999, padding: "3px 10px",
                  color: "#ccc", fontSize: "0.75rem",
                }}>
                  {name}
                </span>
              ))}
              {names.length > 3 && (
                <span style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: 999, padding: "3px 10px",
                  color: "#555", fontSize: "0.75rem",
                }}>
                  +{names.length - 3} more
                </span>
              )}
            </div>
          ) : (
            <p style={{ color: "#444", fontSize: "0.78rem", fontStyle: "italic", marginBottom: 14 }}>
              No names added yet
            </p>
          )}

          {/* Stats row */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8, marginBottom: 14,
          }}>
            <MiniStat icon="⚡" label="XP" value={resident.xp.toLocaleString()} color="var(--gold)" />
            <MiniStat icon="🔥" label="Streak" value={`${streak}d`} color="#fb923c" />
            <MiniStat icon="⚔" label="Wins" value={resident.tournamentWins} color="#a78bfa" />
          </div>

          {/* Rarest accolades */}
          {rarestAcc.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {rarestAcc.map((acc) => {
                const cfg = RARITY_CONFIG[acc.rarity] || RARITY_CONFIG.Common;
                return (
                  <span key={acc.id} style={{
                    background: cfg.glow,
                    border: `1px solid ${cfg.color}35`,
                    borderRadius: 6, padding: "3px 8px",
                    color: cfg.color, fontSize: "0.68rem", fontWeight: 600,
                  }}>
                    {acc.title}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Card footer */}
        <div style={{
          padding: "10px 20px",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          background: "rgba(0,0,0,0.3)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ color: "#333", fontSize: "0.65rem", letterSpacing: "0.08em" }}>
            Lvl {resident.level} · {resident.unlockedAccolades.length} accolades
          </span>
          <span style={{ color: repLevel.color, fontSize: "0.7rem", fontWeight: 600 }}>
            View Profile →
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── Mini stat helpers ────────────────────────────────────────────────────────

function MiniStat({ icon, label, value, color }: { icon: string; label: string; value: any; color: string }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.05)",
      borderRadius: 10, padding: "8px 6px",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 14, marginBottom: 3 }}>{icon}</div>
      <div style={{ color, fontWeight: 700, fontSize: "0.85rem", fontFamily: "'Cormorant Garamond', serif" }}>{value}</div>
      <div style={{ color: "#555", fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
    </div>
  );
}

function StatMini({ icon, label, value, color }: { icon: string; label: string; value: any; color: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 13, marginBottom: 1 }}>{icon}</div>
      <div style={{ color, fontWeight: 700, fontSize: "0.85rem" }}>{value}</div>
      <div style={{ color: "#555", fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
    </div>
  );
}
