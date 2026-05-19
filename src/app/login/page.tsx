"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [apartment, setApartment] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");

  const email = `${apartment}@gokulhub.com`;

  async function handleLogin() {
    setError("");
    if (!apartment || !password) { setError("Enter apartment number and password"); return; }
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
      localStorage.setItem("apartment", apartment);
      router.push("/dashboard");
    } catch (e: any) {
      setError(e.message?.replace("Firebase: ", "") || "Login failed");
    } finally { setLoading(false); }
  }

  async function handleRegister() {
    setError("");
    if (!apartment || !password) { setError("Enter apartment number and password"); return; }
    try {
      setLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "residents", userCredential.user.uid), {
        apartmentNumber: apartment, xp: 0, level: 1, streak: 0,
        lastGarbageDate: "", garbageCount: 0, messageCount: 0,
        checkInStreak: 0, lastCheckInDate: "",
        tournamentWins: 0, reputationScore: 5.0,
        complaintCount: 0, unlockedAccolades: [],
        residentNames: [], primaryContact: "", secondaryContact: "",
        profileUpdatedAt: null,
      });
      localStorage.setItem("apartment", apartment);
      router.push("/dashboard");
    } catch (e: any) {
      setError(e.message?.replace("Firebase: ", "") || "Registration failed");
    } finally { setLoading(false); }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.08) 0%, #050505 60%)" }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div style={{
          position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)",
          width: "600px", height: "600px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(201,168,76,0.05) 0%, transparent 70%)",
        }} />
      </div>

      <div className="w-full max-w-sm animate-fade-in-up" style={{ position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <div className="text-center mb-10">
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "linear-gradient(135deg, #8a6e2f, #c9a84c, #e8c96a)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px", fontSize: 28,
            boxShadow: "0 0 30px rgba(201,168,76,0.3)",
          }}>🏛</div>
          <h1 className="display-font gold-text" style={{ fontSize: "2.6rem", lineHeight: 1.1, marginBottom: 6 }}>
            GokulHub
          </h1>
          <p style={{ color: "#777", fontSize: "0.9rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Gokul Residency Portal
          </p>
        </div>

        {/* Card */}
        <div className="glass-card" style={{ padding: "32px" }}>
          {/* Mode tabs */}
          <div style={{
            display: "flex", background: "#111", borderRadius: 12,
            padding: 4, marginBottom: 28, border: "1px solid var(--border)"
          }}>
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                style={{
                  flex: 1, padding: "10px", borderRadius: 10, border: "none",
                  fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem", fontWeight: 600,
                  cursor: "pointer", transition: "all 0.25s ease",
                  background: mode === m ? "linear-gradient(135deg, #8a6e2f, #c9a84c)" : "transparent",
                  color: mode === m ? "#0a0800" : "#777",
                  letterSpacing: "0.04em",
                }}
              >
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", color: "#888", fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                Apartment Number
              </label>
              <input
                type="text"
                placeholder="e.g. 203"
                value={apartment}
                onChange={(e) => setApartment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (mode === "login" ? handleLogin() : handleRegister())}
                className="premium-input"
              />
            </div>

            <div>
              <label style={{ display: "block", color: "#888", fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (mode === "login" ? handleLogin() : handleRegister())}
                className="premium-input"
              />
            </div>

            {error && (
              <div style={{
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 10, padding: "12px 16px", color: "#f87171", fontSize: "0.88rem",
              }}>
                {error}
              </div>
            )}

            <button
              onClick={mode === "login" ? handleLogin : handleRegister}
              disabled={loading}
              className="gold-button"
              style={{
                width: "100%", padding: "15px", borderRadius: 12,
                fontSize: "1rem", marginTop: 4,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </div>

          <p style={{ textAlign: "center", color: "#555", fontSize: "0.8rem", marginTop: 24 }}>
            Beta v1.0 · Gokul Residency Exclusive
          </p>
        </div>
      </div>
    </main>
  );
}
