// ─── GokulHub Monthly Challenges System ─────────────────────────────────────

export type ChallengeType =
  | "daily_checkins"
  | "poll_participation"
  | "garbage_disposals"
  | "event_participation"
  | "complaint_resolutions"
  | "xp_milestone";

export interface Challenge {
  id: string;
  title: string;
  description: string;
  challengeType: ChallengeType;
  target: number;
  rewardXP: number;
  startDate: string; // ISO date string YYYY-MM-DD
  endDate: string;   // ISO date string YYYY-MM-DD
  active: boolean;
  createdAt?: any;
}

export interface ChallengeProgress {
  id?: string;
  challengeId: string;
  residentId: string;
  apartmentNumber: string;
  current: number;
  completed: boolean;
  rewardClaimed: boolean;
  updatedAt?: any;
}

export const CHALLENGE_TYPE_META: Record<ChallengeType, { label: string; icon: string; description: string }> = {
  daily_checkins: {
    label: "Daily Check-Ins",
    icon: "📅",
    description: "Complete daily check-ins",
  },
  poll_participation: {
    label: "Poll Participation",
    icon: "📊",
    description: "Vote in community polls",
  },
  garbage_disposals: {
    label: "Garbage Disposals",
    icon: "🗑",
    description: "Log daily garbage missions",
  },
  event_participation: {
    label: "Event Participation",
    icon: "🎉",
    description: "Participate in community events",
  },
  complaint_resolutions: {
    label: "Complaint Resolutions",
    icon: "✅",
    description: "Get complaints resolved",
  },
  xp_milestone: {
    label: "XP Milestone",
    icon: "⚡",
    description: "Reach an XP milestone",
  },
};

/**
 * Returns the resident's current stat value for a given challenge type.
 * Used to auto-sync progress when the resident opens the challenges page.
 */
export function getResidentStatForChallenge(
  challengeType: ChallengeType,
  residentData: any
): number {
  switch (challengeType) {
    case "daily_checkins":
      return residentData?.checkInStreak || 0;
    case "garbage_disposals":
      return residentData?.garbageCount || 0;
    case "poll_participation":
      return residentData?.pollVotes || 0;
    case "xp_milestone":
      return residentData?.xp || 0;
    case "event_participation":
      return residentData?.eventCount || 0;
    case "complaint_resolutions":
      return residentData?.resolvedComplaints || 0;
    default:
      return 0;
  }
}

export function getChallengeStatusLabel(challenge: Challenge): string {
  const now = new Date();
  const start = new Date(challenge.startDate);
  const end = new Date(challenge.endDate);
  if (!challenge.active) return "Inactive";
  if (now < start) return "Upcoming";
  if (now > end) return "Ended";
  return "Active";
}

export function getDaysRemaining(endDate: string): number {
  const end = new Date(endDate);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
