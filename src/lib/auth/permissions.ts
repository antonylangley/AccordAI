export type AccordRole = "owner" | "admin" | "member" | "viewer";

export function canEditOrganization(role: AccordRole) {
  return role === "owner" || role === "admin";
}

export function canManagePolicies(role: AccordRole) {
  return role === "owner" || role === "admin";
}

export function canManageMembers(role: AccordRole) {
  return role === "owner" || role === "admin";
}

export function canDeleteOrganization(role: AccordRole) {
  return role === "owner";
}
