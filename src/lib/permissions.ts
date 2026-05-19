import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Permission =
  | "complaints"
  | "maintenance"
  | "polls"
  | "sinkingFund"
  | "contacts"
  | "gasBilling"
  | "adminControl";

export const ALL_PERMISSIONS: Permission[] = [
  "complaints",
  "maintenance",
  "polls",
  "sinkingFund",
  "contacts",
  "gasBilling",
  "adminControl",
];

export const PERMISSION_META: Record<Permission, { label: string; icon: string; description: string }> = {
  complaints:   { label: "Complaints",    icon: "🚨", description: "View & manage resident complaints" },
  maintenance:  { label: "Maintenance",   icon: "💰", description: "Track & update maintenance payments" },
  polls:        { label: "Polls",         icon: "📊", description: "Create & manage community polls" },
  sinkingFund:  { label: "Sinking Fund",  icon: "🏦", description: "Manage sinking fund records" },
  contacts:     { label: "Contacts",      icon: "📞", description: "Add & manage important contacts" },
  gasBilling:   { label: "Gas Billing",   icon: "🔥", description: "Manage gas billing & payments" },
  adminControl: { label: "Admin Control", icon: "🛡", description: "Grant/revoke admin access (supreme only)" },
};

export interface ResidentPermissions {
  role: string; // "supreme_admin" | "admin" | "resident"
  adminPermissions: Permission[];
}

// ─── Core helpers ─────────────────────────────────────────────────────────────

export function isSupremeAdmin(resident: ResidentPermissions | null | undefined): boolean {
  return resident?.role === "supreme_admin";
}

export function hasPermission(
  resident: ResidentPermissions | null | undefined,
  permission: Permission
): boolean {
  if (!resident) return false;
  if (isSupremeAdmin(resident)) return true;
  if (resident.role !== "admin") return false;
  return resident.adminPermissions?.includes(permission) ?? false;
}

export function isAdmin(resident: ResidentPermissions | null | undefined): boolean {
  return resident?.role === "admin" || resident?.role === "supreme_admin";
}

export function getAdminPermissions(resident: ResidentPermissions | null | undefined): Permission[] {
  if (!resident) return [];
  if (isSupremeAdmin(resident)) return [...ALL_PERMISSIONS];
  if (resident.role !== "admin") return [];
  return resident.adminPermissions ?? [];
}

// ─── Firestore fetch ──────────────────────────────────────────────────────────

export async function fetchResidentPermissions(uid: string): Promise<ResidentPermissions | null> {
  try {
    const snap = await getDoc(doc(db, "residents", uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      role: data.role ?? "resident",
      adminPermissions: data.adminPermissions ?? [],
    };
  } catch {
    return null;
  }
}

// ─── Audit log ────────────────────────────────────────────────────────────────

export async function writeAuditLog(entry: {
  action: "grant_admin" | "revoke_admin" | "permission_change";
  grantedBy: string;
  grantedByName: string;
  targetUserId: string;
  targetName: string;
  targetApartment?: string;
  previousPermissions?: Permission[];
  newPermissions?: Permission[];
  previousRole?: string;
  newRole?: string;
}) {
  try {
    await addDoc(collection(db, "auditLog"), {
      ...entry,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error("Audit log error:", err);
  }
}
