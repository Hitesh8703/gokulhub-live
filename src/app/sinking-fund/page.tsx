"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const CYCLES = [1, 2] as const;
type Cycle = typeof CYCLES[number];

const CYCLE_LABELS: Record<Cycle, string> = {
  1: "Cycle 1 (Jan – Jun)",
  2: "Cycle 2 (Jul – Dec)",
};

export default function SinkingFundPage() {
  const router = useRouter();
  const [residentData, setResidentData] = useState<any>(null);
  const [payments, setPayments] = useState<Record<string, any>>({});
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      try {
        const resSnap = await getDoc(doc(db, "residents", user.uid));
        if (!resSnap.exists()) { setLoading(false); return; }
        const res = resSnap.data();
        setResidentData(res);
        await loadPayments(res.apartmentNumber, new Date().getFullYear());
      } catch (e) { console.error(e); }
      setLoading(false);
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadPayments(apt: string, year: number) {
    const snap = await getDocs(
      query(
        collection(db, "sinkingFundPayments"),
        where("apartmentNumber", "==", apt),
        where("year", "==", year)
      )
    );
    const map: Record<string, any> = {};
    snap.forEach((d) => {
      const data = d.data();
      map[`cycle_${data.cycleNumber}`] = data;
    });
    setPayments(map);
  }

  async function switchYear(year: number) {
    setSelectedYear(year);
    if (residentData?.apartmentNumber) {
      setLoading(true);
      await loadPayments(residentData.apartmentNumber, year);
      setLoading(false);
    }
  }

  const formatPaidAt = (ts: any) => {
    if (!ts?.seconds) return "";
    return new Date(ts.seconds * 1000).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  };

  const paidCount = CYCLES.filter((c) => payments[`cycle_${c}`]?.paid).length;
  const pendingCount = CYCLES.filter((c) => !payments[`cycle_${c}`]?.paid).length;

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "#050505" }}>
      <div style={{ textAlign: "center" }}>
        <div className="spinner" style={{ margin: "0 auto 20px" }} />
        <p style={{ color: "#777", fontSize: "0.85rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Loading Sinking Fund
        </p>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen" style={{ background: "#050505", padding: "40px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* Header */}
        <div className="animate-fade-in-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 40, flexWrap: "wrap", gap: 16 }}>
          <div>
            <p style={{ color: "var(--gold)", fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>
              Bi-Annual Dues
            </p>
            <h1 className="display-font" style={{ fontSize: "2.6rem", color: "#f0ece4" }}>
              🏦 Sinking Fund
            </h1>
            {residentData?.apartmentNumber && (
              <p style={{ color: "#555", fontSize: "0.88rem", marginTop: 4 }}>
                Apartment {residentData.apartmentNumber}
              </p>
            )}
          </div>
          <Link href="/dashboard" style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10, padding: "10px 18px", color: "#888", textDecoration: "none",
            fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem",
          }}>
            ← Dashboard
          </Link>
        </div>

        {/* Year Selector */}
        <div className="animate-fade-in-up stagger-1" style={{ display: "flex", gap: 10, marginBottom: 32, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ color: "#555", fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>Year:</span>
          {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map((yr) => (
            <button
              key={yr}
              onClick={() => switchYear(yr)}
              style={{
                padding: "9px 20px", borderRadius: 10, fontSize: "0.88rem", fontWeight: 700,
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
                background: selectedYear === yr ? "linear-gradient(135deg,#8a6e2f,#c9a84c)" : "rgba(255,255,255,0.04)",
                color: selectedYear === yr ? "#0a0800" : "#777",
                border: selectedYear === yr ? "none" : "1px solid rgba(255,255,255,0.08)",
              }}
            >{yr}</button>
          ))}
        </div>

        {/* Summary banner */}
        <div className="animate-fade-in-up stagger-2" style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 32,
        }}>
          <div style={{
            background: "rgba(255,255,255,0.03)", borderRadius: 14, padding: "20px 18px",
            border: "1px solid rgba(255,255,255,0.05)", textAlign: "center",
          }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#f0ece4", lineHeight: 1 }}>2</div>
            <div style={{ fontSize: "0.7rem", color: "#555", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Total Cycles</div>
          </div>
          <div style={{
            background: "rgba(74,222,128,0.06)", borderRadius: 14, padding: "20px 18px",
            border: "1px solid rgba(74,222,128,0.15)", textAlign: "center",
          }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#4ade80", lineHeight: 1 }}>{paidCount}</div>
            <div style={{ fontSize: "0.7rem", color: "#4ade80", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.8 }}>Paid</div>
          </div>
          <div style={{
            background: pendingCount > 0 ? "rgba(239,68,68,0.06)" : "rgba(74,222,128,0.04)",
            borderRadius: 14, padding: "20px 18px",
            border: pendingCount > 0 ? "1px solid rgba(239,68,68,0.15)" : "1px solid rgba(74,222,128,0.1)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: pendingCount > 0 ? "#f87171" : "#4ade80", lineHeight: 1 }}>
              {pendingCount}
            </div>
            <div style={{ fontSize: "0.7rem", color: pendingCount > 0 ? "#f87171" : "#4ade80", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.8 }}>
              {pendingCount > 0 ? "Pending" : "All Clear!"}
            </div>
          </div>
        </div>

        {/* Cycle cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {CYCLES.map((cycle, i) => {
            const rec = payments[`cycle_${cycle}`];
            const isPaid = rec?.paid === true;
            return (
              <div
                key={cycle}
                className={`premium-card animate-fade-in-up stagger-${i + 3}`}
                style={{
                  padding: "24px 26px",
                  display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
                  borderColor: isPaid ? "rgba(74,222,128,0.2)" : "rgba(239,68,68,0.15)",
                  background: isPaid
                    ? "linear-gradient(135deg, rgba(74,222,128,0.04), rgba(255,255,255,0.02))"
                    : "linear-gradient(135deg, rgba(239,68,68,0.04), rgba(255,255,255,0.02))",
                }}
              >
                {/* Cycle icon */}
                <div style={{
                  width: 64, height: 64, borderRadius: 16, flexShrink: 0,
                  background: isPaid ? "rgba(74,222,128,0.12)" : "rgba(239,68,68,0.08)",
                  border: isPaid ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(239,68,68,0.2)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontSize: "1rem", fontWeight: 800, color: isPaid ? "#4ade80" : "#f87171" }}>C{cycle}</span>
                  <span style={{ fontSize: "0.6rem", color: isPaid ? "#4ade80" : "#f87171", opacity: 0.75, marginTop: 2 }}>
                    {selectedYear}
                  </span>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 160 }}>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#f0ece4", marginBottom: 4 }}>
                    Cycle {cycle} · {CYCLE_LABELS[cycle]}
                  </h3>
                  <p style={{ color: "#666", fontSize: "0.82rem" }}>
                    Bi-annual sinking fund contribution
                  </p>
                  {isPaid && rec?.paidAt && (
                    <p style={{ color: "#4ade80", fontSize: "0.78rem", marginTop: 6, fontWeight: 600 }}>
                      Paid on {formatPaidAt(rec.paidAt)}
                    </p>
                  )}
                </div>

                {/* Status badge */}
                {isPaid ? (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)",
                    borderRadius: 12, padding: "10px 18px",
                  }}>
                    <span style={{ fontSize: "1.1rem" }}>✅</span>
                    <div>
                      <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#4ade80", lineHeight: 1 }}>Paid</div>
                      <div style={{ fontSize: "0.68rem", color: "#4ade80", opacity: 0.75, marginTop: 2 }}>Cleared</div>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                    borderRadius: 12, padding: "10px 18px",
                  }}>
                    <span style={{ fontSize: "1.1rem" }}>❌</span>
                    <div>
                      <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#f87171", lineHeight: 1 }}>Pending</div>
                      <div style={{ fontSize: "0.68rem", color: "#f87171", opacity: 0.75, marginTop: 2 }}>Due</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div style={{
          marginTop: 32, padding: "18px 22px", borderRadius: 14,
          background: "rgba(201,168,76,0.04)", border: "1px solid rgba(201,168,76,0.1)",
        }}>
          <p style={{ color: "#666", fontSize: "0.82rem", lineHeight: 1.6 }}>
            ℹ️ Sinking fund is collected twice a year (Cycle 1: Jan–Jun, Cycle 2: Jul–Dec). Payment status is updated by the admin. Contact management if you believe your payment status is incorrect.
          </p>
        </div>

      </div>
    </main>
  );
}
