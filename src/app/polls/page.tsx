"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, addDoc, updateDoc, doc,
  getDoc, serverTimestamp, query, orderBy, increment,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { fetchResidentPermissions, hasPermission } from "@/lib/permissions";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PollOption {
  text: string;
  votes: number;
}

interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  voterIds: string[];
  createdAt: any;
  expiresAt: any;
  createdBy?: string;
}

interface ResidentData {
  apartmentNumber: string;
  xp: number;
  level: number;
  [key: string]: any;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isPollActive(poll: Poll): boolean {
  if (!poll.expiresAt?.seconds) return true;
  return poll.expiresAt.seconds * 1000 > Date.now();
}

function totalVotes(poll: Poll): number {
  return poll.options.reduce((sum, o) => sum + (o.votes || 0), 0);
}

function formatExpiry(ts: any): string {
  if (!ts?.seconds) return "No expiry";
  const d = new Date(ts.seconds * 1000);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PollCard({
  poll,
  currentUserId,
  residentData,
  isAdmin,
  onVote,
}: {
  poll: Poll;
  currentUserId: string;
  residentData: ResidentData | null;
  isAdmin: boolean;
  onVote: (pollId: string, optionIndex: number) => Promise<void>;
}) {
  const hasVoted = poll.voterIds?.includes(currentUserId);
  const active = isPollActive(poll);
  const total = totalVotes(poll);
  const [voting, setVoting] = useState(false);

  async function handleVote(idx: number) {
    if (voting || hasVoted || !active) return;
    setVoting(true);
    await onVote(poll.id, idx);
    setVoting(false);
  }

  return (
    <div className="premium-card" style={{ padding: 26 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            {active ? (
              <span style={{ fontSize: "0.7rem", color: "#4ade80", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 999, padding: "2px 10px", fontWeight: 600, letterSpacing: "0.06em" }}>
                ● Live
              </span>
            ) : (
              <span style={{ fontSize: "0.7rem", color: "#666", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, padding: "2px 10px", fontWeight: 600, letterSpacing: "0.06em" }}>
                ● Closed
              </span>
            )}
            {hasVoted && (
              <span style={{ fontSize: "0.7rem", color: "var(--gold)", background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 999, padding: "2px 10px", fontWeight: 600 }}>
                ✓ Voted
              </span>
            )}
          </div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#f0ece4", lineHeight: 1.4 }}>
            {poll.question}
          </h3>
        </div>
      </div>

      {/* Options */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        {poll.options.map((option, idx) => {
          const pct = total > 0 ? Math.round((option.votes / total) * 100) : 0;
          const showResults = hasVoted || !active;

          return (
            <div key={idx}>
              <button
                onClick={() => handleVote(idx)}
                disabled={hasVoted || !active || voting}
                style={{
                  width: "100%", textAlign: "left", borderRadius: 10,
                  padding: "12px 16px", cursor: hasVoted || !active ? "default" : "pointer",
                  fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem", fontWeight: 500,
                  transition: "all 0.25s ease", position: "relative", overflow: "hidden",
                  background: showResults
                    ? "rgba(255,255,255,0.03)"
                    : "rgba(255,255,255,0.04)",
                  border: showResults
                    ? "1px solid rgba(255,255,255,0.06)"
                    : "1px solid rgba(255,255,255,0.1)",
                  color: "#ccc",
                }}
                onMouseEnter={(e) => {
                  if (!hasVoted && active) {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hover)";
                    (e.currentTarget as HTMLElement).style.background = "rgba(201,168,76,0.06)";
                    (e.currentTarget as HTMLElement).style.color = "#f0ece4";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!hasVoted && active) {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)";
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                    (e.currentTarget as HTMLElement).style.color = "#ccc";
                  }
                }}
              >
                {/* Progress fill */}
                {showResults && (
                  <div style={{
                    position: "absolute", top: 0, left: 0, bottom: 0,
                    width: `${pct}%`,
                    background: "linear-gradient(90deg, rgba(201,168,76,0.15), rgba(201,168,76,0.05))",
                    borderRadius: 10, transition: "width 0.8s cubic-bezier(0.23,1,0.32,1)",
                    pointerEvents: "none",
                  }} />
                )}
                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>{option.text}</span>
                  {showResults && (
                    <span style={{ color: "var(--gold)", fontWeight: 700, fontSize: "0.9rem", minWidth: 42, textAlign: "right" }}>
                      {pct}%
                    </span>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <span style={{ color: "#555", fontSize: "0.78rem" }}>
          {total} vote{total !== 1 ? "s" : ""}
        </span>
        <span style={{ color: "#555", fontSize: "0.78rem" }}>
          Expires: {formatExpiry(poll.expiresAt)}
        </span>
      </div>

      {!hasVoted && active && (
        <p style={{ marginTop: 10, color: "var(--gold-dim)", fontSize: "0.78rem", textAlign: "center" }}>
          Vote to earn +5 XP
        </p>
      )}
    </div>
  );
}

// ─── Create Poll Form ─────────────────────────────────────────────────────────

function CreatePollForm({ onCreated, residentData }: { onCreated: () => void; residentData: ResidentData | null }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [expiryDate, setExpiryDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function addOption() {
    if (options.length < 6) setOptions([...options, ""]);
  }

  function removeOption(idx: number) {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== idx));
  }

  function updateOption(idx: number, val: string) {
    const copy = [...options];
    copy[idx] = val;
    setOptions(copy);
  }

  async function handleCreate() {
    setError("");
    if (!question.trim()) { setError("Enter a question"); return; }
    const validOptions = options.map((o) => o.trim()).filter(Boolean);
    if (validOptions.length < 2) { setError("Add at least 2 options"); return; }

    setSubmitting(true);
    try {
      const user = auth.currentUser;
      const expiresAt = expiryDate ? new Date(expiryDate) : null;

      await addDoc(collection(db, "polls"), {
        question: question.trim(),
        options: validOptions.map((text) => ({ text, votes: 0 })),
        voterIds: [],
        createdAt: serverTimestamp(),
        expiresAt: expiresAt,
        createdBy: residentData?.apartmentNumber || "Admin",
      });

      setQuestion("");
      setOptions(["", ""]);
      setExpiryDate("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      onCreated();
    } catch (e: any) {
      setError(e.message || "Failed to create poll");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="glass-card" style={{ padding: 28 }}>
      <p style={{ color: "var(--gold)", fontSize: "0.75rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 20 }}>
        📊 Create New Poll
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ display: "block", color: "#888", fontSize: "0.76rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Question</label>
          <input
            type="text"
            placeholder="Ask the community something…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="premium-input"
          />
        </div>

        <div>
          <label style={{ display: "block", color: "#888", fontSize: "0.76rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
            Options
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {options.map((opt, idx) => (
              <div key={idx} style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  placeholder={`Option ${idx + 1}`}
                  value={opt}
                  onChange={(e) => updateOption(idx, e.target.value)}
                  className="premium-input"
                  style={{ flex: 1 }}
                />
                {options.length > 2 && (
                  <button
                    onClick={() => removeOption(idx)}
                    style={{
                      padding: "0 14px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.2)",
                      background: "transparent", color: "#f87171", cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif", fontSize: "1.1rem", flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {options.length < 6 && (
              <button
                onClick={addOption}
                style={{
                  padding: "10px", borderRadius: 10, border: "1px dashed rgba(255,255,255,0.1)",
                  background: "transparent", color: "#666", cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", transition: "all 0.2s",
                }}
              >
                + Add Option
              </button>
            )}
          </div>
        </div>

        <div>
          <label style={{ display: "block", color: "#888", fontSize: "0.76rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
            Expiry Date (optional)
          </label>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="premium-input"
            min={new Date().toISOString().split("T")[0]}
          />
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", color: "#f87171", fontSize: "0.88rem" }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 10, padding: "12px 16px", color: "#4ade80", fontSize: "0.88rem" }}>
            ✓ Poll created successfully!
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={submitting}
          className="gold-button"
          style={{ width: "100%", padding: "14px", borderRadius: 12, fontSize: "0.95rem", opacity: submitting ? 0.7 : 1 }}
        >
          {submitting ? "Creating…" : "📊 Publish Poll"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PollsPage() {
  const router = useRouter();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");
  const [residentData, setResidentData] = useState<ResidentData | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function fetchPolls() {
    const q = query(collection(db, "polls"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    setPolls(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Poll)));
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      setCurrentUserId(user.uid);

      const rSnap = await getDoc(doc(db, "residents", user.uid));
      if (rSnap.exists()) {
        const data = rSnap.data() as ResidentData;
        setResidentData(data);
        const perms = await fetchResidentPermissions(user.uid);
        setIsAdmin(hasPermission(perms, "polls"));
      }

      await fetchPolls();
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  async function handleVote(pollId: string, optionIndex: number) {
    const user = auth.currentUser;
    if (!user || !residentData) return;

    const pollRef = doc(db, "polls", pollId);
    const pollSnap = await getDoc(pollRef);
    if (!pollSnap.exists()) return;

    const pollData = pollSnap.data() as Omit<Poll, "id">;

    // double-check not already voted
    if (pollData.voterIds?.includes(user.uid)) {
      showToast("You've already voted on this poll");
      return;
    }

    // check not expired
    if (pollData.expiresAt?.seconds && pollData.expiresAt.seconds * 1000 < Date.now()) {
      showToast("This poll has expired");
      return;
    }

    // update vote count
    const updatedOptions = pollData.options.map((opt: PollOption, idx: number) =>
      idx === optionIndex ? { ...opt, votes: (opt.votes || 0) + 1 } : opt
    );

    await updateDoc(pollRef, {
      options: updatedOptions,
      voterIds: [...(pollData.voterIds || []), user.uid],
    });

    // +5 XP reward
    const residentRef = doc(db, "residents", user.uid);
    const currentXP = (residentData.xp || 0) + 5;
    const newLevel = Math.floor(currentXP / 200) + 1;
    await updateDoc(residentRef, { xp: increment(5), level: newLevel });
    setResidentData((prev) => prev ? { ...prev, xp: currentXP, level: newLevel } : prev);

    showToast("✓ Vote cast! +5 XP earned");

    // refresh polls local state
    setPolls((prev) =>
      prev.map((p) =>
        p.id === pollId
          ? { ...p, options: updatedOptions, voterIds: [...(p.voterIds || []), user.uid] }
          : p
      )
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "#050505" }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner" style={{ margin: "0 auto 20px" }} />
          <p style={{ color: "#777", fontSize: "0.85rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading Polls</p>
        </div>
      </main>
    );
  }

  const activePolls = polls.filter(isPollActive);
  const closedPolls = polls.filter((p) => !isPollActive(p));

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

      <div style={{ maxWidth: 800, margin: "0 auto" }}>

        {/* Header */}
        <div className="animate-fade-in-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 40 }}>
          <div>
            <p style={{ color: "var(--gold)", fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>
              Community
            </p>
            <h1 className="display-font" style={{ fontSize: "2.6rem", color: "#f0ece4" }}>
              📊 Community Polls
            </h1>
            <p style={{ color: "#666", marginTop: 6, fontSize: "0.88rem" }}>
              Vote on community decisions · Earn +5 XP per vote
            </p>
          </div>
          <Link href="/dashboard" style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10, padding: "10px 18px", color: "#888", textDecoration: "none",
            fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem",
          }}>
            ← Dashboard
          </Link>
        </div>

        {/* Create poll — Admin only */}
        {isAdmin && (
          <div className="animate-fade-in-up stagger-1" style={{ marginBottom: 36 }}>
            <CreatePollForm onCreated={fetchPolls} residentData={residentData} />
          </div>
        )}

        {/* Active Polls */}
        {activePolls.length > 0 && (
          <div className="animate-fade-in-up stagger-2" style={{ marginBottom: 36 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <h2 className="display-font" style={{ fontSize: "1.6rem", color: "#f0ece4" }}>Active Polls</h2>
              <span style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 999, padding: "2px 10px", fontSize: "0.75rem", color: "#4ade80", fontWeight: 600 }}>
                {activePolls.length}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {activePolls.map((poll, i) => (
                <div key={poll.id} className={`animate-fade-in-up stagger-${Math.min(i + 3, 8)}`}>
                  <PollCard
                    poll={poll}
                    currentUserId={currentUserId}
                    residentData={residentData}
                    isAdmin={isAdmin}
                    onVote={handleVote}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No polls at all */}
        {polls.length === 0 && (
          <div className="glass-card animate-fade-in" style={{ padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
            <p style={{ color: "#888", marginBottom: 6 }}>No polls yet</p>
            {isAdmin && <p style={{ color: "#555", fontSize: "0.85rem" }}>Create your first poll above</p>}
          </div>
        )}

        {/* Closed Polls */}
        {closedPolls.length > 0 && (
          <div className="animate-fade-in-up stagger-4">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <h2 className="display-font" style={{ fontSize: "1.4rem", color: "#666" }}>Past Polls</h2>
              <span style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, padding: "2px 10px", fontSize: "0.75rem", color: "#555", fontWeight: 600 }}>
                {closedPolls.length}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, opacity: 0.7 }}>
              {closedPolls.map((poll) => (
                <PollCard
                  key={poll.id}
                  poll={poll}
                  currentUserId={currentUserId}
                  residentData={residentData}
                  isAdmin={isAdmin}
                  onVote={handleVote}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
