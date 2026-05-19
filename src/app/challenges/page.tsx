"use client";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, doc, getDoc, query, where,
  addDoc, updateDoc, serverTimestamp, increment,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  Challenge, ChallengeProgress, ChallengeType,
  CHALLENGE_TYPE_META, getResidentStatForChallenge,
  getChallengeStatusLabel, getDaysRemaining,
} from "@/lib/challenges";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function progressPercent(current: number, target: number): number {
  return Math.min(Math.round((current / target) * 100), 100);
}

function getProgressColor(pct: number): string {
  if (pct >= 100) return "linear-gradient(90deg, #4ade80, #22c55e)";
  if (pct >= 60)  return "linear-gradient(90deg, #c9a84c, #e8c96a)";
  return "linear-gradient(90deg, #8a6e2f, #c9a84c)";
}

// ─── Challenge Card ───────────────────────────────────────────────────────────

function ChallengeCard({
  challenge,
  progress,
  onClaim,
  claiming,
}: {
  challenge: Challenge;
  progress: ChallengeProgress | null;
  onClaim: (challenge: Challenge) => void;
  claiming: string | null;
}) {
  const meta    = CHALLENGE_TYPE_META[challenge.challengeType as ChallengeType];
  const current = progress?.current ?? 0;
  const pct     = progressPercent(current, challenge.target);
  const completed = progress?.completed ?? false;
  const claimed   = progress?.rewardClaimed ?? false;
  const daysLeft  = getDaysRemaining(challenge.endDate);
  const statusLabel = getChallengeStatusLabel(challenge);

  return (
    <div
      className="animate-fade-in-up"
      style={{
        background: completed
          ? "linear-gradient(145deg, rgba(14,30,18,0.97), rgba(10,20,14,0.99))"
          : "linear-gradient(145deg, rgba(20,18,14,0.97), rgba(14,14,14,0.98))",
        border: completed
          ? "1px solid rgba(74,222,128,0.25)"
          : "1px solid rgba(201,168,76,0.18)",
        borderRadius: 20,
        padding: 24,
        position: "relative",
        overflow: "hidden",
        transition: "all 0.35s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLElement).style.boxShadow = completed
          ? "0 0 30px rgba(74,222,128,0.12), 0 8px 32px rgba(0,0,0,0.6)"
          : "0 0 30px rgba(201,168,76,0.12), 0 8px 32px rgba(0,0,0,0.6)";
        (e.currentTarget as HTMLElement).style.borderColor = completed
          ? "rgba(74,222,128,0.45)"
          : "rgba(201,168,76,0.45)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
        (e.currentTarget as HTMLElement).style.borderColor = completed
          ? "rgba(74,222,128,0.25)"
          : "rgba(201,168,76,0.18)";
      }}
    >
      {/* Glow orb */}
      <div style={{
        position: "absolute", top: -40, right: -40, width: 120, height: 120,
        borderRadius: "50%",
        background: completed
          ? "radial-gradient(circle, rgba(74,222,128,0.07) 0%, transparent 70%)"
          : "radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 14,
            background: completed ? "rgba(74,222,128,0.12)" : "rgba(201,168,76,0.1)",
            border: completed ? "1px solid rgba(74,222,128,0.25)" : "1px solid rgba(201,168,76,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, flexShrink: 0,
          }}>
            {completed ? "✅" : meta.icon}
          </div>
          <div>
            <h3 style={{
              fontSize: "0.95rem", fontWeight: 700, color: "#f0ece4",
              marginBottom: 2, lineHeight: 1.3,
            }}>
              {challenge.title}
            </h3>
            <p style={{ fontSize: "0.75rem", color: "#666" }}>{meta.label}</p>
          </div>
        </div>

        {/* Status + XP badges */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <span style={{
            padding: "3px 12px", borderRadius: 999, fontSize: "0.68rem", fontWeight: 700,
            letterSpacing: "0.06em", textTransform: "uppercase",
            background: completed ? "rgba(74,222,128,0.12)" : statusLabel === "Active" ? "rgba(201,168,76,0.12)" : "rgba(100,100,100,0.12)",
            color: completed ? "#4ade80" : statusLabel === "Active" ? "var(--gold)" : "#666",
            border: completed ? "1px solid rgba(74,222,128,0.25)" : statusLabel === "Active" ? "1px solid rgba(201,168,76,0.2)" : "1px solid rgba(100,100,100,0.2)",
          }}>
            {completed ? "✓ Done" : statusLabel}
          </span>
          <span style={{
            padding: "3px 10px", borderRadius: 999, fontSize: "0.68rem", fontWeight: 700,
            background: "rgba(99,102,241,0.12)", color: "#a5b4fc",
            border: "1px solid rgba(99,102,241,0.2)",
          }}>
            +{challenge.rewardXP} XP
          </span>
        </div>
      </div>

      {/* Description */}
      <p style={{ fontSize: "0.83rem", color: "#777", marginBottom: 16, lineHeight: 1.5 }}>
        {challenge.description}
      </p>

      {/* Progress bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.75rem" }}>
          <span style={{ color: "#666" }}>Progress</span>
          <span style={{ color: completed ? "#4ade80" : "var(--gold)", fontWeight: 600 }}>
            {current} / {challenge.target} ({pct}%)
          </span>
        </div>
        <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden", height: 8 }}>
          <div style={{
            width: `${pct}%`,
            height: "100%",
            background: getProgressColor(pct),
            borderRadius: 999,
            transition: "width 1.2s cubic-bezier(0.23,1,0.32,1)",
            boxShadow: completed ? "0 0 8px rgba(74,222,128,0.5)" : pct > 60 ? "0 0 8px rgba(201,168,76,0.4)" : "none",
          }} />
        </div>
      </div>

      {/* Footer row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
        <span style={{ fontSize: "0.72rem", color: "#555" }}>
          {daysLeft > 0 ? `⏳ ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left` : "🔒 Ended"}
        </span>

        {completed && !claimed && (
          <button
            onClick={() => onClaim(challenge)}
            disabled={claiming === challenge.id}
            style={{
              padding: "8px 20px", borderRadius: 10,
              background: "linear-gradient(135deg, #22c55e, #4ade80)",
              color: "#0a1f0e", fontFamily: "'DM Sans', sans-serif",
              fontWeight: 700, fontSize: "0.82rem", border: "none",
              cursor: claiming === challenge.id ? "not-allowed" : "pointer",
              opacity: claiming === challenge.id ? 0.7 : 1,
              boxShadow: "0 0 16px rgba(74,222,128,0.3)",
              transition: "all 0.2s",
            }}
          >
            {claiming === challenge.id ? "Claiming…" : `🎁 Claim +${challenge.rewardXP} XP`}
          </button>
        )}

        {completed && claimed && (
          <span style={{
            padding: "7px 18px", borderRadius: 10, fontSize: "0.8rem", fontWeight: 700,
            background: "rgba(74,222,128,0.1)", color: "#4ade80",
            border: "1px solid rgba(74,222,128,0.2)",
          }}>
            🏆 Reward Claimed
          </span>
        )}

        {!completed && (
          <span style={{ fontSize: "0.75rem", color: "#555" }}>
            {challenge.target - current} more to go
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ChallengesPage() {
  const router = useRouter();
  const [loading, setLoading]           = useState(true);
  const [residentData, setResidentData] = useState<any>(null);
  const [residentId, setResidentId]     = useState<string>("");
  const [challenges, setChallenges]     = useState<Challenge[]>([]);
  const [progressMap, setProgressMap]   = useState<Record<string, ChallengeProgress>>({});
  const [claiming, setClaiming]         = useState<string | null>(null);
  const [filter, setFilter]             = useState<"all" | "active" | "completed">("active");

  const syncProgress = useCallback(async (
    uid: string,
    resident: any,
    chs: Challenge[],
  ) => {
    const now = new Date();
    const activeChallenges = chs.filter((c) => {
      return c.active && new Date(c.startDate) <= now && new Date(c.endDate) >= now;
    });

    const progressSnap = await getDocs(
      query(collection(db, "challengeProgress"), where("residentId", "==", uid))
    );
    const existing: Record<string, ChallengeProgress & { id: string }> = {};
    progressSnap.forEach((d) => {
      const data = d.data() as ChallengeProgress;
      existing[data.challengeId] = { ...data, id: d.id };
    });

    const updated: Record<string, ChallengeProgress> = { ...existing };

    for (const ch of activeChallenges) {
      const stat    = getResidentStatForChallenge(ch.challengeType as ChallengeType, resident);
      const current = Math.min(stat, ch.target);
      const completed = current >= ch.target;

      if (existing[ch.id]) {
        const prev = existing[ch.id];
        // Only update if stat grew
        if (current > prev.current) {
          const updateData: Partial<ChallengeProgress> = {
            current,
            completed,
            updatedAt: serverTimestamp(),
          };
          await updateDoc(doc(db, "challengeProgress", prev.id!), updateData);
          updated[ch.id] = { ...prev, current, completed };
        }
      } else {
        // Create new progress doc
        const newProgress: Omit<ChallengeProgress, "id"> = {
          challengeId: ch.id,
          residentId: uid,
          apartmentNumber: resident.apartmentNumber,
          current,
          completed,
          rewardClaimed: false,
          updatedAt: serverTimestamp(),
        };
        const ref = await addDoc(collection(db, "challengeProgress"), newProgress);
        updated[ch.id] = { ...newProgress, id: ref.id };
      }
    }

    setProgressMap(updated);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      try {
        const resSnap = await getDoc(doc(db, "residents", user.uid));
        if (!resSnap.exists()) { router.push("/login"); return; }
        const resident = resSnap.data();
        setResidentData(resident);
        setResidentId(user.uid);

        const chSnap = await getDocs(collection(db, "challenges"));
        const chs = chSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Challenge));
        const sorted = chs.sort((a, b) => {
          // active first, then upcoming, then ended
          const order = (c: Challenge) => {
            const now = new Date();
            if (!c.active) return 3;
            if (new Date(c.endDate) < now) return 2;
            if (new Date(c.startDate) > now) return 1;
            return 0;
          };
          return order(a) - order(b);
        });
        setChallenges(sorted);

        await syncProgress(user.uid, resident, sorted);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router, syncProgress]);

  async function claimReward(challenge: Challenge) {
    const prog = progressMap[challenge.id];
    if (!prog || !prog.completed || prog.rewardClaimed) return;
    setClaiming(challenge.id);
    try {
      // Mark claimed
      const progressDocId = (prog as any).id;
      await updateDoc(doc(db, "challengeProgress", progressDocId), {
        rewardClaimed: true,
        updatedAt: serverTimestamp(),
      });

      // Award XP
      const resRef  = doc(db, "residents", residentId);
      const resSnap = await getDoc(resRef);
      if (resSnap.exists()) {
        const data    = resSnap.data();
        const newXP   = (data.xp || 0) + challenge.rewardXP;
        const newLevel = Math.floor(newXP / 200) + 1;
        await updateDoc(resRef, { xp: increment(challenge.rewardXP), level: newLevel });

        // Notification
        await addDoc(collection(db, "notifications"), {
          type: "private",
          targetApartment: data.apartmentNumber,
          title: "🏆 Challenge Completed!",
          description: `"${challenge.title}" — +${challenge.rewardXP} XP earned!`,
          createdAt: serverTimestamp(),
        });

        setResidentData((prev: any) => ({ ...prev, xp: newXP, level: newLevel }));
      }

      setProgressMap((prev) => ({
        ...prev,
        [challenge.id]: { ...prev[challenge.id], rewardClaimed: true },
      }));
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
    }
    setClaiming(null);
  }

  const now = new Date();
  const filtered = challenges.filter((c) => {
    const prog     = progressMap[c.id];
    const isActive = c.active && new Date(c.startDate) <= now && new Date(c.endDate) >= now;
    const isDone   = prog?.completed && prog?.rewardClaimed;
    if (filter === "active") return isActive && !isDone;
    if (filter === "completed") return isDone;
    return true;
  });

  const activeChallenges   = challenges.filter((c) => c.active && new Date(c.startDate) <= now && new Date(c.endDate) >= now);
  const completedCount     = activeChallenges.filter((c) => progressMap[c.id]?.completed).length;
  const claimableChallenges = activeChallenges.filter((c) => progressMap[c.id]?.completed && !progressMap[c.id]?.rewardClaimed);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "#050505" }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner" style={{ margin: "0 auto 20px" }} />
          <p style={{ color: "#777", letterSpacing: "0.1em", textTransform: "uppercase", fontSize: "0.85rem" }}>Loading Challenges</p>
        </div>
      </main>
    );
  }

  return (
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
        <div className="animate-fade-in-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40, flexWrap: "wrap", gap: 16 }}>
          <div>
            <Link href="/dashboard" style={{ color: "#555", fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
              ← Dashboard
            </Link>
            <h1 className="display-font" style={{ fontSize: "2.6rem", lineHeight: 1.1, color: "#f0ece4" }}>
              Monthly Challenges
            </h1>
            <p style={{ color: "#666", marginTop: 4, fontSize: "0.9rem" }}>Complete challenges to earn bonus XP rewards</p>
          </div>

          {/* Summary stats */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              { label: "Active", value: activeChallenges.length, color: "var(--gold)" },
              { label: "Completed", value: completedCount, color: "#4ade80" },
              { label: "Claimable", value: claimableChallenges.length, color: "#a5b4fc" },
            ].map((s) => (
              <div key={s.label} style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14, padding: "12px 20px", textAlign: "center", minWidth: 80,
              }}>
                <div style={{ fontSize: "1.6rem", fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: "0.68rem", color: "#555", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Claimable banner */}
        {claimableChallenges.length > 0 && (
          <div className="animate-fade-in-up" style={{
            marginBottom: 28,
            background: "linear-gradient(135deg, rgba(74,222,128,0.08), rgba(34,197,94,0.05))",
            border: "1px solid rgba(74,222,128,0.25)",
            borderRadius: 16, padding: "16px 24px",
            display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 24 }}>🎁</span>
            <div>
              <p style={{ color: "#4ade80", fontWeight: 700, fontSize: "0.92rem" }}>
                {claimableChallenges.length} challenge{claimableChallenges.length > 1 ? "s" : ""} ready to claim!
              </p>
              <p style={{ color: "#555", fontSize: "0.78rem", marginTop: 2 }}>
                You've completed the requirements — claim your XP rewards below.
              </p>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="animate-fade-in-up stagger-1" style={{ display: "flex", gap: 8, marginBottom: 28 }}>
          {(["active", "completed", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "9px 22px", borderRadius: 10, fontSize: "0.82rem", fontWeight: 600,
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                transition: "all 0.2s",
                border: filter === f ? "1px solid rgba(201,168,76,0.4)" : "1px solid rgba(255,255,255,0.08)",
                background: filter === f ? "rgba(201,168,76,0.1)" : "rgba(255,255,255,0.03)",
                color: filter === f ? "var(--gold)" : "#666",
                textTransform: "capitalize",
              }}
            >
              {f === "active" ? "🔥 Active" : f === "completed" ? "✅ Completed" : "📋 All"}
            </button>
          ))}
        </div>

        {/* Challenge grid */}
        {filtered.length === 0 ? (
          <div className="glass-card animate-fade-in-up" style={{ padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>
              {filter === "completed" ? "🏆" : "🎯"}
            </div>
            <p style={{ color: "#555", fontSize: "1rem" }}>
              {filter === "completed" ? "No completed challenges yet. Keep going!" : "No challenges available right now. Check back soon!"}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
            {filtered.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                progress={progressMap[challenge.id] ?? null}
                onClaim={claimReward}
                claiming={claiming}
              />
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
