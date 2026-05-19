"use client";
import { useState, useEffect, useCallback } from "react";
import {
  doc, getDoc, updateDoc, arrayUnion,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { applyReputationChange } from "@/lib/reputationService";

// ─── Data ──────────────────────────────────────────────────────────────────

const WASTE_CATEGORIES = [
  {
    id: "wet",
    name: "Wet Waste",
    color: "#22c55e",
    glow: "rgba(34,197,94,0.35)",
    bg: "rgba(34,197,94,0.08)",
    border: "rgba(34,197,94,0.3)",
    icon: "🟢",
    bin: "🪣",
    binColor: "#22c55e",
    examples: [
      "Food leftovers",
      "Vegetable peels",
      "Fruit waste",
      "Tea powder",
      "Flowers",
      "Egg shells",
      "Coffee grounds",
    ],
    disposal: "Place in the GREEN bin. Will be composted.",
    tip: "Drain excess water before disposal to reduce odour.",
  },
  {
    id: "dry",
    name: "Dry Waste",
    color: "#3b82f6",
    glow: "rgba(59,130,246,0.35)",
    bg: "rgba(59,130,246,0.08)",
    border: "rgba(59,130,246,0.3)",
    icon: "🔵",
    bin: "📦",
    binColor: "#3b82f6",
    examples: [
      "Paper",
      "Cardboard",
      "Clean plastic",
      "Metal cans",
      "Glass bottles",
      "Newspapers",
      "Tetra packs",
    ],
    disposal: "Place in the BLUE bin. Will be recycled.",
    tip: "Rinse containers before placing. Flatten cardboard to save space.",
  },
  {
    id: "ewaste",
    name: "E-Waste",
    color: "#eab308",
    glow: "rgba(234,179,8,0.35)",
    bg: "rgba(234,179,8,0.08)",
    border: "rgba(234,179,8,0.3)",
    icon: "🟡",
    bin: "💻",
    binColor: "#eab308",
    examples: [
      "Batteries",
      "Chargers",
      "Wires",
      "Phones",
      "Keyboards",
      "Laptops",
      "Remote controls",
    ],
    disposal: "Place in the YELLOW e-waste bin or authorised collection point.",
    tip: "Never dispose e-waste in regular bins — it contains toxic heavy metals.",
  },
  {
    id: "hazardous",
    name: "Hazardous Waste",
    color: "#ef4444",
    glow: "rgba(239,68,68,0.35)",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.3)",
    icon: "🔴",
    bin: "⚠️",
    binColor: "#ef4444",
    examples: [
      "Paint",
      "Medicines",
      "Chemicals",
      "Sanitary waste",
      "Tube lights",
      "Pesticides",
      "Motor oil",
    ],
    disposal: "Use the RED hazardous waste bin or special collection drives.",
    tip: "Keep original containers. NEVER mix hazardous waste with other categories.",
  },
];

