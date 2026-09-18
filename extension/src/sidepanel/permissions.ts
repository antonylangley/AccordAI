import type { GuardRole } from "../auth/types";

export function canAccessDashboard(role: GuardRole | undefined): boolean {
  return role === "owner" || role === "admin";
}
