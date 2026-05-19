// ─── GokulHub Arena System ────────────────────────────────────────────────────
// Phase 1 — Foundation types, constants, and helpers

// ── Floor War Types ───────────────────────────────────────────────────────────

export interface FloorWarEntry {
  floor: number;
  label: string;
  totalPoints: number;
  reputationPoints: number;
  residentCount: number;
  mvpName: string;
  mvpApt: string;
  mvpXP: number;
  weeklyDelta: number;
}

export interface FloorWarWeek {
  id?: string;
  weekLabel: string;
  startDate: string;
  endDate: string;
  winningFloor: number;
  floors: FloorWarEntry[];
  active: boolean;
}

// ── War Mission Types ─────────────────────────────────────────────────────────

export type MissionType = "community" | "hidden" | "competitive";
export type MissionDifficulty = "easy" | "medium" | "hard" | "legendary";

export interface WarMission {
  id?: string;
  title: string;
  description: string;
  type: MissionType;
  difficulty: MissionDifficulty;
  warXP: number;
  tournamentXP: number;
  floorPoints: number;
  icon: string;
  weekId: string;
  active: boolean;
  requiredAction?: string;
}

export interface MissionProgress {
  id?: string;
  missionId: string;
  residentId: string;
  completed: boolean;
  completedAt?: unknown;
  warXPEarned: number;
  tournamentXPEarned: number;
}

// ── Tournament Types ──────────────────────────────────────────────────────────

export type TournamentRound = "quarterfinal" | "semifinal" | "final";
export type TournamentStatus = "upcoming" | "active" | "completed";

export interface TournamentParticipant {
  residentId: string;
  residentName: string;
  apartmentNumber: string;
  floor: number;
  tournamentXP: number;
  seed: number;
}

export interface TournamentMatch {
  matchId: string;
  round: TournamentRound;
  player1: TournamentParticipant | null;
  player2: TournamentParticipant | null;
  winnerId?: string;
  completed: boolean;
}

export interface Tournament {
  id?: string;
  weekLabel: string;
  status: TournamentStatus;
  startDate: string;
  endDate: string;
  participants: TournamentParticipant[];
  matches: TournamentMatch[];
  winner?: TournamentParticipant;
}

// ── Arena Stats Types ─────────────────────────────────────────────────────────

