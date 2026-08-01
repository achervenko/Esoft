export function canManageChecklists(role: string | null | undefined) {
  return role === "admin" || role === "chief_engineer";
}

export function canViewCalendar(role: string | null | undefined) {
  return role === "admin" || role === "chief_engineer" || role === "engineer";
}

export function canManageProductionCalendar(role: string | null | undefined) {
  return role === "admin";
}
