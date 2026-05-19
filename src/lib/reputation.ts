// ─── GokulHub Reputation System ───────────────────────────────────────────────
// Full reputation logic: levels, titles, badges, calculation, history, guards

export interface ReputationLevel {
  title: string;
  minScore: number;
  maxScore: number;
  color: string;
  glow: string;
  badge: string;
  tier: number;
}

export interface ReputationHistoryEntry {
  id?: string;
  delta: number;
  reason: string;
  source: "system" | "admin";
  adminId?: string;
  adminName?: string;
  timestamp: unknown;
  category: "positive" | "negative";
  eventKey?: string;
}

// ── Title levels (matches spec) ───────────────────────────────────────────────
export const REPUTATION_LEVELS: ReputationLevel[] = [
  { title: "Disturbed Resident", minScore: 0,   maxScore: 199,  color: "#ef4444", glow: "rgba(239,68,68,0.2)",     badge: "😤", tier: 0 },
  { title: "Unstable Resident",  minScore: 200,  maxScore: 399,  color: "#f97316", glow: "rgba(249,115,22,0.2)",    badge: "⚠️",  tier: 1 },
  { title: "Community Member",   minScore: 400,  maxScore: 599,  color: "#9ca3af", glow: "rgba(156,163,175,0.2)",   badge: "🏠",  tier: 2 },
  { title: "Trusted Resident",   minScore: 600,  maxScore: 799,  color: "#60a5fa", glow: "rgba(96,165,250,0.25)",   badge: "🛡️",  tier: 3 },
  { title: "Elite Resident",     minScore: 800,  maxScore: 1000, color: "#e8c96a", glow: "rgba(232,201,106,0.35)",  badge: "👑",  tier: 4 },
];

export function getSpecialTitle(data: Record<string, unknown>): string | null {
  const wins     = (data.tournamentWins as number) || 0;
  const streak   = (data.checkInStreak as number) || (data.streak as number) || 0;
  const polls    = (data.pollVotes as number) || 0;
  const repPts   = (data.reputationPoints as number) || 0;
  if (repPts >= 950) return "Legendary Resident";
  if (wins   >= 5)   return "Tournament Champion";
  if (streak >= 30)  return "Streak Master";
  if (polls  >= 20)  return "Voice of the Community";
  return null;
}

export const DEFAULT_REPUTATION_POINTS = 500;

export function computeReputationPoints(data: Record<string, unknown>): number {
  const pts = (data.reputationPoints as number) ?? DEFAULT_REPUTATION_POINTS;
  return Math.max(0, Math.min(1000, Math.round(pts)));
}

export function getReputationLevel(points: number): ReputationLevel {
  for (let i = REPUTATION_LEVELS.length - 1; i >= 0; i--) {
    if (points >= REPUTATION_LEVELS[i].minScore) return REPUTATION_LEVELS[i];
  }
  return REPUTATION_LEVELS[0];
}

export function getReputationProgress(points: number): number {
  const level = getReputationLevel(points);
  if (level.maxScore >= 1000) return 100;
  const range    = level.maxScore - level.minScore + 1;
  const progress = points - level.minScore;
  return Math.min(Math.round((progress / range) * 100), 100);
}

export const REPUTATION_EVENTS = {
  MAINTENANCE_PAID_ON_TIME:  { delta: +15, label: "Maintenance paid on time",        category: "positive" as const },
  SINKING_FUND_PAID_ON_TIME: { delta: +10, label: "Sinking fund paid on time",        category: "positive" as const },
  GAS_BILL_PAID_ON_TIME:     { delta: +8,  label: "Gas bill paid on time",            category: "positive" as const },
  POLL_PARTICIPATION:        { delta: +5,  label: "Poll participation",               category: "positive" as const },
  EVENT_PARTICIPATION:       { delta: +6,  label: "Event participation",              category: "positive" as const },
  CHALLENGE_COMPLETED:       { delta: +10, label: "Monthly challenge completed",       category: "positive" as const },
  TOURNAMENT_PARTICIPATION:  { delta: +8,  label: "Tournament participation",         category: "positive" as const },
  TOURNAMENT_WIN:            { delta: +20, label: "Tournament victory",               category: "positive" as const },
  FLOOR_WAR_CONTRIBUTION:    { delta: +8,  label: "Floor war contribution",           category: "positive" as const },
  DAILY_CHECKIN:             { delta: +2,  label: "Daily check-in",                   category: "positive" as const },
  STREAK_MILESTONE:          { delta: +10, label: "Streak milestone",                 category: "positive" as const },
  ACCOLADE_EARNED:           { delta: +5,  label: "Accolade earned",                  category: "positive" as const },
  SECRET_FOUND:              { delta: +8,  label: "Secret discovery",                 category: "positive" as const },
  COMPLAINT_RESOLVED:        { delta: +10, label: "Complaint successfully resolved",  category: "positive" as const },
  VALID_COMPLAINT:           { delta: +5,  label: "Valid complaint contribution",      category: "positive" as const },
  ADMIN_APPRECIATION:        { delta: +20, label: "Admin appreciation reward",        category: "positive" as const },
  ADMIN_FEATURED:            { delta: +15, label: "Featured resident selection",      category: "positive" as const },
  MAINTENANCE_LATE:          { delta: -15, label: "Late maintenance payment",         category: "negative" as const },
  MAINTENANCE_UNPAID:        { delta: -20, label: "Unpaid maintenance dues",          category: "negative" as const },
  SINKING_FUND_LATE:         { delta: -10, label: "Late sinking fund payment",        category: "negative" as const },
  GAS_BILL_LATE:             { delta: -8,  label: "Late gas bill payment",            category: "negative" as const },
  FAKE_COMPLAINT:            { delta: -10, label: "Fake complaint filed",             category: "negative" as const },
  ADMIN_WARNING:             { delta: -25, label: "Admin misconduct warning",         category: "negative" as const },
  REPEATED_REPORTS:          { delta: -15, label: "Repeated negative reports",        category: "negative" as const },
  INACTIVITY_PENALTY:        { delta: -5,  label: "Inactivity penalty",               category: "negative" as const },
  COMPLAINT_AGAINST:         { delta: -5,  label: "Complaint filed against you",      category: "negative" as const },
} as const;

export type ReputationEventKey = keyof typeof REPUTATION_EVENTS;