export interface ArenaStats {
  residentId: string;
  arenaRank: number;
  tournamentWins: number;
  floorWarWins: number;
  currentTournamentXP: number;
  totalWarXP: number;
  arenaBadges: string[];
  arenaStreak: number;
  missionsCompleted: number;
  lastUpdated?: unknown;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const FLOOR_CONFIG: Record<number, { label: string; color: string; glow: string; icon: string }> = {
  0: { label: "Ground Floor",  color: "#60a5fa", glow: "rgba(96,165,250,0.3)",  icon: "🌊" },
  1: { label: "First Floor",   color: "#34d399", glow: "rgba(52,211,153,0.3)",  icon: "🌿" },
  2: { label: "Second Floor",  color: "#f97316", glow: "rgba(249,115,22,0.3)",  icon: "🔥" },
  3: { label: "Third Floor",   color: "#a78bfa", glow: "rgba(167,139,250,0.3)", icon: "⚡" },
  4: { label: "Fourth Floor",  color: "#fb7185", glow: "rgba(251,113,133,0.3)", icon: "💎" },
  5: { label: "Fifth Floor",   color: "#fbbf24", glow: "rgba(251,191,36,0.3)",  icon: "👑" },
  6: { label: "Sixth Floor",   color: "#e879f9", glow: "rgba(232,121,249,0.3)", icon: "🌙" },
  7: { label: "Seventh Floor", color: "#38bdf8", glow: "rgba(56,189,248,0.3)",  icon: "🌀" },
  8: { label: "Eighth Floor",  color: "#4ade80", glow: "rgba(74,222,128,0.3)",  icon: "🍀" },
  9: { label: "Ninth Floor",   color: "#f43f5e", glow: "rgba(244,63,94,0.3)",   icon: "🔮" },
};

export const MISSION_DIFFICULTY_META: Record<MissionDifficulty, { label: string; color: string; bg: string }> = {
  easy:      { label: "Easy",      color: "#4ade80", bg: "rgba(74,222,128,0.1)"  },
  medium:    { label: "Medium",    color: "#fbbf24", bg: "rgba(251,191,36,0.1)"  },
  hard:      { label: "Hard",      color: "#f97316", bg: "rgba(249,115,22,0.1)"  },
  legendary: { label: "Legendary", color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
};

export const ARENA_BADGES: Record<string, { label: string; icon: string; color: string }> = {
  first_blood:     { label: "First Blood",     icon: "🩸", color: "#ef4444" },
  floor_champion:  { label: "Floor Champion",  icon: "🏆", color: "#c9a84c" },
  mission_master:  { label: "Mission Master",  icon: "🎯", color: "#60a5fa" },
  war_veteran:     { label: "War Veteran",     icon: "⚔️",  color: "#f97316" },
  tournament_king: { label: "Tournament King", icon: "👑", color: "#fbbf24" },
  secret_hunter:   { label: "Secret Hunter",  icon: "🔍", color: "#a78bfa" },
  arena_legend:    { label: "Arena Legend",   icon: "🌟", color: "#e8c96a" },
};

// ── Sample seed data (used when Firestore is empty) ───────────────────────────

export const SEED_FLOOR_WAR: FloorWarEntry[] = [
  { floor: 3, label: "Third Floor",   totalPoints: 1840, reputationPoints: 2340, residentCount: 8,  mvpName: "Arjun Kumar",  mvpApt: "301", mvpXP: 3200, weeklyDelta: +120 },
  { floor: 0, label: "Ground Floor",  totalPoints: 1720, reputationPoints: 2100, residentCount: 10, mvpName: "Priya Nair",   mvpApt: "001", mvpXP: 2900, weeklyDelta: +85  },
  { floor: 5, label: "Fifth Floor",   totalPoints: 1560, reputationPoints: 1980, residentCount: 7,  mvpName: "Rahul Mehta",  mvpApt: "502", mvpXP: 2750, weeklyDelta: +60  },
  { floor: 2, label: "Second Floor",  totalPoints: 1440, reputationPoints: 1860, residentCount: 9,  mvpName: "Sunita Rao",   mvpApt: "205", mvpXP: 2600, weeklyDelta: -20  },
  { floor: 6, label: "Sixth Floor",   totalPoints: 1380, reputationPoints: 1740, residentCount: 6,  mvpName: "Dev Sharma",   mvpApt: "601", mvpXP: 2400, weeklyDelta: +40  },
  { floor: 4, label: "Fourth Floor",  totalPoints: 1260, reputationPoints: 1580, residentCount: 8,  mvpName: "Kavya Menon",  mvpApt: "403", mvpXP: 2200, weeklyDelta: -45  },
];

export const SEED_MISSIONS: Omit<WarMission, "id" | "weekId">[] = [
  { title: "Civic Voice",        description: "Vote in any active community poll",          type: "community",   difficulty: "easy",      warXP: 20,  tournamentXP: 10,  floorPoints: 5,  icon: "📊", active: true  },
  { title: "Check-In Champion",  description: "Complete your daily check-in streak",        type: "community",   difficulty: "easy",      warXP: 15,  tournamentXP: 8,   floorPoints: 4,  icon: "📅", active: true  },
  { title: "Challenge Warrior",  description: "Make progress on the monthly challenge",     type: "community",   difficulty: "medium",    warXP: 40,  tournamentXP: 20,  floorPoints: 10, icon: "⚡", active: true  },
  { title: "Symbol Seeker",      description: "Find the hidden ⚔️ arena symbol on the app",  type: "hidden",      difficulty: "hard",      warXP: 80,  tournamentXP: 40,  floorPoints: 20, icon: "🔍", active: true  },
  { title: "Daily Hunt",         description: "Discover today's secret mission location",   type: "hidden",      difficulty: "legendary", warXP: 120, tournamentXP: 60,  floorPoints: 30, icon: "🗺️", active: true  },
  { title: "Floor Dominator",    description: "Be your floor's top XP earner this week",   type: "competitive", difficulty: "hard",      warXP: 100, tournamentXP: 50,  floorPoints: 25, icon: "🏆", active: true  },
  { title: "MVP Bonus",          description: "Earn the Floor MVP title in Floor Wars",     type: "competitive", difficulty: "legendary", warXP: 150, tournamentXP: 75,  floorPoints: 40, icon: "👑", active: true  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getFloorFromApartment(aptNumber: string | number): number {
  const apt = String(aptNumber);
  const firstDigit = parseInt(apt[0]);
  return isNaN(firstDigit) ? 1 : firstDigit;
}

export function getArenaRankLabel(rank: number): string {
  if (rank === 1) return "Arena Champion";
  if (rank <= 3)  return "Elite Fighter";
  if (rank <= 10) return "Veteran";
  if (rank <= 25) return "Warrior";
  return "Recruit";
}

export function getCurrentWeekLabel(): string {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}
