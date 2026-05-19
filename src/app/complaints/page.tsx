"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc, collection, serverTimestamp,
  doc, getDoc, getDocs,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Link from "next/link";

const COMPLAINT_TYPES = [
  "Noise",
  "Garbage",
  "Parking",
  "Maintenance",
  "Misconduct",
  "General",
] as const;

type ComplaintType = typeof COMPLAINT_TYPES[number];

interface ResidentInfo {
  uid: string;
  apartmentNumber: string;
  name?: string;
}

export default function ComplaintsPage() {
  const router = useRouter();
  const [residentData, setResidentData] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  // form state
  const [complaintType, setComplaintType] = useState<ComplaintType>("Noise");
  const [againstType, setAgainstType] = useState<"resident" | "general">("general");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // resident selector
  const [allResidents, setAllResidents] = useState<ResidentInfo[]>([]);
  const [selectedResidentId, setSelectedResidentId] = useState<string>("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      setCurrentUserId(user.uid);
      const snap = await getDoc(doc(db, "residents", user.uid));
      if (snap.exists()) setResidentData(snap.data());

      // fetch all residents for selector
      const rSnap = await getDocs(collection(db, "residents"));
      const list: ResidentInfo[] = [];
      rSnap.forEach((d) => {
        if (d.id !== user.uid) {
          list.push({ uid: d.id, ...d.data() } as ResidentInfo);
        }
      });
      list.sort((a, b) =>
        (a.apartmentNumber || "").localeCompare(b.apartmentNumber || "", undefined, { numeric: true })
      );
      setAllResidents(list);
    });
    return () => unsubscribe();
  }, [router]);

  async function handleComplaint() {
    setError("");
    if (!title.trim() || !description.trim()) { setError("Please fill all fields"); return; }
    if (againstType === "resident" && !selectedResidentId) {
      setError("Please select the resident"); return;
    }
    const user = auth.currentUser;
    if (!user || !residentData) return;

    setSubmitting(true);
    try {
      const selectedResident = againstType === "resident"
        ? allResidents.find((r) => r.uid === selectedResidentId)
        : null;

      const complaintPayload: Record<string, any> = {
        title: title.trim(),
        description: description.trim(),
        type: complaintType,
        status: "Pending",
        xpGranted: false,

        // submitter info
        submittedBy: residentData.apartmentNumber,
        submittedById: currentUserId,
        submittedByApartment: residentData.apartmentNumber,

        // against info
        againstType,
        againstResidentName: selectedResident ? `Apt ${selectedResident.apartmentNumber}` : null,
        againstResidentId: selectedResident ? selectedResident.uid : null,

        // legacy compat fields still used by dashboard
        raisedBy: residentData.apartmentNumber,
        apartmentNumber: residentData.apartmentNumber,
        againstApartment: selectedResident ? selectedResident.apartmentNumber : null,

        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "complaints"), complaintPayload);

      // notification
      if (againstType === "resident" && selectedResident) {
        await addDoc(collection(db, "notifications"), {
          type: "private",
          targetApartment: selectedResident.apartmentNumber,
          title: "🚨 Complaint Against You",
          description: `${complaintType}: ${description.trim()}`,
          createdAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "notifications"), {
          type: "public",
          title: `📢 ${complaintType} Issue Reported`,
          description: description.trim(),
          issueType: complaintType,
          createdAt: serverTimestamp(),
        });
      }

      router.push("/my-complaints");
    } catch (e: any) {
      setError(e.message || "Error submitting complaint");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen" style={{ background: "#050505", padding: "40px 24px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>

        {/* Header */}
        <div className="animate-fade-in-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 40 }}>
          <div>
            <p style={{ color: "var(--gold)", fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>
              Community
            </p>
            <h1 className="display-font" style={{ fontSize: "2.6rem", color: "#f0ece4" }}>
              Raise Complaint
            </h1>
          </div>
          <Link href="/dashboard" style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10, padding: "10px 18px", color: "#888", textDecoration: "none",
            fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem",
          }}>
            ← Back
          </Link>
        </div>

        <div className="glass-card animate-fade-in-up stagger-1" style={{ padding: 32 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

            {/* Complaint Type */}
            <div>
              <label style={{ display: "block", color: "#888", fontSize: "0.78rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                Complaint Category
              </label>
              <select
                value={complaintType}
                onChange={(e) => setComplaintType(e.target.value as ComplaintType)}
                className="premium-select"
              >
                {COMPLAINT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Against Type toggle */}
            <div>
              <label style={{ display: "block", color: "#888", fontSize: "0.78rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                Complaint Target
              </label>
              <div style={{
                display: "flex", background: "#111", borderRadius: 12,
                padding: 4, border: "1px solid var(--border)",
              }}>
                {(["general", "resident"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => { setAgainstType(type); setSelectedResidentId(""); }}
                    style={{
                      flex: 1, padding: "11px", borderRadius: 9, border: "none",
                      fontFamily: "'DM Sans', sans-serif", fontSize: "0.88rem", fontWeight: 600,
                      cursor: "pointer", transition: "all 0.25s ease",
                      background: againstType === type
                        ? "linear-gradient(135deg, #8a6e2f, #c9a84c)"
                        : "transparent",
                      color: againstType === type ? "#0a0800" : "#777",
                      letterSpacing: "0.03em",
                    }}
                  >
                    {type === "general" ? "🏢 General Complaint" : "👤 Against Resident"}
                  </button>
                ))}
              </div>
            </div>

            {/* Resident selector */}
            {againstType === "resident" && (
              <div className="animate-fade-in">
                <label style={{ display: "block", color: "#888", fontSize: "0.78rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                  Select Resident / Apartment
                </label>
                <select
                  value={selectedResidentId}
                  onChange={(e) => setSelectedResidentId(e.target.value)}
                  className="premium-select"
                >
                  <option value="">— Choose apartment —</option>
                  {allResidents.map((r) => (
                    <option key={r.uid} value={r.uid}>
                      Apartment {r.apartmentNumber}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Title */}
            <div>
              <label style={{ display: "block", color: "#888", fontSize: "0.78rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                Title
              </label>
              <input
                type="text"
                placeholder="Brief summary of the issue"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="premium-input"
              />
            </div>

            {/* Description */}
            <div>
              <label style={{ display: "block", color: "#888", fontSize: "0.78rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                Description
              </label>
              <textarea
                placeholder="Describe the issue in detail…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="premium-input"
                style={{ height: 140, resize: "vertical" as const }}
              />
            </div>

            {error && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", color: "#f87171", fontSize: "0.88rem" }}>
                {error}
              </div>
            )}

            <button
              onClick={handleComplaint}
              disabled={submitting}
              className="gold-button"
              style={{ width: "100%", padding: "16px", borderRadius: 12, fontSize: "1rem", marginTop: 4, opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? "Submitting…" : "🚨 Submit Complaint"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
