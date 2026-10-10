import { DEFAULT_AUTH_ROUTE } from "./hash-router";
import {
  canReadEquipment,
  canEditEquipment,
} from "../modules/equipment-permissions/equipment-permissions";
import {
  canReadPpe,
  canManageEmployeeSizes,
} from "../modules/ppe-permissions/ppe-permissions";
import {
  isAdministrator,
  canViewCalendar,
  canManageChecklists,
  canManageProductionCalendar,
} from "../shared/lib/roles";

export function getDefaultAuthRoute(role: unknown) {
  return role === "accounting_specialist" || role === "ppe_specialist"
    ? "#/ppe"
    : DEFAULT_AUTH_ROUTE;
}

export function canAccessWorkspaceRoute(role: unknown, route: string) {
  const path = route.split("?")[0];
  const knownRole = typeof role === "string" ? role : null;
  if (path === "#/search") return canReadEquipment(role) || canReadPpe(role);
  if (path === "#/profile") return true;
  if (
    path === "#/ppe" ||
    /^#\/ppe\/(employees|positions)\/[1-9]\d*$/.test(path)
  )
    return canReadPpe(role);
  if (path.startsWith("#/ppe")) return false;
  if (path === "#/dictionaries")
    return isAdministrator(role) || canManageEmployeeSizes(role);
  if (path === "#/users" || path.startsWith("#/users/"))
    return isAdministrator(role);
  if (path === "#/production-calendar")
    return canManageProductionCalendar(knownRole);
  if (path === "#/calendar") return canViewCalendar(knownRole);
  if (path === "#/checklist-admin" || path.startsWith("#/checklist-admin/"))
    return canManageChecklists(knownRole);
  if (path === "#/equipment/create" || /^#\/equipment\/[^/]+\/edit/.test(path))
    return canEditEquipment(knownRole);
  return canReadEquipment(role);
}
