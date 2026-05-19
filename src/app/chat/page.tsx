"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { checkAccolades } from "@/lib/accolades";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, getDoc, updateDoc } from "firebase/firestore";
import Link from "next/link";

export default function ChatPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [currentApartment, setCurrentApartment] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      const snap = await getDoc(doc(db, "residents", user.uid));
      if (snap.exists()) setCurrentApartment(snap.data().apartmentNumber);
    });

    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
    const unsubMessages = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });

    return () => { unsubAuth(); unsubMessages(); };
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!message.trim() || sending) return;
    const user = auth.currentUser;
    if (!user) return;
    setSending(true);
    const residentSnap = await getDoc(doc(db, "residents", user.uid));
    if (!residentSnap.exists()) { setSending(false); return; }
    const residentData = residentSnap.data();
    await addDoc(collection(db, "messages"), { text: message, apartmentNumber: residentData.apartmentNumber, createdAt: serverTimestamp() });
    const updatedData = { ...residentData, messageCount: (residentData.messageCount || 0) + 1 };
    await updateDoc(doc(db, "residents", user.uid), { messageCount: updatedData.messageCount });
    await checkAccolades(user.uid, updatedData);
    setMessage("");
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const formatTime = (ts: any) => {
    if (!ts?.seconds) return "";
    return new Date(ts.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "#050505" }}>
      {/* Header */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(14,14,14,0.95)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 8px rgba(74,222,128,0.6)" }} />
          <div>
            <p style={{ fontWeight: 600, color: "#f0ece4", fontSize: "1rem" }}>🌍 Global Chat</p>
            <p style={{ color: "#555", fontSize: "0.75rem" }}>Gokul Residency · {messages.length} messages</p>
          </div>
        </div>
        <Link href="/dashboard" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 16px", color: "#888", textDecoration: "none", fontFamily: "'DM Sans', sans-serif", fontSize: "0.82rem" }}>
          ← Dashboard
        </Link>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
            <p>No messages yet. Start the conversation!</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.apartmentNumber === currentApartment;
          return (
            <div key={msg.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "72%" }}>
                {!isMe && (
                  <p style={{ fontSize: "0.72rem", color: "var(--gold-dim)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4, paddingLeft: 4 }}>
                    Apt {msg.apartmentNumber}
                  </p>
                )}
                <div style={{
                  padding: "10px 16px", borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: isMe ? "linear-gradient(135deg, #8a6e2f, #c9a84c)" : "#1a1a1a",
                  border: isMe ? "none" : "1px solid rgba(255,255,255,0.06)",
                  color: isMe ? "#0a0800" : "#e0ddd8",
                  fontFamily: "'DM Sans', sans-serif", fontSize: "0.92rem", lineHeight: 1.5,
                }}>
                  {msg.text}
                </div>
                <p style={{ fontSize: "0.7rem", color: "#444", marginTop: 4, paddingLeft: 4, textAlign: isMe ? "right" : "left" }}>
                  {formatTime(msg.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", background: "rgba(14,14,14,0.95)", backdropFilter: "blur(20px)" }}>
        <div style={{ display: "flex", gap: 10, maxWidth: 800, margin: "0 auto" }}>
          <input
            type="text"
            placeholder="Type a message… (Enter to send)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="premium-input"
            style={{ flex: 1 }}
          />
          <button
            onClick={sendMessage}
            disabled={sending || !message.trim()}
            className="gold-button"
            style={{ padding: "0 24px", borderRadius: 12, fontSize: "0.9rem", minWidth: 80, opacity: sending || !message.trim() ? 0.5 : 1 }}
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
      </div>
    </main>
  );
}
