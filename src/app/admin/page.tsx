"use client";
import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, deleteDoc, doc, updateDoc,
  arrayUnion, arrayRemove, increment, getDoc, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, setDoc, where, limit,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { accolades } from "@/lib/accolades";
import {
  Challenge, ChallengeType, CHALLENGE_TYPE_META,
} from "@/lib/challenges";
import {
  computeReputationPoints, getReputationLevel,
  ReputationHistoryEntry,
  DEFAULT_REPUTATION_POINTS,
} from "@/lib/reputation";
import {
  ResidentPermissions, fetchResidentPermissions,
  isSupremeAdmin, hasPermission, isAdmin, getAdminPermissions,
  PERMISSION_META,
} from "@/lib/permissions";
import { AdminBadge, AccessDenied, PermissionGate } from "@/components/PermissionGate";
import AdminControlPanel from "@/components/AdminControlPanel";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Complaint {
  id: string;
  title: string;
  description: string;
  status: string;
  type?: string;
  // submitter
  submittedBy?: string;
  submittedByApartment?: string;
  submittedById?: string;
  // against
  againstType?: "resident" | "general";
  againstResidentName?: string;
  againstResidentId?: string;
  // legacy
  raisedBy?: string;
  xpGranted?: boolean;
  createdAt?: any;
}

interface Notification {
  id: string;
  title: string;
  description: string;
  type?: string;
  createdAt?: any;
}

interface ApartmentContact {
  id: string;
  name: string;
  role: string;
  phone: string;
  description?: string;
  availability?: string;
  category: string;
  createdAt?: any;
}

// ─── StatusBadge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "Resolved")     return <span className="badge badge-resolved">● Resolved</span>;
  if (status === "Under Review") return <span className="badge badge-review">● Under Review</span>;
  return <span className="badge badge-pending">● Pending</span>;
}

// ─── Main Component ──────────────────────────────────────────────────────────


