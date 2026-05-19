"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";

function StatusBadge({ status }: { status: string }) {
  if (status === "Resolved")     return <span className="badge badge-resolved">● Resolved</span>;
  if (status === "Under Review") return <span className="badge badge-review">● Under Review</span>;
  return <span className="badge badge-pending">● Pending</span>;
}

export default function MyComplaintsPage() {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { setLoading(false); return; }
      try {
        // query by both new field (submittedById) and legacy field (raisedBy)
        const apartment = localStorage.getItem("apartment");

        const byId = query(
          collection(db, "complaints"),
          where("submittedById", "==", user.uid)
        );
        const byApartment = apartment
          ? query(collection(db, "complaints"), where("raisedBy", "==", apartment))
          : null;

        const [snapById, snapByApt] = await Promise.all([
          getDocs(byId),
          byApartment ? getDocs(byApartment) : Promise.resolve(null),
        ]);

        const seen = new Set<string>();
        const data: any[] = [];

        snapById.docs.forEach((d) => {
          seen.add(d.id);
          data.push({ id: d.id, ...d.data() });
        });
        if (snapByApt) {
          snapByApt.docs.forEach((d) => {
            if (!seen.has(d.id)) data.push({ id: d.id, ...d.data() });
          });
        }

        // sort: Pending → Under Review → Resolved
        data.sort((a, b) => {
          const order: Record<string, number> = { Pending: 0, "Under Review": 1, Resolved: 2 };
          return (order[a.status] ?? 0) - (order[b.status] ?? 0);
        });
        setComplaints(data);
      } catch (error) { console.error(error); }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "#050505" }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner" style={{ margin: "0 auto 20px" }} />
          <p style={{ color: "#777", fontSize: "0.85rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading Complaints</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: "#050505", padding: "40px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        <div className="animate-fade-in-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 40 }}>
          <div>
            <p style={{ color: "var(--gold)", fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>Tracking</p>
            <h1 className="display-font" style={{ fontSize: "2.6rem", color: "#f0ece4" }}>My Complaints</h1>
          </div>
          <Link href="/dashboard" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 18px", color: "#888", textDecoration: "none", fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem" }}>
            ← Dashboard
          </Link>
        </div>

        {complaints.length === 0 ? (
          <div className="glass-card animate-fade-in" style={{ padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
            <p style={{ color: "#888", marginBottom: 20 }}>No complaints submitted yet</p>
            <Link href="/complaints" style={{ display: "inline-block", background: "linear-gradient(135deg, #8a6e2f, #c9a84c)", color: "#0a0800", padding: "12px 24px", borderRadius: 10, textDecoration: "none", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>
              Raise a Complaint
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {complaints.map((complaint, i) => (
              <div key={complaint.id} className={`premium-card animate-fade-in-up stagger-${Math.min(i + 1, 8)}`} style={{ padding: 24 }}>

                {/* Status row */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  <StatusBadge status={complaint.status || "Pending"} />
                  {complaint.type && (
                    <span style={{
                      fontSize: "0.7rem", color: "var(--gold)", letterSpacing: "0.08em",
                      textTransform: "uppercase", fontWeight: 600,
                      background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)",
                      borderRadius: 999, padding: "2px 10px",
                    }}>
                      {complaint.type}
                    </span>
                  )}
                  {complaint.againstType && (
                    <span style={{
                      fontSize: "0.7rem", borderRadius: 999, padding: "2px 10px", fontWeight: 600,
                      background: complaint.againstType === "resident" ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.05)",
                      color: complaint.againstType === "resident" ? "#f87171" : "#777",
                      border: complaint.againstType === "resident" ? "1px solid rgba(239,68,68,0.25)" : "1px solid rgba(255,255,255,0.08)",
                    }}>
                      {complaint.againstType === "resident" ? "👤 vs Resident" : "🏢 General"}
                    </span>
                  )}
                  {/* XP granted indicator */}
                  {complaint.xpGranted && (
                    <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: "#4ade80", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 999, padding: "3px 10px" }}>
                      ✓ +40 XP Received
                    </span>
                  )}
                </div>

                {/* Title & description */}
                <h2 style={{ fontSize: "1.05rem", fontWeight: 600, color: "#f0ece4", marginBottom: 8 }}>{complaint.title}</h2>
                <p style={{ color: "#777", fontSize: "0.9rem", lineHeight: 1.5 }}>{complaint.description}</p>

                {/* Against info */}
                {complaint.againstType === "resident" && complaint.againstResidentName && (
                  <p style={{ marginTop: 10, fontSize: "0.8rem", color: "#f87171" }}>
                    Against: {complaint.againstResidentName}
                  </p>
                )}
                {/* Legacy compat */}
                {!complaint.againstResidentName && complaint.againstApartment && (
                  <p style={{ marginTop: 10, fontSize: "0.8rem", color: "#555" }}>
                    Against: Apt {complaint.againstApartment}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
