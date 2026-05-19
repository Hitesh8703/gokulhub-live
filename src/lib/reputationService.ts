// ─── GokulHub Reputation Service ───────────────────────────────────────────────
// Centralised automation helpers for all reputation mutations in the app.
// Import these functions instead of writing inline Firestore reputation logic.

import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  DEFAULT_REPUTATION_POINTS,
  REPUTATION_EVENTS,
  ReputationHistoryEntry,
  ReputationEventKey,
} from "@/lib/reputation";

// ── Re-export types so callers only need one import ──────────────────────────
export type { ReputationHistoryEntry, ReputationEventKey };

// ── Internal helper ───────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ── Core: createReputationHistoryEntry ────────────────────────────────────────
/**
 * Writes a single entry to a resident's `reputationHistory` sub-collection.
 * Does NOT update `reputationPoints` on the resident document.
 * Use `applyReputationChange` when you want both.
 */
export async function createReputationHistoryEntry(
  residentId: string,
  entry: Omit<ReputationHistoryEntry, "timestamp">
): Promise<void> {
  await addDoc(
    collection(db, "residents", residentId, "reputationHistory"),
    {
      ...entry,
      timestamp: serverTimestamp(),
    }
  );
}

// ── Core: applyReputationChange ───────────────────────────────────────────────
/**
 * Generic reputation mutation.
 * - Reads the resident's current `reputationPoints` from Firestore.
 * - Clamps the delta to [-500, +500].
 * - Clamps the final score to [0, 1000].
 * - Writes the updated score back.
 * - Creates a history entry.
 *
 * Returns the new reputation score.
 */
export async function applyReputationChange(
  residentId: string,
  delta: number,
  entry: Omit<ReputationHistoryEntry, "timestamp" | "delta">
): Promise<number> {
  const clampedDelta = clamp(delta, -500, 500);

  const resSnap = await getDoc(doc(db, "residents", residentId));
  if (!resSnap.exists()) {
    throw new Error(`Resident ${residentId} not found`);
  }

  const data = resSnap.data() as Record<string, unknown>;
  const currentPts =
    typeof data.reputationPoints === "number"
      ? data.reputationPoints
      : DEFAULT_REPUTATION_POINTS;

  const newPts = clamp(currentPts + clampedDelta, 0, 1000);

  await updateDoc(doc(db, "residents", residentId), {
    reputationPoints: newPts,
  });

  await createReputationHistoryEntry(residentId, {
    ...entry,
    delta: clampedDelta,
  });

  return newPts;
}

// ── Automation: rewardPollParticipation ───────────────────────────────────────
/**
 * Awards reputation when a resident votes in a poll.
 * Uses the POLL_PARTICIPATION event (+5 pts).
 */
export async function rewardPollParticipation(
  residentId: string
): Promise<number> {
  const event = REPUTATION_EVENTS.POLL_PARTICIPATION;
  return applyReputationChange(residentId, event.delta, {
    reason: event.label,
    source: "system",
    category: event.category,
    eventKey: "POLL_PARTICIPATION" satisfies ReputationEventKey,
  });
}

// ── Automation: rewardMaintenancePayment ──────────────────────────────────────
/**
 * Awards reputation when maintenance dues are paid on time.
 * Uses the MAINTENANCE_PAID_ON_TIME event (+15 pts).
 */
export async function rewardMaintenancePayment(
  residentId: string
): Promise<number> {
  const event = REPUTATION_EVENTS.MAINTENANCE_PAID_ON_TIME;
  return applyReputationChange(residentId, event.delta, {
    reason: event.label,
    source: "system",
    category: event.category,
    eventKey: "MAINTENANCE_PAID_ON_TIME" satisfies ReputationEventKey,
  });
}

// ── Automation: rewardSinkingFundPayment ──────────────────────────────────────
/**
 * Awards reputation when the sinking fund contribution is paid on time.
 * Uses the SINKING_FUND_PAID_ON_TIME event (+10 pts).
 */
export async function rewardSinkingFundPayment(
  residentId: string
): Promise<number> {
  const event = REPUTATION_EVENTS.SINKING_FUND_PAID_ON_TIME;
  return applyReputationChange(residentId, event.delta, {
    reason: event.label,
    source: "system",
    category: event.category,
    eventKey: "SINKING_FUND_PAID_ON_TIME" satisfies ReputationEventKey,
  });
}

// ── Automation: rewardGasPayment ──────────────────────────────────────────────
/**
 * Awards reputation when a gas bill is paid on time.
 * Uses the GAS_BILL_PAID_ON_TIME event (+8 pts).
 */
export async function rewardGasPayment(residentId: string): Promise<number> {
  const event = REPUTATION_EVENTS.GAS_BILL_PAID_ON_TIME;
  return applyReputationChange(residentId, event.delta, {
    reason: event.label,
    source: "system",
    category: event.category,
    eventKey: "GAS_BILL_PAID_ON_TIME" satisfies ReputationEventKey,
  });
}

