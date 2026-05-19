"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
const WasteInfoGuide = dynamic(() => import("@/components/WasteInfoGuide"), { ssr: false });
import { onAuthStateChanged, updatePassword, signOut } from "firebase/auth";
import {
  doc, getDoc, updateDoc, collection, query,
  where, getDocs, addDoc, serverTimestamp, increment,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { fetchResidentPermissions, isAdmin, isSupremeAdmin, ResidentPermissions } from "@/lib/permissions";
import { AdminBadge } from "@/components/PermissionGate";
import { checkAccolades } from "@/lib/accolades";
import {
  Challenge, ChallengeProgress, ChallengeType,
  getResidentStatForChallenge, getChallengeStatusLabel, getDaysRemaining,
} from "@/lib/challenges";

const NAV_ITEMS = [
  { href: "/profile",       icon: "👤", label: "My Profile"       },
  { href: "/arena",         icon: "⚔️",  label: "Gokul Arena"      },
  { href: "/directory",     icon: "🏠", label: "Resident Directory" },
  { href: "/contacts",      icon: "📞", label: "Important Contacts" },
  { href: "/chat",          icon: "💬", label: "Global Chat"      },
  { href: "/leaderboard",   icon: "🏆", label: "Leaderboard"      },
  { href: "/reputation",    icon: "⭐", label: "My Reputation"    },
  { href: "/accolades",     icon: "🏅", label: "Accolades"        },
  { href: "/polls",         icon: "📊", label: "Community Polls"  },
  { href: "/notifications", icon: "🔔", label: "Notifications"    },
  { href: "/complaints",    icon: "🚨", label: "Raise Complaint"  },
  { href: "/my-complaints", icon: "📋", label: "My Complaints"    },
  { href: "/challenges",    icon: "🏆", label: "Monthly Challenges" },
  { href: "/maintenance",   icon: "💰", label: "Maintenance"      },
  { href: "/sinking-fund",   icon: "🏦", label: "Sinking Fund"      },
  { href: "/gas-billing",    icon: "🔥", label: "Gas Billing"       },
];

// ─── Streak helpers ────────────────────────────────────────────────────────

function getTodayString() {
  return new Date().toDateString();
}

function getYesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toDateString();
}

