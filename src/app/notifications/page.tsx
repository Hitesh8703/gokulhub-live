"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection, query, where, getDocs,
  doc, getDoc, updateDoc, arrayUnion,
} from "firebase/firestore";

// ─── Notification icon helper ─────────────────────────────────────────────

function notifIcon(title: string, type: string) {
  if (title?.includes("Check-In"))    return "✅";
  if (title?.includes("Streak"))      return "🔥";
  if (title?.includes("Level Up"))    return "🎉";
  if (title?.includes("Resolved"))    return "✅";
  if (title?.includes("Under Review")) return "🔍";
  if (title?.includes("Complaint"))   return "🚨";
  if (title?.includes("Accolade"))    return "🏅";
  if (title?.includes("XP"))         return "⚡";
  if (type === "public")             return "📢";
  return "🔔";
}

function notifColor(title: string, type: string) {
  if (title?.includes("Resolved"))    return { bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.25)",  text: "#4ade80" };
  if (title?.includes("Under Review")) return { bg: "rgba(234,179,8,0.1)",   border: "rgba(234,179,8,0.25)",  text: "#fbbf24" };
  if (title?.includes("Complaint"))   return { bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.2)",   text: "#f87171" };
  if (title?.includes("Level Up"))    return { bg: "rgba(168,85,247,0.1)",  border: "rgba(168,85,247,0.25)", text: "#c084fc" };
  if (title?.includes("Accolade"))    return { bg: "rgba(201,168,76,0.1)",  border: "rgba(201,168,76,0.25)", text: "var(--gold)" };
  if (title?.includes("Check-In") || title?.includes("Streak")) {
    return { bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.25)", text: "#60a5fa" };
  }
  if (type === "public")             return { bg: "rgba(201,168,76,0.1)",  border: "rgba(201,168,76,0.2)",  text: "var(--gold)" };
  return { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.1)", text: "#888" };
}

// ─── Component ────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [residentData, setResidentData]   = useState<any>(null);
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { setLoading(false); return; }

      const residentSnap = await getDoc(doc(db, "residents", user.uid));
      if (!residentSnap.exists()) { setLoading(false); return; }

      const resident = residentSnap.data();
      setResidentData(resident);
      const apt = resident.apartmentNumber;

      const [publicSnap, privateSnap] = await Promise.all([
        getDocs(query(collection(db, "notifications"), where("type", "==", "public"))),
        getDocs(query(collection(db, "notifications"), where("targetApartment", "==", apt))),
      ]);

      const all: any[] = [];
      publicSnap.forEach((d) => {
        const data = d.data();
        if (!data.clearedBy?.includes(apt)) all.push({ id: d.id, ...data });
      });
      privateSnap.forEach((d) => {
        const data = d.data();
        if (!data.clearedBy?.includes(apt)) all.push({ id: d.id, ...data });
      });

      all.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setNotifications(all);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  async function clearNotification(notificationId: string) {
    if (!residentData) return;
    await updateDoc(doc(db, "notifications", notificationId), {
      clearedBy: arrayUnion(residentData.apartmentNumber),
    });
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  }

  async function clearAll() {
    if (!residentData || notifications.length === 0) return;
    await Promise.all(
      notifications.map((n) =>
        updateDoc(doc(db, "notifications", n.id), {
          clearedBy: arrayUnion(residentData.apartmentNumber),
        })
      )
    );
    setNotifications([]);
  }

  const formatDate = (ts: any) => {
    if (!ts?.seconds) return "";
    return new Date(ts.seconds * 1000).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  };

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "#050505" }}>
      <div style={{ textAlign: "center" }}>
        <div className="spinner" style={{ margin: "0 auto 20px" }} />
        <p style={{ color: "#777", fontSize: "0.85rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading Notifications</p>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen" style={{ background: "#050505", padding: "40px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* Header */}
        <div className="animate-fade-in-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 40 }}>
          <div>
            <p style={{ color: "var(--gold)", fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>Updates</p>
            <h1 className="display-font" style={{ fontSize: "2.6rem", color: "#f0ece4" }}>
              🔔 Notifications
              {notifications.length > 0 && (
                <span style={{
                  marginLeft: 12,
                  background: "rgba(201,168,76,0.15)", border: "1px solid var(--border)",
                  borderRadius: 999, padding: "2px 10px", fontSize: "1.2rem",
                  color: "var(--gold)", verticalAlign: "middle",
                }}>
                  {notifications.length}
                </span>
              )}
            </h1>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {notifications.length > 1 && (
              <button
                onClick={clearAll}
                style={{
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10, padding: "10px 16px", color: "#666",
                  fontFamily: "'DM Sans', sans-serif", fontSize: "0.8rem", cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#f87171"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.3)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#666"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
              >
                Clear All
              </button>
            )}
            <Link href="/dashboard" style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10, padding: "10px 18px", color: "#888",
              textDecoration: "none", fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem",
            }}>
              ← Dashboard
            </Link>
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="glass-card animate-fade-in" style={{ padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <p style={{ color: "#4ade80", fontWeight: 600, marginBottom: 6 }}>All caught up</p>
            <p style={{ color: "#555", fontSize: "0.88rem" }}>No new notifications</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {notifications.map((notification, i) => {
              const color = notifColor(notification.title, notification.type);
              const icon  = notifIcon(notification.title, notification.type);
              return (
                <div
                  key={notification.id}
                  className={`premium-card animate-fade-in-up stagger-${Math.min(i + 1, 8)}`}
                  style={{ padding: 22 }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    {/* Icon circle */}
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                      background: color.bg, border: `1px solid ${color.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                    }}>
                      {icon}
                    </div>

                    <div style={{ flex: 1 }}>
                      {/* Title row */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
                        <h2 style={{ fontWeight: 700, color: "#f0ece4", fontSize: "0.95rem" }}>
                          {notification.title}
                        </h2>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {notification.createdAt && (
                            <span style={{ fontSize: "0.68rem", color: "#444" }}>
                              {formatDate(notification.createdAt)}
                            </span>
                          )}
                          <span style={{
                            fontSize: "0.68rem", color: color.text,
                            letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600,
                            background: color.bg, border: `1px solid ${color.border}`,
                            borderRadius: 999, padding: "2px 8px",
                          }}>
                            {notification.type === "public" ? "Community" : "Private"}
                          </span>
                        </div>
                      </div>

                      <p style={{ color: "#777", fontSize: "0.88rem", lineHeight: 1.55 }}>
                        {notification.description}
                      </p>

                      <button
                        onClick={() => clearNotification(notification.id)}
                        style={{
                          marginTop: 14, padding: "6px 14px", borderRadius: 8, fontSize: "0.75rem",
                          fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                          background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
                          color: "#555", transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.3)"; (e.currentTarget as HTMLElement).style.color = "#f87171"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "#555"; }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