// ── GasBillRow component ─────────────────────────────────────────────────
function GasBillRow({ bill, onTogglePaid, onSaveUnits }: {
  bill: any;
  onTogglePaid: () => void;
  onSaveUnits: (units: number) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [unitsVal, setUnitsVal] = React.useState(bill.unitsUsed != null ? String(bill.unitsUsed) : "");

  return (
    <tr style={{ background: "rgba(255,255,255,0.02)" }}>
      <td style={{ padding: "14px 14px", borderRadius: "12px 0 0 12px", border: "1px solid rgba(255,255,255,0.04)", borderRight: "none" }}>
        <span style={{ fontWeight: 700, color: "var(--gold)", fontSize: "0.95rem" }}>{bill.apartmentNumber}</span>
      </td>
      <td style={{ padding: "14px 14px", border: "1px solid rgba(255,255,255,0.04)", borderLeft: "none", borderRight: "none" }}>
        <span style={{ color: "#ccc", fontSize: "0.88rem" }}>{bill.residentName}</span>
      </td>
      <td style={{ padding: "14px 12px", border: "1px solid rgba(255,255,255,0.04)", borderLeft: "none", borderRight: "none" }}>
        {editing ? (
          <input
            type="number"
            min="0"
            step="0.1"
            value={unitsVal}
            onChange={(e) => setUnitsVal(e.target.value)}
            style={{
              width: 80, padding: "6px 10px", borderRadius: 6,
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
              color: "#f0ece4", fontSize: "0.85rem", outline: "none",
            }}
          />
        ) : (
          <span style={{ color: bill.unitsUsed != null ? "#f0ece4" : "#444", fontSize: "0.88rem" }}>
            {bill.unitsUsed != null ? `${bill.unitsUsed} units` : "Not entered"}
          </span>
        )}
      </td>
      <td style={{ padding: "14px 12px", border: "1px solid rgba(255,255,255,0.04)", borderLeft: "none", borderRight: "none" }}>
        <span style={{ color: "#888", fontSize: "0.88rem" }}>₹{bill.ratePerUnit}</span>
      </td>
      <td style={{ padding: "14px 12px", border: "1px solid rgba(255,255,255,0.04)", borderLeft: "none", borderRight: "none" }}>
        <span style={{ fontWeight: 700, color: bill.totalBill != null ? "var(--gold)" : "#444", fontSize: "0.95rem" }}>
          {bill.totalBill != null ? `₹${bill.totalBill}` : "—"}
        </span>
      </td>
      <td style={{ padding: "14px 12px", border: "1px solid rgba(255,255,255,0.04)", borderLeft: "none", borderRight: "none" }}>
        {bill.paid ? (
          <span style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 999, padding: "4px 10px", fontSize: "0.72rem", color: "#4ade80", fontWeight: 700 }}>✅ Paid</span>
        ) : (
          <span style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 999, padding: "4px 10px", fontSize: "0.72rem", color: "#f87171", fontWeight: 700 }}>⚠ Pending</span>
        )}
      </td>
      <td style={{ padding: "14px 12px", borderRadius: "0 12px 12px 0", border: "1px solid rgba(255,255,255,0.04)", borderLeft: "none" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {editing ? (
            <>
              <button
                onClick={() => { onSaveUnits(parseFloat(unitsVal)); setEditing(false); }}
                style={{ padding: "6px 12px", borderRadius: 7, fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", background: "linear-gradient(135deg,#8a6e2f,#c9a84c)", color: "#0a0800", border: "none" }}
              >Save</button>
              <button
                onClick={() => setEditing(false)}
                style={{ padding: "6px 10px", borderRadius: 7, fontSize: "0.75rem", cursor: "pointer", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#666" }}
              >✕</button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              style={{ padding: "6px 12px", borderRadius: 7, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)", color: "var(--gold)" }}
            >✏ Edit</button>
          )}
          {bill.billExists || bill.unitsUsed != null ? (
            <button
              onClick={onTogglePaid}
              style={{
                padding: "6px 12px", borderRadius: 7, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                background: bill.paid ? "rgba(239,68,68,0.08)" : "rgba(74,222,128,0.08)",
                border: bill.paid ? "1px solid rgba(239,68,68,0.2)" : "1px solid rgba(74,222,128,0.2)",
                color: bill.paid ? "#f87171" : "#4ade80",
              }}
            >{bill.paid ? "✗ Unpaid" : "✓ Paid"}</button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [complaints, setComplaints]         = useState<Complaint[]>([]);
  const [notifications, setNotifications]   = useState<Notification[]>([]);
  const [residents, setResidents]           = useState<any[]>([]);
  const [selectedResident, setSelectedResident] = useState("");
  const [selectedAccolade, setSelectedAccolade] = useState("");
  const [toast, setToast]                   = useState("");
  const [activeTab, setActiveTab]           = useState<"complaints" | "notifications" | "accolades" | "contacts" | "challenges" | "maintenance" | "sinking-fund" | "gas" | "reputation" | "adminControl">("complaints");
  const [residentPerms, setResidentPerms]   = useState<ResidentPermissions | null>(null);
  const [currentUserId, setCurrentUserId]   = useState<string>("");
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [permLoading, setPermLoading]       = useState(true);

  // ── Challenges state ──────────────────────────────────────────────────────
  const [challenges, setChallenges]         = useState<Challenge[]>([]);
  const [challengeForm, setChallengeForm]   = useState({
    title: "", description: "", challengeType: "daily_checkins" as ChallengeType,
    target: 7, rewardXP: 100, startDate: "", endDate: "", active: true,
  });
  const [editingChallengeId, setEditingChallengeId] = useState<string | null>(null);
  const [challengeLoading, setChallengeLoading]     = useState(false);
  const [challengeProgressList, setChallengeProgressList] = useState<any[]>([]);

  // ── Maintenance state ────────────────────────────────────────────────────
  const [maintenanceYear, setMaintenanceYear]       = useState(new Date().getFullYear());
  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([]);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  // Sinking Fund state
  const [sfYear, setSfYear]                 = useState(new Date().getFullYear());
  const [sfRecords, setSfRecords]           = useState<any[]>([]);
  const [sfLoading, setSfLoading]           = useState(false);

  // Gas Billing state
  const [gasRatePerUnit, setGasRatePerUnit] = useState(0);
  const [gasRateInput, setGasRateInput]     = useState("");
  const [gasMonth, setGasMonth]             = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [gasBills, setGasBills]             = useState<any[]>([]);
  const [gasLoading, setGasLoading]         = useState(false);
  const [gasSettings, setGasSettings]       = useState<Record<string, boolean>>({});

  // ── Reputation Admin state ────────────────────────────────────────────────
  const [repSelectedResident, setRepSelectedResident] = useState("");
  const [repDelta, setRepDelta]                       = useState("");
  const [repReason, setRepReason]                     = useState("");
  const [repType, setRepType]                         = useState<"appreciation" | "warning" | "custom">("custom");
  const [repLoading, setRepLoading]                   = useState(false);
  const [repHistory, setRepHistory]                   = useState<(ReputationHistoryEntry & { residentId: string; aptNum: string; residentName: string })[]>([]);

  // ── Contacts state ────────────────────────────────────────────────────────
  const [contacts, setContacts]             = useState<ApartmentContact[]>([]);
  const [contactForm, setContactForm]       = useState({
    name: "", role: "", phone: "", description: "", availability: "", category: "General",
  });
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactLoading, setContactLoading] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  // ── Reputation Admin Functions ────────────────────────────────────────────

  async function loadRepHistory() {
    try {
      const allSnap = await getDocs(collection(db, "residents"));
      const entries: (ReputationHistoryEntry & { residentId: string; aptNum: string; residentName: string })[] = [];
      for (const d of allSnap.docs) {
        const rd = d.data() as Record<string, unknown>;
        const hSnap = await getDocs(query(collection(db, "residents", d.id, "reputationHistory"), orderBy("timestamp", "desc"), limit(5)));
        hSnap.docs.forEach((hd) => {
          entries.push({
            id: hd.id,
            residentId: d.id,
            aptNum: String(rd.apartmentNumber || ""),
            residentName: ((rd.residentNames as string[]) || [])[0] || "",
            ...(hd.data() as ReputationHistoryEntry),
          });
        });
      }
      entries.sort((a, b) => {
        const tsA = a.timestamp;
        const tsB = b.timestamp;
        const ta = tsA && typeof tsA === "object" && "toDate" in tsA ? (tsA as { toDate: () => Date }).toDate().getTime() : 0;
        const tb = tsB && typeof tsB === "object" && "toDate" in tsB ? (tsB as { toDate: () => Date }).toDate().getTime() : 0;
        return tb - ta;
      });
      setRepHistory(entries.slice(0, 50));
    } catch (e) {
      console.error("loadRepHistory error:", e);
    }
  }

  async function applyReputation() {
    if (!repSelectedResident) { showToast("Please select a resident."); return; }
    const parsedDelta = parseInt(repDelta);
    if (!parsedDelta || isNaN(parsedDelta)) { showToast("Please enter a valid point value."); return; }
    if (!repReason.trim()) { showToast("Please enter a reason."); return; }
    const clampedDelta = Math.max(-500, Math.min(500, parsedDelta));
    setRepLoading(true);
    try {
      const resSnap = await getDoc(doc(db, "residents", repSelectedResident));
      if (!resSnap.exists()) { showToast("Resident not found."); return; }
      const currentData = resSnap.data() as Record<string, unknown>;
      const currentPts = typeof currentData.reputationPoints === "number"
        ? currentData.reputationPoints
        : DEFAULT_REPUTATION_POINTS;
      const newPts = Math.max(0, Math.min(1000, currentPts + clampedDelta));

      await updateDoc(doc(db, "residents", repSelectedResident), { reputationPoints: newPts });

      const adminUser = auth.currentUser;
      await addDoc(collection(db, "residents", repSelectedResident, "reputationHistory"), {
        delta: clampedDelta,
        reason: repReason.trim(),
        source: "admin",
        adminId: adminUser?.uid || "admin",
        adminName: adminUser?.displayName || "Admin",
        category: clampedDelta > 0 ? "positive" : "negative",
        eventKey: repType === "appreciation" ? "ADMIN_APPRECIATION" : repType === "warning" ? "ADMIN_WARNING" : "ADMIN_CUSTOM",
        timestamp: serverTimestamp(),
      });

      // Update local residents list for instant UI feedback
      setResidents((prev) => prev.map((r) =>
        r.id === repSelectedResident ? { ...r, reputationPoints: newPts } : r
      ));

      showToast(`✓ Reputation updated: ${clampedDelta > 0 ? "+" : ""}${clampedDelta} points for Apt ${currentData.apartmentNumber}`);
      setRepDelta("");
      setRepReason("");
      await loadRepHistory();
    } catch (e) {
      console.error(e);
      showToast("Failed to update reputation. Try again.");
    } finally {
      setRepLoading(false);
    }
  }

  // Ref to hold the contacts real-time listener so we can clean it up
  const unsubContactsRef = React.useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }

      const residentSnapshot = await getDocs(collection(db, "residents"));
      const residentList: any[] = [];
      let currentResident: any = null;
      residentSnapshot.forEach((docItem) => {
        const resident = { id: docItem.id, ...docItem.data() };
        residentList.push(resident);
        if (docItem.id === user.uid) currentResident = resident;
      });

      // ── Permission system ──────────────────────────────────────────────────
      const perms = await fetchResidentPermissions(user.uid);
      if (!perms || !isAdmin(perms)) {
        router.push("/dashboard");
        return;
      }
      setResidentPerms(perms);
      setCurrentUserId(user.uid);
      setCurrentUserName(currentResident?.name || user.displayName || "Admin");
      setPermLoading(false);
      setResidents(residentList);

      const complaintSnapshot = await getDocs(collection(db, "complaints"));
      const cList = complaintSnapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Complaint));
      cList.sort((a, b) => {
        const order: Record<string, number> = { Pending: 0, "Under Review": 1, Resolved: 2 };
        const oa = order[a.status] ?? 0;
        const ob = order[b.status] ?? 0;
        if (oa !== ob) return oa - ob;
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      });
      setComplaints(cList);

      const notificationSnapshot = await getDocs(collection(db, "notifications"));
      const nList = notificationSnapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Notification));
      nList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setNotifications(nList);

      // Real-time contacts listener — store unsub in ref for proper cleanup
      const contactsQ = query(collection(db, "apartmentContacts"), orderBy("createdAt", "desc"));
      if (unsubContactsRef.current) unsubContactsRef.current();
      unsubContactsRef.current = onSnapshot(contactsQ, (snap) => {
        setContacts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ApartmentContact)));
      });

      // Load challenges
      const chalSnap = await getDocs(query(collection(db, "challenges"), orderBy("createdAt", "desc")));
      setChallenges(chalSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Challenge)));

      // Load challenge progress
      const progressSnap = await getDocs(collection(db, "challengeProgress"));
      setChallengeProgressList(progressSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubscribe();
      if (unsubContactsRef.current) unsubContactsRef.current();
    };
  }, [router]);

  // ── Complaint: update status ─────────────────────────────────────────────

  async function updateComplaintStatus(complaint: Complaint, status: string) {
    const updates: Record<string, any> = { status };

    if (status === "Resolved" && !complaint.xpGranted && complaint.submittedById) {
      updates.xpGranted = true;

      const residentRef  = doc(db, "residents", complaint.submittedById);
      const residentSnap = await getDoc(residentRef);
      if (residentSnap.exists()) {
        const residentDoc = residentSnap.data();
        const currentXP   = residentDoc.xp || 0;
        const newXP       = currentXP + 40;
        const newLevel    = Math.floor(newXP / 200) + 1;

        await updateDoc(residentRef, { xp: increment(40), level: newLevel });

        // Notify the submitter
        const targetApt = complaint.submittedByApartment || complaint.raisedBy || residentDoc.apartmentNumber;
        await addDoc(collection(db, "notifications"), {
          type: "private",
          targetApartment: targetApt,
          title: "✅ Complaint Resolved",
          description: `Your complaint "${complaint.title}" has been resolved. +40 XP awarded!`,
          createdAt: serverTimestamp(),
        });

        showToast(`✓ Resolved · +40 XP → Apt ${targetApt}`);
      }
    } else if (status === "Under Review") {
      // Notify submitter that complaint is being reviewed
      if (complaint.submittedByApartment || complaint.raisedBy) {
        const targetApt = complaint.submittedByApartment || complaint.raisedBy || "";
        await addDoc(collection(db, "notifications"), {
          type: "private",
          targetApartment: targetApt,
          title: "🔍 Complaint Under Review",
          description: `Your complaint "${complaint.title}" is now under review by admin.`,
          createdAt: serverTimestamp(),
        });
      }
      showToast("Status → Under Review · Submitter notified");
    } else {
      showToast(`Status updated to "${status}"`);
    }

    await updateDoc(doc(db, "complaints", complaint.id), updates);
    setComplaints((prev) =>
      prev.map((c) => c.id === complaint.id
        ? { ...c, status, xpGranted: updates.xpGranted ?? c.xpGranted }
        : c
      )
    );
  }

  async function deleteComplaint(complaintId: string) {
    if (!confirm("Permanently delete this complaint?")) return;
    await deleteDoc(doc(db, "complaints", complaintId));
    setComplaints((prev) => prev.filter((c) => c.id !== complaintId));
    showToast("Complaint deleted");
  }

  async function deleteNotification(notificationId: string) {
    if (!confirm("Delete this notification?")) return;
    await deleteDoc(doc(db, "notifications", notificationId));
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    showToast("Notification deleted");
  }

  // ── Accolade actions ─────────────────────────────────────────────────────

  async function grantAccolade() {
    if (!selectedResident || !selectedAccolade) { showToast("Select apartment and accolade"); return; }
    const resident = residents.find((r) => r.id === selectedResident);
    const accolade = accolades.find((a) => a.id === selectedAccolade);
    if (!resident || !accolade) return;
    if (resident.unlockedAccolades?.includes(accolade.id)) { showToast("Resident already has this accolade"); return; }
    await updateDoc(doc(db, "residents", resident.id), {
      unlockedAccolades: arrayUnion(accolade.id),
      xp: increment(accolade.xp),
    });
    await addDoc(collection(db, "notifications"), {
      type: "private",
      targetApartment: resident.apartmentNumber,
      title: `🏅 Accolade Granted: ${accolade.title}`,
      description: `Admin awarded you the "${accolade.title}" accolade. +${accolade.xp} XP!`,
      createdAt: serverTimestamp(),
    });
    showToast(`✓ Accolade granted to Apt ${resident.apartmentNumber}`);
  }

  async function removeAccolade() {
    if (!selectedResident || !selectedAccolade) { showToast("Select apartment and accolade"); return; }
    await updateDoc(doc(db, "residents", selectedResident), {
      unlockedAccolades: arrayRemove(selectedAccolade),
    });
    showToast("Accolade removed");
  }

  // ── Contacts: save (add or update) ─────────────────────────────────────────

  async function saveContact() {
    const { name, role, phone, category } = contactForm;
    if (!name.trim() || !role.trim() || !phone.trim()) {
      showToast("⚠ Name, role, and phone are required"); return;
    }
    setContactLoading(true);
    try {
      if (editingContactId) {
        await updateDoc(doc(db, "apartmentContacts", editingContactId), {
          ...contactForm, updatedAt: serverTimestamp(),
        });
        showToast("✓ Contact updated");
      } else {
        await addDoc(collection(db, "apartmentContacts"), {
          ...contactForm, createdAt: serverTimestamp(),
        });
        showToast("✓ Contact added");
      }
      setContactForm({ name: "", role: "", phone: "", description: "", availability: "", category: "General" });
      setEditingContactId(null);
    } catch { showToast("Error saving contact"); }
    setContactLoading(false);
  }

  function startEditContact(contact: ApartmentContact) {
    setContactForm({
      name: contact.name, role: contact.role, phone: contact.phone,
      description: contact.description || "", availability: contact.availability || "",
      category: contact.category,
    });
    setEditingContactId(contact.id);
    // Scroll to form
    setTimeout(() => document.getElementById("contact-form")?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  }

  function cancelEditContact() {
    setContactForm({ name: "", role: "", phone: "", description: "", availability: "", category: "General" });
    setEditingContactId(null);
  }

  async function deleteContact(id: string) {
    if (!confirm("Delete this contact?")) return;
    await deleteDoc(doc(db, "apartmentContacts", id));
    showToast("Contact deleted");
  }

  // ── Challenges CRUD ─────────────────────────────────────────────────────────

  async function saveChallenge() {
    const { title, description, challengeType, target, rewardXP, startDate, endDate, active } = challengeForm;
    if (!title.trim() || !description.trim() || !startDate || !endDate) {
      showToast("⚠ Title, description, start date, and end date are required"); return;
    }
    if (new Date(startDate) >= new Date(endDate)) {
      showToast("⚠ End date must be after start date"); return;
    }
    setChallengeLoading(true);
    try {
      if (editingChallengeId) {
        await updateDoc(doc(db, "challenges", editingChallengeId), {
          title, description, challengeType, target: Number(target), rewardXP: Number(rewardXP),
          startDate, endDate, active, updatedAt: serverTimestamp(),
        });
        setChallenges((prev) => prev.map((c) => c.id === editingChallengeId
          ? { ...c, title, description, challengeType, target: Number(target), rewardXP: Number(rewardXP), startDate, endDate, active }
          : c
        ));
        showToast("✓ Challenge updated");
      } else {
        const ref = await addDoc(collection(db, "challenges"), {
          title, description, challengeType, target: Number(target), rewardXP: Number(rewardXP),
          startDate, endDate, active, createdAt: serverTimestamp(),
        });
        setChallenges((prev) => [{
          id: ref.id, title, description, challengeType, target: Number(target),
          rewardXP: Number(rewardXP), startDate, endDate, active,
        } as Challenge, ...prev]);
        showToast("✓ Challenge created");
      }
      setChallengeForm({ title: "", description: "", challengeType: "daily_checkins", target: 7, rewardXP: 100, startDate: "", endDate: "", active: true });
      setEditingChallengeId(null);
    } catch (err) { console.error(err); showToast("Error saving challenge"); }
    setChallengeLoading(false);
  }

  async function toggleChallengeActive(ch: Challenge) {
    await updateDoc(doc(db, "challenges", ch.id), { active: !ch.active });
    setChallenges((prev) => prev.map((c) => c.id === ch.id ? { ...c, active: !c.active } : c));
    showToast(ch.active ? "Challenge deactivated" : "Challenge activated");
  }

  async function deleteChallenge(id: string) {
    if (!confirm("Permanently delete this challenge?")) return;
    await deleteDoc(doc(db, "challenges", id));
    setChallenges((prev) => prev.filter((c) => c.id !== id));
    showToast("Challenge deleted");
  }

  function startEditChallenge(ch: Challenge) {
    setChallengeForm({
      title: ch.title, description: ch.description, challengeType: ch.challengeType as ChallengeType,
      target: ch.target, rewardXP: ch.rewardXP, startDate: ch.startDate, endDate: ch.endDate, active: ch.active,
    });
    setEditingChallengeId(ch.id);
    setTimeout(() => document.getElementById("challenge-form")?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  }

  function cancelEditChallenge() {
    setChallengeForm({ title: "", description: "", challengeType: "daily_checkins", target: 7, rewardXP: 100, startDate: "", endDate: "", active: true });
    setEditingChallengeId(null);
  }

  function getProgressForChallenge(challengeId: string) {
    return challengeProgressList.filter((p) => p.challengeId === challengeId);
  }

  // ── Maintenance: load records ─────────────────────────────────────────────

  async function loadMaintenanceRecords(year: number) {
    setMaintenanceLoading(true);
    try {
      const snap = await getDocs(collection(db, "maintenancePayments"));
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const filtered = all.filter((r: any) => r.year === year);
      // Build a map: apartmentNumber -> { Q1, Q2, Q3, Q4 }
      const residentMap: Record<string, any> = {};
      for (const res of residents) {
        residentMap[res.apartmentNumber] = {
          residentId: res.id,
          residentName: res.name || `Apt ${res.apartmentNumber}`,
          apartmentNumber: res.apartmentNumber,
          Q1: null, Q2: null, Q3: null, Q4: null,
        };
      }
      for (const rec of filtered) {
        const apt = (rec as any).apartmentNumber;
        const q   = (rec as any).quarter as "Q1" | "Q2" | "Q3" | "Q4";
        if (residentMap[apt]) residentMap[apt][q] = rec;
      }
      setMaintenanceRecords(Object.values(residentMap));
    } catch (e) { console.error(e); showToast("Error loading maintenance records"); }
    setMaintenanceLoading(false);
  }

  async function togglePayment(apt: string, residentId: string, quarter: "Q1"|"Q2"|"Q3"|"Q4", year: number, currentRec: any) {
    const docId = `${apt}_${year}_${quarter}`;
    const ref   = doc(db, "maintenancePayments", docId);
    if (currentRec?.paid) {
      // Mark unpaid
      await setDoc(ref, {
        apartmentNumber: apt, residentId, year, quarter,
        paid: false, paidAt: null,
      });
      showToast(`${apt} ${quarter} → Unpaid`);
    } else {
      // Mark paid
      await setDoc(ref, {
        apartmentNumber: apt, residentId, year, quarter,
        paid: true, paidAt: serverTimestamp(),
      });
      showToast(`✓ ${apt} ${quarter} → Paid`);
    }
    await loadMaintenanceRecords(year);
  }


  // ── Sinking Fund: load records ────────────────────────────────────────────
  async function loadSFRecords(year: number) {
    setSfLoading(true);
    try {
      const snap = await getDocs(collection(db, "sinkingFundPayments"));
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const filtered = all.filter((r: any) => r.year === year);
      const residentMap: Record<string, any> = {};
      for (const res of residents) {
        residentMap[res.apartmentNumber] = {
          residentId: res.id,
          residentName: res.name || `Apt ${res.apartmentNumber}`,
          apartmentNumber: res.apartmentNumber,
          cycle_1: null,
          cycle_2: null,
        };
      }
      for (const rec of filtered) {
        const apt = (rec as any).apartmentNumber;
        const cycle = (rec as any).cycleNumber as 1 | 2;
        if (residentMap[apt]) residentMap[apt][`cycle_${cycle}`] = rec;
      }
      setSfRecords(Object.values(residentMap));
    } catch (e) { console.error(e); showToast("Error loading sinking fund records"); }
    setSfLoading(false);
  }

  async function toggleSFPayment(apt: string, residentId: string, cycle: 1 | 2, year: number, currentRec: any) {
    const docId = `${apt}_${year}_C${cycle}`;
    const ref   = doc(db, "sinkingFundPayments", docId);
    if (currentRec?.paid) {
      await setDoc(ref, { apartmentNumber: apt, residentId, year, cycleNumber: cycle, paid: false, paidAt: null });
      showToast(`${apt} Cycle ${cycle} → Unpaid`);
    } else {
      await setDoc(ref, { apartmentNumber: apt, residentId, year, cycleNumber: cycle, paid: true, paidAt: serverTimestamp() });
      showToast(`✓ ${apt} Cycle ${cycle} → Paid`);
    }
    await loadSFRecords(year);
  }

  // ── Gas Billing: load config and bills ───────────────────────────────────
  async function loadGasData(month: string) {
    setGasLoading(true);
    try {
      // Load rate
      const rateSnap = await getDoc(doc(db, "gasConfig", "rate"));
      const rate = rateSnap.exists() ? (rateSnap.data().ratePerUnit || 0) : 0;
      setGasRatePerUnit(rate);
      setGasRateInput(String(rate));

      // Load gas settings per apartment
      const settingsSnap = await getDocs(collection(db, "gasSettings"));
      const settingsMap: Record<string, boolean> = {};
      settingsSnap.forEach((d) => { settingsMap[d.id] = d.data().gasEnabled || false; });
      setGasSettings(settingsMap);

      // Load bills for this month
      const billsSnap = await getDocs(
        query(collection(db, "gasBills"), where("month", "==", month))
      );
      const bills: any[] = billsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Merge with residents (only gas-enabled ones)
      const mergedBills: any[] = [];
      for (const res of residents) {
        if (settingsMap[res.apartmentNumber]) {
          const bill = bills.find((b: any) => b.apartmentNumber === res.apartmentNumber);
          mergedBills.push({
            apartmentNumber: res.apartmentNumber,
            residentName: res.name || `Apt ${res.apartmentNumber}`,
            residentId: res.id,
            unitsUsed: bill?.unitsUsed ?? null,
            ratePerUnit: bill?.ratePerUnit ?? rate,
            totalBill: bill?.totalBill ?? null,
            paid: bill?.paid || false,
            paidAt: bill?.paidAt || null,
            billExists: !!bill,
          });
        }
      }
      setGasBills(mergedBills);
    } catch (e) { console.error(e); showToast("Error loading gas data"); }
    setGasLoading(false);
  }

  async function saveGasRate() {
    const rate = parseFloat(gasRateInput);
    if (isNaN(rate) || rate < 0) { showToast("Enter a valid rate"); return; }
    await setDoc(doc(db, "gasConfig", "rate"), { ratePerUnit: rate });
    setGasRatePerUnit(rate);
    showToast(`✓ Gas rate updated to ₹${rate}/unit`);
    await loadGasData(gasMonth);
  }

  async function toggleGasEnabled(apt: string, current: boolean) {
    await setDoc(doc(db, "gasSettings", apt), { gasEnabled: !current });
    setGasSettings((prev) => ({ ...prev, [apt]: !current }));
    showToast(`${apt} gas ${!current ? "enabled" : "disabled"}`);
    await loadGasData(gasMonth);
  }

  async function toggleGasPaid(apt: string, residentId: string, month: string, currentPaid: boolean, currentBill: any) {
    const docId = `${apt}_${month}`;
    const ref   = doc(db, "gasBills", docId);
    if (currentPaid) {
      await setDoc(ref, { ...currentBill, paid: false, paidAt: null }, { merge: true });
      showToast(`${apt} gas bill → Unpaid`);
    } else {
      await setDoc(ref, { ...currentBill, paid: true, paidAt: serverTimestamp() }, { merge: true });
      showToast(`✓ ${apt} gas bill → Paid`);
    }
    await loadGasData(month);
  }

  async function saveGasUnits(apt: string, residentId: string, month: string, units: number, rate: number) {
    const docId = `${apt}_${month}`;
    const totalBill = parseFloat((units * rate).toFixed(2));
    await setDoc(doc(db, "gasBills", docId), {
      apartmentNumber: apt, residentId, month, unitsUsed: units,
      ratePerUnit: rate, totalBill, paid: false, paidAt: null, submittedAt: serverTimestamp(),
    }, { merge: true });
    showToast(`✓ ${apt} usage saved`);
    await loadGasData(month);
  }


  // ── Helpers ───────────────────────────────────────────────────────────────

  const STATUS_ORDER = ["Pending", "Under Review", "Resolved"];

  const formatDate = (ts: any) => {
    if (!ts?.seconds) return "";
    return new Date(ts.seconds * 1000).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  };

  const formatTime = (ts: any) => {
    if (!ts?.seconds) return "";
    return new Date(ts.seconds * 1000).toLocaleTimeString("en-IN", {
      hour: "2-digit", minute: "2-digit",
    });
  };

  const tabStyle = (active: boolean) => ({
    padding: "10px 18px", borderRadius: 10, border: "none",
    fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", fontWeight: 600,
    cursor: "pointer", transition: "all 0.2s ease",
    background: active ? "linear-gradient(135deg, #8a6e2f, #c9a84c)" : "rgba(255,255,255,0.04)",
    color: active ? "#0a0800" : "#777",
    letterSpacing: "0.03em",
  });

  // Permission loading guard
  if (permLoading) {
    return (
      <main style={{
        minHeight: "100vh", background: "#050505",
        display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          border: "2px solid rgba(201,168,76,0.15)", borderTopColor: "#c9a84c",
          animation: "spin 1s linear infinite",
        }} />
        <p style={{ color: "#555", fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem" }}>
          Verifying clearance…
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: "#050505", padding: "40px 24px" }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 1000,
          background: "linear-gradient(135deg, #1a1a1a, #222)",
          border: "1px solid var(--border-hover)", borderRadius: 12, padding: "14px 20px",
          color: "var(--gold)", fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
          boxShadow: "0 8px 40px rgba(0,0,0,0.6)", animation: "fadeInUp 0.3s ease",
        }}>
          {toast}
        </div>
      )}

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div className="animate-fade-in-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <p style={{ color: "var(--gold)", fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>Administration</p>
            <h1 className="display-font" style={{ fontSize: "2.8rem", color: "#f0ece4", marginBottom: 10 }}>🛡 Admin Panel</h1>
            {residentPerms && <AdminBadge role={residentPerms.role} />}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {residentPerms && !isSupremeAdmin(residentPerms) && (
              <div style={{
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10, padding: "8px 14px", fontSize: "0.75rem", color: "#555",
                fontFamily: "'DM Sans', sans-serif",
              }}>
                <span style={{ color: "#777" }}>Access: </span>
                {getAdminPermissions(residentPerms).length === 0
                  ? <span style={{ color: "#444" }}>No modules</span>
                  : getAdminPermissions(residentPerms).map((p) => PERMISSION_META[p]?.icon).join(" ")}
              </div>
            )}
            <Link href="/dashboard" style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10, padding: "10px 18px", color: "#888", textDecoration: "none",
              fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem",
            }}>
              ← Dashboard
            </Link>
          </div>
        </div>

        {/* Quick links */}
        <div className="animate-fade-in-up stagger-1" style={{ display: "flex", gap: 12, marginBottom: 32, flexWrap: "wrap" }}>
          <Link href="/polls" style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12, padding: "14px 20px",
            textDecoration: "none", color: "#ccc",
            fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem", fontWeight: 600,
          }}>
            <span style={{ fontSize: 20 }}>📊</span> Manage Polls
          </Link>
        </div>

        {/* Stats overview */}
        <div className="animate-fade-in-up stagger-1" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 14, marginBottom: 32 }}>
          {[
            { label: "Total",        value: complaints.length,                                          icon: "🚨" },
            { label: "Pending",      value: complaints.filter(c => c.status === "Pending").length,      icon: "⏳" },
            { label: "Under Review", value: complaints.filter(c => c.status === "Under Review").length, icon: "🔍" },
            { label: "Resolved",     value: complaints.filter(c => c.status === "Resolved").length,     icon: "✅" },
            { label: "Residents",    value: residents.length,                                           icon: "🏠" },
          ].map((s) => (
            <div key={s.label} style={{
              background: "rgba(255,255,255,0.03)", borderRadius: 14, padding: "18px 16px",
              border: "1px solid rgba(255,255,255,0.05)", textAlign: "center",
            }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: "1.7rem", fontWeight: 700, color: "#f0ece4", lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: "0.7rem", color: "#555", marginTop: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs — filtered by permissions */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
          {hasPermission(residentPerms, "complaints") && (
            <button onClick={() => setActiveTab("complaints")} style={tabStyle(activeTab === "complaints")}>🚨 Complaints ({complaints.length})</button>
          )}
          {isSupremeAdmin(residentPerms) && (
            <button onClick={() => setActiveTab("notifications")} style={tabStyle(activeTab === "notifications")}>🔔 Notifications ({notifications.length})</button>
          )}
          {hasPermission(residentPerms, "contacts") && (
            <button onClick={() => setActiveTab("contacts")} style={tabStyle(activeTab === "contacts")}>📞 Contacts ({contacts.length})</button>
          )}
          {isSupremeAdmin(residentPerms) && (
            <button onClick={() => setActiveTab("accolades")} style={tabStyle(activeTab === "accolades")}>🏅 Accolades</button>
          )}
          {isSupremeAdmin(residentPerms) && (
            <button onClick={() => setActiveTab("challenges")} style={tabStyle(activeTab === "challenges")}>🏆 Challenges ({challenges.length})</button>
          )}
          {hasPermission(residentPerms, "maintenance") && (
            <button onClick={() => { setActiveTab("maintenance"); loadMaintenanceRecords(maintenanceYear); }} style={tabStyle(activeTab === "maintenance")}>💰 Maintenance</button>
          )}
          {hasPermission(residentPerms, "sinkingFund") && (
            <button onClick={() => { setActiveTab("sinking-fund"); loadSFRecords(sfYear); }} style={tabStyle(activeTab === "sinking-fund")}>🏦 Sinking Fund</button>
          )}
          {hasPermission(residentPerms, "gasBilling") && (
            <button onClick={() => { setActiveTab("gas"); loadGasData(gasMonth); }} style={tabStyle(activeTab === "gas")}>🔥 Gas Billing</button>
          )}
          {isSupremeAdmin(residentPerms) && (
            <button onClick={() => { setActiveTab("reputation"); loadRepHistory(); }} style={tabStyle(activeTab === "reputation")}>⭐ Reputation</button>
          )}
          {hasPermission(residentPerms, "adminControl") && (
            <button onClick={() => setActiveTab("adminControl")} style={{
              ...tabStyle(activeTab === "adminControl"),
              background: activeTab === "adminControl"
                ? "linear-gradient(135deg, rgba(201,168,76,0.9), #c9a84c)"
                : "rgba(201,168,76,0.06)",
              border: "1px solid rgba(201,168,76,0.2)",
              color: activeTab === "adminControl" ? "#0a0800" : "#c9a84c",
            }}>
              🛡 Admin Control
            </button>
          )}
        </div>

        <div className="gold-divider" />

        {/* ── Tab: COMPLAINTS ─────────────────────────────────────────────── */}
        {activeTab === "complaints" && hasPermission(residentPerms, "complaints") && (
          <div className="animate-fade-in">
            {complaints.length === 0 ? (
              <div className="glass-card" style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
                <p style={{ color: "#555" }}>No complaints submitted yet</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {complaints.map((complaint, i) => (
                  <div
                    key={complaint.id}
                    className={`premium-card animate-fade-in-up stagger-${Math.min(i + 1, 8)}`}
                    style={{ padding: 24 }}
                  >
                    {/* Row 1: badges + date */}
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

                      <span style={{
                        fontSize: "0.7rem", borderRadius: 999, padding: "3px 10px",
                        fontWeight: 600, letterSpacing: "0.06em",
                        background: complaint.againstType === "resident"
                          ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.05)",
                        color: complaint.againstType === "resident" ? "#f87171" : "#777",
                        border: complaint.againstType === "resident"
                          ? "1px solid rgba(239,68,68,0.25)" : "1px solid rgba(255,255,255,0.08)",
                      }}>
                        {complaint.againstType === "resident" ? "👤 vs Resident" : "🏢 General"}
                      </span>

                      {complaint.createdAt && (
                        <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#555" }}>
                          {formatDate(complaint.createdAt)} · {formatTime(complaint.createdAt)}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 style={{ fontSize: "1.08rem", fontWeight: 700, color: "#f0ece4", marginBottom: 8 }}>
                      {complaint.title}
                    </h3>

                    {/* Description */}
                    <p style={{ color: "#888", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: 16 }}>
                      {complaint.description}
                    </p>

                    {/* Meta info row */}
                    <div style={{
                      display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                      gap: 12, marginBottom: 16, paddingTop: 14,
                      borderTop: "1px solid rgba(255,255,255,0.05)",
                    }}>

                      {/* Submitted by */}
                      <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: "10px 12px" }}>
                        <div style={{ fontSize: "0.68rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                          Submitted By
                        </div>
                        <div style={{ fontSize: "0.9rem", color: "var(--gold)", fontWeight: 600 }}>
                          Apt {complaint.submittedByApartment || complaint.raisedBy || "—"}
                        </div>
                      </div>

                      {/* Against */}
                      <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: "10px 12px" }}>
                        <div style={{ fontSize: "0.68rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                          Against
                        </div>
                        <div style={{
                          fontSize: "0.9rem", fontWeight: 600,
                          color: complaint.againstType === "resident" ? "#f87171" : "#777",
                        }}>
                          {complaint.againstType === "resident"
                            ? (complaint.againstResidentName || "Resident")
                            : "General Issue"}
                        </div>
                      </div>

                      {/* Complaint type */}
                      <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: "10px 12px" }}>
                        <div style={{ fontSize: "0.68rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                          Category
                        </div>
                        <div style={{ fontSize: "0.9rem", color: "#ccc", fontWeight: 600 }}>
                          {complaint.type || "—"}
                        </div>
                      </div>

                      {/* XP status */}
                      {complaint.xpGranted && (
                        <div style={{ background: "rgba(34,197,94,0.06)", borderRadius: 8, padding: "10px 12px", border: "1px solid rgba(34,197,94,0.15)" }}>
                          <div style={{ fontSize: "0.68rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                            XP Reward
                          </div>
                          <div style={{ fontSize: "0.9rem", color: "#4ade80", fontWeight: 600 }}>
                            ✓ +40 XP Granted
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Status action buttons */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ color: "#444", fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", marginRight: 4 }}>
                        Set status:
                      </span>
                      {STATUS_ORDER.map((status) => (
                        <button
                          key={status}
                          onClick={() => updateComplaintStatus(complaint, status)}
                          disabled={complaint.status === status}
                          style={{
                            padding: "8px 16px", borderRadius: 8, fontSize: "0.78rem", fontWeight: 600,
                            cursor: complaint.status === status ? "default" : "pointer",
                            fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s", letterSpacing: "0.04em",
                            border: complaint.status === status ? "none" : "1px solid rgba(255,255,255,0.1)",
                            background: complaint.status === status
                              ? status === "Resolved"     ? "rgba(34,197,94,0.2)"
                                : status === "Under Review" ? "rgba(234,179,8,0.2)"
                                : "rgba(239,68,68,0.2)"
                              : "rgba(255,255,255,0.04)",
                            color: complaint.status === status
                              ? status === "Resolved"     ? "#4ade80"
                                : status === "Under Review" ? "#fbbf24"
                                : "#f87171"
                              : "#666",
                          }}
                        >
                          {status === "Pending" ? "⏳ Pending"
                            : status === "Under Review" ? "🔍 Under Review"
                            : "✅ Resolve"}
                        </button>
                      ))}
                      <button
                        onClick={() => deleteComplaint(complaint.id)}
                        style={{
                          marginLeft: "auto", padding: "8px 16px", borderRadius: 8, fontSize: "0.78rem",
                          fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                          background: "transparent", border: "1px solid rgba(239,68,68,0.2)",
                          color: "#f87171", transition: "all 0.2s",
                        }}
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: NOTIFICATIONS ──────────────────────────────────────────── */}
        {activeTab === "notifications" && (
          <div className="animate-fade-in">
            {notifications.length === 0 ? (
              <div className="glass-card" style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <p style={{ color: "#555" }}>No active notifications</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {notifications.map((notification) => (
                  <div key={notification.id} className="premium-card" style={{ padding: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{
                          fontSize: "0.7rem",
                          color: notification.type === "public" ? "var(--gold)" : "#888",
                          letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600,
                        }}>
                          {notification.type || "notification"}
                        </span>
                        {notification.createdAt && (
                          <span style={{ fontSize: "0.68rem", color: "#444" }}>
                            · {formatDate(notification.createdAt)}
                          </span>
                        )}
                      </div>
                      <p style={{ fontWeight: 600, color: "#f0ece4", marginBottom: 4 }}>{notification.title}</p>
                      <p style={{ color: "#777", fontSize: "0.85rem" }}>{notification.description}</p>
                    </div>
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      style={{
                        padding: "8px 16px", borderRadius: 8, fontSize: "0.8rem",
                        fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                        background: "transparent", border: "1px solid rgba(239,68,68,0.2)",
                        color: "#f87171", whiteSpace: "nowrap", transition: "all 0.2s",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: CONTACTS ────────────────────────────────────────────────── */}
        {activeTab === "contacts" && hasPermission(residentPerms, "contacts") && (
          <div className="animate-fade-in">

            {/* Add/Edit Form */}
            <div id="contact-form" className="glass-card" style={{ padding: 28, marginBottom: 28 }}>
              <p style={{ color: "var(--gold)", fontSize: "0.75rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 20 }}>
                {editingContactId ? "✏️ Edit Contact" : "➕ Add New Contact"}
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
                <input
                  placeholder="Name *"
                  value={contactForm.name}
                  onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))}
                  className="premium-input"
                  style={{ margin: 0 }}
                />
                <input
                  placeholder="Role / Service *"
                  value={contactForm.role}
                  onChange={(e) => setContactForm((p) => ({ ...p, role: e.target.value }))}
                  className="premium-input"
                  style={{ margin: 0 }}
                />
                <input
                  placeholder="Phone Number *"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm((p) => ({ ...p, phone: e.target.value }))}
                  className="premium-input"
                  style={{ margin: 0 }}
                />
                <select
                  value={contactForm.category}
                  onChange={(e) => setContactForm((p) => ({ ...p, category: e.target.value }))}
                  className="premium-select"
                  style={{ margin: 0 }}
                >
                  {["General","Plumbing","Electrical","Security","Lift","Water","Garbage","Society","Internet"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input
                  placeholder="Availability (e.g. 9AM–6PM)"
                  value={contactForm.availability}
                  onChange={(e) => setContactForm((p) => ({ ...p, availability: e.target.value }))}
                  className="premium-input"
                  style={{ margin: 0, gridColumn: "span 1" }}
                />
                <input
                  placeholder="Description (optional)"
                  value={contactForm.description}
                  onChange={(e) => setContactForm((p) => ({ ...p, description: e.target.value }))}
                  className="premium-input"
                  style={{ margin: 0, gridColumn: "span 1" }}
                />
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
                <button
                  onClick={saveContact}
                  disabled={contactLoading}
                  style={{
                    padding: "12px 28px", borderRadius: 10,
                    background: "linear-gradient(135deg, #8a6e2f, #c9a84c)",
                    color: "#0a0800", fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 700, fontSize: "0.9rem", cursor: contactLoading ? "not-allowed" : "pointer",
                    border: "none", opacity: contactLoading ? 0.7 : 1, transition: "all 0.2s",
                  }}
                >
                  {contactLoading ? "Saving..." : editingContactId ? "✓ Save Changes" : "✓ Add Contact"}
                </button>
                {editingContactId && (
                  <button
                    onClick={cancelEditContact}
                    style={{
                      padding: "12px 22px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
                      background: "transparent", color: "#888",
                      fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: "0.9rem",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Contacts List */}
            {contacts.length === 0 ? (
              <div className="glass-card" style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📞</div>
                <p style={{ color: "#555" }}>No apartment contacts yet. Add the first one above.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {contacts.map((contact) => (
                  <div key={contact.id} className="premium-card" style={{
                    padding: "20px 22px",
                    display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
                  }}>
                    {/* Category icon */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: "rgba(201,168,76,0.1)", border: "1px solid var(--border)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20, flexShrink: 0,
                    }}>
                      {{"Plumbing":"🔧","Electrical":"⚡","Security":"🔒","Lift":"🛗","Water":"💧","Garbage":"🗑️","Society":"🏛️","Internet":"📶","General":"📞"}[contact.category] || "📞"}
                    </div>

                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, color: "#f0ece4", fontSize: "0.95rem" }}>{contact.name}</span>
                        <span style={{
                          padding: "2px 10px", borderRadius: 99,
                          background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)",
                          fontSize: "0.68rem", color: "var(--gold)", fontWeight: 600, letterSpacing: "0.05em",
                          textTransform: "uppercase",
                        }}>
                          {contact.category}
                        </span>
                      </div>
                      <p style={{ color: "var(--gold)", fontSize: "0.8rem", fontWeight: 600, marginBottom: 2 }}>{contact.role}</p>
                      {contact.description && <p style={{ color: "#666", fontSize: "0.78rem" }}>{contact.description}</p>}
                      {contact.availability && <p style={{ color: "#555", fontSize: "0.75rem" }}>🕐 {contact.availability}</p>}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <a href={`tel:${contact.phone}`} style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: "1.3rem", fontWeight: 700, color: "#c9a84c",
                        textDecoration: "none",
                      }}>
                        {contact.phone}
                      </a>
                      <button
                        onClick={() => startEditContact(contact)}
                        style={{
                          padding: "8px 14px", borderRadius: 8, fontSize: "0.8rem",
                          fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                          background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)",
                          color: "var(--gold)", transition: "all 0.2s",
                        }}
                      >
                        ✏ Edit
                      </button>
                      <button
                        onClick={() => deleteContact(contact.id)}
                        style={{
                          padding: "8px 14px", borderRadius: 8, fontSize: "0.8rem",
                          fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                          background: "transparent", border: "1px solid rgba(239,68,68,0.2)",
                          color: "#f87171", transition: "all 0.2s",
                        }}
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: ACCOLADES ──────────────────────────────────────────────── */}
        {activeTab === "accolades" && (
          <div className="animate-fade-in">
            <div className="glass-card" style={{ padding: 28, maxWidth: 560 }}>
              <p style={{ color: "var(--gold)", fontSize: "0.75rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 20 }}>
                🏅 Manage Accolades
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <select value={selectedResident} onChange={(e) => setSelectedResident(e.target.value)} className="premium-select">
                  <option value="">Select Apartment</option>
                  {residents.map((r) => (
                    <option key={r.id} value={r.id}>Apartment {r.apartmentNumber}</option>
                  ))}
                </select>
                <select value={selectedAccolade} onChange={(e) => setSelectedAccolade(e.target.value)} className="premium-select">
                  <option value="">Select Accolade</option>
                  {accolades.map((a) => (
                    <option key={a.id} value={a.id}>{a.title} (+{a.xp} XP)</option>
                  ))}
                </select>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={grantAccolade} style={{
                    flex: 1, padding: "13px", borderRadius: 10, border: "1px solid rgba(34,197,94,0.3)",
                    cursor: "pointer", background: "rgba(34,197,94,0.12)",
                    color: "#4ade80", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: "0.9rem",
                  }}>
                    ✓ Grant
                  </button>
                  <button onClick={removeAccolade} style={{
                    flex: 1, padding: "13px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.25)",
                    cursor: "pointer", background: "rgba(239,68,68,0.1)",
                    color: "#f87171", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: "0.9rem",
                  }}>
                    ✕ Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: CHALLENGES ─────────────────────────────────────────────── */}
        {activeTab === "challenges" && (
          <div className="animate-fade-in">

            {/* Create / Edit Form */}
            <div id="challenge-form" className="glass-card" style={{ padding: 28, marginBottom: 28 }}>
              <p style={{ color: "var(--gold)", fontSize: "0.75rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 20 }}>
                {editingChallengeId ? "✏ Edit Challenge" : "➕ Create New Challenge"}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
                <input
                  placeholder="Challenge Title *"
                  value={challengeForm.title}
                  onChange={(e) => setChallengeForm((p) => ({ ...p, title: e.target.value }))}
                  className="premium-input"
                  style={{ margin: 0 }}
                />
                <select
                  value={challengeForm.challengeType}
                  onChange={(e) => setChallengeForm((p) => ({ ...p, challengeType: e.target.value as ChallengeType }))}
                  className="premium-select"
                  style={{ margin: 0 }}
                >
                  {Object.entries(CHALLENGE_TYPE_META).map(([key, val]) => (
                    <option key={key} value={key}>{val.icon} {val.label}</option>
                  ))}
                </select>
                <input
                  placeholder="Target (e.g. 7 check-ins) *"
                  type="number"
                  min={1}
                  value={challengeForm.target}
                  onChange={(e) => setChallengeForm((p) => ({ ...p, target: Number(e.target.value) }))}
                  className="premium-input"
                  style={{ margin: 0 }}
                />
                <input
                  placeholder="Reward XP *"
                  type="number"
                  min={1}
                  value={challengeForm.rewardXP}
                  onChange={(e) => setChallengeForm((p) => ({ ...p, rewardXP: Number(e.target.value) }))}
                  className="premium-input"
                  style={{ margin: 0 }}
                />
                <div>
                  <label style={{ display: "block", color: "#666", fontSize: "0.75rem", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Start Date *</label>
                  <input
                    type="date"
                    value={challengeForm.startDate}
                    onChange={(e) => setChallengeForm((p) => ({ ...p, startDate: e.target.value }))}
                    className="premium-input"
                    style={{ margin: 0, colorScheme: "dark" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", color: "#666", fontSize: "0.75rem", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>End Date *</label>
                  <input
                    type="date"
                    value={challengeForm.endDate}
                    onChange={(e) => setChallengeForm((p) => ({ ...p, endDate: e.target.value }))}
                    className="premium-input"
                    style={{ margin: 0, colorScheme: "dark" }}
                  />
                </div>
                <textarea
                  placeholder="Description *"
                  value={challengeForm.description}
                  onChange={(e) => setChallengeForm((p) => ({ ...p, description: e.target.value }))}
                  className="premium-input"
                  rows={2}
                  style={{ margin: 0, gridColumn: "span 2", resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 18 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={challengeForm.active}
                    onChange={(e) => setChallengeForm((p) => ({ ...p, active: e.target.checked }))}
                    style={{ accentColor: "var(--gold)", width: 16, height: 16 }}
                  />
                  <span style={{ color: "#ccc", fontSize: "0.88rem" }}>Active (visible to residents)</span>
                </label>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
                <button
                  onClick={saveChallenge}
                  disabled={challengeLoading}
                  style={{
                    padding: "12px 28px", borderRadius: 10,
                    background: "linear-gradient(135deg, #8a6e2f, #c9a84c)",
                    color: "#0a0800", fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 700, fontSize: "0.9rem",
                    cursor: challengeLoading ? "not-allowed" : "pointer",
                    border: "none", opacity: challengeLoading ? 0.7 : 1, transition: "all 0.2s",
                  }}
                >
                  {challengeLoading ? "Saving..." : editingChallengeId ? "✓ Save Changes" : "✓ Create Challenge"}
                </button>
                {editingChallengeId && (
                  <button
                    onClick={cancelEditChallenge}
                    style={{
                      padding: "12px 22px", borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "transparent", color: "#888",
                      fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: "0.9rem",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Challenges List */}
            {challenges.length === 0 ? (
              <div className="glass-card" style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
                <p style={{ color: "#555" }}>No challenges created yet. Create the first one above.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {challenges.map((ch) => {
                  const meta      = CHALLENGE_TYPE_META[ch.challengeType as ChallengeType] ?? CHALLENGE_TYPE_META["daily_checkins"];
                  const progList  = getProgressForChallenge(ch.id);
                  const doneCount = progList.filter((p) => p.completed).length;
                  const now       = new Date();
                  const isLive    = ch.active && new Date(ch.startDate) <= now && new Date(ch.endDate) >= now;
                  const isUpcoming = ch.active && new Date(ch.startDate) > now;
                  const isEnded   = new Date(ch.endDate) < now;
                  return (
                    <div key={ch.id} className="premium-card" style={{
                      padding: "22px 24px",
                      display: "flex", alignItems: "flex-start", gap: 18, flexWrap: "wrap",
                      borderColor: isLive ? "rgba(201,168,76,0.25)" : "rgba(255,255,255,0.06)",
                    }}>
                      {/* Icon */}
                      <div style={{
                        width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                        background: isLive ? "rgba(201,168,76,0.12)" : "rgba(100,100,100,0.08)",
                        border: isLive ? "1px solid rgba(201,168,76,0.25)" : "1px solid rgba(100,100,100,0.15)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                      }}>
                        {meta.icon}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, color: "#f0ece4", fontSize: "0.95rem" }}>{ch.title}</span>
                          <span style={{
                            padding: "2px 10px", borderRadius: 99, fontSize: "0.65rem",
                            background: isLive ? "rgba(201,168,76,0.12)" : isUpcoming ? "rgba(99,102,241,0.12)" : "rgba(100,100,100,0.1)",
                            color: isLive ? "var(--gold)" : isUpcoming ? "#a5b4fc" : "#555",
                            border: isLive ? "1px solid rgba(201,168,76,0.2)" : isUpcoming ? "1px solid rgba(99,102,241,0.2)" : "1px solid rgba(100,100,100,0.15)",
                            fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
                          }}>
                            {!ch.active ? "Inactive" : isLive ? "Live" : isUpcoming ? "Upcoming" : "Ended"}
                          </span>
                          <span style={{ padding: "2px 10px", borderRadius: 99, fontSize: "0.65rem", background: "rgba(99,102,241,0.1)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.2)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            +{ch.rewardXP} XP
                          </span>
                        </div>
                        <p style={{ color: "#666", fontSize: "0.8rem", marginBottom: 6 }}>{ch.description}</p>
                        <div style={{ display: "flex", gap: 16, fontSize: "0.72rem", color: "#555", flexWrap: "wrap" }}>
                          <span>{meta.icon} {meta.label} · Target: {ch.target}</span>
                          <span>📅 {ch.startDate} → {ch.endDate}</span>
                          {progList.length > 0 && (
                            <span style={{ color: doneCount > 0 ? "#4ade80" : "#555" }}>
                              👥 {doneCount}/{progList.length} residents completed
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <button
                          onClick={() => toggleChallengeActive(ch)}
                          style={{
                            padding: "8px 14px", borderRadius: 8, fontSize: "0.78rem", fontWeight: 600,
                            cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
                            background: ch.active ? "rgba(74,222,128,0.1)" : "rgba(100,100,100,0.08)",
                            border: ch.active ? "1px solid rgba(74,222,128,0.25)" : "1px solid rgba(100,100,100,0.15)",
                            color: ch.active ? "#4ade80" : "#666",
                          }}
                        >
                          {ch.active ? "● Active" : "○ Inactive"}
                        </button>
                        <button
                          onClick={() => startEditChallenge(ch)}
                          style={{
                            padding: "8px 14px", borderRadius: 8, fontSize: "0.78rem", fontWeight: 600,
                            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                            background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)",
                            color: "var(--gold)", transition: "all 0.2s",
                          }}
                        >
                          ✏ Edit
                        </button>
                        <button
                          onClick={() => deleteChallenge(ch.id)}
                          style={{
                            padding: "8px 14px", borderRadius: 8, fontSize: "0.78rem", fontWeight: 600,
                            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                            background: "transparent", border: "1px solid rgba(239,68,68,0.2)",
                            color: "#f87171", transition: "all 0.2s",
                          }}
                        >
                          🗑 Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: MAINTENANCE ─────────────────────────────────────────────── */}
        {activeTab === "maintenance" && hasPermission(residentPerms, "maintenance") && (
          <div className="animate-fade-in">

            {/* Year selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28, flexWrap: "wrap" }}>
              <p style={{ color: "var(--gold)", fontSize: "0.75rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                💰 Maintenance Payments
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
                <span style={{ color: "#666", fontSize: "0.82rem" }}>Year:</span>
                {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map((yr) => (
                  <button
                    key={yr}
                    onClick={() => { setMaintenanceYear(yr); loadMaintenanceRecords(yr); }}
                    style={{
                      padding: "8px 16px", borderRadius: 8, fontSize: "0.82rem", fontWeight: 700,
                      cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
                      background: maintenanceYear === yr ? "linear-gradient(135deg,#8a6e2f,#c9a84c)" : "rgba(255,255,255,0.04)",
                      color: maintenanceYear === yr ? "#0a0800" : "#777",
                      border: maintenanceYear === yr ? "none" : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >{yr}</button>
                ))}
              </div>
            </div>

            {/* Summary stats */}
            {maintenanceRecords.length > 0 && (() => {
              const quarters: ("Q1"|"Q2"|"Q3"|"Q4")[] = ["Q1","Q2","Q3","Q4"];
              const total = maintenanceRecords.length;
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 14, marginBottom: 24 }}>
                  {quarters.map((q) => {
                    const paid = maintenanceRecords.filter((r) => r[q]?.paid).length;
                    return (
                      <div key={q} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 14, padding: "18px 16px", border: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
                        <div style={{ fontSize: "0.7rem", color: "var(--gold)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6, fontWeight: 700 }}>{q}</div>
                        <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#f0ece4", lineHeight: 1 }}>{paid}<span style={{ fontSize: "1rem", color: "#444" }}>/{total}</span></div>
                        <div style={{ fontSize: "0.7rem", color: paid === total ? "#4ade80" : "#f87171", marginTop: 6, fontWeight: 600 }}>
                          {paid === total ? "✅ All Paid" : `⚠ ${total - paid} Pending`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {maintenanceLoading ? (
              <div style={{ padding: 60, textAlign: "center" }}>
                <div className="spinner" style={{ margin: "0 auto 16px" }} />
                <p style={{ color: "#555" }}>Loading payment records…</p>
              </div>
            ) : maintenanceRecords.length === 0 ? (
              <div className="glass-card" style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
                <p style={{ color: "#555" }}>No residents found. Click a year above to load records.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 10px" }}>
                  <thead>
                    <tr>
                      {["Apt", "Resident", "Q1", "Q2", "Q3", "Q4", "Status"].map((h) => (
                        <th key={h} style={{
                          padding: "10px 14px", textAlign: "left", color: "#555",
                          fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700,
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {maintenanceRecords.sort((a, b) => String(a.apartmentNumber).localeCompare(String(b.apartmentNumber))).map((row) => {
                      const quarters: ("Q1"|"Q2"|"Q3"|"Q4")[] = ["Q1","Q2","Q3","Q4"];
                      const allPaid = quarters.every((q) => row[q]?.paid);
                      return (
                        <tr key={row.apartmentNumber} style={{
                          background: "rgba(255,255,255,0.02)",
                          borderRadius: 12,
                        }}>
                          <td style={{ padding: "14px 14px", borderRadius: "12px 0 0 12px", border: "1px solid rgba(255,255,255,0.04)", borderRight: "none" }}>
                            <span style={{ fontWeight: 700, color: "var(--gold)", fontSize: "0.95rem" }}>
                              {row.apartmentNumber}
                            </span>
                          </td>
                          <td style={{ padding: "14px 14px", border: "1px solid rgba(255,255,255,0.04)", borderLeft: "none", borderRight: "none" }}>
                            <span style={{ color: "#ccc", fontSize: "0.88rem" }}>{row.residentName}</span>
                          </td>
                          {quarters.map((q) => (
                            <td key={q} style={{ padding: "14px 10px", border: "1px solid rgba(255,255,255,0.04)", borderLeft: "none", borderRight: "none", textAlign: "center" }}>
                              <button
                                onClick={() => togglePayment(row.apartmentNumber, row.residentId, q, maintenanceYear, row[q])}
                                title={row[q]?.paid ? "Mark as Unpaid" : "Mark as Paid"}
                                style={{
                                  width: 36, height: 36, borderRadius: 10, cursor: "pointer",
                                  border: row[q]?.paid ? "1px solid rgba(74,222,128,0.35)" : "1px solid rgba(239,68,68,0.25)",
                                  background: row[q]?.paid ? "rgba(74,222,128,0.12)" : "rgba(239,68,68,0.08)",
                                  color: row[q]?.paid ? "#4ade80" : "#f87171",
                                  fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center",
                                  margin: "0 auto", transition: "all 0.2s",
                                }}
                              >
                                {row[q]?.paid ? "✓" : "✗"}
                              </button>
                            </td>
                          ))}
                          <td style={{ padding: "14px 14px", borderRadius: "0 12px 12px 0", border: "1px solid rgba(255,255,255,0.04)", borderLeft: "none" }}>
                            {allPaid ? (
                              <span style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 999, padding: "4px 12px", fontSize: "0.72rem", color: "#4ade80", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                                ✅ Paid
                              </span>
                            ) : (
                              <span style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 999, padding: "4px 12px", fontSize: "0.72rem", color: "#f87171", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                                ⚠ Pending
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Legend */}
            <div style={{ display: "flex", gap: 16, marginTop: 20, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.35)", display: "flex", alignItems: "center", justifyContent: "center", color: "#4ade80", fontSize: "0.85rem" }}>✓</div>
                <span style={{ color: "#666", fontSize: "0.8rem" }}>Paid — click to mark unpaid</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171", fontSize: "0.85rem" }}>✗</div>
                <span style={{ color: "#666", fontSize: "0.8rem" }}>Pending — click to mark paid</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: SINKING FUND ─────────────────────────────────────────────── */}
        {activeTab === "sinking-fund" && hasPermission(residentPerms, "sinkingFund") && (
          <div className="animate-fade-in">
            {/* Year selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28, flexWrap: "wrap" }}>
              <p style={{ color: "var(--gold)", fontSize: "0.75rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                🏦 Sinking Fund Payments
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
                <span style={{ color: "#666", fontSize: "0.82rem" }}>Year:</span>
                {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map((yr) => (
                  <button
                    key={yr}
                    onClick={() => { setSfYear(yr); loadSFRecords(yr); }}
                    style={{
                      padding: "8px 16px", borderRadius: 8, fontSize: "0.82rem", fontWeight: 700,
                      cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
                      background: sfYear === yr ? "linear-gradient(135deg,#8a6e2f,#c9a84c)" : "rgba(255,255,255,0.04)",
                      color: sfYear === yr ? "#0a0800" : "#777",
                      border: sfYear === yr ? "none" : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >{yr}</button>
                ))}
              </div>
            </div>

            {/* Summary stats */}
            {sfRecords.length > 0 && (() => {
              const cycles: (1 | 2)[] = [1, 2];
              const total = sfRecords.length;
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 24 }}>
                  {cycles.map((c) => {
                    const paid = sfRecords.filter((r) => r[`cycle_${c}`]?.paid).length;
                    const label = c === 1 ? "Cycle 1 (Jan–Jun)" : "Cycle 2 (Jul–Dec)";
                    return (
                      <div key={c} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 14, padding: "18px 16px", border: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
                        <div style={{ fontSize: "0.7rem", color: "var(--gold)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6, fontWeight: 700 }}>{label}</div>
                        <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#f0ece4", lineHeight: 1 }}>{paid}<span style={{ fontSize: "1rem", color: "#444" }}>/{total}</span></div>
                        <div style={{ fontSize: "0.7rem", color: paid === total ? "#4ade80" : "#f87171", marginTop: 6, fontWeight: 600 }}>
                          {paid === total ? "✅ All Paid" : `⚠ ${total - paid} Pending`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {sfLoading ? (
              <div style={{ padding: 60, textAlign: "center" }}>
                <div className="spinner" style={{ margin: "0 auto 16px" }} />
                <p style={{ color: "#555" }}>Loading sinking fund records…</p>
              </div>
            ) : sfRecords.length === 0 ? (
              <div className="glass-card" style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🏦</div>
                <p style={{ color: "#555" }}>Click a year above to load sinking fund records.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 10px" }}>
                  <thead>
                    <tr>
                      {["Apt", "Resident", "Cycle 1", "Cycle 2", "Status"].map((h) => (
                        <th key={h} style={{
                          padding: "10px 14px", textAlign: "left", color: "#555",
                          fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700,
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sfRecords.sort((a, b) => String(a.apartmentNumber).localeCompare(String(b.apartmentNumber))).map((row) => {
                      const cycles: (1 | 2)[] = [1, 2];
                      const allPaid = cycles.every((c) => row[`cycle_${c}`]?.paid);
                      return (
                        <tr key={row.apartmentNumber}>
                          <td style={{ padding: "14px 14px", borderRadius: "12px 0 0 12px", border: "1px solid rgba(255,255,255,0.04)", borderRight: "none" }}>
                            <span style={{ fontWeight: 700, color: "var(--gold)", fontSize: "0.95rem" }}>{row.apartmentNumber}</span>
                          </td>
                          <td style={{ padding: "14px 14px", border: "1px solid rgba(255,255,255,0.04)", borderLeft: "none", borderRight: "none" }}>
                            <span style={{ color: "#ccc", fontSize: "0.88rem" }}>{row.residentName}</span>
                          </td>
                          {cycles.map((c) => (
                            <td key={c} style={{ padding: "14px 10px", border: "1px solid rgba(255,255,255,0.04)", borderLeft: "none", borderRight: "none", textAlign: "center" }}>
                              <button
                                onClick={() => toggleSFPayment(row.apartmentNumber, row.residentId, c, sfYear, row[`cycle_${c}`])}
                                title={row[`cycle_${c}`]?.paid ? "Mark as Unpaid" : "Mark as Paid"}
                                style={{
                                  width: 36, height: 36, borderRadius: 10, cursor: "pointer",
                                  border: row[`cycle_${c}`]?.paid ? "1px solid rgba(74,222,128,0.35)" : "1px solid rgba(239,68,68,0.25)",
                                  background: row[`cycle_${c}`]?.paid ? "rgba(74,222,128,0.12)" : "rgba(239,68,68,0.08)",
                                  color: row[`cycle_${c}`]?.paid ? "#4ade80" : "#f87171",
                                  fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center",
                                  margin: "0 auto", transition: "all 0.2s",
                                }}
                              >
                                {row[`cycle_${c}`]?.paid ? "✓" : "✗"}
                              </button>
                            </td>
                          ))}
                          <td style={{ padding: "14px 14px", borderRadius: "0 12px 12px 0", border: "1px solid rgba(255,255,255,0.04)", borderLeft: "none" }}>
                            {allPaid ? (
                              <span style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 999, padding: "4px 12px", fontSize: "0.72rem", color: "#4ade80", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                                ✅ Paid
                              </span>
                            ) : (
                              <span style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 999, padding: "4px 12px", fontSize: "0.72rem", color: "#f87171", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                                ⚠ Pending
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: GAS BILLING ──────────────────────────────────────────────── */}
        {activeTab === "gas" && hasPermission(residentPerms, "gasBilling") && (
          <div className="animate-fade-in">
            {/* Rate config + month selector */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
              {/* Rate card */}
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.07)", padding: "22px 24px" }}>
                <p style={{ color: "var(--gold)", fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12, fontWeight: 700 }}>💰 Gas Rate</p>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ color: "#555", fontSize: "0.9rem" }}>₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={gasRateInput}
                    onChange={(e) => setGasRateInput(e.target.value)}
                    placeholder="Rate per unit"
                    style={{
                      flex: 1, padding: "10px 14px", borderRadius: 8,
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                      color: "#f0ece4", fontFamily: "'DM Sans', sans-serif", fontSize: "0.95rem", outline: "none",
                    }}
                  />
                  <span style={{ color: "#555", fontSize: "0.8rem" }}>/unit</span>
                  <button
                    onClick={saveGasRate}
                    style={{
                      padding: "10px 16px", borderRadius: 8, fontWeight: 700, fontSize: "0.82rem",
                      cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                      background: "linear-gradient(135deg,#8a6e2f,#c9a84c)", color: "#0a0800", border: "none",
                    }}
                  >Save</button>
                </div>
                <p style={{ color: "#444", fontSize: "0.75rem", marginTop: 8 }}>Current: ₹{gasRatePerUnit}/unit</p>
              </div>
              {/* Month selector */}
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.07)", padding: "22px 24px" }}>
                <p style={{ color: "var(--gold)", fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12, fontWeight: 700 }}>📅 Billing Month</p>
                <input
                  type="month"
                  value={gasMonth}
                  onChange={(e) => { setGasMonth(e.target.value); loadGasData(e.target.value); }}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 8,
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                    color: "#f0ece4", fontFamily: "'DM Sans', sans-serif", fontSize: "0.95rem", outline: "none",
                    colorScheme: "dark",
                  }}
                />
              </div>
            </div>

            {/* Gas enable/disable per apartment */}
            <div style={{ marginBottom: 28 }}>
              <p style={{ color: "#555", fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Apartment Gas Enrollment</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {residents.sort((a, b) => String(a.apartmentNumber).localeCompare(String(b.apartmentNumber))).map((res) => {
                  const enabled = gasSettings[res.apartmentNumber] || false;
                  return (
                    <button
                      key={res.apartmentNumber}
                      onClick={() => toggleGasEnabled(res.apartmentNumber, enabled)}
                      style={{
                        padding: "8px 14px", borderRadius: 10, fontSize: "0.8rem", fontWeight: 700,
                        cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
                        background: enabled ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.03)",
                        border: enabled ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(255,255,255,0.07)",
                        color: enabled ? "#4ade80" : "#555",
                      }}
                    >
                      {enabled ? "🔥" : "○"} Apt {res.apartmentNumber}
                    </button>
                  );
                })}
              </div>
            </div>

            {gasLoading ? (
              <div style={{ padding: 60, textAlign: "center" }}>
                <div className="spinner" style={{ margin: "0 auto 16px" }} />
                <p style={{ color: "#555" }}>Loading gas billing data…</p>
              </div>
            ) : gasBills.length === 0 ? (
              <div className="glass-card" style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔥</div>
                <p style={{ color: "#555" }}>No apartments enrolled in gas yet. Enable apartments above then click the Gas tab again.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 10px" }}>
                  <thead>
                    <tr>
                      {["Apt", "Resident", "Units Used", "Rate", "Total Bill", "Status", "Actions"].map((h) => (
                        <th key={h} style={{
                          padding: "10px 14px", textAlign: "left", color: "#555",
                          fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700,
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gasBills.sort((a, b) => String(a.apartmentNumber).localeCompare(String(b.apartmentNumber))).map((bill) => (
                      <GasBillRow
                        key={bill.apartmentNumber}
                        bill={bill}
                        onTogglePaid={() => toggleGasPaid(bill.apartmentNumber, bill.residentId, gasMonth, bill.paid, bill)}
                        onSaveUnits={(units: number) => saveGasUnits(bill.apartmentNumber, bill.residentId, gasMonth, units, gasRatePerUnit)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}


        {/* ── Tab: REPUTATION ─────────────────────────────────────────────────── */}
        {activeTab === "reputation" && (
          <div className="animate-fade-in">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>

              {/* Admin Control Panel */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "24px" }}>
                <p style={{ color: "var(--gold)", fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16, fontWeight: 700 }}>
                  ⭐ Adjust Reputation
                </p>

                {/* Select resident */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", color: "#555", fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                    Resident
                  </label>
                  <select
                    value={repSelectedResident}
                    onChange={(e) => setRepSelectedResident(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f0ece4", fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem", outline: "none" }}
                  >
                    <option value="">Select resident…</option>
                    {residents.sort((a, b) => String(a.apartmentNumber).localeCompare(String(b.apartmentNumber))).map((r) => {
                      const pts = computeReputationPoints(r as Record<string, unknown>);
                      const lvl = getReputationLevel(pts);
                      return (
                        <option key={r.id} value={r.id}>
                          Apt {r.apartmentNumber} — {lvl.title} ({pts} pts)
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Type presets */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", color: "#555", fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Type</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {([
                      { key: "appreciation", label: "👍 Appreciation", delta: "+20", color: "#4ade80" },
                      { key: "warning",      label: "⚠️ Warning",      delta: "-25", color: "#f87171" },
                      { key: "custom",       label: "✏️ Custom",        delta: "",    color: "#888"    },
                    ] as const).map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => {
                          setRepType(opt.key);
                          if (opt.key !== "custom") setRepDelta(opt.delta);
                        }}
                        style={{
                          padding: "8px 14px", borderRadius: 10, fontSize: "0.78rem", fontWeight: 600,
                          cursor: "pointer", fontFamily: "'DM Sans', sans-serif", border: "none",
                          background: repType === opt.key ? `${opt.color}20` : "rgba(255,255,255,0.04)",
                          color: repType === opt.key ? opt.color : "#555",
                          outline: repType === opt.key ? `1px solid ${opt.color}40` : "none",
                          transition: "all 0.2s",
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Delta */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", color: "#555", fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                    Points (use − for negative, e.g. −10)
                  </label>
                  <input
                    type="number"
                    value={repDelta}
                    onChange={(e) => setRepDelta(e.target.value)}
                    placeholder="e.g. 20 or -15"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f0ece4", fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem", outline: "none" }}
                  />
                </div>

                {/* Reason */}
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: "block", color: "#555", fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Reason</label>
                  <textarea
                    value={repReason}
                    onChange={(e) => setRepReason(e.target.value)}
                    placeholder="Describe why this reputation change is being applied…"
                    rows={3}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f0ece4", fontFamily: "'DM Sans', sans-serif", fontSize: "0.88rem", outline: "none", resize: "vertical" }}
                  />
                </div>

                <button
                  onClick={applyReputation}
                  disabled={repLoading}
                  style={{
                    width: "100%", padding: "12px", borderRadius: 10, fontSize: "0.9rem", fontWeight: 700,
                    cursor: repLoading ? "default" : "pointer", fontFamily: "'DM Sans', sans-serif",
                    background: repLoading ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg,#8a6e2f,#c9a84c)",
                    color: repLoading ? "#555" : "#0a0800", border: "none", transition: "all 0.2s",
                  }}
                >
                  {repLoading ? "Applying…" : "⭐ Apply Reputation Change"}
                </button>
              </div>

              {/* Reputation Leaderboard overview */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "24px", overflowY: "auto", maxHeight: 480 }}>
                <p style={{ color: "var(--gold)", fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>
                  🏆 Reputation Standings
                </p>
                {[...residents]
                  .map((r) => ({ ...r, _repPts: computeReputationPoints(r as Record<string, unknown>) }))
                  .sort((a, b) => b._repPts - a._repPts)
                  .map((r, idx) => {
                    const lvl = getReputationLevel(r._repPts);
                    return (
                      <div key={r.id || idx} style={{
                        display: "flex", alignItems: "center", gap: 10, marginBottom: 10,
                        padding: "8px 12px", borderRadius: 10,
                        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                      }}>
                        <span style={{ color: "#444", fontWeight: 700, fontSize: "0.8rem", minWidth: 24 }}>#{idx + 1}</span>
                        <span style={{ fontSize: 16 }}>{lvl.badge}</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ color: "#ccc", fontSize: "0.82rem", fontWeight: 600 }}>Apt {r.apartmentNumber}</p>
                          <p style={{ color: lvl.color, fontSize: "0.68rem" }}>{lvl.title}</p>
                        </div>
                        <span style={{ color: lvl.color, fontWeight: 800, fontSize: "0.95rem" }}>{r._repPts}</span>
                      </div>
                    );
                  })
                }
              </div>
            </div>

            {/* Recent Reputation Changes */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "24px" }}>
              <p style={{ color: "var(--gold)", fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16, fontWeight: 700 }}>
                📜 Recent Reputation Activity
              </p>
              {repHistory.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📜</div>
                  <p style={{ color: "#444" }}>No reputation history yet. Use the panel above to get started.</p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" }}>
                    <thead>
                      <tr>
                        {["Apartment", "Change", "Reason", "Source", "Time"].map((h) => (
                          <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#444", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {repHistory.map((entry, i) => (
                        <tr key={i}>
                          <td style={{ padding: "10px 12px", borderRadius: "10px 0 0 10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRight: "none" }}>
                            <span style={{ fontWeight: 700, color: "var(--gold)", fontSize: "0.88rem" }}>Apt {entry.aptNum}</span>
                            {entry.residentName && <p style={{ color: "#555", fontSize: "0.72rem" }}>{entry.residentName}</p>}
                          </td>
                          <td style={{ padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderLeft: "none", borderRight: "none" }}>
                            <span style={{ fontWeight: 800, color: entry.delta > 0 ? "#4ade80" : "#f87171", fontSize: "1rem" }}>
                              {entry.delta > 0 ? "+" : ""}{entry.delta}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderLeft: "none", borderRight: "none", maxWidth: 200 }}>
                            <span style={{ color: "#bbb", fontSize: "0.82rem" }}>{entry.reason}</span>
                          </td>
                          <td style={{ padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderLeft: "none", borderRight: "none" }}>
                            <span style={{ color: "#555", fontSize: "0.75rem" }}>{entry.source === "admin" ? "👤 Admin" : "🤖 System"}</span>
                          </td>
                          <td style={{ padding: "10px 12px", borderRadius: "0 10px 10px 0", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderLeft: "none" }}>
                            <span style={{ color: "#444", fontSize: "0.72rem" }}>
                              {entry.timestamp && typeof entry.timestamp === "object" && "toDate" in entry.timestamp
                                ? (entry.timestamp as { toDate: () => Date }).toDate().toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                                : ""}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: ADMIN CONTROL ─────────────────────────────────────────────── */}
        {activeTab === "adminControl" && (
          <div className="animate-fade-in-up" style={{ marginTop: 8 }}>
            {hasPermission(residentPerms, "adminControl") ? (
              <>
                <div style={{ marginBottom: 20 }}>
                  <p style={{ color: "#c9a84c", fontSize: "0.75rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6, fontWeight: 700 }}>
                    🛡 Admin Control Panel
                  </p>
                  <p style={{ color: "#555", fontSize: "0.85rem" }}>
                    Manage admin roles and module permissions for residents.
                    Only supreme admins can make changes here.
                  </p>
                </div>
                <AdminControlPanel
                  currentUserId={currentUserId}
                  currentUserName={currentUserName}
                  currentResident={residentPerms!}
                  showToast={showToast}
                />
              </>
            ) : (
              <div style={{
                background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.15)",
                borderRadius: 16, padding: "48px 24px", textAlign: "center",
              }}>
                <div style={{ fontSize: "3rem", marginBottom: 16 }}>🔒</div>
                <p style={{ color: "#ef4444", fontWeight: 700 }}>Supreme Admin Only</p>
                <p style={{ color: "#555", fontSize: "0.85rem", marginTop: 8 }}>
                  This panel requires the adminControl permission.
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
}