function streakEmoji(streak: number) {
  if (streak >= 30) return "🔥🔥🔥";
  if (streak >= 7)  return "🔥🔥";
  if (streak >= 3)  return "🔥";
  return "✨";
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [residentData, setResidentData] = useState<any>(null);
  const [complaints, setComplaints]     = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [newPassword, setNewPassword]   = useState("");
  const [garbageLoading, setGarbageLoading] = useState(false);
  const [wasteGuideOpen, setWasteGuideOpen] = useState(false);
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([]);
  const [challengeProgressMap, setChallengeProgressMap] = useState<Record<string, ChallengeProgress>>({});
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [pwSuccess, setPwSuccess]       = useState(false);
  const [residentPerms, setResidentPerms] = useState<ResidentPermissions | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      try {
        const residentRef  = doc(db, "residents", user.uid);
        const residentSnap = await getDoc(residentRef);
        if (residentSnap.exists()) {
          const residentInfo = residentSnap.data();
          setResidentData(residentInfo);
          // Load permissions for admin badge / panel visibility
          const perms = await fetchResidentPermissions(user.uid);
          setResidentPerms(perms);
          const q = query(
            collection(db, "complaints"),
            where("againstApartment", "==", residentInfo.apartmentNumber)
          );
          const snap = await getDocs(q);
          setComplaints(snap.docs.map((d) => ({ id: d.id, ...d.data() })));

          // Load active challenges
          const now = new Date();
          const chalSnap = await getDocs(collection(db, "challenges"));
          const allChallenges = chalSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Challenge));
          const live = allChallenges.filter((c) =>
            c.active &&
            new Date(c.startDate) <= now &&
            new Date(c.endDate) >= now
          ).slice(0, 3);
          setActiveChallenges(live);

          // Load progress for those challenges
          if (live.length > 0) {
            const progSnap = await getDocs(
              query(collection(db, "challengeProgress"), where("residentId", "==", user.uid))
            );
            const pMap: Record<string, ChallengeProgress> = {};
            progSnap.forEach((d) => {
              const data = d.data() as ChallengeProgress;
              pMap[data.challengeId] = { ...data, id: d.id } as any;
            });
            // Auto-set progress for any not yet tracked
            for (const ch of live) {
              if (!pMap[ch.id]) {
                const stat = getResidentStatForChallenge(ch.challengeType as ChallengeType, residentInfo);
                pMap[ch.id] = {
                  challengeId: ch.id,
                  residentId: user.uid,
                  apartmentNumber: residentInfo.apartmentNumber,
                  current: Math.min(stat, ch.target),
                  completed: Math.min(stat, ch.target) >= ch.target,
                  rewardClaimed: false,
                };
              }
            }
            setChallengeProgressMap(pMap);
          }
        }
      } catch (error) { console.log(error); }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // ── Garbage mission ──────────────────────────────────────────────────────

  async function handleGarbageMission() {
    const user = auth.currentUser;
    if (!user || !residentData) return;
    const today = getTodayString();
    if (residentData.lastGarbageDate === today) { alert("Already completed garbage mission today! ✅"); return; }
    setGarbageLoading(true);
    const updatedXP           = (residentData.xp || 0) + 50;
    const updatedStreak       = (residentData.streak || 0) + 1;
    const updatedGarbageCount = (residentData.garbageCount || 0) + 1;
    const updatedLevel        = Math.floor(updatedXP / 200) + 1;
    const updatedData = { ...residentData, xp: updatedXP, streak: updatedStreak, garbageCount: updatedGarbageCount, level: updatedLevel, lastGarbageDate: today };
    const residentRef = doc(db, "residents", user.uid);
    await updateDoc(residentRef, updatedData);
    if (updatedLevel > (residentData.level || 1)) {
      await addDoc(collection(db, "notifications"), {
        type: "private", targetApartment: residentData.apartmentNumber,
        title: "🎉 Level Up!", description: `You reached Level ${updatedLevel}!`,
        createdAt: serverTimestamp(),
      });
    }
    setResidentData(updatedData);
    await checkAccolades(user.uid, updatedData);
    setGarbageLoading(false);
    alert("🗑 Garbage disposed! +50 XP earned");
  }

  // ── Daily Check-In ───────────────────────────────────────────────────────

  async function handleDailyCheckIn() {
    const user = auth.currentUser;
    if (!user || !residentData) return;
    const today     = getTodayString();
    const yesterday = getYesterdayString();

    if (residentData.lastCheckInDate === today) {
      alert("You already checked in today! Come back tomorrow 🌅");
      return;
    }

    setCheckInLoading(true);
    try {
      const residentRef = doc(db, "residents", user.uid);

      // Streak: consecutive only if last check-in was yesterday
      const wasYesterday  = residentData.lastCheckInDate === yesterday;
      const currentStreak = wasYesterday ? (residentData.checkInStreak || 0) + 1 : 1;
      const xpReward      = 15;
      const newXP         = (residentData.xp || 0) + xpReward;
      const newLevel      = Math.floor(newXP / 200) + 1;

      const updatedData = {
        ...residentData,
        xp: newXP,
        level: newLevel,
        lastCheckInDate: today,
        checkInStreak: currentStreak,
      };

      await updateDoc(residentRef, {
        xp: increment(xpReward),
        level: newLevel,
        lastCheckInDate: today,
        checkInStreak: currentStreak,
      });

      // Check-in notification
      await addDoc(collection(db, "notifications"), {
        type: "private",
        targetApartment: residentData.apartmentNumber,
        title: `${streakEmoji(currentStreak)} Daily Check-In!`,
        description: `+${xpReward} XP earned · ${currentStreak}-day streak`,
        createdAt: serverTimestamp(),
      });

      // Milestone notifications
      const milestones = [3, 7, 14, 30, 60, 90];
      if (milestones.includes(currentStreak)) {
        await addDoc(collection(db, "notifications"), {
          type: "private",
          targetApartment: residentData.apartmentNumber,
          title: `🎉 ${currentStreak}-Day Streak Milestone!`,
          description: `Amazing! You've checked in ${currentStreak} days in a row. Keep it up!`,
          createdAt: serverTimestamp(),
        });
      }

      // Level-up notification
      if (newLevel > (residentData.level || 1)) {
        await addDoc(collection(db, "notifications"), {
          type: "private",
          targetApartment: residentData.apartmentNumber,
          title: "🎉 Level Up!",
          description: `You reached Level ${newLevel}!`,
          createdAt: serverTimestamp(),
        });
      }

      setResidentData(updatedData);
      await checkAccolades(user.uid, updatedData);
    } catch (err) {
      console.error(err);
    } finally {
      setCheckInLoading(false);
    }
  }

  // ── Password change ──────────────────────────────────────────────────────

  async function handlePasswordChange() {
    if (!auth.currentUser) return;
    if (newPassword.length < 6) { alert("Password must be at least 6 characters"); return; }
    try {
      await updatePassword(auth.currentUser, newPassword);
      setPwSuccess(true);
      setNewPassword("");
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (error: any) { alert(error.message); }
  }

  async function handleLogout() {
    await signOut(auth);
    localStorage.removeItem("apartment");
    router.push("/login");
  }

  const xpProgress     = Math.min(((residentData?.xp || 0) % 200) / 200 * 100, 100);
  const checkedInToday = residentData?.lastCheckInDate === getTodayString();
  const checkInStreak  = residentData?.checkInStreak || 0;

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "#050505" }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner" style={{ margin: "0 auto 20px" }} />
          <p style={{ color: "#777", letterSpacing: "0.1em", textTransform: "uppercase", fontSize: "0.85rem" }}>Loading Dashboard</p>
        </div>
      </main>
    );
  }

  return (
    <>
    <main
      className="min-h-screen text-white"
      style={{
        backgroundImage: "radial-gradient(ellipse at 50% -10%, rgba(201,168,76,0.06) 0%, #050505 50%), linear-gradient(rgba(0,0,0,0.88), rgba(0,0,0,0.88)), url('/gokul-residency.jpeg')",
        backgroundSize: "cover, cover, cover",
        backgroundPosition: "center, center, center",
        backgroundAttachment: "fixed, fixed, fixed",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>

        {/* Header */}
        <div className="animate-fade-in-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40 }}>
          <div>
            <p style={{ color: "var(--gold)", fontSize: "0.8rem", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>Welcome back</p>
            <h1 className="display-font" style={{ fontSize: "3rem", lineHeight: 1.1, color: "#f0ece4" }}>
              Apt {residentData?.apartmentNumber || "—"}
            </h1>
            <p style={{ color: "#666", marginTop: 4, fontSize: "0.9rem" }}>Gokul Residency · Beta</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Link
              href="/profile"
              style={{
                background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.25)",
                borderRadius: 10, padding: "10px 18px", color: "var(--gold)",
                fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem",
                textDecoration: "none", fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
              }}
            >
              👤 My Profile
            </Link>
            <button
              onClick={handleLogout}
              style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10, padding: "10px 18px", color: "#888",
                fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", cursor: "pointer",
              }}
            >
              Sign Out
            </button>
          </div>
        </div>

        {residentData && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>

            {/* Stats Card */}
            <div className="glass-card animate-fade-in-up stagger-1" style={{ padding: 28 }}>
              <p style={{ color: "var(--gold)", fontSize: "0.75rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 20 }}>
                Resident Stats
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                {[
                  { label: "XP Points", value: residentData.xp || 0,           icon: "⚡" },
                  { label: "Level",     value: residentData.level || 1,         icon: "🎯" },
                  { label: "Streak",    value: `${residentData.streak || 0}d`,  icon: "🔥" },
                  { label: "Missions",  value: residentData.garbageCount || 0,  icon: "🗑" },
                ].map((stat) => (
                  <div key={stat.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "16px", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ fontSize: 18, marginBottom: 6 }}>{stat.icon}</div>
                    <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#f0ece4", lineHeight: 1 }}>{stat.value}</div>
                    <div style={{ fontSize: "0.75rem", color: "#666", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{stat.label}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.78rem", color: "#666" }}>
                  <span>Level {residentData.level || 1} Progress</span>
                  <span className="gold-text">{Math.round(xpProgress)}%</span>
                </div>
                <div className="xp-bar-track">
                  <div className="xp-bar-fill" style={{ width: `${xpProgress}%` }} />
                </div>
                <p style={{ fontSize: "0.75rem", color: "#555", marginTop: 6 }}>
                  {(residentData.xp || 0) % 200} / 200 XP to next level
                </p>
              </div>
            </div>

            {/* Navigation + Action Buttons */}
            <div className="animate-fade-in-up stagger-2" style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Daily Check-In */}
              <button
                onClick={handleDailyCheckIn}
                disabled={checkInLoading || checkedInToday}
                style={{
                  width: "100%", padding: "18px 20px", borderRadius: 14, fontSize: "1rem",
                  display: "flex", alignItems: "center", gap: 12,
                  border: checkedInToday ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(99,102,241,0.4)",
                  cursor: checkedInToday ? "default" : "pointer",
                  fontFamily: "'DM Sans', sans-serif", fontWeight: 600, transition: "all 0.3s ease",
                  background: checkedInToday
                    ? "rgba(34,197,94,0.12)"
                    : "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(99,102,241,0.2))",
                  color: checkedInToday ? "#4ade80" : "#a5b4fc",
                  opacity: checkInLoading ? 0.7 : 1,
                }}
              >
                <span style={{ fontSize: 22 }}>
                  {checkedInToday ? "✅" : streakEmoji(checkInStreak)}
                </span>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                    {checkInLoading
                      ? "Checking in…"
                      : checkedInToday
                        ? "Checked In Today ✓"
                        : "Daily Check-In (+15 XP)"}
                  </div>
                  {checkInStreak > 0 && (
                    <div style={{ fontSize: "0.75rem", marginTop: 2, opacity: 0.8 }}>
                      {checkedInToday
                        ? `${streakEmoji(checkInStreak)} ${checkInStreak}-day streak`
                        : `Current streak: ${checkInStreak} day${checkInStreak !== 1 ? "s" : ""}`}
                    </div>
                  )}
                </div>
              </button>

              {/* Garbage Mission */}
              <button
                onClick={handleGarbageMission}
                disabled={garbageLoading || residentData.lastGarbageDate === getTodayString()}
                className="gold-button"
                style={{
                  width: "100%", padding: "18px 20px", borderRadius: 14, fontSize: "1rem",
                  display: "flex", alignItems: "center", gap: 12,
                  opacity: residentData.lastGarbageDate === getTodayString() ? 0.5 : 1,
                }}
              >
                <span style={{ fontSize: 22 }}>🗑</span>
                <span>
                  {garbageLoading ? "Processing…"
                    : residentData.lastGarbageDate === getTodayString()
                      ? "Mission Done Today ✓"
                      : "I Disposed Garbage Today (+50 XP)"}
                </span>
              </button>

              {/* Waste Info Guide */}
              <button
                onClick={() => setWasteGuideOpen(true)}
                style={{
                  width: "100%", padding: "16px 20px", borderRadius: 14, fontSize: "0.95rem",
                  display: "flex", alignItems: "center", gap: 12,
                  background: "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(59,130,246,0.08))",
                  border: "1px solid rgba(34,197,94,0.3)",
                  color: "#86efac", cursor: "pointer",
                  boxShadow: "0 0 16px rgba(34,197,94,0.1)",
                  transition: "all 0.3s ease",
                  fontWeight: 600, letterSpacing: "0.01em",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(34,197,94,0.5)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 0 24px rgba(34,197,94,0.25)";
                  (e.currentTarget as HTMLElement).style.background = "linear-gradient(135deg, rgba(34,197,94,0.18), rgba(59,130,246,0.12))";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(34,197,94,0.3)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 0 16px rgba(34,197,94,0.1)";
                  (e.currentTarget as HTMLElement).style.background = "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(59,130,246,0.08))";
                }}
              >
                <span style={{ fontSize: 22 }}>♻️</span>
                <span>Waste Info Guide</span>
              </button>

              {/* Nav grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {NAV_ITEMS.map((item, i) => (
                  <Link key={item.href} href={item.href}
                    className={`animate-fade-in-up stagger-${i + 3}`}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 12, padding: "14px 16px",
                      textDecoration: "none", color: "#ccc",
                      fontFamily: "'DM Sans', sans-serif", fontSize: "0.88rem", fontWeight: 500,
                      transition: "all 0.25s ease",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hover)";
                      (e.currentTarget as HTMLElement).style.background = "rgba(201,168,76,0.06)";
                      (e.currentTarget as HTMLElement).style.color = "#f0ece4";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
                      (e.currentTarget as HTMLElement).style.color = "#ccc";
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>

              {residentPerms && isAdmin(residentPerms) && (
                <Link href="/admin" style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                  background: "linear-gradient(135deg, rgba(201,168,76,0.1), rgba(201,168,76,0.05))",
                  border: "1px solid var(--border-hover)",
                  borderRadius: 12, padding: "14px 16px",
                  textDecoration: "none", color: "var(--gold)",
                  fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem", fontWeight: 600,
                  letterSpacing: "0.04em", transition: "all 0.25s ease",
                }}>
                  <span>🛡 Admin Panel</span>
                  <AdminBadge role={residentPerms.role} />
                </Link>
              )}
            </div>

            {/* Check-In Streak Card */}
            <div className="glass-card animate-fade-in-up stagger-3" style={{ padding: 28 }}>
              <p style={{ color: "var(--gold)", fontSize: "0.75rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 20 }}>
                Daily Check-In Streak
              </p>

              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: "3.5rem", marginBottom: 8, lineHeight: 1 }}>
                  {checkedInToday ? "✅" : streakEmoji(checkInStreak)}
                </div>
                <div className="display-font" style={{ fontSize: "3rem", color: "#f0ece4", lineHeight: 1 }}>
                  {checkInStreak}
                </div>
                <div style={{ fontSize: "0.85rem", color: "#666", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  day{checkInStreak !== 1 ? "s" : ""} streak
                </div>
                {checkedInToday && (
                  <div style={{
                    marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6,
                    background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
                    borderRadius: 999, padding: "5px 16px", fontSize: "0.78rem", color: "#4ade80", fontWeight: 600,
                  }}>
                    ✓ Checked in today · +15 XP
                  </div>
                )}
                {!checkedInToday && (
                  <div style={{
                    marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6,
                    background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)",
                    borderRadius: 999, padding: "5px 16px", fontSize: "0.78rem", color: "var(--gold)", fontWeight: 600,
                  }}>
                    ⏳ Not checked in yet today
                  </div>
                )}
              </div>

              {/* Milestone progress */}
              <p style={{ fontSize: "0.72rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                Streak Milestones
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { days: 3,  label: "3-Day Streak",  emoji: "🔥",     xp: 30  },
                  { days: 7,  label: "7-Day Streak",  emoji: "🔥🔥",  xp: 40  },
                  { days: 30, label: "30-Day Legend", emoji: "🔥🔥🔥", xp: 175 },
                ].map((m) => {
                  const reached = checkInStreak >= m.days;
                  return (
                    <div key={m.days} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px", borderRadius: 10,
                      background: reached ? "rgba(201,168,76,0.07)" : "rgba(255,255,255,0.02)",
                      border: reached ? "1px solid rgba(201,168,76,0.2)" : "1px solid rgba(255,255,255,0.05)",
                    }}>
                      <span style={{ fontSize: 18, opacity: reached ? 1 : 0.25 }}>{m.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: reached ? "#f0ece4" : "#555" }}>
                          {m.label}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: reached ? "var(--gold)" : "#444" }}>
                          +{m.xp} XP bonus notification
                        </div>
                      </div>
                      {reached
                        ? <span style={{ fontSize: "0.72rem", color: "#4ade80", fontWeight: 600 }}>✓</span>
                        : <span style={{ fontSize: "0.72rem", color: "#444" }}>{m.days - checkInStreak}d</span>
                      }
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Monthly Challenges Preview */}
            {activeChallenges.length > 0 && (
              <div className="glass-card animate-fade-in-up stagger-4" style={{ padding: 28 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <p style={{ color: "var(--gold)", fontSize: "0.75rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                    🏆 Monthly Challenges
                  </p>
                  <Link href="/challenges" style={{
                    fontSize: "0.72rem", color: "#555", textDecoration: "none",
                    letterSpacing: "0.06em", textTransform: "uppercase", transition: "color 0.2s",
                  }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--gold)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#555"; }}
                  >
                    View All →
                  </Link>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {activeChallenges.map((ch) => {
                    const prog     = challengeProgressMap[ch.id];
                    const current  = prog?.current ?? 0;
                    const pct      = Math.min(Math.round((current / ch.target) * 100), 100);
                    const done     = prog?.completed ?? false;
                    const claimed  = prog?.rewardClaimed ?? false;
                    const daysLeft = getDaysRemaining(ch.endDate);
                    return (
                      <Link key={ch.id} href="/challenges" style={{ textDecoration: "none" }}>
                        <div style={{
                          background: done ? "rgba(14,30,18,0.7)" : "rgba(255,255,255,0.02)",
                          border: done ? "1px solid rgba(74,222,128,0.2)" : "1px solid rgba(255,255,255,0.06)",
                          borderRadius: 14, padding: "14px 16px", transition: "all 0.25s ease", cursor: "pointer",
                        }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = done ? "rgba(74,222,128,0.4)" : "rgba(201,168,76,0.3)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = done ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.06)"; }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <span style={{ fontSize: "0.88rem", fontWeight: 600, color: done ? "#4ade80" : "#f0ece4" }}>
                              {done ? "✅ " : ""}{ch.title}
                            </span>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              {done && claimed && (
                                <span style={{ fontSize: "0.68rem", color: "#4ade80", fontWeight: 700 }}>🏆 Claimed</span>
                              )}
                              {done && !claimed && (
                                <span style={{ fontSize: "0.68rem", color: "#a5b4fc", fontWeight: 700 }}>🎁 Unclaimed</span>
                              )}
                              <span style={{ fontSize: "0.68rem", color: "#a5b4fc", fontWeight: 600 }}>+{ch.rewardXP} XP</span>
                            </div>
                          </div>
                          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden", height: 6, marginBottom: 6 }}>
                            <div style={{
                              width: `${pct}%`, height: "100%", borderRadius: 999,
                              background: done ? "linear-gradient(90deg, #4ade80, #22c55e)" : "linear-gradient(90deg, #8a6e2f, #c9a84c)",
                              transition: "width 1s cubic-bezier(0.23,1,0.32,1)",
                            }} />
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "#555" }}>
                            <span>{current}/{ch.target} · {pct}%</span>
                            <span>{daysLeft > 0 ? `⏳ ${daysLeft}d left` : "Ended"}</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ⚔️ Gokul Arena Feature Card */}
            <Link href="/arena" style={{ textDecoration: "none" }}>
              <div className="animate-fade-in-up stagger-3" style={{
                background: "linear-gradient(135deg, rgba(20,10,0,0.97), rgba(10,0,20,0.97))",
                border: "1px solid rgba(201,168,76,0.3)",
                borderRadius: 20,
                padding: "24px 28px",
                position: "relative",
                overflow: "hidden",
                cursor: "pointer",
                marginBottom: 20,
                transition: "all 0.3s ease",
              }}>
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 2,
                  background: "linear-gradient(90deg, transparent, var(--gold), rgba(167,139,250,0.8), var(--gold), transparent)",
                  opacity: 0.7,
                }} />
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                    background: "rgba(201,168,76,0.12)",
                    border: "1px solid rgba(201,168,76,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.6rem",
                  }}>⚔️</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: "var(--gold)", fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>
                      New · Phase 1 Live
                    </p>
                    <p style={{ color: "#f0ece4", fontWeight: 700, fontSize: "1.05rem" }}>Gokul Arena</p>
                    <p style={{ color: "#666", fontSize: "0.8rem", marginTop: 2 }}>
                      Floor Wars · Missions · Tournaments · Leaderboards
                    </p>
                  </div>
                  <span style={{ color: "var(--gold)", fontSize: "1.2rem" }}>→</span>
                </div>
              </div>
            </Link>

            {/* Emergency Quick Access */}
            <div className="glass-card animate-fade-in-up stagger-4" style={{
              padding: 28,
              background: "linear-gradient(145deg, rgba(25,8,8,0.97), rgba(15,5,5,0.99))",
              border: "1px solid rgba(239,68,68,0.2)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <p style={{ color: "#f87171", fontSize: "0.75rem", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 }}>
                  🚨 Emergency Numbers
                </p>
                <Link href="/contacts" style={{
                  fontSize: "0.72rem", color: "#555", textDecoration: "none",
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  transition: "color 0.2s",
                }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--gold)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#555"; }}
                >
                  View All →
                </Link>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { name: "Police",      phone: "100",  icon: "🚔" },
                  { name: "Ambulance",   phone: "108",  icon: "🚑" },
                  { name: "Fire",        phone: "101",  icon: "🚒" },
                  { name: "Women Help",  phone: "1091", icon: "🛡️" },
                ].map((e) => (
                  <a key={e.phone} href={`tel:${e.phone}`} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", borderRadius: 10, textDecoration: "none",
                    background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)",
                    transition: "all 0.2s",
                  }}
                    onMouseEnter={(el) => { (el.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.12)"; (el.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.35)"; }}
                    onMouseLeave={(el) => { (el.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.05)"; (el.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.15)"; }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 16 }}>{e.icon}</span>
                      <span style={{ color: "#ccc", fontSize: "0.88rem", fontWeight: 500 }}>{e.name}</span>
                    </span>
                    <span style={{ color: "#f87171", fontFamily: "'Cormorant Garamond', serif", fontSize: "1.1rem", fontWeight: 700 }}>
                      {e.phone}
                    </span>
                  </a>
                ))}
              </div>
            </div>

            {/* Complaints Against You */}
            <div className="glass-card animate-fade-in-up stagger-4" style={{ padding: 28 }}>
              <p style={{ color: "var(--gold)", fontSize: "0.75rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 20 }}>
                Complaints Against You
              </p>
              {complaints.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0" }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🎉</div>
                  <p style={{ color: "#4ade80", fontWeight: 600 }}>No complaints</p>
                  <p style={{ color: "#555", fontSize: "0.85rem", marginTop: 4 }}>You're in good standing</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <p style={{ color: "#f87171", fontSize: "0.9rem" }}>{complaints.length} complaint{complaints.length > 1 ? "s" : ""} on record</p>
                  {complaints.map((complaint) => (
                    <div key={complaint.id} style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "14px" }}>
                      <p style={{ color: "#f87171", fontWeight: 600, marginBottom: 4 }}>⚠ {complaint.title}</p>
                      <p style={{ color: "#888", fontSize: "0.85rem" }}>{complaint.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Change Password */}
            <div className="glass-card animate-fade-in-up stagger-5" style={{ padding: 28 }}>
              <p style={{ color: "var(--gold)", fontSize: "0.75rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 20 }}>
                Security
              </p>
              <p style={{ color: "#666", fontSize: "0.88rem", marginBottom: 16 }}>Update your account password</p>
              <input
                type="password"
                placeholder="New password (min. 6 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="premium-input"
                style={{ marginBottom: 14 }}
              />
              {pwSuccess && (
                <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, padding: "10px 14px", color: "#4ade80", fontSize: "0.85rem", marginBottom: 12 }}>
                  Password updated successfully ✓
                </div>
              )}
              <button
                onClick={handlePasswordChange}
                style={{
                  width: "100%", padding: "13px", borderRadius: 10,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "#ccc", fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem",
                  fontWeight: 500, cursor: "pointer", transition: "all 0.2s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hover)"; (e.currentTarget as HTMLElement).style.color = "#f0ece4"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLElement).style.color = "#ccc"; }}
              >
                Update Password
              </button>
            </div>

          </div>
        )}
      </div>
    </main>

    {/* Waste Info Guide Modal */}
    {wasteGuideOpen && residentData && (
      <WasteInfoGuide
        userId={auth.currentUser?.uid || ""}
        residentData={residentData}
        onXpEarned={(xp) => {
          setResidentData((prev: any) => ({
            ...prev,
            xp: (prev?.xp || 0) + xp,
            level: Math.floor(((prev?.xp || 0) + xp) / 200) + 1,
          }));
        }}
        onClose={() => setWasteGuideOpen(false)}
      />
    )}
    </>
  );
}
