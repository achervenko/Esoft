export const USER_ROLES = ["admin", "chief_engineer", "engineer", "operator", "auditor", "ppe_specialist", "accounting_specialist", "storekeeper"] as const;
export type AppRole = (typeof USER_ROLES)[number];

export function getUserRoles(role: unknown): AppRole[] {
  if (typeof role !== "string") return [];
  return [...new Set(role.split(",").map((value) => value.trim()).filter(
    (value): value is AppRole => (USER_ROLES as readonly string[]).includes(value),
  ))];
}

export function hasRole(role: unknown, target: AppRole) {
  return getUserRoles(role).includes(target);
}
