"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, onSnapshot, query, orderBy,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// ─── Types ──────────────────────────────────────────────────────────────────

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

// ─── Static Emergency Contacts ───────────────────────────────────────────────

const EMERGENCY_CONTACTS = [
  { name: "Police",              phone: "100",  icon: "🚔", desc: "Law enforcement & security emergency"           },
  { name: "Ambulance",           phone: "108",  icon: "🚑", desc: "Medical emergency & health crisis"              },
  { name: "Fire Department",     phone: "101",  icon: "🚒", desc: "Fire, rescue & hazardous incidents"             },
  { name: "Women Helpline",      phone: "1091", icon: "🛡️", desc: "Women safety & distress helpline"              },
  { name: "Electricity Emergency", phone: "1912", icon: "⚡", desc: "Power outage & electrical emergency"          },
  { name: "Gas Emergency",       phone: "1906", icon: "🔥", desc: "Gas leak & cylinder emergency"                 },
];

const CATEGORY_ICONS: Record<string, string> = {
  Plumbing:    "🔧",
  Electrical:  "⚡",
  Security:    "🔒",
  Lift:        "🛗",
  Water:       "💧",
  Garbage:     "🗑️",
  Society:     "🏛️",
  Internet:    "📶",
  General:     "📞",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts]     = useState<ApartmentContact[]>([]);
  const [loading, setLoading]       = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) { router.push("/login"); return; }

      // Real-time listener for apartment contacts
      const q = query(collection(db, "apartmentContacts"), orderBy("createdAt", "desc"));
      const unsubContacts = onSnapshot(q, (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ApartmentContact));
        setContacts(data);
        setLoading(false);
      });

      return () => unsubContacts();
    });
    return () => unsubscribe();
  }, [router]);

  // ── Derived values ────────────────────────────────────────────────────────

  const categories = ["All", ...Array.from(new Set(contacts.map((c) => c.category)))];

  const filteredContacts = contacts.filter((c) => {
    const matchSearch = !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = selectedCategory === "All" || c.category === selectedCategory;
    return matchSearch && matchCat;
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen" style={{ background: "#050505", padding: "40px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div className="animate-fade-in-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 36, flexWrap: "wrap", gap: 16 }}>
          <div>
            <p style={{ color: "var(--gold)", fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>
              Safety & Support
            </p>
            <h1 className="display-font" style={{ fontSize: "2.8rem", color: "#f0ece4" }}>
              📞 Important Contacts
            </h1>
            <p style={{ color: "#666", marginTop: 8, fontSize: "0.9rem" }}>
              Emergency numbers & apartment service contacts
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

        {/* ── SECTION 1: Emergency Contacts ─────────────────────────────────── */}
        <section className="animate-fade-in-up stagger-1" style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 4, height: 24, borderRadius: 2,
              background: "linear-gradient(to bottom, #ef4444, #dc2626)",
            }} />
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif", fontSize: "1.6rem",
              color: "#f87171", fontWeight: 700, letterSpacing: "0.02em",
            }}>
              🚨 Universal Emergency Contacts
            </h2>
          </div>
          <p style={{ color: "#555", fontSize: "0.85rem", marginBottom: 20, marginLeft: 16 }}>
            National emergency numbers — available 24/7
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
            {EMERGENCY_CONTACTS.map((contact) => (
              <div key={contact.phone} style={{
                background: "linear-gradient(145deg, rgba(30,10,10,0.97), rgba(20,8,8,0.99))",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: 18, padding: "22px 22px",
                transition: "all 0.3s ease",
                position: "relative", overflow: "hidden",
              }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.55)";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 40px rgba(239,68,68,0.12)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.25)";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                {/* Red glow accent */}
                <div style={{
                  position: "absolute", top: 0, right: 0, width: 80, height: 80,
                  background: "radial-gradient(circle at top right, rgba(239,68,68,0.08), transparent 70%)",
                  pointerEvents: "none",
                }} />

                <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                  {/* Icon */}
                  <div style={{
                    width: 50, height: 50, borderRadius: 14,
                    background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22, flexShrink: 0,
                  }}>
                    {contact.icon}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, color: "#f0ece4", fontSize: "1rem", marginBottom: 2 }}>
                      {contact.name}
                    </p>
                    <p style={{ color: "#666", fontSize: "0.78rem", marginBottom: 10 }}>
                      {contact.desc}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <span style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: "1.7rem", fontWeight: 700,
                        color: "#f87171", letterSpacing: "0.04em",
                      }}>
                        {contact.phone}
                      </span>
                      <a
                        href={`tel:${contact.phone}`}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "8px 16px", borderRadius: 10,
                          background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)",
                          color: "#f87171", textDecoration: "none",
                          fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: "0.82rem",
                          letterSpacing: "0.04em", transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.28)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.15)";
                        }}
                      >
                        📲 Call
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 2: Apartment-Specific Contacts ────────────────────────── */}
        <section className="animate-fade-in-up stagger-2">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 4, height: 24, borderRadius: 2,
              background: "linear-gradient(to bottom, var(--gold-dim), var(--gold))",
            }} />
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif", fontSize: "1.6rem",
              color: "var(--gold-light)", fontWeight: 700,
            }}>
              🏢 Apartment Service Contacts
            </h2>
          </div>

          {/* Search & Filter */}
          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="🔍  Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1, minWidth: 220, padding: "12px 18px", borderRadius: 12,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#f0ece4", fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem",
                outline: "none", transition: "all 0.2s",
              }}
              onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hover)"; }}
              onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)"; }}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: "10px 16px", borderRadius: 10, border: "none",
                    fontFamily: "'DM Sans', sans-serif", fontSize: "0.8rem", fontWeight: 600,
                    cursor: "pointer", transition: "all 0.2s ease",
                    background: selectedCategory === cat
                      ? "linear-gradient(135deg, #8a6e2f, #c9a84c)"
                      : "rgba(255,255,255,0.04)",
                    color: selectedCategory === cat ? "#0a0800" : "#777",
                  }}
                >
                  {cat === "All" ? "All" : `${CATEGORY_ICONS[cat] || "📞"} ${cat}`}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="glass-card" style={{ padding: 60, textAlign: "center" }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                border: "2px solid rgba(201,168,76,0.15)",
                borderTop: "2px solid var(--gold)",
                animation: "spin 1s linear infinite",
                margin: "0 auto 16px",
              }} />
              <p style={{ color: "#555" }}>Loading contacts...</p>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="glass-card" style={{ padding: 60, textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>
                {contacts.length === 0 ? "📞" : "🔍"}
              </div>
              <p style={{ color: "#555", fontSize: "0.95rem" }}>
                {contacts.length === 0
                  ? "No apartment contacts added yet. Admin will add them soon."
                  : "No contacts match your search."}
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
              {filteredContacts.map((contact) => (
                <ContactCard key={contact.id} contact={contact} />
              ))}
            </div>
          )}
        </section>

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </main>
  );
}