const CONFUSING_ITEMS: Array<{
  item: string;
  emoji: string;
  category: string;
  categoryColor: string;
  instructions: string;
  guidance: string;
}> = [
  {
    item: "Coconut Shell",
    emoji: "🥥",
    category: "Wet Waste",
    categoryColor: "#22c55e",
    instructions: "Green bin — breaks down naturally",
    guidance: "Though hard, it is organic and biodegradable. Goes with wet waste.",
  },
  {
    item: "Soil / Mud",
    emoji: "🌱",
    category: "Wet Waste",
    categoryColor: "#22c55e",
    instructions: "Green bin or garden compost",
    guidance: "Clean soil is inert organic matter. Use for composting or return to garden.",
  },
  {
    item: "Broken Glass",
    emoji: "🪟",
    category: "Hazardous / Dry",
    categoryColor: "#ef4444",
    instructions: "Wrap in newspaper, place in dry bin",
    guidance: "Broken glass is sharp — wrap safely before disposal. Not recyclable if mixed.",
  },
  {
    item: "Pizza Box",
    emoji: "🍕",
    category: "Wet Waste (if oily)",
    categoryColor: "#22c55e",
    instructions: "Wet bin if soiled, dry bin if clean",
    guidance: "Greasy boxes can't be recycled — they contaminate paper. Clean parts can go in blue.",
  },
  {
    item: "Oily Paper Plate",
    emoji: "🧻",
    category: "Wet Waste",
    categoryColor: "#22c55e",
    instructions: "Green bin — too soiled to recycle",
    guidance: "Paper soaked in food/oil cannot be recycled and goes with organic waste.",
  },
  {
    item: "Batteries",
    emoji: "🔋",
    category: "E-Waste",
    categoryColor: "#eab308",
    instructions: "Yellow e-waste bin only",
    guidance: "Batteries contain lead, mercury, cadmium. NEVER in regular bins. Use e-waste drop-off.",
  },
  {
    item: "Thermocol",
    emoji: "📦",
    category: "Dry Waste (check locally)",
    categoryColor: "#3b82f6",
    instructions: "Blue bin — but check with facility",
    guidance: "Most facilities don't recycle thermocol. Reuse where possible; confirm with local plant.",
  },
  {
    item: "Sanitary Pads",
    emoji: "🩺",
    category: "Hazardous Waste",
    categoryColor: "#ef4444",
    instructions: "Red bin — wrap securely",
    guidance: "Biohazardous — must be wrapped in newspaper/plastic before disposal in red bin.",
  },
  {
    item: "Hair / Nail Clippings",
    emoji: "✂️",
    category: "Wet Waste",
    categoryColor: "#22c55e",
    instructions: "Green bin — biodegradable",
    guidance: "Hair and nail clippings are organic and compostable. Goes in the green bin.",
  },
  {
    item: "Old Electronics",
    emoji: "📱",
    category: "E-Waste",
    categoryColor: "#eab308",
    instructions: "E-waste collection drive or yellow bin",
    guidance: "Electronics have toxic components. Use manufacturer take-back or e-waste centres.",
  },
  {
    item: "Medicine Strips",
    emoji: "💊",
    category: "Hazardous Waste",
    categoryColor: "#ef4444",
    instructions: "Red bin or pharmacy return",
    guidance: "Expired medicines pollute soil and water. Return to pharmacy or use hazardous bin.",
  },
  {
    item: "Styrofoam Cup",
    emoji: "☕",
    category: "Dry Waste",
    categoryColor: "#3b82f6",
    instructions: "Blue bin if clean",
    guidance: "Not recyclable in most plants. Minimise use. Clean cups go in dry waste.",
  },
];

const ECO_CARDS = [
  {
    id: "eco1",
    title: "Did You Know?",
    fact: "Improper segregation sends 40% more waste to landfills, accelerating methane production and climate change.",
    emoji: "🌍",
    xp: 5,
  },
  {
    id: "eco2",
    title: "Composting Power",
    fact: "1 kg of food waste can produce 300g of compost that enriches soil naturally — no chemicals needed!",
    emoji: "♻️",
    xp: 5,
  },
  {
    id: "eco3",
    title: "E-Waste Crisis",
    fact: "Only 20% of global e-waste is formally recycled. The rest leaches lead and mercury into our groundwater.",
    emoji: "⚡",
    xp: 5,
  },
  {
    id: "eco4",
    title: "Plastic Reality",
    fact: "A single plastic bottle takes 450 years to decompose. Rinse and recycle every bottle you can!",
    emoji: "🧴",
    xp: 5,
  },
  {
    id: "eco5",
    title: "Wet Waste Gold",
    fact: "India generates 62 million tonnes of waste annually. 50% is organic — and can be converted to biogas or compost.",
    emoji: "🌱",
    xp: 5,
  },
  {
    id: "eco6",
    title: "Zero Waste Hero",
    fact: "Japan recycles over 84% of its waste. Residents sort waste into 10+ categories. Small habits, massive impact.",
    emoji: "🏆",
    xp: 5,
  },
];

