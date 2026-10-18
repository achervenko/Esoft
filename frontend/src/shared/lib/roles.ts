import { hasPermission } from "./permissions";

export function canManageChecklists(permissions: unknown) {
  return hasPermission(permissions, "checklists.manage");
}

export function canViewCalendar(permissions: unknown) {
  return hasPermission(permissions, "calendar.read");
}

export function canManageProductionCalendar(permissions: unknown) {
  return hasPermission(permissions, "calendar.manage");
}

export function canManageUsers(permissions: unknown) {
  return hasPermission(permissions, "users.manage");
}
