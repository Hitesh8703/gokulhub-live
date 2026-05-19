"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc, getDoc, collection, getDocs, query, where,
  setDoc, serverTimestamp, orderBy,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(monthStr: string) {
  const [year, month] = monthStr.split("-");
  return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-IN", {
    month: "long", year: "numeric",
  });
}

export default function GasBillingPage() {
  const router = useRouter();
  const [residentData, setResidentData] = useState<any>(null);
  const [gasEnabled, setGasEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  // Current month billing
  const [currentMonthStr] = useState(getCurrentMonth());
  const [currentBill, setCurrentBill] = useState<any>(null);
  const [unitsInput, setUnitsInput] = useState("");
  const [ratePerUnit, setRatePerUnit] = useState(0);

  // History
  const [history, setHistory] = useState<any[]>([]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      try {
        const resSnap = await getDoc(doc(db, "residents", user.uid));
        if (!resSnap.exists()) { setLoading(false); return; }
        const res = resSnap.data();
        setResidentData(res);

        // Check if this apartment has gas enabled
        const aptGasSnap = await getDoc(doc(db, "gasSettings", res.apartmentNumber));
        const enabled = aptGasSnap.exists() && aptGasSnap.data().gasEnabled === true;
        setGasEnabled(enabled);

        if (enabled) {
          // Get rate
          const rateSnap = await getDoc(doc(db, "gasConfig", "rate"));
          const rate = rateSnap.exists() ? (rateSnap.data().ratePerUnit || 0) : 0;
          setRatePerUnit(rate);

          // Get current month bill
          const billId = `${res.apartmentNumber}_${currentMonthStr}`;
          const billSnap = await getDoc(doc(db, "gasBills", billId));
          if (billSnap.exists()) {
            const bill = billSnap.data();
            setCurrentBill(bill);
            setUnitsInput(String(bill.unitsUsed || ""));
          }

          // Get history (last 12 months)
          const histSnap = await getDocs(
            query(
              collection(db, "gasBills"),
              where("apartmentNumber", "==", res.apartmentNumber),
              orderBy("month", "desc")
            )
          );
          setHistory(histSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function submitUsage() {
    if (!residentData) return;
    const units = parseFloat(unitsInput);
    if (isNaN(units) || units < 0) { showToast("Please enter valid units consumed"); return; }

    setSaving(true);
    try {
      const billId = `${residentData.apartmentNumber}_${currentMonthStr}`;
      const totalBill = parseFloat((units * ratePerUnit).toFixed(2));
      await setDoc(doc(db, "gasBills", billId), {
        apartmentNumber: residentData.apartmentNumber,
        residentId: residentData.uid || auth.currentUser?.uid,
        month: currentMonthStr,
        unitsUsed: units,
        ratePerUnit,
        totalBill,
        paid: currentBill?.paid || false,
        paidAt: currentBill?.paidAt || null,
        submittedAt: serverTimestamp(),
      });
      setCurrentBill({ unitsUsed: units, ratePerUnit, totalBill, paid: currentBill?.paid || false });
      // Refresh history
      const histSnap = await getDocs(
        query(
          collection(db, "gasBills"),
          where("apartmentNumber", "==", residentData.apartmentNumber),
          orderBy("month", "desc")
        )
      );
      setHistory(histSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      showToast("✓ Usage submitted successfully");
    } catch (e) { console.error(e); showToast("Error submitting usage"); }
    setSaving(false);
  }

  const formatPaidAt = (ts: any) => {
    if (!ts?.seconds) return "";
    return new Date(ts.seconds * 1000).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  };

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "#050505" }}>
      <div style={{ textAlign: "center" }}>
        <div className="spinner" style={{ margin: "0 auto 20px" }} />
        <p style={{ color: "#777", fontSize: "0.85rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Loading Gas Billing
        </p>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen" style={{ background: "#050505", padding: "40px 24px" }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 1000,
          background: "linear-gradient(135deg, #1a1a1a, #222)",
          border: "1px solid var(--border-hover)", borderRadius: 12, padding: "14px 20px",
          color: "var(--gold)", fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
          boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
        }}>
          {toast}
        </div>
      )}

      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* Header */}
        <div className="animate-fade-in-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 40, flexWrap: "wrap", gap: 16 }}>
          <div>
            <p style={{ color: "var(--gold)", fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>
              Monthly Billing
            </p>
            <h1 className="display-font" style={{ fontSize: "2.6rem", color: "#f0ece4" }}>
              🔥 Gas Billing
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

        {/* Not enrolled */}
        {!gasEnabled ? (
          <div className="premium-card animate-fade-in-up" style={{ padding: "48px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
            <h2 style={{ color: "#f0ece4", fontSize: "1.4rem", fontWeight: 700, marginBottom: 10 }}>
              Reticulated Gas Not Enabled
            </h2>
            <p style={{ color: "#555", fontSize: "0.88rem", lineHeight: 1.6 }}>
              Your apartment is not currently enrolled in the reticulated gas system.<br />
              Please contact the management office if you believe this is incorrect.
            </p>
          </div>
        ) : (
          <>
            {/* Current month */}
            <div className="animate-fade-in-up stagger-1" style={{
              background: "rgba(255,255,255,0.02)", borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.07)", padding: "28px 28px", marginBottom: 24,
            }}>
              <p style={{ color: "var(--gold)", fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16, fontWeight: 700 }}>
                {formatMonth(currentMonthStr)} · Current Month
              </p>

              {/* Rate info */}
              <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
                <div style={{
                  flex: 1, minWidth: 140, background: "rgba(201,168,76,0.06)", borderRadius: 12,
                  border: "1px solid rgba(201,168,76,0.15)", padding: "16px 18px", textAlign: "center",
                }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--gold)" }}>₹{ratePerUnit}</div>
                  <div style={{ fontSize: "0.7rem", color: "#888", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Rate / Unit</div>
                </div>
                <div style={{
                  flex: 1, minWidth: 140, background: "rgba(255,255,255,0.03)", borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.05)", padding: "16px 18px", textAlign: "center",
                }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f0ece4" }}>
                    {currentBill ? currentBill.unitsUsed : "—"}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "#888", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Units Used</div>
                </div>
                <div style={{
                  flex: 1, minWidth: 140,
                  background: currentBill?.paid ? "rgba(74,222,128,0.06)" : "rgba(239,68,68,0.06)",
                  borderRadius: 12,
                  border: currentBill?.paid ? "1px solid rgba(74,222,128,0.2)" : "1px solid rgba(239,68,68,0.15)",
                  padding: "16px 18px", textAlign: "center",
                }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: currentBill?.paid ? "#4ade80" : "#f87171" }}>
                    ₹{currentBill ? currentBill.totalBill : "0"}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: currentBill?.paid ? "#4ade80" : "#f87171", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {currentBill?.paid ? "✅ Paid" : "Total Bill"}
                  </div>
                </div>
              </div>

              {/* Enter usage */}
              {!currentBill?.paid && (
                <div>
                  <p style={{ color: "#777", fontSize: "0.82rem", marginBottom: 10 }}>Enter your units consumed this month:</p>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="e.g. 12.5"
                      value={unitsInput}
                      onChange={(e) => setUnitsInput(e.target.value)}
                      style={{
                        flex: 1, minWidth: 160, padding: "12px 16px", borderRadius: 10,
                        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                        color: "#f0ece4", fontFamily: "'DM Sans', sans-serif", fontSize: "0.95rem",
                        outline: "none",
                      }}
                    />
                    {unitsInput && !isNaN(parseFloat(unitsInput)) && (
                      <span style={{ color: "var(--gold)", fontWeight: 700, fontSize: "0.95rem" }}>
                        = ₹{(parseFloat(unitsInput) * ratePerUnit).toFixed(2)}
                      </span>
                    )}
                    <button
                      onClick={submitUsage}
                      disabled={saving}
                      style={{
                        padding: "12px 22px", borderRadius: 10, fontWeight: 700, fontSize: "0.88rem",
                        cursor: saving ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif",
                        background: saving ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg,#8a6e2f,#c9a84c)",
                        color: saving ? "#555" : "#0a0800", border: "none", transition: "all 0.2s",
                      }}
                    >
                      {saving ? "Saving…" : currentBill ? "Update Usage" : "Submit Usage"}
                    </button>
                  </div>
                </div>
              )}

              {currentBill?.paid && currentBill?.paidAt && (
                <p style={{ color: "#4ade80", fontSize: "0.82rem", marginTop: 8 }}>
                  Paid on {formatPaidAt(currentBill.paidAt)}
                </p>
              )}
            </div>

            {/* History */}
            <div className="animate-fade-in-up stagger-2">
              <p style={{ color: "var(--gold)", fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16, fontWeight: 700 }}>
                📋 Payment History
              </p>
              {history.length === 0 ? (
                <div className="premium-card" style={{ padding: "32px", textAlign: "center" }}>
                  <p style={{ color: "#555", fontSize: "0.88rem" }}>No gas billing history yet.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {history.map((bill) => (
                    <div key={bill.id} className="premium-card" style={{
                      padding: "18px 22px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
                      borderColor: bill.paid ? "rgba(74,222,128,0.15)" : "rgba(239,68,68,0.1)",
                    }}>
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <div style={{ fontWeight: 700, color: "#f0ece4", fontSize: "0.95rem" }}>{formatMonth(bill.month)}</div>
                        <div style={{ color: "#555", fontSize: "0.78rem", marginTop: 2 }}>
                          {bill.unitsUsed} units × ₹{bill.ratePerUnit}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700, color: "var(--gold)", fontSize: "1rem" }}>₹{bill.totalBill}</div>
                        {bill.paid ? (
                          <span style={{
                            background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.25)",
                            borderRadius: 999, padding: "3px 10px", fontSize: "0.7rem", color: "#4ade80",
                            fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                          }}>✅ Paid</span>
                        ) : (
                          <span style={{
                            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                            borderRadius: 999, padding: "3px 10px", fontSize: "0.7rem", color: "#f87171",
                            fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                          }}>⚠ Pending</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </main>
  );
}