const QUIZZES: Array<{
  id: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  xp: number;
}> = [
  {
    id: "q1",
    question: "Where should batteries be disposed?",
    options: ["Green bin", "Blue bin", "Yellow e-waste bin", "Red bin"],
    correct: 2,
    explanation: "Batteries contain toxic metals like lead and cadmium. Always use the yellow e-waste bin or authorised drop-off points.",
    xp: 10,
  },
  {
    id: "q2",
    question: "Which bin does a coconut shell go into?",
    options: ["Blue bin", "Red bin", "Green bin", "Yellow bin"],
    correct: 2,
    explanation: "Coconut shells are organic and biodegradable. They go in the GREEN (wet waste) bin for composting.",
    xp: 10,
  },
  {
    id: "q3",
    question: "A greasy pizza box should go in which bin?",
    options: ["Blue (dry)", "Green (wet)", "Red (hazardous)", "Yellow (e-waste)"],
    correct: 1,
    explanation: "Greasy food-soiled cardboard cannot be recycled. It goes in the GREEN (wet waste) bin.",
    xp: 10,
  },
  {
    id: "q4",
    question: "Which waste type is sanitary waste classified as?",
    options: ["Wet waste", "Dry waste", "E-waste", "Hazardous waste"],
    correct: 3,
    explanation: "Sanitary waste is biohazardous. Wrap securely and place in the RED hazardous waste bin.",
    xp: 10,
  },
  {
    id: "q5",
    question: "Old smartphones should be placed in which bin?",
    options: ["Blue bin", "Green bin", "Yellow e-waste bin", "Red bin"],
    correct: 2,
    explanation: "Smartphones contain toxic components. Use the yellow e-waste bin or manufacturer take-back programs.",
    xp: 10,
  },
  {
    id: "q6",
    question: "Expired medicines should be disposed in:",
    options: ["Green bin", "Blue bin", "Red hazardous bin", "Any bin"],
    correct: 2,
    explanation: "Medicines can contaminate soil and water. Return to pharmacy or use the RED hazardous waste bin.",
    xp: 10,
  },
];

