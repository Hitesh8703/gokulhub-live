"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

/**
 * /profile → redirects the authenticated user to their own
 * profile page at /residents/[uid], which supports both
 * self-editing and public viewing by other residents.
 */
export default function ProfileRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
      } else {
        router.replace(`/residents/${user.uid}`);
      }
    });
    return () => unsub();
  }, [router]);

  return (
    <main
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#050505" }}
    >
      <div style={{ textAlign: "center" }}>
        <div className="spinner" style={{ margin: "0 auto 20px" }} />
        <p
          style={{
            color: "#777",
            fontSize: "0.85rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Loading Profile
        </p>
      </div>
    </main>
  );
}