// ── Automation: penaliseLateMaintenancePayment ────────────────────────────────
/**
 * Deducts reputation for a late maintenance payment.
 * Uses the MAINTENANCE_LATE event (-15 pts).
 */
export async function penaliseLateMaintenancePayment(
  residentId: string
): Promise<number> {
  const event = REPUTATION_EVENTS.MAINTENANCE_LATE;
  return applyReputationChange(residentId, event.delta, {
    reason: event.label,
    source: "system",
    category: event.category,
    eventKey: "MAINTENANCE_LATE" satisfies ReputationEventKey,
  });
}

// ── Automation: penaliseUnpaidMaintenance ─────────────────────────────────────
/**
 * Deducts reputation for unpaid maintenance dues.
 * Uses the MAINTENANCE_UNPAID event (-20 pts).
 */
export async function penaliseUnpaidMaintenance(
  residentId: string
): Promise<number> {
  const event = REPUTATION_EVENTS.MAINTENANCE_UNPAID;
  return applyReputationChange(residentId, event.delta, {
    reason: event.label,
    source: "system",
    category: event.category,
    eventKey: "MAINTENANCE_UNPAID" satisfies ReputationEventKey,
  });
}

// ── Automation: rewardEventParticipation ─────────────────────────────────────
/**
 * Awards reputation for participating in a community event.
 * Uses the EVENT_PARTICIPATION event (+6 pts).
 */
export async function rewardEventParticipation(
  residentId: string
): Promise<number> {
  const event = REPUTATION_EVENTS.EVENT_PARTICIPATION;
  return applyReputationChange(residentId, event.delta, {
    reason: event.label,
    source: "system",
    category: event.category,
    eventKey: "EVENT_PARTICIPATION" satisfies ReputationEventKey,
  });
}

// ── Automation: rewardChallengeCompleted ──────────────────────────────────────
/**
 * Awards reputation for completing a monthly challenge.
 * Uses the CHALLENGE_COMPLETED event (+10 pts).
 */
export async function rewardChallengeCompleted(
  residentId: string
): Promise<number> {
  const event = REPUTATION_EVENTS.CHALLENGE_COMPLETED;
  return applyReputationChange(residentId, event.delta, {
    reason: event.label,
    source: "system",
    category: event.category,
    eventKey: "CHALLENGE_COMPLETED" satisfies ReputationEventKey,
  });
}

// ── Automation: rewardDailyCheckin ────────────────────────────────────────────
/**
 * Awards reputation for a daily check-in.
 * Uses the DAILY_CHECKIN event (+2 pts).
 */
export async function rewardDailyCheckin(residentId: string): Promise<number> {
  const event = REPUTATION_EVENTS.DAILY_CHECKIN;
  return applyReputationChange(residentId, event.delta, {
    reason: event.label,
    source: "system",
    category: event.category,
    eventKey: "DAILY_CHECKIN" satisfies ReputationEventKey,
  });
}

// ── Automation: rewardStreakMilestone ─────────────────────────────────────────
/**
 * Awards reputation for reaching a streak milestone.
 * Uses the STREAK_MILESTONE event (+10 pts).
 */
export async function rewardStreakMilestone(
  residentId: string
): Promise<number> {
  const event = REPUTATION_EVENTS.STREAK_MILESTONE;
  return applyReputationChange(residentId, event.delta, {
    reason: event.label,
    source: "system",
    category: event.category,
    eventKey: "STREAK_MILESTONE" satisfies ReputationEventKey,
  });
}

// ── Admin helper: applyAdminReputationChange ──────────────────────────────────
/**
 * Admin-initiated reputation change. Attaches admin identity to the history entry.
 * `repType` maps to "appreciation" | "warning" | "custom".
 */
export async function applyAdminReputationChange(
  residentId: string,
  delta: number,
  reason: string,
  repType: "appreciation" | "warning" | "custom",
  adminId: string,
  adminName: string
): Promise<number> {
  const clampedDelta = clamp(delta, -500, 500);
  const eventKey: string =
    repType === "appreciation"
      ? "ADMIN_APPRECIATION"
      : repType === "warning"
      ? "ADMIN_WARNING"
      : "ADMIN_CUSTOM";

  const resSnap = await getDoc(doc(db, "residents", residentId));
  if (!resSnap.exists()) {
    throw new Error(`Resident ${residentId} not found`);
  }

  const data = resSnap.data() as Record<string, unknown>;
  const currentPts =
    typeof data.reputationPoints === "number"
      ? data.reputationPoints
      : DEFAULT_REPUTATION_POINTS;

  const newPts = clamp(currentPts + clampedDelta, 0, 1000);

  await updateDoc(doc(db, "residents", residentId), {
    reputationPoints: newPts,
  });

  await createReputationHistoryEntry(residentId, {
    delta: clampedDelta,
    reason: reason.trim(),
    source: "admin",
    adminId,
    adminName,
    category: clampedDelta > 0 ? "positive" : "negative",
    eventKey,
  });

  return newPts;
}