// ─── Props ─────────────────────────────────────────────────────────────────
interface WasteInfoGuideProps {
  userId: string;
  residentData: Record<string, unknown>;
  onXpEarned: (xp: number) => void;
  onClose: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────
export default function WasteInfoGuide({
  userId, residentData, onXpEarned, onClose,
}: WasteInfoGuideProps) {
  const [activeTab, setActiveTab] = useState<"categories" | "confusing" | "search" | "learn" | "quiz">("categories");
  const [searchQuery, setSearchQuery] = useState("");
  const [ecoCardIndex, setEcoCardIndex] = useState(0);
  const [viewedCards, setViewedCards] = useState<string[]>([]);
  const [completedQuizzes, setCompletedQuizzes] = useState<string[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number | null>>({});
  const [quizFeedback, setQuizFeedback] = useState<Record<string, "correct" | "wrong" | null>>({});
  const [xpToast, setXpToast] = useState<{ amount: number; visible: boolean }>({ amount: 0, visible: false });

  // ── Load Firebase state ─────────────────────────────────────────────────
  useEffect(() => {
    const viewed = (residentData.viewedEcoCards as string[]) || [];
    const quizzes = (residentData.completedWasteQuizzes as string[]) || [];
    setViewedCards(viewed);
    setCompletedQuizzes(quizzes);
  }, [residentData]);

  // ── XP Toast ────────────────────────────────────────────────────────────
  const showXpToast = useCallback((amount: number) => {
    setXpToast({ amount, visible: true });
    setTimeout(() => setXpToast({ amount, visible: false }), 2500);
  }, []);

  // ── Eco card viewed ─────────────────────────────────────────────────────
  async function handleEcoCardViewed(cardId: string) {
    if (viewedCards.includes(cardId)) return;
    const card = ECO_CARDS.find((c) => c.id === cardId);
    if (!card) return;
    const newXp = (residentData.xp as number || 0) + card.xp;
    const newLevel = Math.floor(newXp / 200) + 1;
    await updateDoc(doc(db, "residents", userId), {
      xp: newXp,
      level: newLevel,
      viewedEcoCards: arrayUnion(cardId),
    });
    await applyReputationChange(userId, 2, {
      reason: "Eco awareness card read",
      source: "system",
      category: "positive",
      eventKey: "DAILY_CHECKIN",
    });
    setViewedCards((prev) => [...prev, cardId]);
    onXpEarned(card.xp);
    showXpToast(card.xp);
  }

  // ── Quiz answer ─────────────────────────────────────────────────────────
  async function handleQuizAnswer(quizId: string, optionIndex: number) {
    if (quizAnswers[quizId] !== undefined) return;
    const quiz = QUIZZES.find((q) => q.id === quizId);
    if (!quiz) return;
    const isCorrect = optionIndex === quiz.correct;
    setQuizAnswers((prev) => ({ ...prev, [quizId]: optionIndex }));
    setQuizFeedback((prev) => ({ ...prev, [quizId]: isCorrect ? "correct" : "wrong" }));

    if (isCorrect && !completedQuizzes.includes(quizId)) {
      const newXp = (residentData.xp as number || 0) + quiz.xp;
      const newLevel = Math.floor(newXp / 200) + 1;
      await updateDoc(doc(db, "residents", userId), {
        xp: newXp,
        level: newLevel,
        completedWasteQuizzes: arrayUnion(quizId),
      });
      await applyReputationChange(userId, 3, {
        reason: "Waste segregation quiz correct",
        source: "system",
        category: "positive",
        eventKey: "POLL_PARTICIPATION",
      });
      setCompletedQuizzes((prev) => [...prev, quizId]);
      onXpEarned(quiz.xp);
      showXpToast(quiz.xp);
    }
  }

  // ── Search results ──────────────────────────────────────────────────────
  const searchResults = searchQuery.trim().length < 2
    ? []
    : (() => {
        const q = searchQuery.toLowerCase();
        const results: Array<{ name: string; category: string; color: string; disposal: string; emoji?: string }> = [];

        // Search confusing items
        CONFUSING_ITEMS.forEach((item) => {
          if (item.item.toLowerCase().includes(q) || item.instructions.toLowerCase().includes(q)) {
            results.push({
              name: item.item,
              category: item.category,
              color: item.categoryColor,
              disposal: item.instructions,
              emoji: item.emoji,
            });
          }
        });

        // Search examples
        WASTE_CATEGORIES.forEach((cat) => {
          cat.examples.forEach((ex) => {
            if (ex.toLowerCase().includes(q)) {
              if (!results.find((r) => r.name.toLowerCase() === ex.toLowerCase())) {
                results.push({
                  name: ex,
                  category: cat.name,
                  color: cat.color,
                  disposal: cat.disposal,
                });
              }
            }
          });
        });

        return results.slice(0, 6);
      })();

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "20px 16px", overflowY: "auto",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* XP Toast */}
      {xpToast.visible && (
        <div style={{
          position: "fixed", top: 80, right: 20, zIndex: 2000,
          background: "linear-gradient(135deg, #22c55e, #16a34a)",
          color: "#fff", fontWeight: 700, fontSize: "1rem",
          padding: "12px 20px", borderRadius: 12,
          boxShadow: "0 4px 20px rgba(34,197,94,0.5)",
          animation: "fadeInUp 0.3s ease",
        }}>
          +{xpToast.amount} XP 🌿
        </div>
      )}

      <div style={{
        width: "100%", maxWidth: 680,
        background: "linear-gradient(145deg, #0e0e0e, #111)",
        border: "1px solid rgba(201,168,76,0.2)",
        borderRadius: 20, overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
        marginTop: 10, marginBottom: 40,
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(59,130,246,0.1), rgba(234,179,8,0.08))",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          padding: "24px 24px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f0ece4", fontFamily: "'Cormorant Garamond', serif" }}>
              ♻️ Waste Info Guide
            </div>
            <div style={{ fontSize: "0.8rem", color: "#777", marginTop: 2 }}>
              Learn · Segregate · Earn XP · Save the Planet
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#aaa", width: 36, height: 36, borderRadius: "50%",
              fontSize: "1.1rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s",
            }}
          >✕</button>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", overflowX: "auto", gap: 0,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          scrollbarWidth: "none",
        }}>
          {(["categories", "confusing", "search", "learn", "quiz"] as const).map((tab) => {
            const labels: Record<string, string> = {
              categories: "🗑 Bins",
              confusing: "🤔 Confusing",
              search: "🔍 Search",
              learn: "📚 Learn",
              quiz: "❓ Quiz",
            };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: "0 0 auto", padding: "12px 18px",
                  background: activeTab === tab ? "rgba(201,168,76,0.1)" : "transparent",
                  borderBottom: activeTab === tab ? "2px solid #c9a84c" : "2px solid transparent",
                  color: activeTab === tab ? "#e8c96a" : "#777",
                  fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", border: "none",
                  transition: "all 0.2s", whiteSpace: "nowrap",
                }}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ padding: 20 }}>

          {/* ── CATEGORIES TAB ── */}
          {activeTab === "categories" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontSize: "0.82rem", color: "#777", margin: 0 }}>
                Four colour-coded bins keep waste out of landfills. Here&apos;s what goes where:
              </p>
              {WASTE_CATEGORIES.map((cat) => (
                <div key={cat.id} style={{
                  background: cat.bg,
                  border: `1px solid ${cat.border}`,
                  borderRadius: 14, padding: 18,
                  boxShadow: `0 0 20px ${cat.glow}`,
                  transition: "all 0.3s",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: "50%",
                      background: cat.color, boxShadow: `0 0 8px ${cat.color}`,
                      flexShrink: 0,
                    }} />
                    <span style={{ fontWeight: 700, color: cat.color, fontSize: "1rem" }}>{cat.name}</span>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#aaa", marginBottom: 8, lineHeight: 1.5 }}>
                    <strong style={{ color: "#ccc" }}>Examples: </strong>
                    {cat.examples.join(", ")}
                  </div>
                  <div style={{
                    background: "rgba(0,0,0,0.25)", borderRadius: 8,
                    padding: "8px 12px", fontSize: "0.78rem", color: cat.color,
                  }}>
                    ✅ {cat.disposal}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#666", marginTop: 6 }}>
                    💡 {cat.tip}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── CONFUSING ITEMS TAB ── */}
          {activeTab === "confusing" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: "0.82rem", color: "#777", margin: 0 }}>
                These items confuse most people. Here&apos;s the correct guidance:
              </p>
              {CONFUSING_ITEMS.map((item) => (
                <div key={item.item} style={{
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 12, padding: 14,
                  display: "flex", gap: 12, alignItems: "flex-start",
                  transition: "all 0.25s",
                }}>
                  <span style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>{item.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, color: "#f0ece4", fontSize: "0.9rem" }}>{item.item}</span>
                      <span style={{
                        fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px",
                        borderRadius: 999, background: `${item.categoryColor}20`,
                        color: item.categoryColor, border: `1px solid ${item.categoryColor}40`,
                      }}>{item.category}</span>
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#22c55e", marginBottom: 4 }}>
                      📍 {item.instructions}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#777", lineHeight: 1.4 }}>
                      {item.guidance}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── SEARCH TAB ── */}
          {activeTab === "search" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ position: "relative" }}>
                <span style={{
                  position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                  fontSize: "1rem",
                }}>🔍</span>
                <input
                  type="text"
                  placeholder="Search an item... (e.g. coconut shell, battery)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%", padding: "14px 16px 14px 44px",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 12, color: "#f0ece4", fontSize: "0.9rem",
                    outline: "none", transition: "border-color 0.2s",
                  }}
                  autoFocus
                />
              </div>

              {searchQuery.trim().length > 0 && searchQuery.trim().length < 2 && (
                <p style={{ color: "#666", fontSize: "0.82rem", textAlign: "center" }}>
                  Type at least 2 characters to search…
                </p>
              )}

              {searchResults.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {searchResults.map((result, i) => (
                    <div key={i} style={{
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12, padding: 14,
                      borderLeft: `3px solid ${result.color}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        {result.emoji && <span style={{ fontSize: 18 }}>{result.emoji}</span>}
                        <span style={{ fontWeight: 600, color: "#f0ece4" }}>{result.name}</span>
                        <span style={{
                          fontSize: "0.7rem", padding: "2px 8px", borderRadius: 999,
                          background: `${result.color}20`, color: result.color,
                          border: `1px solid ${result.color}40`,
                        }}>{result.category}</span>
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#aaa" }}>
                        📍 {result.disposal}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <div style={{ textAlign: "center", color: "#555", padding: "24px 0" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🤷</div>
                  <div style={{ fontSize: "0.85rem" }}>No results found for &quot;{searchQuery}&quot;</div>
                  <div style={{ fontSize: "0.75rem", marginTop: 4 }}>Try: battery, coconut, glass, paper, medicine</div>
                </div>
              )}

              {searchQuery.trim().length === 0 && (
                <div>
                  <p style={{ fontSize: "0.8rem", color: "#666", margin: "0 0 12px" }}>Popular searches:</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {["battery", "coconut shell", "pizza box", "medicine", "broken glass", "hair"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setSearchQuery(s)}
                        style={{
                          padding: "6px 14px", borderRadius: 999,
                          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                          color: "#aaa", fontSize: "0.8rem", cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── LEARN TAB ── */}
          {activeTab === "learn" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontSize: "0.82rem", color: "#777", margin: 0 }}>
                Read each card to earn <strong style={{ color: "#22c55e" }}>+5 XP</strong> (once per card). Awareness is the first step to change.
              </p>

              {/* Nav arrows */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  onClick={() => setEcoCardIndex((i) => Math.max(0, i - 1))}
                  disabled={ecoCardIndex === 0}
                  style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                    color: ecoCardIndex === 0 ? "#333" : "#aaa", cursor: ecoCardIndex === 0 ? "not-allowed" : "pointer",
                    fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >‹</button>
                <span style={{ flex: 1, textAlign: "center", fontSize: "0.8rem", color: "#555" }}>
                  {ecoCardIndex + 1} / {ECO_CARDS.length}
                </span>
                <button
                  onClick={() => setEcoCardIndex((i) => Math.min(ECO_CARDS.length - 1, i + 1))}
                  disabled={ecoCardIndex === ECO_CARDS.length - 1}
                  style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                    color: ecoCardIndex === ECO_CARDS.length - 1 ? "#333" : "#aaa",
                    cursor: ecoCardIndex === ECO_CARDS.length - 1 ? "not-allowed" : "pointer",
                    fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >›</button>
              </div>

              {/* Eco card */}
              {ECO_CARDS.map((card, idx) => {
                if (idx !== ecoCardIndex) return null;
                const viewed = viewedCards.includes(card.id);
                return (
                  <div key={card.id} style={{
                    background: "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(59,130,246,0.08))",
                    border: `1px solid ${viewed ? "rgba(34,197,94,0.4)" : "rgba(34,197,94,0.15)"}`,
                    borderRadius: 16, padding: 24, textAlign: "center",
                    boxShadow: viewed ? "0 0 30px rgba(34,197,94,0.2)" : "none",
                    transition: "all 0.4s",
                  }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>{card.emoji}</div>
                    <div style={{
                      fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em",
                      textTransform: "uppercase", color: "#22c55e", marginBottom: 8,
                    }}>{card.title}</div>
                    <div style={{
                      fontSize: "1rem", color: "#e0ddd5", lineHeight: 1.6,
                      fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
                    }}>
                      &ldquo;{card.fact}&rdquo;
                    </div>
                    {viewed ? (
                      <div style={{
                        marginTop: 16, fontSize: "0.78rem", color: "#22c55e",
                        padding: "6px 16px", borderRadius: 999,
                        background: "rgba(34,197,94,0.1)", display: "inline-block",
                      }}>
                        ✅ Read • +{card.xp} XP earned
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEcoCardViewed(card.id)}
                        style={{
                          marginTop: 16,
                          background: "linear-gradient(135deg, #16a34a, #22c55e)",
                          color: "#fff", fontWeight: 600, fontSize: "0.85rem",
                          border: "none", borderRadius: 10, padding: "10px 22px",
                          cursor: "pointer", boxShadow: "0 4px 14px rgba(34,197,94,0.3)",
                          transition: "all 0.2s",
                        }}
                      >
                        Mark as Read · +{card.xp} XP 🌿
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Progress dots */}
              <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                {ECO_CARDS.map((c, i) => (
                  <div
                    key={c.id}
                    onClick={() => setEcoCardIndex(i)}
                    style={{
                      width: 8, height: 8, borderRadius: "50%", cursor: "pointer",
                      background: i === ecoCardIndex ? "#22c55e" : viewedCards.includes(c.id) ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.1)",
                      transition: "all 0.2s",
                    }}
                  />
                ))}
              </div>

              {viewedCards.length > 0 && (
                <div style={{
                  textAlign: "center", fontSize: "0.78rem", color: "#555",
                }}>
                  {viewedCards.length} / {ECO_CARDS.length} cards read
                  {viewedCards.length === ECO_CARDS.length && (
                    <span style={{ color: "#22c55e", marginLeft: 6 }}>🏆 All done!</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── QUIZ TAB ── */}
          {activeTab === "quiz" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontSize: "0.82rem", color: "#777", margin: 0 }}>
                Answer correctly to earn <strong style={{ color: "#e8c96a" }}>+10 XP</strong> per quiz (once each). Incorrect answers give no penalty.
              </p>
              <div style={{ fontSize: "0.78rem", color: "#555" }}>
                {completedQuizzes.length} / {QUIZZES.length} quizzes completed
              </div>

              {QUIZZES.map((quiz) => {
                const answered = quizAnswers[quiz.id] !== undefined;
                const feedback = quizFeedback[quiz.id];
                const alreadyDone = completedQuizzes.includes(quiz.id);

                return (
                  <div key={quiz.id} style={{
                    background: feedback === "correct"
                      ? "rgba(34,197,94,0.08)"
                      : feedback === "wrong"
                        ? "rgba(239,68,68,0.06)"
                        : "rgba(255,255,255,0.03)",
                    border: feedback === "correct"
                      ? "1px solid rgba(34,197,94,0.3)"
                      : feedback === "wrong"
                        ? "1px solid rgba(239,68,68,0.25)"
                        : "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 14, padding: 16,
                    transition: "all 0.3s",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontWeight: 600, color: "#e0ddd5", fontSize: "0.9rem", lineHeight: 1.4, flex: 1 }}>
                        {quiz.question}
                      </div>
                      {alreadyDone && (
                        <span style={{
                          fontSize: "0.7rem", padding: "2px 8px", borderRadius: 999,
                          background: "rgba(34,197,94,0.15)", color: "#22c55e",
                          border: "1px solid rgba(34,197,94,0.3)", flexShrink: 0,
                        }}>+{quiz.xp} XP ✓</span>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                      {quiz.options.map((option, i) => {
                        const isSelected = quizAnswers[quiz.id] === i;
                        const isCorrectOption = i === quiz.correct;
                        let bg = "rgba(255,255,255,0.04)";
                        let border = "rgba(255,255,255,0.1)";
                        let color = "#aaa";

                        if (answered) {
                          if (isCorrectOption) { bg = "rgba(34,197,94,0.15)"; border = "rgba(34,197,94,0.4)"; color = "#22c55e"; }
                          else if (isSelected) { bg = "rgba(239,68,68,0.12)"; border = "rgba(239,68,68,0.35)"; color = "#ef4444"; }
                        }

                        return (
                          <button
                            key={i}
                            onClick={() => handleQuizAnswer(quiz.id, i)}
                            disabled={answered}
                            style={{
                              textAlign: "left", padding: "10px 14px",
                              background: bg, border: `1px solid ${border}`,
                              borderRadius: 9, color, fontSize: "0.84rem",
                              cursor: answered ? "default" : "pointer",
                              transition: "all 0.25s", display: "flex", alignItems: "center", gap: 8,
                            }}
                          >
                            <span style={{
                              width: 22, height: 22, borderRadius: "50%",
                              background: answered && isCorrectOption ? "#22c55e" : answered && isSelected ? "#ef4444" : "rgba(255,255,255,0.08)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "0.7rem", fontWeight: 700, flexShrink: 0, color: answered ? "#fff" : "#666",
                            }}>
                              {answered && isCorrectOption ? "✓" : answered && isSelected && !isCorrectOption ? "✗" : String.fromCharCode(65 + i)}
                            </span>
                            {option}
                          </button>
                        );
                      })}
                    </div>

                    {answered && (
                      <div style={{
                        marginTop: 12, padding: "10px 14px",
                        background: feedback === "correct" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.08)",
                        borderRadius: 9, fontSize: "0.8rem",
                        color: feedback === "correct" ? "#22c55e" : "#ef4444",
                        lineHeight: 1.5,
                      }}>
                        {feedback === "correct"
                          ? `✅ Correct! ${alreadyDone ? "(XP already earned)" : `+${quiz.xp} XP awarded`}`
                          : "❌ Not quite — "}
                        {feedback === "wrong" && <span style={{ color: "#aaa" }}>{quiz.explanation}</span>}
                        {feedback === "correct" && <div style={{ color: "#888", marginTop: 4 }}>{quiz.explanation}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
