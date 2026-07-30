export function canManageChecklists(role: string | null | undefined) {
  return role === "admin" || role === "chief_engineer";
}

export function canManageProductionCalendar(role: string | null | undefined) {
  return role === "admin";
}