// ─── Contact Card ─────────────────────────────────────────────────────────────

function ContactCard({ contact }: { contact: ApartmentContact }) {
  const icon = CATEGORY_ICONS[contact.category] || "📞";

  return (
    <div style={{
      background: "linear-gradient(145deg, rgba(20,18,14,0.97), rgba(14,14,14,0.99))",
      border: "1px solid var(--border)",
      borderRadius: 18, padding: "22px",
      transition: "all 0.35s cubic-bezier(0.23,1,0.32,1)",
      position: "relative", overflow: "hidden",
    }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hover)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 40px rgba(201,168,76,0.12)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      {/* Gold accent glow */}
      <div style={{
        position: "absolute", top: 0, right: 0, width: 80, height: 80,
        background: "radial-gradient(circle at top right, rgba(201,168,76,0.06), transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Category badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "4px 10px", borderRadius: 99,
          background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)",
          fontSize: "0.7rem", color: "var(--gold)", fontWeight: 600, letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}>
          {icon} {contact.category}
        </span>
        {contact.availability && (
          <span style={{
            fontSize: "0.68rem", color: "#555", letterSpacing: "0.04em",
          }}>
            🕐 {contact.availability}
          </span>
        )}
      </div>

      {/* Name & role */}
      <p style={{ fontWeight: 700, color: "#f0ece4", fontSize: "1.05rem", marginBottom: 2 }}>
        {contact.name}
      </p>
      <p style={{ color: "var(--gold)", fontSize: "0.82rem", fontWeight: 600, marginBottom: 8, letterSpacing: "0.03em" }}>
        {contact.role}
      </p>

      {contact.description && (
        <p style={{ color: "#666", fontSize: "0.8rem", marginBottom: 14, lineHeight: 1.5 }}>
          {contact.description}
        </p>
      )}

      {/* Phone & call */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
        <span style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "1.35rem", fontWeight: 700,
          color: "#c9a84c", letterSpacing: "0.04em",
        }}>
          {contact.phone}
        </span>
        <a
          href={`tel:${contact.phone}`}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 10,
            background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)",
            color: "var(--gold-light)", textDecoration: "none",
            fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: "0.82rem",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(201,168,76,0.2)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(201,168,76,0.1)";
          }}
        >
          📲 Call
        </a>
      </div>
    </div>
  );
}
